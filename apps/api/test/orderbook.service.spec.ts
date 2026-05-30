import { ConfigService } from "@nestjs/config";
import { DemoStore } from "../src/common/demo-store";
import { AuditService } from "../src/modules/audit/audit.service";
import { OrderbookService } from "../src/modules/orders/orderbook.service";
import { OwnershipService } from "../src/modules/ownership/ownership.service";
import { SettlementSideEffectsService } from "../src/modules/side-effects/settlement-side-effects.service";
import { TicketOwnershipSideEffectsService } from "../src/modules/side-effects/ticket-ownership-side-effects.service";
import { TicketsService } from "../src/modules/tickets/tickets.service";

describe("OrderbookService", () => {
  let store: DemoStore;
  let orderbook: OrderbookService;

  beforeEach(() => {
    store = new DemoStore();
    const audit = new AuditService(store);
    const ownership = new OwnershipService(new ConfigService());
    const settlementSideEffects = new SettlementSideEffectsService(ownership);
    const ticketOwnership = new TicketOwnershipSideEffectsService(ownership);
    orderbook = new OrderbookService(
      store,
      audit,
      settlementSideEffects,
      new TicketsService(store, audit, ticketOwnership),
    );
  });

  it("settles a one-ticket buy against the lowest eligible ask", async () => {
    store.tickets.push({
      id: "tkt_demo_002",
      tokenId: "2",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      ownerId: "usr_fan_demo",
      seatHash: "section-118-row-h-seat-13",
      status: "ACTIVE",
      transferCount: 0,
      metadataUri: null,
    });

    await orderbook.createOrder({
      userId: "usr_fan_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "SELL",
      price: 1350,
      ticketId: "tkt_demo_001",
    });
    const lowerAsk = await orderbook.createOrder({
      userId: "usr_fan_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "SELL",
      price: 1300,
      ticketId: "tkt_demo_002",
    });

    const buy = await orderbook.createOrder({
      userId: "usr_buyer_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "BUY",
      price: 1400,
    });

    const buyTrade = await buy.trade;
    expect(buyTrade).toMatchObject({
      sellOrderId: lowerAsk.order.id,
      ticketId: "tkt_demo_002",
      price: 1300,
    });
    expect(store.getTicket("tkt_demo_002")).toMatchObject({
      ownerId: "usr_buyer_demo",
      status: "TRANSFERRED",
      transferCount: 1,
    });
    expect(buy.order.status).toBe("SETTLED");
    expect(store.auditLogs[0]).toMatchObject({
      action: "TRADE_SETTLED",
      metadata: expect.objectContaining({
        ownershipAdapter: "mock",
      }),
    });
  });

  it("uses FIFO priority when ask prices are equal", async () => {
    store.tickets.push({
      id: "tkt_demo_002",
      tokenId: "2",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      ownerId: "usr_fan_demo",
      seatHash: "section-118-row-h-seat-13",
      status: "ACTIVE",
      transferCount: 0,
      metadataUri: null,
    });

    const firstAsk = await orderbook.createOrder({
      userId: "usr_fan_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "SELL",
      price: 1320,
      ticketId: "tkt_demo_001",
    });
    await orderbook.createOrder({
      userId: "usr_fan_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "SELL",
      price: 1320,
      ticketId: "tkt_demo_002",
    });

    const buy = await orderbook.createOrder({
      userId: "usr_buyer_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "BUY",
      price: 1320,
    });

    const buyTrade = await buy.trade;
    expect(buyTrade?.sellOrderId).toBe(firstAsk.order.id);
    expect(store.getTicket("tkt_demo_001").ownerId).toBe("usr_buyer_demo");
  });

  it("cancels an open sell order and releases the listed ticket", async () => {
    const sell = await orderbook.createOrder({
      userId: "usr_fan_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "SELL",
      price: 1320,
      ticketId: "tkt_demo_001",
    });

    expect(store.getTicket("tkt_demo_001").status).toBe("LISTED_FOR_RESALE");

    const cancelled = await orderbook.cancelOrder(sell.order.id, {
      userId: "usr_fan_demo",
    });

    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.remainingQuantity).toBe(0);
    expect(store.getTicket("tkt_demo_001").status).toBe("ACTIVE");
    expect(store.auditLogs[0]).toMatchObject({
      action: "ORDER_CANCELLED",
      entityId: sell.order.id,
    });
  });

  it("returns the existing order for repeated idempotency keys", async () => {
    const first = await orderbook.createOrder({
      userId: "usr_buyer_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "BUY",
      price: 1288,
      idempotencyKey: "order-retry-1",
    });

    const retry = await orderbook.createOrder({
      userId: "usr_buyer_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "BUY",
      price: 1288,
      idempotencyKey: "order-retry-1",
    });

    expect(retry.order.id).toBe(first.order.id);
    expect(store.orders).toHaveLength(1);

    await expect(
      orderbook.createOrder({
        userId: "usr_buyer_demo",
        eventId: "evt_weekend_demo",
        ticketTypeId: "tt_cat2_demo",
        side: "BUY",
        price: 1300,
        idempotencyKey: "order-retry-1",
      }),
    ).rejects.toThrow("Idempotency key already belongs");
  });
});
