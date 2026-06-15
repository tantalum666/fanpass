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

const QR_TTL_SECONDS = 30;

export interface SignedQrPayload {
  v?: number;
  credentialId?: string;
  ticketId: string;
  eventId: string;
  ticketTypeId?: string;
  ownerIdHash: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  entryMode?: "qr" | "nfc";
  kid?: string;
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

type EntryCredentialStatus = "ACTIVE" | "CONSUMED" | "REVOKED" | "EXPIRED";

interface MemoryEntryCredential {
  credentialId: string;
  ticketId: string;
  eventId: string;
  ticketTypeId?: string;
  ownerIdHash: string;
  nonce: string;
  entryMode: "qr" | "nfc";
  keyId?: string;
  status: EntryCredentialStatus;
  issuedAt: string;
  expiresAt: string;
  revokedReason?: string;
  supersededByCredentialId?: string;
}

@Injectable()
export class VerificationService {
  private readonly consumedNonces = new Set<string>();
  private readonly activeRedemptionClaims = new Set<string>();
  private readonly entryCredentials = new Map<string, MemoryEntryCredential>();

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
    this.activeRedemptionClaims.clear();
    this.entryCredentials.clear();
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
    const payload = this.buildUnsignedPayload(ticket, "qr");
    this.revokeActiveMemoryCredentials(ticket.id, payload.credentialId);
    this.entryCredentials.set(payload.credentialId, {
      credentialId: payload.credentialId,
      ticketId: payload.ticketId,
      eventId: payload.eventId,
      ticketTypeId: payload.ticketTypeId,
      ownerIdHash: payload.ownerIdHash,
      nonce: payload.nonce,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      entryMode: payload.entryMode,
      keyId: payload.kid,
      status: "ACTIVE",
    });
    return this.attachSignature(payload);
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
      this.expireMemoryCredential(payload.credentialId);
      this.recordCheckin(payload, scannerUserId, gate, "EXPIRED");
      this.throwRedemptionFailure("EXPIRED", "QR payload has expired");
    }
    const memoryCredentialResult = this.assertMemoryCredentialActive(payload);
    if (memoryCredentialResult) {
      this.recordCheckin(payload, scannerUserId, gate, memoryCredentialResult);
      this.throwRedemptionFailure(
        memoryCredentialResult,
        this.credentialFailureMessage(memoryCredentialResult),
      );
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
    if (ticket.status === "REDEEMED") {
      this.recordCheckin(payload, scannerUserId, gate, "DUPLICATE");
      this.throwRedemptionFailure(
        "DUPLICATE",
        "Ticket has already been redeemed",
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

    try {
      this.claimMemoryRedemption(payload);
    } catch (error) {
      this.recordCheckin(payload, scannerUserId, gate, "DUPLICATE");
      throw error;
    }
    ticket.status = "REDEEMED";
    this.consumedNonces.add(payload.nonce);
    this.consumeMemoryCredential(payload.credentialId);
    const checkin = this.recordCheckin(payload, scannerUserId, gate, "ACCEPTED");
    this.dispatchOwnershipRedeem({
      ticketId: ticket.id,
      tokenId: ticket.tokenId,
    });
    this.audit.record(scannerUserId, "TICKET_REDEEMED", "ticket", ticket.id, {
      gate,
      nonce: payload.nonce,
      ownershipAdapter: "deferred",
      ownershipRef: `pending:ownership-redeem:${ticket.id}`,
      transactionHash: null,
    });
    this.releaseMemoryRedemptionClaim(payload);

    return {
      ticketId: ticket.id,
      eventId: ticket.eventId,
      result: "ACCEPTED",
      redeemedAt: checkin.checkedInAt,
    };
  }

  async validateNfcPayload(
    ndefPayload: string,
    eventId: string,
    scannerUserId: string,
    gate: string,
    session?: FanPassSession,
  ) {
    const payload = this.parseSignedEntryPayload(ndefPayload);
    if (payload.eventId !== eventId) {
      this.throwRedemptionFailure(
        "OWNER_MISMATCH",
        "NFC payload belongs to a different event",
      );
    }
    return this.redeem(
      {
        ...payload,
        entryMode: payload.entryMode ?? "nfc",
      },
      scannerUserId,
      gate,
      session,
    );
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
      .digest("base64url");
  }

  private verifySignature(payload: SignedQrPayload) {
    const expected = this.sign({
      v: payload.v,
      credentialId: payload.credentialId,
      ticketId: payload.ticketId,
      eventId: payload.eventId,
      ticketTypeId: payload.ticketTypeId,
      ownerIdHash: payload.ownerIdHash,
      nonce: payload.nonce,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      entryMode: payload.entryMode,
      kid: payload.kid,
    });
    const actual = this.signatureBuffer(payload.signature);
    const expectedBuffer = this.signatureBuffer(expected);
    if (
      actual.length !== expectedBuffer.length ||
      !timingSafeEqual(actual, expectedBuffer)
    ) {
      throw new BadRequestException("Invalid QR signature");
    }
  }

  private canonical(payload: Record<string, string | number | undefined>) {
    return JSON.stringify(
      Object.keys(payload)
        .filter((key) => payload[key] !== undefined)
        .sort()
        .reduce<Record<string, string | number>>((accumulator, key) => {
          accumulator[key] = payload[key] as string | number;
          return accumulator;
        }, {}),
    );
  }

  private signatureBuffer(signature: string) {
    if (/^[a-f0-9]{64}$/i.test(signature)) {
      return Buffer.from(signature, "hex");
    }
    return Buffer.from(signature, "base64url");
  }

  private hash(value: string) {
    return createHmac("sha256", this.secret()).update(value).digest("hex");
  }

  private keyId() {
    return this.config.get<string>("QR_SIGNING_KEY_ID") ?? "local-dev-key-v1";
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
    const ttlSeconds = readIntegerConfig(
      this.config,
      "QR_TTL_SECONDS",
      QR_TTL_SECONDS,
    );
    return Math.min(ttlSeconds, QR_TTL_SECONDS) * 1000;
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
    const payload = this.buildUnsignedPayload(ticket, "qr");
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.entryCredential.updateMany({
        where: {
          ticketId: ticket.id,
          status: "ACTIVE",
        },
        data: {
          status: "REVOKED",
          revokedReason: "SUPERSEDED",
          supersededByCredentialId: payload.credentialId,
        },
      });
      await tx.entryCredential.create({
        data: {
          id: payload.credentialId,
          ticketId: payload.ticketId,
          eventId: payload.eventId,
          ticketTypeId: payload.ticketTypeId,
          ownerIdHash: payload.ownerIdHash,
          nonce: payload.nonce,
          entryMode: payload.entryMode,
          keyId: payload.kid,
          status: "ACTIVE",
          issuedAt: new Date(payload.issuedAt),
          expiresAt: new Date(payload.expiresAt),
          createdByUserId: session?.userId ?? null,
        },
      });
    });
    return this.attachSignature(payload);
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
      await this.expirePrismaCredential(prisma, payload.credentialId);
      await this.recordPrismaCheckin(
        prisma,
        payload,
        scannerUserId,
        gate,
        "EXPIRED",
      );
      this.throwRedemptionFailure("EXPIRED", "QR payload has expired");
    }

