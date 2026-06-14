import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Optional,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { DemoStore } from "../../common/demo-store";
import { TicketRecord } from "../../common/domain";
import { PrismaService } from "../../common/prisma.service";
import { FanPassSession } from "../../common/session";
import { AuditService } from "../audit/audit.service";
import { TicketOwnershipSideEffectsService } from "../side-effects/ticket-ownership-side-effects.service";

export interface IssueTicketInput {
  eventId: string;
  ticketTypeId: string;
  ownerId: string;
  seatHash?: string;
}

export interface TicketProofHistoryItem {
  id: string;
  label: string;
  state: string;
  timestamp: string;
  description: string;
  safeTicketRef: string;
  proofReference?: string;
  externalUrl?: string;
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly store: DemoStore,
    private readonly audit: AuditService,
    private readonly ticketOwnership: TicketOwnershipSideEffectsService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  listTickets(session?: FanPassSession) {
    const prisma = this.prismaClient();
    if (prisma) {
      const eventWhere = this.prismaTicketEventScope(session);
      return prisma.ticket
        .findMany({
          where: eventWhere,
          include: {
            event: true,
            ticketType: true,
          },
          orderBy: {
            id: "asc",
          },
        })
        .then((tickets) =>
          tickets.map((ticket) => this.mapExpandedPrismaTicket(ticket)),
        );
    }

    return this.store.tickets
      .filter((ticket) => this.memoryCanAccessEvent(ticket.eventId, session))
      .map((ticket) => this.expandTicket(ticket.id));
  }

  getTicket(id: string, session?: FanPassSession) {
    const prisma = this.prismaClient();
    if (prisma) {
      return prisma.ticket
        .findUniqueOrThrow({
          where: { id },
          include: {
            event: true,
            ticketType: true,
          },
        })
        .then((ticket) => {
          this.assertPrismaExpandedTicketAccess(ticket, session);
          return this.mapExpandedPrismaTicket(ticket);
        });
    }

    const ticket = this.store.getTicket(id);
    this.assertMemoryEventAccess(ticket.eventId, session);
    return this.expandTicket(ticket.id);
  }

  async getProofHistory(id: string, session?: FanPassSession) {
    const prisma = this.prismaClient();
    if (prisma) {
      const ticket = await prisma.ticket.findUniqueOrThrow({
        where: { id },
        include: {
          event: {
            include: {
              organizer: true,
            },
          },
          ticketType: true,
          checkins: {
            orderBy: {
              checkedInAt: "desc",
            },
            take: 1,
          },
        },
      });
      this.assertPrismaProofAccess(ticket, session);
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityType: "ticket",
          entityId: ticket.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 12,
      });

