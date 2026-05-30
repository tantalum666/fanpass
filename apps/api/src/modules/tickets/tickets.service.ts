import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Optional,
} from "@nestjs/common";
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
    const ownership = await this.ticketOwnership.issueTicket({
      localTicketId: ticketId,
      tokenIdHint,
      eventId: input.eventId,
      ownerId: input.ownerId,
      ownerWalletAddress: owner.walletAddress,
      transferable: ticketType.transferable,
      resaleCap: ticketType.resaleCap,
      maxTransferCount: ticketType.maxTransferCount,
      metadataUri: null,
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
}