    const credentialResult = await this.assertPrismaCredentialActive(
      prisma,
      payload,
    );
    if (credentialResult) {
      await this.recordPrismaCheckin(
        prisma,
        payload,
        scannerUserId,
        gate,
        credentialResult,
      );
      this.throwRedemptionFailure(
        credentialResult,
        this.credentialFailureMessage(credentialResult),
      );
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
    if (ticket.status === "REDEEMED") {
      await this.recordPrismaCheckin(
        prisma,
        payload,
        scannerUserId,
        gate,
        "DUPLICATE",
      );
      this.throwRedemptionFailure(
        "DUPLICATE",
        "Ticket has already been redeemed",
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

    const redeemTicket = {
      ticketId: ticket.id,
      tokenId: ticket.tokenId,
    };

    const result = await this.acceptPrismaRedemption(
      prisma,
      payload,
      ticket,
      scannerUserId,
      gate,
      redeemTicket,
    );
    if (!this.ticketOwnership.usesOutboxProofSync()) {
      this.dispatchOwnershipRedeem(redeemTicket);
    }

    return {
      ticketId: ticket.id,
      eventId: ticket.eventId,
      result: "ACCEPTED",
      redeemedAt: result.checkin.checkedInAt.toISOString(),
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

  private async acceptPrismaRedemption(
    prisma: PrismaService,
    payload: SignedQrPayload,
    ticket: TicketRecord,
    scannerUserId: string,
    gate: string,
    redeemTicket: { ticketId: string; tokenId: string | null },
  ) {
    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const ticketClaim = await tx.ticket.updateMany({
          where: {
            id: ticket.id,
            status: {
              in: ["ACTIVE", "TRANSFERRED"],
            },
          },
          data: { status: "REDEEMED" },
        });
        if (ticketClaim.count !== 1) {
          this.throwRedemptionFailure(
            "DUPLICATE",
            "Ticket has already been redeemed",
          );
        }

        const ownership = this.ticketOwnership.usesOutboxProofSync()
          ? await this.ticketOwnership.redeemTicket(redeemTicket, {
              writer: tx,
            })
          : {
              adapter: "deferred",
              status: "PENDING",
              tokenId: ticket.tokenId ?? "pending",
              ownershipRef: `pending:ownership-redeem:${ticket.id}`,
              transactionHash: null,
            };
        const checkin = await tx.checkin.create({
          data: {
            id: `chk_${randomUUID()}`,
            ticketId: ticket.id,
            scannerUserId,
            gate,
            nonce: payload.nonce,
            acceptedNonce: payload.nonce,
            acceptedTicketId: ticket.id,
            result: "ACCEPTED",
          } as Prisma.CheckinUncheckedCreateInput,
        });
        await this.consumePrismaCredential(tx, payload, checkin.id, {
          scannerUserId,
          gate,
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
        return { checkin, ownership };
      });
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        await this.recordPrismaCheckin(
          prisma,
          payload,
          scannerUserId,
          gate,
          "DUPLICATE",
        );
        this.throwRedemptionFailure(
          "DUPLICATE",
          "Ticket or QR nonce has already been redeemed",
        );
      }
      throw error;
    }
  }

  private parseSignedEntryPayload(value: string): SignedQrPayload {
    const normalized = this.normalizeNdefPayload(value);
    let parsed: unknown;
    try {
      parsed = JSON.parse(normalized);
    } catch (error) {
      throw new BadRequestException({
        result: "INVALID_TICKET",
        message: "NFC payload is not valid FanPass entry JSON",
      });
    }
    if (!this.isSignedEntryPayload(parsed)) {
      throw new BadRequestException({
        result: "INVALID_TICKET",
        message: "NFC payload is missing required FanPass entry fields",
      });
    }
    return parsed;
  }

  private dispatchOwnershipRedeem(input: {
    ticketId: string;
    tokenId: string | null;
  }) {
    void this.ticketOwnership.redeemTicket(input).catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Ownership redeem failed";
      console.error(
        `Ownership redeem side effect failed for ${input.ticketId}: ${message}`,
      );
    });
  }

