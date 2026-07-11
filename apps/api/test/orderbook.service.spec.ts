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
      undefined,
      new ConfigService({ FANPASS_REQUIRE_PAYMENT_AUTHORIZATION: "false" }),
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
      fulfillmentMode: "RESALE_ONLY",
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
    expect(buy.order.fulfillmentMode).toBe("RESALE_ONLY");
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

  it("issues a primary ticket for an authorized buy order without a resale ask", async () => {
    const buy = await orderbook.createOrder({
      userId: "usr_buyer_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "BUY",
      price: 1288,
    });

    expect(buy.trade).toBeNull();

    const settlement = await orderbook.settleAfterPaymentAuthorization(
      buy.order.id,
    );

    expect(settlement).toMatchObject({
      orderId: buy.order.id,
      tradeId: null,
      fulfillmentType: "PRIMARY",
      matched: false,
      issued: true,
    });
    expect(settlement?.ticketId).toEqual(expect.stringMatching(/^tkt_/));
    expect(buy.order).toMatchObject({
      status: "SETTLED",
      remainingQuantity: 0,
      ticketId: settlement?.ticketId,
    });
    expect(store.getTicket(settlement!.ticketId)).toMatchObject({
      ownerId: "usr_buyer_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      status: "ACTIVE",
      seatHash: `primary-order:${buy.order.id}`,
    });
    expect(
      store.auditLogs.some(
        (log) =>
          log.action === "ORDER_PRIMARY_TICKET_ISSUED" &&
          log.entityId === buy.order.id,
      ),
    ).toBe(true);
  });

  it("rejects a resale-only market buy instead of issuing primary inventory when the ask is gone", async () => {
    const buy = await orderbook.createOrder({
      userId: "usr_buyer_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "BUY",
      fulfillmentMode: "RESALE_ONLY",
      price: 1288,
    });

    const settlement = await orderbook.settleAfterPaymentAuthorization(
      buy.order.id,
    );

    expect(settlement).toBeNull();
    expect(buy.order).toMatchObject({
      fulfillmentMode: "RESALE_ONLY",
      status: "REJECTED",
      remainingQuantity: 0,
      ticketId: null,
    });
    expect(
      store.auditLogs.some(
        (log) =>
          log.action === "RESALE_ORDER_UNAVAILABLE" &&
          log.entityId === buy.order.id,
      ),
    ).toBe(true);
  });

  it("keeps primary-only checkout out of the resale book even when an ask is open", async () => {
    await orderbook.createOrder({
      userId: "usr_fan_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "SELL",
      price: 1288,
      ticketId: "tkt_demo_001",
    });

    const buy = await orderbook.createOrder({
      userId: "usr_buyer_demo",
      eventId: "evt_weekend_demo",
      ticketTypeId: "tt_cat2_demo",
      side: "BUY",
      fulfillmentMode: "PRIMARY_ONLY",
      price: 1288,
    });

    expect(buy.trade).toBeNull();
    expect(store.getTicket("tkt_demo_001")).toMatchObject({
      ownerId: "usr_fan_demo",
      status: "LISTED_FOR_RESALE",
    });

    const settlement = await orderbook.settleAfterPaymentAuthorization(
      buy.order.id,
    );
    expect(settlement).toMatchObject({
      fulfillmentType: "PRIMARY",
      issued: true,
      matched: false,
    });
    expect(store.getTicket("tkt_demo_001").ownerId).toBe("usr_fan_demo");
  });

  it("rolls back every claim when another buyer wins the same sell order", async () => {
    let transactionRolledBack = false;
    const tx = {
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: "ord_buy_loser",
            userId: "usr_buyer_demo",
            status: "OPEN",
            fulfillmentMode: "RESALE_ONLY",
          })
          .mockResolvedValueOnce({
            id: "ord_sell_winner",
            userId: "usr_fan_demo",
            ticketId: "tkt_demo_001",
            status: "OPEN",
          }),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      ticket: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "tkt_demo_001",
          tokenId: "1",
          ownerId: "usr_fan_demo",
          owner: { walletAddress: null },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "usr_buyer_demo",
          walletAddress: null,
        }),
      },
      auditLog: {
        create: jest.fn(),
      },
    };
    const prisma = {
      trade: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(
        async (operation: (client: typeof tx) => unknown) => {
          try {
            return await operation(tx);
          } catch (error) {
            transactionRolledBack = true;
            throw error;
          }
        },
      ),
    };

    const result = await (orderbook as any).settlePrisma(
      prisma,
      "ord_buy_loser",
      "ord_sell_winner",
      1288,
    );

    expect(result).toBeNull();
    expect(transactionRolledBack).toBe(true);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