      return this.buildProofHistory({
        id: ticket.id,
        status: ticket.status,
        transferCount: ticket.transferCount,
        eventTitle: ticket.event.title,
        ticketTypeName: ticket.ticketType.name,
        auditLogs: auditLogs.map((log) => ({
          action: log.action,
          createdAt: log.createdAt.toISOString(),
          metadata: log.metadataJson,
        })),
        latestCheckinAt: ticket.checkins[0]?.checkedInAt.toISOString(),
      });
    }

    const ticket = this.store.getTicket(id);
    this.assertMemoryProofAccess(ticket, session);
    const event = this.store.getEvent(ticket.eventId);
    const ticketType = this.store.getTicketType(ticket.ticketTypeId);
    const auditLogs = this.store.auditLogs
      .filter((log) => log.entityType === "ticket" && log.entityId === id)
      .map((log) => ({
        action: log.action,
        createdAt: log.createdAt,
        metadata: log.metadata,
      }));
    const latestCheckinAt = this.store.checkins.find(
      (checkin) => checkin.ticketId === id,
    )?.checkedInAt;

    return this.buildProofHistory({
      id: ticket.id,
      status: ticket.status,
      transferCount: ticket.transferCount,
      eventTitle: event.title,
      ticketTypeName: ticketType.name,
      auditLogs,
      latestCheckinAt,
    });
  }

  getRawTicket(id: string) {
    return this.store.getTicket(id);
  }

  listOwnedTickets(ownerId: string, session?: FanPassSession) {
    const prisma = this.prismaClient();
    if (prisma) {
      const eventScope = this.prismaTicketEventScope(session);
      return prisma.ticket
        .findMany({
          where: {
            ownerId,
            ...eventScope,
          },
          orderBy: {
            id: "asc",
          },
        })
        .then((tickets) =>
          tickets.map((ticket) => this.mapPrismaTicket(ticket)),
        );
    }

    return this.store.tickets.filter(
      (ticket) =>
        ticket.ownerId === ownerId &&
        this.memoryCanAccessEvent(ticket.eventId, session),
    );
  }

  async issueTicket(input: IssueTicketInput, session?: FanPassSession) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.issuePrismaTicket(prisma, input, session);
    }

    this.store.getEvent(input.eventId);
    this.assertMemoryEventAccess(input.eventId, session);
    const ticketType = this.store.getTicketType(input.ticketTypeId);
    if (ticketType.eventId !== input.eventId) {
      throw new BadRequestException("Ticket type does not belong to event");
    }
    const owner = this.store.users.find(
      (candidate) => candidate.id === input.ownerId,
    );
    if (!owner) {
      throw new BadRequestException(`Owner ${input.ownerId} not found`);
    }
    const ticketId = `tkt_${randomUUID()}`;
    const ownership = await this.ticketOwnership.issueTicket({
      localTicketId: ticketId,
      tokenIdHint: String(this.store.tickets.length + 1),
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      ownerId: input.ownerId,
      ownerWalletAddress: owner.walletAddress,
      transferable: ticketType.transferable,
      resaleCap: ticketType.resaleCap,
      maxTransferCount: ticketType.maxTransferCount,
      metadataUri: null,
    });
    const ticket: TicketRecord = {
      id: ticketId,
      tokenId: ownership.tokenId,
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      ownerId: input.ownerId,
      seatHash: input.seatHash ?? null,
      status: "ACTIVE",
      transferCount: 0,
      metadataUri: null,
    };
    this.store.tickets.unshift(ticket);
    this.audit.record(input.ownerId, "TICKET_ISSUED", "ticket", ticket.id, {
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      ownershipAdapter: ownership.adapter,
      ownershipRef: ownership.ownershipRef,
      transactionHash: ownership.transactionHash,
    });
    return ticket;
  }

  assertCanGenerateEntryPayload(ticket: TicketRecord) {
    if (ticket.status !== "ACTIVE" && ticket.status !== "TRANSFERRED") {
      throw new BadRequestException(
        `Ticket status ${ticket.status} cannot generate an entry code`,
      );
    }
  }

  assertCanList(ticket: TicketRecord) {
    const ticketType = this.store.getTicketType(ticket.ticketTypeId);
    if (
      !ticketType.transferable ||
      ticket.transferCount >= ticketType.maxTransferCount
    ) {
      throw new BadRequestException("Ticket transfer policy blocks resale");
    }
    if (ticket.status !== "ACTIVE" && ticket.status !== "TRANSFERRED") {
      throw new BadRequestException(
        `Ticket status ${ticket.status} cannot be listed`,
      );
    }
  }

  assertCanRedeem(ticket: TicketRecord) {
    this.store.assertCanRedeem(ticket);
  }

  markListedForResale(ticketId: string, actorId: string, orderPrice: number) {
    const ticket = this.store.getTicket(ticketId);
    this.assertCanList(ticket);
    ticket.status = "LISTED_FOR_RESALE";
    this.audit.record(
      actorId,
      "TICKET_LISTED_FOR_RESALE",
      "ticket",
      ticket.id,
      {
        orderPrice,
      },
    );
    return ticket;
  }

  private expandTicket(id: string) {
    const ticket = this.store.getTicket(id);
    return {
      ...ticket,
      event: this.store.getEvent(ticket.eventId),
      ticketType: this.store.getTicketType(ticket.ticketTypeId),
    };
  }

  private buildProofHistory(input: {
    id: string;
    status: TicketRecord["status"];
    transferCount: number;
    eventTitle: string;
    ticketTypeName: string;
    auditLogs: Array<{
      action: string;
      createdAt: string;
      metadata?: unknown;
    }>;
    latestCheckinAt?: string;
  }): { items: TicketProofHistoryItem[] } {
    const safeTicketRef = this.safeTicketRef(input.id);
    const issuedAt =
      this.auditTimestamp(input.auditLogs, "TICKET_ISSUED") ??
      this.auditTimestamp(input.auditLogs, "TICKET_PURCHASED") ??
      null;
    const listedAt = this.auditTimestamp(
      input.auditLogs,
      "TICKET_LISTED_FOR_RESALE",
    );
    const redeemedAt =
      input.latestCheckinAt ??
      this.auditTimestamp(input.auditLogs, "TICKET_REDEEMED");
    const latestOwnership = this.latestOwnershipProof(input.auditLogs);

    const items: TicketProofHistoryItem[] = [
      {
        id: "issued",
        label: "Verified issue",
        state: "OK",
        timestamp: issuedAt ?? "Not recorded",
        description: `${input.eventTitle} ${input.ticketTypeName} is linked to ${safeTicketRef}.`,
        safeTicketRef,
      },
      {
        id: "holder-boundary",
        label: "Holder boundary",
        state: "Redacted",
        timestamp: "Current",
        description:
          "Current holder check passed. Full holder, wallet, signing, and scanner data remain hidden.",
        safeTicketRef,
      },
      {
        id: "lifecycle",
        label: "Lifecycle state",
        state: this.safeStatus(input.status),
        timestamp: listedAt ?? redeemedAt ?? "Current",
        description: this.lifecycleDescription(
          input.status,
          input.transferCount,
        ),
        safeTicketRef,
      },
      {
        id: "entry-code",
        label: "Dynamic code window",
        state: this.entryState(input.status),
        timestamp: "Short-lived",
        description:
          "Entry credentials are generated by the backend and rendered on web without exposing raw credential internals.",
        safeTicketRef,
      },
    ];
    if (latestOwnership) {
      items.push({
        id: "chain-proof",
        label: "On-chain proof",
        state: latestOwnership.adapter === "testnet" ? "Sepolia" : "Local",
        timestamp: latestOwnership.createdAt,
        description:
          latestOwnership.adapter === "testnet"
            ? "Ticket lifecycle proof was written to the configured Sepolia contract and can be checked on the block explorer."
            : "Ticket lifecycle proof is using the local ownership adapter.",
        safeTicketRef,
        proofReference: latestOwnership.proofReference,
        externalUrl: latestOwnership.externalUrl,
      });
    }

    return { items };
  }

  private auditTimestamp(
    logs: Array<{ action: string; createdAt: string; metadata?: unknown }>,
    action: string,
  ) {
    return logs.find((log) => log.action === action)?.createdAt;
  }

  private latestOwnershipProof(
    logs: Array<{ action: string; createdAt: string; metadata?: unknown }>,
  ) {
    for (const log of logs) {
      const metadata = this.recordMetadata(log.metadata);
      const adapter = this.optionalMetadataString(metadata, "ownershipAdapter");
      const ownershipRef = this.optionalMetadataString(metadata, "ownershipRef");
      const transactionHash = this.optionalMetadataString(
        metadata,
        "transactionHash",
      );
      if (!adapter && !ownershipRef && !transactionHash) {
        continue;
      }
      return {
        adapter: adapter ?? "unknown",
        createdAt: log.createdAt,
        proofReference:
          transactionHash !== null
            ? `tx ${this.shortHex(transactionHash)}`
            : ownershipRef !== null
              ? `proof ${this.shortOwnershipRef(ownershipRef)}`
              : "proof pending",
        externalUrl:
          adapter === "testnet" && transactionHash !== null
            ? `https://sepolia.etherscan.io/tx/${transactionHash}`
            : undefined,
      };
    }
    return null;
  }

  private recordMetadata(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private optionalMetadataString(
    metadata: Record<string, unknown>,
    key: string,
  ) {
    const value = metadata[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private shortHex(value: string) {
    return /^0x[a-fA-F0-9]{8,}$/.test(value)
      ? `${value.slice(0, 8)}...${value.slice(-6)}`
      : this.safeTicketRef(value);
  }

  private shortOwnershipRef(value: string) {
    return value
      .split(":")
      .map((part) => (part.startsWith("0x") ? this.shortHex(part) : part))
      .join(":");
  }

  private lifecycleDescription(
    status: TicketRecord["status"],
    transferCount: number,
  ) {
    if (status === "LISTED_FOR_RESALE") {
      return "Entry is paused while the resale listing is open.";
    }
    if (status === "REDEEMED") {
      return "Ticket has been redeemed; entry code generation is closed.";
    }
    if (status === "CANCELLED" || status === "REFUNDED") {
      return "Ticket is no longer eligible for entry.";
    }
    if (transferCount > 0) {
      return `Ownership has changed ${transferCount} time${transferCount === 1 ? "" : "s"} under organizer rules.`;
    }
    return "No public transfer details are exposed in the web fallback preview.";
  }

  private entryState(status: TicketRecord["status"]) {
    return status === "ACTIVE" || status === "TRANSFERRED"
      ? "Ready"
      : "Paused";
  }

  private safeStatus(status: TicketRecord["status"]) {
    return status
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private safeTicketRef(id: string) {
    const compact = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return `FP-${compact.slice(-6).padStart(6, "0")}`;
  }

  private async issuePrismaTicket(
    prisma: PrismaService,
    input: IssueTicketInput,
    session?: FanPassSession,
  ) {
    const event = await prisma.event.findUniqueOrThrow({
      where: { id: input.eventId },
      include: {
        organizer: true,
      },
    });
    this.assertPrismaEventAccess(event, session);
    const ticketType = await prisma.ticketType.findUniqueOrThrow({
      where: { id: input.ticketTypeId },
    });
    if (ticketType.eventId !== input.eventId) {
      throw new BadRequestException("Ticket type does not belong to event");
    }
    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: input.ownerId },
    });
    const ticketId = `tkt_${randomUUID()}`;
    const tokenIdHint = String((await prisma.ticket.count()) + 1);
    const ownershipInput = {
      localTicketId: ticketId,
      tokenIdHint,
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      ownerId: input.ownerId,
      ownerWalletAddress: owner.walletAddress,
      transferable: ticketType.transferable,
      resaleCap: ticketType.resaleCap,
      maxTransferCount: ticketType.maxTransferCount,
      metadataUri: null,
    };

    if (this.ticketOwnership.usesOutboxProofSync()) {
      const ticket = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const ownership = await this.ticketOwnership.issueTicket(
            ownershipInput,
            { writer: tx },
          );
          const issued = await tx.ticket.create({
            data: {
              id: ticketId,
              tokenId: ownership.tokenId,
              eventId: input.eventId,
              ticketTypeId: input.ticketTypeId,
              ownerId: input.ownerId,
              seatHash: input.seatHash ?? null,
              status: "ACTIVE",
              transferCount: 0,
              metadataUri: null,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: input.ownerId,
              action: "TICKET_ISSUED",
              entityType: "ticket",
              entityId: issued.id,
              metadataJson: {
                eventId: input.eventId,
                ticketTypeId: input.ticketTypeId,
                ownershipAdapter: ownership.adapter,
                ownershipRef: ownership.ownershipRef,
                transactionHash: ownership.transactionHash,
              },
            },
          });
          return issued;
        },
      );

      return this.mapPrismaTicket(ticket);
    }

    const ownership = await this.ticketOwnership.issueTicket({
      ...ownershipInput,
    });

    const ticket = await prisma.ticket.create({
      data: {
        id: ticketId,
        tokenId: ownership.tokenId,
        eventId: input.eventId,
        ticketTypeId: input.ticketTypeId,
        ownerId: input.ownerId,
        seatHash: input.seatHash ?? null,
        status: "ACTIVE",
        transferCount: 0,
        metadataUri: null,
      },
    });

    await this.audit.record(
      input.ownerId,
      "TICKET_ISSUED",
      "ticket",
      ticket.id,
      {
        eventId: input.eventId,
        ticketTypeId: input.ticketTypeId,
        ownershipAdapter: ownership.adapter,
        ownershipRef: ownership.ownershipRef,
        transactionHash: ownership.transactionHash,
      },
    );

    return this.mapPrismaTicket(ticket);
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

  private mapExpandedPrismaTicket(ticket: {
    id: string;
    tokenId: string | null;
    eventId: string;
    ticketTypeId: string;
    ownerId: string;
    seatHash: string | null;
    status: TicketRecord["status"];
    transferCount: number;
    metadataUri: string | null;
    event: unknown;
    ticketType: unknown;
  }) {
    return {
      ...this.mapPrismaTicket(ticket),
      event: ticket.event,
      ticketType: ticket.ticketType,
    };
  }

  private prismaClient() {
    return process.env.FANPASS_DATA_SOURCE === "prisma"
      ? this.prisma
      : undefined;
  }

  private prismaTicketEventScope(session: FanPassSession | undefined) {
    if (!session || session.role === "ADMIN") {
      return {};
    }
    if (session.role !== "ORGANIZER") {
      return {};
    }
    return {
      event: {
        organizer: {
          userId: session.userId,
        },
      },
    };
  }

  private assertPrismaExpandedTicketAccess(
    ticket: { event: unknown },
    session: FanPassSession | undefined,
  ) {
    const event = ticket.event as { organizer?: { userId?: string } };
    this.assertPrismaEventAccess(event, session);
  }

  private assertPrismaProofAccess(
    ticket: {
      ownerId: string;
      event: { organizer?: { userId?: string } };
    },
    session: FanPassSession | undefined,
  ) {
    if (!session || session.role === "ADMIN") {
      return;
    }
    if (session.role === "FAN" && ticket.ownerId === session.userId) {
      return;
    }
    if (
      session.role === "ORGANIZER" &&
      ticket.event.organizer?.userId === session.userId
    ) {
      return;
    }
    throw new ForbiddenException("Ticket proof history is not accessible");
  }

  private assertPrismaEventAccess(
    event: { organizer?: { userId?: string } },
    session: FanPassSession | undefined,
  ) {
    if (!session || session.role === "ADMIN") {
      return;
    }
    if (
      session.role === "ORGANIZER" &&
      event.organizer?.userId === session.userId
    ) {
      return;
    }
    if (session.role === "ORGANIZER") {
      throw new ForbiddenException("Organizer is not assigned to this event");
    }
  }

  private memoryCanAccessEvent(
    eventId: string,
    session: FanPassSession | undefined,
  ) {
    if (!session || session.role === "ADMIN") {
      return true;
    }
    if (session.role !== "ORGANIZER") {
      return true;
    }
    const organizer = this.store.organizers.find(
      (candidate) => candidate.userId === session.userId,
    );
    return this.store.events.some(
      (event) => event.id === eventId && event.organizerId === organizer?.id,
    );
  }

  private assertMemoryEventAccess(
    eventId: string,
    session: FanPassSession | undefined,
  ) {
    if (!this.memoryCanAccessEvent(eventId, session)) {
      throw new ForbiddenException("Organizer is not assigned to this event");
    }
  }

  private assertMemoryProofAccess(
    ticket: TicketRecord,
    session: FanPassSession | undefined,
  ) {
    if (!session || session.role === "ADMIN") {
      return;
    }
    if (session.role === "FAN" && ticket.ownerId === session.userId) {
      return;
    }
    if (session.role === "ORGANIZER") {
      this.assertMemoryEventAccess(ticket.eventId, session);
      return;
    }
    throw new ForbiddenException("Ticket proof history is not accessible");
  }
}
