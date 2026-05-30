import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DemoStore } from "../src/common/demo-store";
import { AuditService } from "../src/modules/audit/audit.service";
import { OwnershipService } from "../src/modules/ownership/ownership.service";
import { TicketOwnershipSideEffectsService } from "../src/modules/side-effects/ticket-ownership-side-effects.service";
import { TicketsService } from "../src/modules/tickets/tickets.service";

describe("TicketsService", () => {
  let store: DemoStore;
  let tickets: TicketsService;

  beforeEach(() => {
    store = new DemoStore();
    tickets = new TicketsService(
      store,
      new AuditService(store),
      new TicketOwnershipSideEffectsService(
        new OwnershipService(new ConfigService()),
      ),
    );
  });

  it("issues active tickets and writes an audit entry", async () => {
    const ticket = await tickets.issueTicket({
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      ownerId: "usr_fan_demo",
      seatHash: "section-101-row-a-seat-1",
    });

    expect(ticket).toMatchObject({
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      ownerId: "usr_fan_demo",
      status: "ACTIVE",
    });
    expect(store.auditLogs[0]).toMatchObject({
      action: "TICKET_ISSUED",
      entityType: "ticket",
      entityId: ticket.id,
      metadata: expect.objectContaining({
        ownershipAdapter: "mock",
      }),
    });
  });

  it("blocks listing redeemed tickets", () => {
    const ticket = store.getTicket("tkt_demo_001");
    ticket.status = "REDEEMED";

    expect(() =>
      tickets.markListedForResale(ticket.id, ticket.ownerId, 1300),
    ).toThrow(BadRequestException);
    expect(ticket.status).toBe("REDEEMED");
  });

  it("blocks listing tickets over transfer limit", () => {
    const ticket = store.getTicket("tkt_demo_001");
    ticket.transferCount = store.getTicketType(
      ticket.ticketTypeId,
    ).maxTransferCount;

    expect(() =>
      tickets.markListedForResale(ticket.id, ticket.ownerId, 1300),
    ).toThrow(BadRequestException);
    expect(ticket.status).toBe("ACTIVE");
  });

  it("scopes organizer ticket inventory to owned events", async () => {
    store.users.push({
      id: "usr_other_organizer",
      name: "Other Organizer",
      email: "other-organizer@fanpass.test",
      role: "ORGANIZER",
      privyId: "did:privy:other-organizer-demo",
      walletAddress: null,
      riskScore: 0,
    });
    store.organizers.push({
      id: "org_other_demo",
      userId: "usr_other_organizer",
      organizationName: "Other Events Ltd",
      verificationStatus: "APPROVED",
      payoutAccountId: null,
    });
    store.events.push({
      id: "evt_other_demo",
      organizerId: "org_other_demo",
      title: "Other Organizer Private Event",
      venueId: "ven_kaitak_demo",
      startTime: "2026-12-01T20:00:00+08:00",
      endTime: "2026-12-01T23:00:00+08:00",
      status: "PUBLISHED",
      posterUrl: null,
    });
    store.ticketTypes.push({
      id: "tt_other_demo",
      eventId: "evt_other_demo",
      name: "PRIVATE",
      faceValue: 999,
      currency: "HKD",
      supply: 10,
      transferable: true,
      resaleCap: 1199,
      maxTransferCount: 1,
    });
    store.tickets.push({
      id: "tkt_other_demo",
      tokenId: "99",
      eventId: "evt_other_demo",
      ticketTypeId: "tt_other_demo",
      ownerId: "usr_fan_demo",
      seatHash: null,
      status: "ACTIVE",
      transferCount: 0,
      metadataUri: null,
    });

    const scopedTickets = await tickets.listTickets({
      userId: "usr_organizer_demo",
      role: "ORGANIZER",
    });

    expect(scopedTickets.map((ticket) => ticket.id)).toEqual(["tkt_demo_001"]);
    expect(() =>
      tickets.getTicket("tkt_other_demo", {
        userId: "usr_organizer_demo",
        role: "ORGANIZER",
      }),
    ).toThrow(ForbiddenException);
    await expect(
      tickets.issueTicket(
        {
          eventId: "evt_other_demo",
          ticketTypeId: "tt_other_demo",
          ownerId: "usr_fan_demo",
        },
        {
          userId: "usr_organizer_demo",
          role: "ORGANIZER",
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
