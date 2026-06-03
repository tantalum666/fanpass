import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { DemoStore } from "../../common/demo-store";
import { CheckinRecord, TicketRecord } from "../../common/domain";
import { PrismaService } from "../../common/prisma.service";
import { FanPassSession } from "../../common/session";
import {
  isProductionLikeEnvironment,
  readIntegerConfig,
} from "../../config/security-config";
import { AuditService } from "../audit/audit.service";
import { TicketOwnershipSideEffectsService } from "../side-effects/ticket-ownership-side-effects.service";
import { TicketsService } from "../tickets/tickets.service";

export interface SignedQrPayload {
  ticketId: string;
  eventId: string;
  ownerIdHash: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

export type RedemptionResult =
  | "ACCEPTED"
  | "DUPLICATE"
  | "EXPIRED"
  | "INVALID_SIGNATURE"
  | "INVALID_TICKET"
  | "OWNER_MISMATCH"
  | "NOT_ACTIVE"
  | "CANCELLED"
  | "ERROR";

@Injectable()
export class VerificationService {
  private readonly consumedNonces = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly store: DemoStore,
    private readonly audit: AuditService,
    private readonly tickets: TicketsService,
    private readonly ticketOwnership: TicketOwnershipSideEffectsService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  reset() {
    this.consumedNonces.clear();
  }

  createPayload(
    ticketId: string,
    session?: FanPassSession,
  ): SignedQrPayload | Promise<SignedQrPayload> {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.createPrismaPayload(prisma, ticketId, session);
    }

    const ticket = this.tickets.getRawTicket(ticketId);
    this.assertCanGenerateForSession(ticket, session);
    this.tickets.assertCanGenerateEntryPayload(ticket);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + this.ttlMs());
    const payload = {
      ticketId: ticket.id,
      eventId: ticket.eventId,
      ownerIdHash: this.hash(ticket.ownerId),
      nonce: `nonce_${randomUUID()}`,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    return {
      ...payload,
      signature: this.sign(payload),
    };
  }