  private normalizeNdefPayload(value: string) {
    const trimmed = value.trim();
    if (trimmed.startsWith("fanpass://entry?")) {
      const url = new URL(trimmed);
      const encodedPayload = url.searchParams.get("payload");
      if (!encodedPayload) {
        throw new BadRequestException({
          result: "INVALID_TICKET",
          message: "NFC URI is missing FanPass payload",
        });
      }
      return encodedPayload;
    }
    return trimmed;
  }

  private buildUnsignedPayload(
    ticket: TicketRecord,
    entryMode: "qr" | "nfc",
  ): Omit<SignedQrPayload, "signature"> & {
    credentialId: string;
    ticketTypeId: string;
    entryMode: "qr" | "nfc";
    kid: string;
  } {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + this.ttlMs());
    return {
      v: 1,
      credentialId: `cred_${randomUUID()}`,
      ticketId: ticket.id,
      eventId: ticket.eventId,
      ticketTypeId: ticket.ticketTypeId,
      ownerIdHash: this.hash(ticket.ownerId),
      nonce: `nonce_${randomUUID()}`,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      entryMode,
      kid: this.keyId(),
    };
  }

  private attachSignature(
    payload: Omit<SignedQrPayload, "signature">,
  ): SignedQrPayload {
    return {
      ...payload,
      signature: this.sign(payload),
    };
  }

  private revokeActiveMemoryCredentials(
    ticketId: string,
    supersededByCredentialId: string,
  ) {
    for (const credential of this.entryCredentials.values()) {
      if (credential.ticketId === ticketId && credential.status === "ACTIVE") {
        credential.status = "REVOKED";
        credential.revokedReason = "SUPERSEDED";
        credential.supersededByCredentialId = supersededByCredentialId;
      }
    }
  }

  private expireMemoryCredential(credentialId: string | undefined) {
    if (!credentialId) {
      return;
    }
    const credential = this.entryCredentials.get(credentialId);
    if (credential?.status === "ACTIVE") {
      credential.status = "EXPIRED";
    }
  }

  private consumeMemoryCredential(credentialId: string | undefined) {
    if (!credentialId) {
      return;
    }
    const credential = this.entryCredentials.get(credentialId);
    if (credential?.status === "ACTIVE") {
      credential.status = "CONSUMED";
    }
  }

  private claimMemoryRedemption(payload: SignedQrPayload) {
    const nonceClaim = `nonce:${payload.nonce}`;
    const ticketClaim = `ticket:${payload.ticketId}`;
    if (
      this.consumedNonces.has(payload.nonce) ||
      this.activeRedemptionClaims.has(nonceClaim) ||
      this.activeRedemptionClaims.has(ticketClaim)
    ) {
      this.throwRedemptionFailure(
        "DUPLICATE",
        "Ticket or QR nonce has already been redeemed",
      );
    }
    this.activeRedemptionClaims.add(nonceClaim);
    this.activeRedemptionClaims.add(ticketClaim);
  }

  private releaseMemoryRedemptionClaim(payload: SignedQrPayload) {
    this.activeRedemptionClaims.delete(`nonce:${payload.nonce}`);
    this.activeRedemptionClaims.delete(`ticket:${payload.ticketId}`);
  }

  private assertMemoryCredentialActive(
    payload: SignedQrPayload,
  ): Exclude<RedemptionResult, "ACCEPTED"> | null {
    if (!payload.credentialId) {
      return null;
    }
    const credential = this.entryCredentials.get(payload.credentialId);
    if (!credential) {
      return "INVALID_TICKET";
    }
    if (!this.credentialMatchesPayload(credential, payload)) {
      return "OWNER_MISMATCH";
    }
    if (credential.status === "CONSUMED") {
      return "DUPLICATE";
    }
    if (credential.status === "REVOKED") {
      return "INVALID_TICKET";
    }
    if (
      credential.status === "EXPIRED" ||
      new Date(credential.expiresAt).getTime() < Date.now()
    ) {
      credential.status = "EXPIRED";
      return "EXPIRED";
    }
    return null;
  }

  private async assertPrismaCredentialActive(
    prisma: PrismaService,
    payload: SignedQrPayload,
  ): Promise<Exclude<RedemptionResult, "ACCEPTED"> | null> {
    if (!payload.credentialId) {
      return null;
    }
    const credential = await prisma.entryCredential.findUnique({
      where: {
        id: payload.credentialId,
      },
    });
    if (!credential) {
      return "INVALID_TICKET";
    }
    if (!this.credentialMatchesPayload(credential, payload)) {
      return "OWNER_MISMATCH";
    }
    if (credential.status === "CONSUMED") {
      return "DUPLICATE";
    }
    if (credential.status === "REVOKED") {
      return "INVALID_TICKET";
    }
    if (
      credential.status === "EXPIRED" ||
      credential.expiresAt.getTime() < Date.now()
    ) {
      await this.expirePrismaCredential(prisma, payload.credentialId);
      return "EXPIRED";
    }
    return null;
  }

  private credentialMatchesPayload(
    credential: {
      ticketId: string;
      eventId: string;
      ticketTypeId?: string | null;
      ownerIdHash: string;
      nonce: string;
      entryMode: string;
      keyId?: string | null;
    },
    payload: SignedQrPayload,
  ) {
    return (
      credential.ticketId === payload.ticketId &&
      credential.eventId === payload.eventId &&
      (credential.ticketTypeId ?? undefined) === payload.ticketTypeId &&
      credential.ownerIdHash === payload.ownerIdHash &&
      credential.nonce === payload.nonce &&
      credential.entryMode === (payload.entryMode ?? "qr") &&
      (credential.keyId ?? undefined) === payload.kid
    );
  }

  private async expirePrismaCredential(
    prisma: PrismaService,
    credentialId: string | undefined,
  ) {
    if (!credentialId) {
      return;
    }
    await prisma.entryCredential.updateMany({
      where: {
        id: credentialId,
        status: "ACTIVE",
      },
      data: {
        status: "EXPIRED",
      },
    });
  }

  private async consumePrismaCredential(
    writer: Prisma.TransactionClient,
    payload: SignedQrPayload,
    checkinId: string,
    context: { scannerUserId: string; gate: string },
  ) {
    if (!payload.credentialId) {
      return;
    }
    const updated = await writer.entryCredential.updateMany({
      where: {
        id: payload.credentialId,
        status: "ACTIVE",
      },
      data: {
        status: "CONSUMED",
        consumedAt: new Date(),
        consumedCheckinId: checkinId,
        scannerUserId: context.scannerUserId,
        gate: context.gate,
      },
    });
    if (updated.count !== 1) {
      this.throwRedemptionFailure(
        "DUPLICATE",
        "Entry credential has already been used",
      );
    }
  }

  private credentialFailureMessage(
    result: Exclude<RedemptionResult, "ACCEPTED">,
  ) {
    switch (result) {
      case "DUPLICATE":
        return "Entry credential has already been used";
      case "EXPIRED":
        return "Entry credential has expired";
      case "OWNER_MISMATCH":
        return "Entry credential does not match current ticket ownership";
      default:
        return "Entry credential is no longer valid";
    }
  }

  private isUniqueConstraintViolation(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    );
  }

  private isSignedEntryPayload(value: unknown): value is SignedQrPayload {
    if (!value || typeof value !== "object") {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return [
      "ticketId",
      "eventId",
      "ownerIdHash",
      "nonce",
      "issuedAt",
      "expiresAt",
      "signature",
    ].every((field) => typeof candidate[field] === "string");
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
    _gate: string,
    session: FanPassSession | undefined,
  ) {
    if (
      !session ||
      session.role === "ADMIN" ||
      session.role === "GATE_STAFF"
    ) {
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
    throw new ForbiddenException("Gate access is not assigned");
  }

  private async assertPrismaGateAccess(
    prisma: PrismaService,
    eventId: string,
    _gate: string,
    session: FanPassSession | undefined,
  ) {
    if (
      !session ||
      session.role === "ADMIN" ||
      session.role === "GATE_STAFF"
    ) {
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
    throw new ForbiddenException("Gate access is not assigned");
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
