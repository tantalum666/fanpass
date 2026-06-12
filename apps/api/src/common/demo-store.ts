import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  AuditLogRecord,
  CheckinRecord,
  FanTaskSubmissionRecord,
  GateAssignmentRecord,
  OrderRecord,
  OrganizerRecord,
  TicketRecord,
  TradeRecord,
  UserRecord,
  VenueRecord,
  EventRecord,
  FanTaskRecord,
  TicketTypeRecord,
} from "./domain";
import { createDemoSeed } from "./demo-seed";

@Injectable()
export class DemoStore {
  readonly users: UserRecord[] = [];
  readonly organizers: OrganizerRecord[] = [];
  readonly venues: VenueRecord[] = [];
  readonly events: EventRecord[] = [];
  readonly ticketTypes: TicketTypeRecord[] = [];
  readonly tickets: TicketRecord[] = [];
  readonly orders: OrderRecord[] = [];
  readonly trades: TradeRecord[] = [];
  readonly fanTasks: FanTaskRecord[] = [];
  readonly fanTaskSubmissions: FanTaskSubmissionRecord[] = [];
  readonly gateAssignments: GateAssignmentRecord[] = [];
  readonly checkins: CheckinRecord[] = [];
  readonly auditLogs: AuditLogRecord[] = [];

  constructor(private readonly options: { includeMarketDepth?: boolean } = {}) {
    this.seed();
  }

  reset() {
    this.users.length = 0;
    this.organizers.length = 0;
    this.venues.length = 0;
    this.events.length = 0;
    this.ticketTypes.length = 0;
    this.tickets.length = 0;
    this.orders.length = 0;
    this.trades.length = 0;
    this.fanTasks.length = 0;
    this.fanTaskSubmissions.length = 0;
    this.gateAssignments.length = 0;
    this.checkins.length = 0;
    this.auditLogs.length = 0;
    this.seed();
  }

  private seed() {
    const seed = createDemoSeed(this.options);
    this.users.push(...seed.users);
    this.organizers.push(...seed.organizers);
    this.venues.push(...seed.venues);
    this.events.push(...seed.events);
    this.ticketTypes.push(...seed.ticketTypes);
    this.tickets.push(...seed.tickets);
    this.orders.push(...seed.orders);
    this.trades.push(...seed.trades);
    this.fanTasks.push(...seed.fanTasks);
    this.gateAssignments.push(...seed.gateAssignments);
  }

  now() {
    return new Date().toISOString();
  }

  audit(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown> = {},
  ) {
    this.auditLogs.unshift({
      id: `aud_${randomUUID()}`,
      actorId,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: this.now(),
    });
  }

  recordCheckin(input: Omit<CheckinRecord, "id" | "checkedInAt">) {
    const checkin = {
      id: `chk_${randomUUID()}`,
      ...input,
      checkedInAt: this.now(),
    };
    this.checkins.unshift(checkin);
    return checkin;
  }

  getEvent(id: string) {
    const event = this.events.find((candidate) => candidate.id === id);
    if (!event) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    return event;
  }

  getTicket(id: string) {
    const ticket = this.tickets.find((candidate) => candidate.id === id);
    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }
    return ticket;
  }

  getTicketType(id: string) {
    const ticketType = this.ticketTypes.find(
      (candidate) => candidate.id === id,
    );
    if (!ticketType) {
      throw new NotFoundException(`Ticket type ${id} not found`);
    }
    return ticketType;
  }

  assertCanRedeem(ticket: TicketRecord) {
    if (ticket.status === "REDEEMED") {
      throw new BadRequestException("Ticket has already been redeemed");
    }
    if (!["ACTIVE", "TRANSFERRED"].includes(ticket.status)) {
      throw new BadRequestException(
        `Ticket status ${ticket.status} cannot be redeemed`,
      );
    }
  }
}
