import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { DemoStore } from "../../common/demo-store";
import { EventRecord } from "../../common/domain";
import { PrismaService } from "../../common/prisma.service";
import { FanPassSession } from "../../common/session";
import { AuditService } from "../audit/audit.service";

export interface CreateEventInput {
  title: string;
  venueName: string;
  city: string;
  startTime: string;
  endTime: string;
}

export interface CreateTicketTypeInput {
  name: string;
  faceValue: number;
  currency: string;
  supply: number;
  transferable: boolean;
  resaleCap?: number;
  maxTransferCount: number;
}

@Injectable()
export class EventsService {
  constructor(
    private readonly store: DemoStore,
    private readonly audit: AuditService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  listEvents() {
    const prisma = this.prismaClient();
    if (prisma) {
      const now = new Date();
      return prisma.event
        .findMany({
          where: {
            status: "PUBLISHED",
          },
          include: {
            venue: true,
            ticketTypes: true,
            fanCampaigns: {
              where: {
                status: "ACTIVE",
                startsAt: { lte: now },
                closesAt: { gt: now },
              },
              select: { id: true },
            },
          },
          orderBy: {
            startTime: "asc",
          },
        })
        .then((events) => events.map((event) => this.mapPrismaEvent(event)));
    }

    return this.store.events
      .filter((event) => event.status === "PUBLISHED")
      .map((event) => this.expandEvent(event.id));
  }

  async getEvent(id: string) {
    const prisma = this.prismaClient();
    if (prisma) {
      const now = new Date();
      const event = await prisma.event.findFirst({
        where: {
          id,
          status: "PUBLISHED",
        },
        include: {
          venue: true,
          ticketTypes: true,
          fanCampaigns: {
            where: {
              status: "ACTIVE",
              startsAt: { lte: now },
              closesAt: { gt: now },
            },
            select: { id: true },
          },
        },
      });
      if (!event) {
        throw new NotFoundException(`Event ${id} not found`);
      }
      return this.mapPrismaEvent(event);
    }

    const event = this.store.events.find(
      (candidate) => candidate.id === id && candidate.status === "PUBLISHED",
    );
    if (!event) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    return this.expandEvent(event.id);
  }

  async createEvent(input: CreateEventInput, session: FanPassSession) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.createPrismaEvent(prisma, input, session);
    }

    const venueId = `ven_${randomUUID()}`;
    const eventId = `evt_${randomUUID()}`;
    const organizerId = this.memoryOrganizerIdForWrite(session);

    this.store.venues.push({
      id: venueId,
      name: input.venueName,
      country: "HK",
      city: input.city,
      address: input.venueName,
      timezone: "Asia/Hong_Kong",
      capacity: 1000,
    });