  async redeem(
    payload: SignedQrPayload,
    scannerUserId: string,
    gate: string,
    session?: FanPassSession,
  ) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.redeemPrismaPayload(
        prisma,
        payload,
        scannerUserId,
        gate,
        session,
      );
    }

    this.assertMemoryGateAssignment(payload.eventId, gate, session);

    try {
      this.verifySignature(payload);
    } catch (error) {
      this.recordCheckin(payload, scannerUserId, gate, "INVALID_SIGNATURE");
      this.throwRedemptionFailure("INVALID_SIGNATURE", "Invalid QR signature");
    }
    if (new Date(payload.expiresAt).getTime() < Date.now()) {
      this.recordCheckin(payload, scannerUserId, gate, "EXPIRED");
      this.throwRedemptionFailure("EXPIRED", "QR payload has expired");
    }
    if (this.consumedNonces.has(payload.nonce)) {
      this.recordCheckin(payload, scannerUserId, gate, "DUPLICATE");
      this.throwRedemptionFailure(
        "DUPLICATE",
        "QR nonce has already been used",
      );
    }

    const ticket = this.tickets.getRawTicket(payload.ticketId);
    if (
      ticket.eventId !== payload.eventId ||
      this.hash(ticket.ownerId) !== payload.ownerIdHash
    ) {
      this.recordCheckin(payload, scannerUserId, gate, "OWNER_MISMATCH");
      this.throwRedemptionFailure(
        "OWNER_MISMATCH",
        "QR payload does not match current ticket ownership",
      );
    }
    try {
      this.tickets.assertCanRedeem(ticket);
    } catch (error) {
      const result = ticket.status === "CANCELLED" ? "CANCELLED" : "NOT_ACTIVE";
      this.recordCheckin(payload, scannerUserId, gate, result);
      this.throwRedemptionFailure(
        result,
        error instanceof Error ? error.message : "Ticket cannot be redeemed",
      );
    }

    const ownership = await this.ticketOwnership.redeemTicket({
      ticketId: ticket.id,
      tokenId: ticket.tokenId,
    });
    ticket.status = "REDEEMED";
    this.consumedNonces.add(payload.nonce);
    const checkin = this.recordCheckin(
      payload,
      scannerUserId,
      gate,
      "ACCEPTED",
    );
    this.audit.record(scannerUserId, "TICKET_REDEEMED", "ticket", ticket.id, {
      gate,
      nonce: payload.nonce,
      ownershipAdapter: ownership.adapter,
      ownershipRef: ownership.ownershipRef,
      transactionHash: ownership.transactionHash,
    });

    return {
      ticketId: ticket.id,
      eventId: ticket.eventId,
      result: "ACCEPTED",
      redeemedAt: checkin.checkedInAt,
    };
  }

  async checkinSummary(
    eventId: string,
    gate: string,
    session?: FanPassSession,
  ) {
    const prisma = this.prismaClient();
    if (prisma) {
      await this.assertPrismaGateAccess(prisma, eventId, gate, session);
      const checkins = await prisma.checkin.findMany({
        where: {
          gate,
          ticket: {
            eventId,
          },
        },
        orderBy: {
          checkedInAt: "desc",
        },
      });
      return this.buildCheckinSummary(
        eventId,
        gate,
        checkins.map((checkin: { result: string; checkedInAt: Date }) => ({
          result: checkin.result as RedemptionResult,
          checkedInAt: checkin.checkedInAt,
        })),
      );
    }

    this.assertMemoryGateAssignment(eventId, gate, session);

    const checkins = this.store.checkins.filter((checkin) => {
      const ticket = this.store.tickets.find(
        (candidate) => candidate.id === checkin.ticketId,
      );
      return ticket?.eventId === eventId && checkin.gate === gate;
    });
    return this.buildCheckinSummary(eventId, gate, checkins);
  }

  private sign(payload: Omit<SignedQrPayload, "signature">) {
    return createHmac("sha256", this.secret())
      .update(this.canonical(payload))
      .digest("hex");
  }

  private verifySignature(payload: SignedQrPayload) {
    const expected = this.sign({
      ticketId: payload.ticketId,
      eventId: payload.eventId,
      ownerIdHash: payload.ownerIdHash,
      nonce: payload.nonce,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    });
    const actual = Buffer.from(payload.signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    if (
      actual.length !== expectedBuffer.length ||
      !timingSafeEqual(actual, expectedBuffer)
    ) {
      throw new BadRequestException("Invalid QR signature");
    }
  }

  private canonical(payload: Record<string, string>) {
    return JSON.stringify(
      Object.keys(payload)
        .sort()
        .reduce<Record<string, string>>((accumulator, key) => {
          accumulator[key] = payload[key];
          return accumulator;
        }, {}),
    );
  }

  private hash(value: string) {
    return createHmac("sha256", this.secret()).update(value).digest("hex");
  }

  private secret() {
    const configured = this.config.get<string>("QR_SIGNING_SECRET");
    if (configured) {
      return configured;
    }
    if (isProductionLikeEnvironment()) {
      throw new Error("QR_SIGNING_SECRET is required in production");
    }
    return "fanpass-local-dev-secret";
  }

  private ttlMs() {
    const ttlSeconds = readIntegerConfig(this.config, "QR_TTL_SECONDS", 300);
    return ttlSeconds * 1000;
  }

  private recordCheckin(
    payload: Pick<SignedQrPayload, "ticketId" | "nonce">,
    scannerUserId: string,
    gate: string,
    result: Parameters<DemoStore["recordCheckin"]>[0]["result"],
  ) {
    return this.store.recordCheckin({
      ticketId: payload.ticketId,
      scannerUserId,
      gate,
      nonce: payload.nonce,
      result,
    });
  }

  private async createPrismaPayload(
    prisma: PrismaService,
    ticketId: string,
    session?: FanPassSession,
  ): Promise<SignedQrPayload> {
    const ticket = this.mapPrismaTicket(
      await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } }),
    );
    this.assertCanGenerateForSession(ticket, session);
    this.tickets.assertCanGenerateEntryPayload(ticket);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + this.ttlMs());
    const payload = {
      ticketId: ticket.id,
      eventId: ticket.eventId,
      ownerIdHash: this.hash(ticket.ownerId),
      nonce: `nonce_${randomUUID()}`,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    return {
      ...payload,
      signature: this.sign(payload),
    };
  }

  private async redeemPrismaPayload(
    prisma: PrismaService,
    payload: SignedQrPayload,
    scannerUserId: string,
    gate: string,
    session?: FanPassSession,
  ) {
    await this.assertPrismaGateAccess(prisma, payload.eventId, gate, session);

    try {
      this.verifySignature(payload);
    } catch (error) {
      await this.recordPrismaCheckin(
        prisma,
        payload,
        scannerUserId,
        gate,
        "INVALID_SIGNATURE",
      );
      this.throwRedemptionFailure("INVALID_SIGNATURE", "Invalid QR signature");
    }

    if (new Date(payload.expiresAt).getTime() < Date.now()) {
      await this.recordPrismaCheckin(
        prisma,
        payload,
        scannerUserId,
        gate,
        "EXPIRED",
      );
      this.throwRedemptionFailure("EXPIRED", "QR payload has expired");
    }

    const consumedNonce = await prisma.checkin.findFirst({
      where: {
        nonce: payload.nonce,
        result: "ACCEPTED",
      },
    });
    if (consumedNonce) {
      await this.recordPrismaCheckin(
        prisma,
        payload,
        scannerUserId,
        gate,
        "DUPLICATE",
      );
      this.throwRedemptionFailure(
        "DUPLICATE",
        "QR nonce has already been used",
      );
    }

    const ticket = this.mapPrismaTicket(
      await prisma.ticket.findUniqueOrThrow({
        where: { id: payload.ticketId },
      }),
    );
    if (
      ticket.eventId !== payload.eventId ||
      this.hash(ticket.ownerId) !== payload.ownerIdHash
    ) {
      await this.recordPrismaCheckin(
        prisma,
        payload,
        scannerUserId,
        gate,
        "OWNER_MISMATCH",
      );
      this.throwRedemptionFailure(
        "OWNER_MISMATCH",
        "QR payload does not match current ticket ownership",
      );
    }

    try {
      this.tickets.assertCanRedeem(ticket);
    } catch (error) {
      const result = ticket.status === "CANCELLED" ? "CANCELLED" : "NOT_ACTIVE";
      await this.recordPrismaCheckin(
        prisma,
        payload,
        scannerUserId,
        gate,
        result,
      );
      this.throwRedemptionFailure(
        result,
        error instanceof Error ? error.message : "Ticket cannot be redeemed",
      );
    }

    const ownership = await this.ticketOwnership.redeemTicket({
      ticketId: ticket.id,
      tokenId: ticket.tokenId,
    });

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: "REDEEMED" },
        });
        const checkin = await tx.checkin.create({
          data: {
            id: `chk_${randomUUID()}`,
            ticketId: ticket.id,
            scannerUserId,
            gate,
            nonce: payload.nonce,
            acceptedNonce: payload.nonce,
            result: "ACCEPTED",
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: scannerUserId,
            action: "TICKET_REDEEMED",
            entityType: "ticket",
            entityId: ticket.id,
            metadataJson: {
              gate,
              nonce: payload.nonce,
              ownershipAdapter: ownership.adapter,
              ownershipRef: ownership.ownershipRef,
              transactionHash: ownership.transactionHash,
            },
          },
        });
        return checkin;
      },
    );

    return {
      ticketId: ticket.id,
      eventId: ticket.eventId,
      result: "ACCEPTED",
      redeemedAt: result.checkedInAt.toISOString(),
    };
  }

  private async recordPrismaCheckin(
    prisma: PrismaService,
    payload: Pick<SignedQrPayload, "ticketId" | "nonce">,
    scannerUserId: string,
    gate: string,
    result: CheckinRecord["result"],
  ) {
    const [ticket, scanner] = await Promise.all([
      prisma.ticket.findUnique({ where: { id: payload.ticketId } }),
      prisma.user.findUnique({ where: { id: scannerUserId } }),
    ]);
    if (!ticket || !scanner) {
      return null;
    }
    return prisma.checkin.create({
      data: {
        id: `chk_${randomUUID()}`,
        ticketId: payload.ticketId,
        scannerUserId,
        gate,
        nonce: payload.nonce,
        result,
      },
    });
  }

  private mapPrismaTicket(ticket: {
    id: string;
    tokenId: string | null;
    eventId: string;
    ticketTypeId: string;
    ownerId: string;
    seatHash: string | null;
    status: TicketRecord["status"];
    transferCount: number;
    metadataUri: string | null;
  }): TicketRecord {
    return {
      id: ticket.id,
      tokenId: ticket.tokenId,
      eventId: ticket.eventId,
      ticketTypeId: ticket.ticketTypeId,
      ownerId: ticket.ownerId,
      seatHash: ticket.seatHash,
      status: ticket.status,
      transferCount: ticket.transferCount,
      metadataUri: ticket.metadataUri,
    };
  }

  private assertCanGenerateForSession(
    ticket: TicketRecord,
    session: FanPassSession | undefined,
  ) {
    if (!session) {
      return;
    }
    if (session.role === "ADMIN") {
      return;
    }
    if (session.role !== "FAN" || ticket.ownerId !== session.userId) {
      throw new ForbiddenException(
        "Only the ticket owner can generate this entry code",
      );
    }
  }

  private assertMemoryGateAssignment(
    eventId: string,
    gate: string,
    session: FanPassSession | undefined,
  ) {
    if (!session || session.role === "ADMIN") {
      return;
    }
    if (session.role === "ORGANIZER") {
      const organizer = this.store.organizers.find(
        (candidate) => candidate.userId === session.userId,
      );
      const event = this.store.events.find(
        (candidate) =>
          candidate.id === eventId && candidate.organizerId === organizer?.id,
      );
      if (event) {
        return;
      }
      throw new ForbiddenException("Organizer is not assigned to this event");
    }
    if (session.role !== "GATE_STAFF") {
      throw new ForbiddenException("Gate access is not assigned");
    }
    const assignment = this.store.gateAssignments.find(
      (candidate) =>
        candidate.eventId === eventId &&
        candidate.gate === gate &&
        candidate.staffUserId === session.userId &&
        candidate.active,
    );
    if (!assignment) {
      throw new ForbiddenException("Gate staff is not assigned to this gate");
    }
  }

  private async assertPrismaGateAccess(
    prisma: PrismaService,
    eventId: string,
    gate: string,
    session: FanPassSession | undefined,
  ) {
    if (!session || session.role === "ADMIN") {
      return;
    }
    if (session.role === "ORGANIZER") {
      const organizerEvent = await prisma.event.findFirst({
        where: {
          id: eventId,
          organizer: {
            userId: session.userId,
          },
        },
      });
      if (organizerEvent) {
        return;
      }
      throw new ForbiddenException("Organizer is not assigned to this event");
    }
    if (session.role !== "GATE_STAFF") {
      throw new ForbiddenException("Gate access is not assigned");
    }
    const assignment = await prisma.gateAssignment.findFirst({
      where: {
        eventId,
        gate,
        staffUserId: session.userId,
        active: true,
      },
    });
    if (!assignment) {
      throw new ForbiddenException("Gate staff is not assigned to this gate");
    }
  }

  private prismaClient() {
    return process.env.FANPASS_DATA_SOURCE === "prisma"
      ? this.prisma
      : undefined;
  }

  private throwRedemptionFailure(
    result: Exclude<RedemptionResult, "ACCEPTED">,
    message: string,
  ): never {
    throw new BadRequestException({
      result,
      message,
    });
  }

  private buildCheckinSummary(
    eventId: string,
    gate: string,
    checkins: Array<{ result: RedemptionResult; checkedInAt: Date | string }>,
  ) {
    const results = checkins.reduce<Record<RedemptionResult, number>>(
      (summary, checkin) => {
        summary[checkin.result] += 1;
        return summary;
      },
      {
        ACCEPTED: 0,
        DUPLICATE: 0,
        EXPIRED: 0,
        INVALID_SIGNATURE: 0,
        INVALID_TICKET: 0,
        OWNER_MISMATCH: 0,
        NOT_ACTIVE: 0,
        CANCELLED: 0,
        ERROR: 0,
      },
    );

    return {
      eventId,
      gate,
      total: checkins.length,
      accepted: results.ACCEPTED,
      rejected: checkins.length - results.ACCEPTED,
      results,
      lastCheckedInAt:
        checkins[0]?.checkedInAt instanceof Date
          ? checkins[0].checkedInAt.toISOString()
          : (checkins[0]?.checkedInAt ?? null),
    };
  }
}
