import { ConfigService } from "@nestjs/config";
import { DemoStore } from "../src/common/demo-store";
import { walletBindingFingerprint } from "../src/common/wallet-binding";
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

  it("returns chronological public price history without trade identifiers", async () => {
    store.trades.push({
      id: "trd_public_history",
      buyOrderId: "ord_public_history_buy",
      sellOrderId: "ord_public_history_sell",
      ticketId: "tkt_demo_001",
      price: 1360,
      fee: 48,
      settlementStatus: "SETTLED",
      createdAt: "2026-06-07T10:30:00.000Z",
    });
    const snapshot = await orderbook.getOrderbook(
      "evt_weekend_demo",
      "tt_cat2_demo",
    );

    expect(snapshot.priceHistory).toEqual([
      {
        price: 1360,
        tradedAt: "2026-06-07T10:30:00.000Z",
      },
    ]);
    expect(snapshot.priceHistory[0]).not.toHaveProperty("tradeId");
    expect(snapshot.priceHistory[0]).not.toHaveProperty("ticketId");
    expect(snapshot.priceHistory[0]).not.toHaveProperty("userId");
  });

  it("does not expose a memory-backed orderbook for an unpublished event", async () => {
    const event = store.events.find(
      (candidate) => candidate.id === "evt_weekend_demo",
    );
    expect(event).toBeDefined();
    event!.status = "DRAFT";

    expect(() =>
      orderbook.getOrderbook("evt_weekend_demo", "tt_cat2_demo"),
    ).toThrow("Event or ticket category is not available");
  });

  it("settles a one-ticket buy against the lowest eligible ask", async () => {
    verifyTestWallet(store, "usr_fan_demo", "wal_test_fan");
    verifyTestWallet(store, "usr_buyer_demo", "wal_test_buyer");
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
    verifyTestWallet(store, "usr_fan_demo", "wal_test_fan");
    verifyTestWallet(store, "usr_buyer_demo", "wal_test_buyer");
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

  it("rejects a sell order whose ticket does not belong to the selected category", async () => {
    const ticket = store.getTicket("tkt_demo_001");
    const wrongType = {
      id: "tt_wrong_market",
      eventId: ticket.eventId,
      name: "Wrong market",
      faceValue: 1_000,
      currency: "HKD",
      supply: 100,
      transferable: true,
      resaleCap: 5_000,
      maxTransferCount: 5,
    };
    store.ticketTypes.push(wrongType);

    await expect(
      orderbook.createOrder({
        userId: ticket.ownerId,
        eventId: ticket.eventId,
        ticketTypeId: wrongType.id,
        ticketId: ticket.id,
        side: "SELL",
        price: 1_000,
      }),
    ).rejects.toThrow("Ticket is not available for this market");
    expect(ticket.status).toBe("ACTIVE");
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
    verifyTestWallet(store, "usr_buyer_demo", "wal_test_buyer");
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

  it("rejects primary checkout for an unpublished event without mutating inventory state", async () => {
    const initialOrders = store.orders.length;
    const initialTickets = store.tickets.length;
    store.getEvent("evt_weekend_demo").status = "DRAFT";

    await expect(
      orderbook.createOrder({
        userId: "usr_buyer_demo",
        eventId: "evt_weekend_demo",
        ticketTypeId: "tt_cat2_demo",
        side: "BUY",
        fulfillmentMode: "PRIMARY_ONLY",
        price: 1288,
      }),
    ).rejects.toThrow("Event is not available for checkout");
    expect(store.orders).toHaveLength(initialOrders);
    expect(store.tickets).toHaveLength(initialTickets);
  });

  it("rejects resale writes for an unpublished event before mutating ticket or order state", async () => {
    const initialOrders = store.orders.length;
    const initialAuditLogs = store.auditLogs.length;
    const ticket = store.getTicket("tkt_demo_001");
    store.getEvent("evt_weekend_demo").status = "DRAFT";

    await expect(
      orderbook.createOrder({
        userId: ticket.ownerId,
        eventId: ticket.eventId,
        ticketTypeId: ticket.ticketTypeId,
        side: "SELL",
        price: 1288,
        ticketId: ticket.id,
      }),
    ).rejects.toThrow("Event is not available for marketplace operations");
    await expect(
      orderbook.createOrder({
        userId: "usr_buyer_demo",
        eventId: ticket.eventId,
        ticketTypeId: ticket.ticketTypeId,
        side: "BUY",
        fulfillmentMode: "RESALE_ONLY",
        price: 1288,
      }),
    ).rejects.toThrow("Event is not available for marketplace operations");

    expect(ticket.status).toBe("ACTIVE");
    expect(store.orders).toHaveLength(initialOrders);
    expect(store.auditLogs).toHaveLength(initialAuditLogs);
  });

  it("rechecks publication immediately before matching an existing resale pair", async () => {
    const audit = new AuditService(store);
    const ownership = new OwnershipService(new ConfigService());
    const guardedOrderbook = new OrderbookService(
      store,
      audit,
      new SettlementSideEffectsService(ownership),
      new TicketsService(
        store,
        audit,
        new TicketOwnershipSideEffectsService(ownership),
      ),
      undefined,
      new ConfigService({ FANPASS_REQUIRE_PAYMENT_AUTHORIZATION: "true" }),
    );
    const ticket = store.getTicket("tkt_demo_001");
    const sell = await guardedOrderbook.createOrder({
      userId: ticket.ownerId,
      eventId: ticket.eventId,
      ticketTypeId: ticket.ticketTypeId,
      side: "SELL",
      price: 1288,
      ticketId: ticket.id,
    });
    const buy = await guardedOrderbook.createOrder({
      userId: "usr_buyer_demo",
      eventId: ticket.eventId,
      ticketTypeId: ticket.ticketTypeId,
      side: "BUY",
      fulfillmentMode: "RESALE_ONLY",
      price: 1288,
    });
    store.getEvent(ticket.eventId).status = "DRAFT";

    await expect(
      guardedOrderbook.settleAfterPaymentAuthorization(buy.order.id),
    ).rejects.toThrow("Event is not available for marketplace operations");

    expect(sell.order.status).toBe("OPEN");
    expect(buy.order.status).toBe("OPEN");
    expect(ticket).toMatchObject({
      ownerId: "usr_fan_demo",
      status: "LISTED_FOR_RESALE",
      transferCount: 0,
    });
    expect(store.trades).toHaveLength(0);
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
    verifyTestWallet(store, "usr_buyer_demo", "wal_test_buyer");
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
      $queryRaw: jest.fn().mockResolvedValue([{ status: "PUBLISHED" }]),
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: "ord_buy_loser",
            userId: "usr_buyer_demo",
            side: "BUY",
            eventId: "evt_weekend_demo",
            ticketTypeId: "tt_cat2_demo",
            status: "OPEN",
            fulfillmentMode: "RESALE_ONLY",
          })
          .mockResolvedValueOnce({
            id: "ord_sell_winner",
            userId: "usr_fan_demo",
            side: "SELL",
            eventId: "evt_weekend_demo",
            ticketTypeId: "tt_cat2_demo",
            ticketId: "tkt_demo_001",
            price: 1288,
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
          eventId: "evt_weekend_demo",
          ticketTypeId: "tt_cat2_demo",
          ownerId: "usr_fan_demo",
          transferCount: 0,
          owner: verifiedWalletRecord(
            "did:privy:fan-demo",
            "wal_test_fan",
            "0x0000000000000000000000000000000000002001",
          ),
          ticketType: {
            eventId: "evt_weekend_demo",
            transferable: true,
            resaleCap: 1400,
            maxTransferCount: 1,
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "usr_buyer_demo",
          ...verifiedWalletRecord(
            "did:privy:buyer-demo",
            "wal_test_buyer",
            "0x0000000000000000000000000000000000002002",
          ),
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

  it("refuses to claim a legacy sell order whose market differs from its ticket", async () => {
    const updateOrder = jest.fn();
    const updateTicket = jest.fn();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ status: "PUBLISHED" }]),
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: "ord_buy_wrong_market",
            userId: "usr_buyer_demo",
            side: "BUY",
            eventId: "evt_selected",
            ticketTypeId: "tt_selected",
            status: "OPEN",
            fulfillmentMode: "RESALE_ONLY",
          })
          .mockResolvedValueOnce({
            id: "ord_sell_wrong_market",
            userId: "usr_fan_demo",
            side: "SELL",
            eventId: "evt_selected",
            ticketTypeId: "tt_selected",
            ticketId: "tkt_actual",
            price: 4_000,
            status: "OPEN",
          }),
        updateMany: updateOrder,
      },
      ticket: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "tkt_actual",
          tokenId: "1",
          eventId: "evt_actual",
          ticketTypeId: "tt_actual",
          ownerId: "usr_fan_demo",
          transferCount: 0,
          owner: { walletAddress: null },
          ticketType: {
            eventId: "evt_actual",
            transferable: true,
            resaleCap: 1_200,
            maxTransferCount: 1,
          },
        }),
        updateMany: updateTicket,
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "usr_buyer_demo",
          walletAddress: null,
        }),
      },
    };
    const prisma = {
      trade: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) =>
        operation(tx),
      ),
    };

    await expect(
      (orderbook as any).settlePrisma(
        prisma,
        "ord_buy_wrong_market",
        "ord_sell_wrong_market",
        4_000,
      ),
    ).rejects.toThrow("Resale order and ticket market do not match");
    expect(updateOrder).not.toHaveBeenCalled();
    expect(updateTicket).not.toHaveBeenCalled();
  });

  it("refuses to finalize ownership or payment for a mismatched legacy settlement", async () => {
    const updateOrder = jest.fn();
    const updateTicket = jest.fn();
    const createTrade = jest.fn();
    const tx = {
      trade: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: createTrade,
      },
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: "ord_buy_finalize",
            userId: "usr_buyer_demo",
            side: "BUY",
            eventId: "evt_selected",
            ticketTypeId: "tt_selected",
            status: "MATCHED",
          })
          .mockResolvedValueOnce({
            id: "ord_sell_finalize",
            userId: "usr_fan_demo",
            side: "SELL",
            eventId: "evt_selected",
            ticketTypeId: "tt_selected",
            ticketId: "tkt_actual",
            price: 4_000,
            status: "MATCHED",
          }),
        updateMany: updateOrder,
      },
      ticket: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tkt_actual",
          eventId: "evt_actual",
          ticketTypeId: "tt_actual",
          ownerId: "usr_fan_demo",
          transferCount: 0,
          status: "TRANSFER_PENDING",
          ticketType: {
            eventId: "evt_actual",
            transferable: true,
            resaleCap: 1_200,
            maxTransferCount: 1,
          },
        }),
        updateMany: updateTicket,
      },
    };
    const prisma = {
      $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) =>
        operation(tx),
      ),
    };
    const audit = new AuditService(store);
    const ownership = new OwnershipService(new ConfigService());
    const settlementOrderbook = new OrderbookService(
      store,
      audit,
      new SettlementSideEffectsService(ownership),
      new TicketsService(
        store,
        audit,
        new TicketOwnershipSideEffectsService(ownership),
      ),
      prisma as never,
      new ConfigService({ FANPASS_DATA_SOURCE: "prisma" }),
    );

    await expect(
      settlementOrderbook.finalizeOwnershipTransfer({
        buyOrderId: "ord_buy_finalize",
        sellOrderId: "ord_sell_finalize",
        ticketId: "tkt_actual",
        ownership: {
          status: "PENDING",
          adapter: "privy",
          ownershipRef: "tx:pending",
          transactionHash: "0xpending",
        },
      }),
    ).rejects.toThrow("Ownership transfer must be confirmed before settlement");
    expect(prisma.$transaction).not.toHaveBeenCalled();

    await expect(
      settlementOrderbook.finalizeOwnershipTransfer({
        buyOrderId: "ord_buy_finalize",
        sellOrderId: "ord_sell_finalize",
        ticketId: "tkt_actual",
        ownership: {
          status: "CONFIRMED",
          adapter: "privy",
          ownershipRef: "tx:confirmed",
          transactionHash: "0xconfirmed",
        },
      }),
    ).rejects.toThrow("Resale order and ticket market do not match");
    expect(updateOrder).not.toHaveBeenCalled();
    expect(updateTicket).not.toHaveBeenCalled();
    expect(createTrade).not.toHaveBeenCalled();
  });
});

function verifyTestWallet(store: DemoStore, userId: string, walletId: string) {
  const user = store.users.find((candidate) => candidate.id === userId);
  if (!user?.privyId || !user.walletAddress) {
    throw new Error(`Missing wallet fixture for ${userId}`);
  }
  Object.assign(
    user,
    verifiedWalletRecord(user.privyId, walletId, user.walletAddress),
  );
}

function verifiedWalletRecord(
  privyId: string,
  privyWalletId: string,
  walletAddress: string,
) {
  return {
    privyId,
    privyWalletId,
    walletAddress,
    walletBindingStatus: "VERIFIED" as const,
    walletBindingVerifiedAt: new Date("2026-07-20T00:00:00.000Z"),
    walletBindingVersion: 1,
    walletBindingFingerprint: walletBindingFingerprint({
      privyId,
      walletId: privyWalletId,
      walletAddress,
    }),
  };
}