    const event = {
      id: eventId,
      organizerId,
      title: input.title,
      venueId,
      startTime: input.startTime,
      endTime: input.endTime,
      status: "DRAFT" as const,
      posterUrl: null,
    };
    this.store.events.unshift(event);
    this.audit.record(session.userId, "EVENT_CREATED", "event", eventId, {
      title: input.title,
    });
    return event;
  }

  async createTicketType(
    eventId: string,
    input: CreateTicketTypeInput,
    session: FanPassSession,
  ) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.createPrismaTicketType(prisma, eventId, input, session);
    }

    const event = this.store.getEvent(eventId);
    const organizerId = this.memoryOrganizerIdForWrite(session);
    if (session.role !== "ADMIN" && event.organizerId !== organizerId) {
      throw new ForbiddenException("Event is outside this organizer scope");
    }
    const ticketType = {
      id: `tt_${randomUUID()}`,
      eventId,
      name: input.name,
      faceValue: input.faceValue,
      currency: input.currency,
      supply: input.supply,
      transferable: input.transferable,
      resaleCap: input.resaleCap ?? null,
      maxTransferCount: input.maxTransferCount,
    };
    this.store.ticketTypes.push(ticketType);
    this.audit.record(
      session.userId,
      "TICKET_TYPE_CREATED",
      "ticket_type",
      ticketType.id,
      {
        eventId,
        name: input.name,
      },
    );
    return ticketType;
  }

  private expandEvent(id: string) {
    const event = this.store.getEvent(id);
    const now = Date.now();
    return {
      ...event,
      venue: this.store.venues.find((venue) => venue.id === event.venueId),
      ticketTypes: this.store.ticketTypes.filter(
        (ticketType) => ticketType.eventId === event.id,
      ),
      fanAccessAvailable: this.store.fanCampaigns.some(
        (campaign) =>
          campaign.eventId === event.id &&
          campaign.status === "ACTIVE" &&
          Date.parse(campaign.startsAt) <= now &&
          Date.parse(campaign.closesAt) > now,
      ),
    };
  }

  private async createPrismaEvent(
    prisma: PrismaService,
    input: CreateEventInput,
    session: FanPassSession,
  ) {
    const organizerId = await this.prismaOrganizerIdForWrite(prisma, session);
    const venue = await prisma.venue.create({
      data: {
        id: `ven_${randomUUID()}`,
        name: input.venueName,
        country: "HK",
        city: input.city,
        address: input.venueName,
        timezone: "Asia/Hong_Kong",
        capacity: 1000,
      },
    });

    const event = await prisma.event.create({
      data: {
        id: `evt_${randomUUID()}`,
        organizerId,
        title: input.title,
        venueId: venue.id,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        status: "DRAFT",
        posterUrl: null,
      },
      include: {
        venue: true,
        ticketTypes: true,
      },
    });

    await this.audit.record(
      session.userId,
      "EVENT_CREATED",
      "event",
      event.id,
      {
        title: input.title,
      },
    );

    return this.mapPrismaEvent(event);
  }

  private async createPrismaTicketType(
    prisma: PrismaService,
    eventId: string,
    input: CreateTicketTypeInput,
    session: FanPassSession,
  ) {
    const organizerId = await this.prismaOrganizerIdForWrite(prisma, session);
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        ...(session.role === "ADMIN" ? {} : { organizerId }),
      },
    });
    if (!event) {
      throw new ForbiddenException("Event is outside this organizer scope");
    }
    const ticketType = await prisma.ticketType.create({
      data: {
        id: `tt_${randomUUID()}`,
        eventId,
        name: input.name,
        faceValue: input.faceValue,
        currency: input.currency,
        supply: input.supply,
        transferable: input.transferable,
        resaleCap: input.resaleCap ?? null,
        maxTransferCount: input.maxTransferCount,
      },
    });

    await this.audit.record(
      session.userId,
      "TICKET_TYPE_CREATED",
      "ticket_type",
      ticketType.id,
      {
        eventId,
        name: input.name,
      },
    );

    return ticketType;
  }

  private mapPrismaEvent(event: {
    id: string;
    organizerId: string;
    title: string;
    venueId: string;
    startTime: Date;
    endTime: Date;
    status: EventRecord["status"];
    posterUrl: string | null;
    venue: unknown;
    ticketTypes: unknown[];
    fanCampaigns?: Array<{ id: string }>;
  }) {
    return {
      id: event.id,
      organizerId: event.organizerId,
      title: event.title,
      venueId: event.venueId,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      status: event.status,
      posterUrl: event.posterUrl,
      venue: event.venue,
      ticketTypes: event.ticketTypes,
      fanAccessAvailable: (event.fanCampaigns?.length ?? 0) > 0,
    };
  }

  private memoryOrganizerIdForWrite(session: FanPassSession) {
    if (session.role === "ADMIN") {
      const organizer = this.store.organizers[0];
      if (!organizer) {
        throw new ForbiddenException("No organizer profile exists");
      }
      return organizer.id;
    }
    const organizer = this.store.organizers.find(
      (candidate) => candidate.userId === session.userId,
    );
    if (!organizer) {
      throw new ForbiddenException("Organizer profile is not linked");
    }
    return organizer.id;
  }

  private async prismaOrganizerIdForWrite(
    prisma: PrismaService,
    session: FanPassSession,
  ) {
    const organizer = await prisma.organizer.findFirst({
      where: session.role === "ADMIN" ? {} : { userId: session.userId },
      orderBy: session.role === "ADMIN" ? { id: "asc" } : undefined,
    });
    if (!organizer) {
      throw new ForbiddenException(
        session.role === "ADMIN"
          ? "No organizer profile exists"
          : "Organizer profile is not linked",
      );
    }
    return organizer.id;
  }

  private prismaClient() {
    return process.env.FANPASS_DATA_SOURCE === "prisma"
      ? this.prisma
      : undefined;
  }
}
