import { Injectable, Optional } from "@nestjs/common";
import { randomUUID } from "crypto";
import { demoSeedIds } from "../../common/demo-seed";
import { DemoStore } from "../../common/demo-store";
import { EventRecord } from "../../common/domain";
import { PrismaService } from "../../common/prisma.service";
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
    @Optional() private readonly prisma?: PrismaService
  ) {}

  listEvents() {
    const prisma = this.prismaClient();
    if (prisma) {
      return prisma.event
        .findMany({
          include: {
            venue: true,
            ticketTypes: true
          },
          orderBy: {
            startTime: "asc"
          }
        })
        .then((events) => events.map((event) => this.mapPrismaEvent(event)));
    }

    return this.store.events.map((event) => this.expandEvent(event.id));
  }

  getEvent(id: string) {
    const prisma = this.prismaClient();
    if (prisma) {
      return prisma.event
        .findUniqueOrThrow({
          where: { id },
          include: {
            venue: true,
            ticketTypes: true
          }
        })
        .then((event) => this.mapPrismaEvent(event));
    }

    return this.expandEvent(this.store.getEvent(id).id);
  }

  createEvent(input: CreateEventInput) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.createPrismaEvent(prisma, input);
    }

    const venueId = `ven_${randomUUID()}`;
    const eventId = `evt_${randomUUID()}`;
    const organizerId = demoSeedIds.organizerId;

    this.store.venues.push({
      id: venueId,
      name: input.venueName,
      country: "HK",
      city: input.city,
      address: input.venueName,
      timezone: "Asia/Hong_Kong",
      capacity: 1000
    });

    const event = {
      id: eventId,
      organizerId,
      title: input.title,
      venueId,
      startTime: input.startTime,
      endTime: input.endTime,
      status: "DRAFT" as const,
      posterUrl: null
    };
    this.store.events.unshift(event);
    this.audit.record(demoSeedIds.organizerUserId, "EVENT_CREATED", "event", eventId, { title: input.title });
    return event;
  }

  createTicketType(eventId: string, input: CreateTicketTypeInput) {
    const prisma = this.prismaClient();
    if (prisma) {
      return this.createPrismaTicketType(prisma, eventId, input);
    }

    this.store.getEvent(eventId);
    const ticketType = {
      id: `tt_${randomUUID()}`,
      eventId,
      name: input.name,
      faceValue: input.faceValue,
      currency: input.currency,
      supply: input.supply,
      transferable: input.transferable,
      resaleCap: input.resaleCap ?? null,
      maxTransferCount: input.maxTransferCount
    };
    this.store.ticketTypes.push(ticketType);
    this.audit.record(demoSeedIds.organizerUserId, "TICKET_TYPE_CREATED", "ticket_type", ticketType.id, {
      eventId,
      name: input.name
    });
    return ticketType;
  }

  private expandEvent(id: string) {
    const event = this.store.getEvent(id);
    return {
      ...event,
      venue: this.store.venues.find((venue) => venue.id === event.venueId),
      ticketTypes: this.store.ticketTypes.filter((ticketType) => ticketType.eventId === event.id)
    };
  }

  private async createPrismaEvent(prisma: PrismaService, input: CreateEventInput) {
    const venue = await prisma.venue.create({
      data: {
        id: `ven_${randomUUID()}`,
        name: input.venueName,
        country: "HK",
        city: input.city,
        address: input.venueName,
        timezone: "Asia/Hong_Kong",
        capacity: 1000
      }
    });

    const event = await prisma.event.create({
      data: {
        id: `evt_${randomUUID()}`,
        organizerId: demoSeedIds.organizerId,
        title: input.title,
        venueId: venue.id,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        status: "DRAFT",
        posterUrl: null
      },
      include: {
        venue: true,
        ticketTypes: true
      }
    });

    await this.audit.record(demoSeedIds.organizerUserId, "EVENT_CREATED", "event", event.id, {
      title: input.title
    });

    return this.mapPrismaEvent(event);
  }

  private async createPrismaTicketType(prisma: PrismaService, eventId: string, input: CreateTicketTypeInput) {
    await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
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
        maxTransferCount: input.maxTransferCount
      }
    });

    await this.audit.record(demoSeedIds.organizerUserId, "TICKET_TYPE_CREATED", "ticket_type", ticketType.id, {
      eventId,
      name: input.name
    });

    return ticketType;
  }

  private mapPrismaEvent(
    event: {
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
    }
  ) {
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
      ticketTypes: event.ticketTypes
    };
  }

  private prismaClient() {
    return process.env.FANPASS_DATA_SOURCE === "prisma" ? this.prisma : undefined;
  }
}
