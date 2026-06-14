import { ConfigService } from "@nestjs/config";
import { DemoStore } from "../src/common/demo-store";
import { AuditService } from "../src/modules/audit/audit.service";
import { OrderbookService } from "../src/modules/orders/orderbook.service";
import { OwnershipService } from "../src/modules/ownership/ownership.service";
import { SettlementSideEffectsService } from "../src/modules/side-effects/settlement-side-effects.service";
import { TicketOwnershipSideEffectsService } from "../src/modules/side-effects/ticket-ownership-side-effects.service";
import { TicketsService } from "../src/modules/tickets/tickets.service";

function createService(prisma: unknown) {
  const store = new DemoStore();
  const audit = new AuditService(store);
  const ownership = new OwnershipService(new ConfigService());
  return new OrderbookService(
    store,
    audit,
    new SettlementSideEffectsService(ownership),
    new TicketsService(
      store,
      audit,
      new TicketOwnershipSideEffectsService(ownership),
    ),
    prisma as any,
  );
}

describe("OrderbookService Prisma catalog validation", () => {
  it("rejects checkout when the event does not exist instead of surfacing Prisma P2025", async () => {
    const service = createService({
      event: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      ticketType: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tt_api_demo",
          eventId: "evt_api_demo",
          faceValue: 100,
          resaleCap: 110,
        }),
      },
    });

    await expect(
      service.createOrder({
        userId: "usr_buyer_demo",
        eventId: "evt_missing",
        ticketTypeId: "tt_api_demo",
        side: "BUY",
        price: 100,
      }),
    ).rejects.toThrow("Event is not available for checkout");
  });

  it("rejects checkout when the ticket category does not belong to the event", async () => {
    const service = createService({
      event: {
        findUnique: jest.fn().mockResolvedValue({ id: "evt_api_demo" }),
      },
      ticketType: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tt_other_demo",
          eventId: "evt_other_demo",
          faceValue: 100,
          resaleCap: 110,
        }),
      },
    });

    await expect(
      service.createOrder({
        userId: "usr_buyer_demo",
        eventId: "evt_api_demo",
        ticketTypeId: "tt_other_demo",
        side: "BUY",
        price: 100,
      }),
    ).rejects.toThrow("Ticket category is not available for checkout");
  });

  it("rejects orderbook reads when the ticket category is missing", async () => {
    const service = createService({
      order: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      trade: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ticketType: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.getOrderbook("evt_missing", "tt_missing"),
    ).rejects.toThrow("Event or ticket category is not available");
  });
});
