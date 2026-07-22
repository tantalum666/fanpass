import { ConfigService } from "@nestjs/config";
import { DemoStore } from "../src/common/demo-store";
import { walletBindingFingerprint } from "../src/common/wallet-binding";
import { AuditService } from "../src/modules/audit/audit.service";
import { OrderbookService } from "../src/modules/orders/orderbook.service";
import { OwnershipService } from "../src/modules/ownership/ownership.service";
import { SettlementSideEffectsService } from "../src/modules/side-effects/settlement-side-effects.service";
import { TicketOwnershipSideEffectsService } from "../src/modules/side-effects/ticket-ownership-side-effects.service";
import { TicketsService } from "../src/modules/tickets/tickets.service";

function createService(prisma: unknown, onsaleInventory?: unknown) {
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
    new ConfigService({ FANPASS_DATA_SOURCE: "prisma" }),
    undefined,
    onsaleInventory as any,
  );
}

function createPrimarySagaService(input: {
  prisma: unknown;
  tickets: unknown;
  settlementSideEffects: unknown;
  onsaleInventory: unknown;
  config?: Record<string, string>;
}) {
  const store = new DemoStore();
  return new OrderbookService(
    store,
    new AuditService(store),
    input.settlementSideEffects as never,
    input.tickets as never,
    input.prisma as never,
    new ConfigService({
      FANPASS_DATA_SOURCE: "prisma",
      ...(input.config ?? {}),
    }),
    undefined,
    input.onsaleInventory as never,
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
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "evt_api_demo", status: "PUBLISHED" }),
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

  it("rejects primary checkout for an unpublished event before creating an order or hold", async () => {
    const createOrder = jest.fn();
    const transaction = jest.fn();
    const service = createService({
      event: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "evt_api_demo", status: "DRAFT" }),
      },
      ticketType: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tt_api_demo",
          eventId: "evt_api_demo",
          faceValue: 100,
          resaleCap: 110,
        }),
      },
      order: {
        create: createOrder,
      },
      $transaction: transaction,
    });

    await expect(
      service.createOrder({
        userId: "usr_buyer_demo",
        eventId: "evt_api_demo",
        ticketTypeId: "tt_api_demo",
        side: "BUY",
        fulfillmentMode: "PRIMARY_ONLY",
        price: 100,
      }),
    ).rejects.toThrow("Event is not available for checkout");
    expect(transaction).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("locks and rechecks the event before a primary order is written", async () => {
    const lockTicketType = jest.fn().mockResolvedValue(undefined);
    const reservePrimaryInventory = jest.fn();
    const lockEvent = jest.fn().mockResolvedValue([{ status: "CANCELLED" }]);
    const createOrder = jest.fn();
    const createAudit = jest.fn();
    const tx = {
      $queryRaw: lockEvent,
      order: { create: createOrder },
      auditLog: { create: createAudit },
    };
    const transaction = jest.fn(
      async (operation: (client: typeof tx) => Promise<unknown>) =>
        operation(tx),
    );
    const service = createService(
      {
        event: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: "evt_api_demo", status: "PUBLISHED" }),
        },
        ticketType: {
          findUnique: jest.fn().mockResolvedValue({
            id: "tt_api_demo",
            eventId: "evt_api_demo",
            faceValue: 100,
            resaleCap: 110,
          }),
        },
        order: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        $transaction: transaction,
      },
      {
        lockPrimaryOrderCreation: lockTicketType,
        reservePrimaryInventory,
      },
    );

    await expect(
      service.createOrder({
        userId: "usr_buyer_demo",
        eventId: "evt_api_demo",
        ticketTypeId: "tt_api_demo",
        side: "BUY",
        fulfillmentMode: "PRIMARY_ONLY",
        price: 100,
      }),
    ).rejects.toThrow("Event is not available for checkout");

    expect(lockTicketType).toHaveBeenCalledTimes(1);
    expect(lockEvent).toHaveBeenCalledTimes(1);
    expect(createOrder).not.toHaveBeenCalled();
    expect(reservePrimaryInventory).not.toHaveBeenCalled();
    expect(createAudit).not.toHaveBeenCalled();
  });

  it.each(["DRAFT", "CANCELLED"])(
    "rejects resale writes for a %s event before opening a transaction",
    async (status) => {
      const transaction = jest.fn();
      const createOrder = jest.fn();
      const service = createService({
        event: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: "evt_api_demo", status }),
        },
        ticketType: {
          findUnique: jest.fn().mockResolvedValue({
            id: "tt_api_demo",
            eventId: "evt_api_demo",
            faceValue: 100,
            resaleCap: 110,
            transferable: true,
            maxTransferCount: 1,
          }),
        },
        order: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: createOrder,
        },
        $transaction: transaction,
      });

      await expect(
        service.createOrder({
          userId: "usr_buyer_demo",
          eventId: "evt_api_demo",
          ticketTypeId: "tt_api_demo",
          side: "BUY",
          fulfillmentMode: "RESALE_ONLY",
          price: 100,
        }),
      ).rejects.toThrow("Event is not available for marketplace operations");
      expect(transaction).not.toHaveBeenCalled();
      expect(createOrder).not.toHaveBeenCalled();
    },
  );

  it("locks and rechecks the event before atomically listing a resale ticket and creating its order", async () => {
    const lockEvent = jest.fn().mockResolvedValue([{ status: "PUBLISHED" }]);
    const findTicket = jest.fn().mockResolvedValue({
      id: "tkt_api_demo",
      eventId: "evt_api_demo",
      ticketTypeId: "tt_api_demo",
      ownerId: "usr_seller_demo",
      status: "ACTIVE",
      transferCount: 0,
    });
    const updateTicket = jest.fn().mockResolvedValue({ count: 1 });
    const createOrder = jest.fn().mockResolvedValue({
      id: "ord_api_sell",
      userId: "usr_seller_demo",
      eventId: "evt_api_demo",
      ticketTypeId: "tt_api_demo",
      ticketId: "tkt_api_demo",
      side: "SELL",
      fulfillmentMode: "RESALE_ONLY",
      price: 100,
      quantity: 1,
      remainingQuantity: 1,
      status: "OPEN",
      idempotencyKey: "sell-api-demo",
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
    });
    const createAudit = jest.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: lockEvent,
      ticket: {
        findUnique: findTicket,
        updateMany: updateTicket,
      },
      order: { create: createOrder },
      auditLog: { create: createAudit },
    };
    const transaction = jest.fn(
      async (operation: (client: typeof tx) => Promise<unknown>) =>
        operation(tx),
    );
    const service = createService({
      event: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "evt_api_demo", status: "PUBLISHED" }),
      },
      ticketType: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tt_api_demo",
          eventId: "evt_api_demo",
          faceValue: 100,
          resaleCap: 110,
          transferable: true,
          maxTransferCount: 1,
        }),
      },
      ticket: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tkt_api_demo",
          eventId: "evt_api_demo",
          ticketTypeId: "tt_api_demo",
          ownerId: "usr_seller_demo",
          status: "ACTIVE",
          transferCount: 0,
        }),
      },
      order: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: transaction,
    });

    await expect(
      service.createOrder({
        userId: "usr_seller_demo",
        eventId: "evt_api_demo",
        ticketTypeId: "tt_api_demo",
        ticketId: "tkt_api_demo",
        side: "SELL",
        price: 100,
        idempotencyKey: "sell-api-demo",
      }),
    ).resolves.toMatchObject({
      order: { id: "ord_api_sell", status: "OPEN" },
      trade: null,
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(lockEvent).toHaveBeenCalledTimes(1);
    expect(lockEvent.mock.invocationCallOrder[0]).toBeLessThan(
      findTicket.mock.invocationCallOrder[0],
    );
    expect(updateTicket).toHaveBeenCalledWith({
      where: {
        id: "tkt_api_demo",
        ownerId: "usr_seller_demo",
        status: { in: ["ACTIVE", "TRANSFERRED"] },
      },
      data: { status: "LISTED_FOR_RESALE" },
    });
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(createAudit).toHaveBeenCalledTimes(2);
  });

  it("rejects a resale match after event closure before claims or side-effect outbox writes", async () => {
    const lockEvent = jest.fn().mockResolvedValue([{ status: "CANCELLED" }]);
    const updateOrder = jest.fn();
    const updateTicket = jest.fn();
    const createAudit = jest.fn();
    const createOutbox = jest.fn();
    const findTicket = jest.fn();
    const findBuyer = jest.fn();
    const tx = {
      $queryRaw: lockEvent,
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: "ord_buy_demo",
            userId: "usr_buyer_demo",
            eventId: "evt_api_demo",
            ticketTypeId: "tt_api_demo",
            side: "BUY",
            fulfillmentMode: "RESALE_ONLY",
            status: "OPEN",
          })
          .mockResolvedValueOnce({
            id: "ord_sell_demo",
            userId: "usr_seller_demo",
            eventId: "evt_api_demo",
            ticketTypeId: "tt_api_demo",
            ticketId: "tkt_api_demo",
            side: "SELL",
            price: 100,
            status: "OPEN",
          }),
        updateMany: updateOrder,
      },
      ticket: {
        findUniqueOrThrow: findTicket,
        updateMany: updateTicket,
      },
      user: { findUniqueOrThrow: findBuyer },
      auditLog: { create: createAudit },
      sideEffectOutbox: { create: createOutbox },
    };
    const service = createService({
      trade: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(
        async (operation: (client: typeof tx) => Promise<unknown>) =>
          operation(tx),
      ),
    });

    await expect(
      (service as any).settlePrisma(
        (service as any).prisma,
        "ord_buy_demo",
        "ord_sell_demo",
        100,
      ),
    ).rejects.toThrow("Event is not available for marketplace operations");

    expect(lockEvent).toHaveBeenCalledTimes(1);
    expect(findTicket).not.toHaveBeenCalled();
    expect(findBuyer).not.toHaveBeenCalled();
    expect(updateOrder).not.toHaveBeenCalled();
    expect(updateTicket).not.toHaveBeenCalled();
    expect(createAudit).not.toHaveBeenCalled();
    expect(createOutbox).not.toHaveBeenCalled();
  });

  it("fails closed on an unverified resale wallet before order or ticket claims", async () => {
    const updateOrder = jest.fn();
    const updateTicket = jest.fn();
    const enqueueOwnershipTransfer = jest.fn();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ status: "PUBLISHED" }]),
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(primaryResaleBuyOrder())
          .mockResolvedValueOnce(primaryResaleSellOrder()),
        updateMany: updateOrder,
      },
      ticket: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...primaryResaleTicket(),
          owner: {
            ...verifiedWalletRecord(
              "did:privy:seller",
              "wal_test_seller",
              "0x0000000000000000000000000000000000003001",
            ),
            walletBindingStatus: "UNVERIFIED",
          },
        }),
        updateMany: updateTicket,
      },
      user: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue(
            verifiedWalletRecord(
              "did:privy:buyer",
              "wal_test_buyer",
              "0x0000000000000000000000000000000000003002",
            ),
          ),
      },
      payment: { count: jest.fn().mockResolvedValue(1) },
      auditLog: { create: jest.fn() },
    };
    const service = createPrimarySagaService({
      prisma: {
        trade: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn(
          async (operation: (client: typeof tx) => Promise<unknown>) =>
            operation(tx),
        ),
      },
      tickets: {},
      settlementSideEffects: { enqueueOwnershipTransfer },
      onsaleInventory: {},
      config: { FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: "true" },
    });

    await expect(
      (service as any).settlePrisma(
        (service as any).prisma,
        "ord_buy_binding",
        "ord_sell_binding",
        100,
      ),
    ).rejects.toThrow("Ticket seller wallet is not verified for custody");
    expect(updateOrder).not.toHaveBeenCalled();
    expect(updateTicket).not.toHaveBeenCalled();
    expect(enqueueOwnershipTransfer).not.toHaveBeenCalled();
  });

  it("pins both verified resale wallet binding snapshots in the transfer job", async () => {
    const seller = verifiedWalletRecord(
      "did:privy:seller",
      "wal_test_seller",
      "0x0000000000000000000000000000000000003001",
    );
    const buyer = verifiedWalletRecord(
      "did:privy:buyer",
      "wal_test_buyer",
      "0x0000000000000000000000000000000000003002",
    );
    const enqueueOwnershipTransfer = jest
      .fn()
      .mockResolvedValue("ownership-transfer:test");
    const transferOwnership = jest.fn();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ status: "PUBLISHED" }]),
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(primaryResaleBuyOrder())
          .mockResolvedValueOnce(primaryResaleSellOrder()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      ticket: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...primaryResaleTicket(),
          owner: seller,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue(buyer) },
      payment: { count: jest.fn().mockResolvedValue(1) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = createPrimarySagaService({
      prisma: {
        trade: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn(
          async (operation: (client: typeof tx) => Promise<unknown>) =>
            operation(tx),
        ),
      },
      tickets: {},
      settlementSideEffects: {
        enqueueOwnershipTransfer,
        transferOwnership,
      },
      onsaleInventory: {},
      config: { FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: "true" },
    });

    await expect(
      (service as any).settlePrisma(
        (service as any).prisma,
        "ord_buy_binding",
        "ord_sell_binding",
        100,
      ),
    ).resolves.toBeNull();
    expect(enqueueOwnershipTransfer).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        fromWalletAddress: seller.walletAddress,
        fromWalletBindingVersion: seller.walletBindingVersion,
        fromWalletBindingFingerprint: seller.walletBindingFingerprint,
        toWalletAddress: buyer.walletAddress,
        toWalletBindingVersion: buyer.walletBindingVersion,
        toWalletBindingFingerprint: buyer.walletBindingFingerprint,
      }),
    );
    expect(transferOwnership).not.toHaveBeenCalled();
  });

  it.each([undefined, "false", "TRUE"])(
    "blocks provider-backed Prisma settlement before claims when async dispatch is %p",
    (asyncSettlement) => {
      const transaction = jest.fn();
      const transferOwnership = jest.fn();
      const service = createPrimarySagaService({
        prisma: {
          trade: { findUnique: jest.fn().mockResolvedValue(null) },
          $transaction: transaction,
        },
        tickets: {},
        settlementSideEffects: { transferOwnership },
        onsaleInventory: {},
        config: {
          OWNERSHIP_ADAPTER: "privy",
          ...(asyncSettlement === undefined
            ? {}
            : { FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: asyncSettlement }),
        },
      });

      return expect(
        (service as any).settlePrisma(
          (service as any).prisma,
          "ord_buy_dispatch_fence",
          "ord_sell_dispatch_fence",
          100,
        ),
      )
        .rejects.toThrow(
          "Provider-backed settlement requires FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true",
        )
        .then(() => {
          expect(transaction).not.toHaveBeenCalled();
          expect(transferOwnership).not.toHaveBeenCalled();
        });
    },
  );

  it("blocks the payment-authorized dispatch entrypoint before reading provider-backed orders", async () => {
    const findOrder = jest.fn();
    const transaction = jest.fn();
    const transferOwnership = jest.fn();
    const service = createPrimarySagaService({
      prisma: {
        order: { findUnique: findOrder },
        $transaction: transaction,
      },
      tickets: {},
      settlementSideEffects: { transferOwnership },
      onsaleInventory: {},
      config: {
        OWNERSHIP_ADAPTER: "testnet",
        FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: "false",
      },
    });

    await expect(
      service.settleAfterPaymentAuthorization("ord_dispatch_fence"),
    ).rejects.toThrow(
      "Provider-backed settlement requires FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true",
    );
    expect(findOrder).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(transferOwnership).not.toHaveBeenCalled();
  });

  it("rejects a sell order whose ticket does not belong to the selected market", async () => {
    const updateTicket = jest.fn();
    const createOrder = jest.fn();
    const service = createService({
      event: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "evt_selected", status: "PUBLISHED" }),
      },
      ticketType: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tt_selected",
          eventId: "evt_selected",
          faceValue: 100,
          resaleCap: 5_000,
          transferable: true,
          maxTransferCount: 5,
        }),
      },
      ticket: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tkt_actual",
          eventId: "evt_actual",
          ticketTypeId: "tt_actual",
          ownerId: "usr_seller",
          status: "ACTIVE",
          transferCount: 0,
        }),
        update: updateTicket,
      },
      order: {
        create: createOrder,
      },
    });

    await expect(
      service.createOrder({
        userId: "usr_seller",
        eventId: "evt_selected",
        ticketTypeId: "tt_selected",
        ticketId: "tkt_actual",
        side: "SELL",
        price: 4_000,
      }),
    ).rejects.toThrow("Ticket is not available for this market");
    expect(updateTicket).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("rejects orderbook reads when the ticket category is missing", async () => {
    const findOrders = jest.fn();
    const findTrades = jest.fn();
    const service = createService({
      order: {
        findMany: findOrders,
      },
      trade: {
        findMany: findTrades,
      },
      ticketType: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.getOrderbook("evt_missing", "tt_missing"),
    ).rejects.toThrow("Event or ticket category is not available");
    expect(findOrders).not.toHaveBeenCalled();
    expect(findTrades).not.toHaveBeenCalled();
  });

  it("rejects orderbook reads for an unpublished event before market queries", async () => {
    const findOrders = jest.fn();
    const findTrades = jest.fn();
    const findPublicTicketType = jest.fn().mockResolvedValue(null);
    const service = createService({
      order: {
        findMany: findOrders,
      },
      trade: {
        findMany: findTrades,
      },
      ticketType: {
        findFirst: findPublicTicketType,
      },
    });

    await expect(service.getOrderbook("evt_draft", "tt_draft")).rejects.toThrow(
      "Event or ticket category is not available",
    );
    expect(findPublicTicketType).toHaveBeenCalledWith({
      where: {
        id: "tt_draft",
        eventId: "evt_draft",
        event: {
          status: "PUBLISHED",
        },
      },
    });
    expect(findOrders).not.toHaveBeenCalled();
    expect(findTrades).not.toHaveBeenCalled();
  });

  it("does not let cancellation overwrite an order that a matcher already claimed", async () => {
    const auditCreate = jest.fn();
    const ticketUpdate = jest.fn();
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: "ord_raced",
          userId: "usr_buyer_demo",
          eventId: "evt_api_demo",
          ticketTypeId: "tt_api_demo",
          ticketId: null,
          side: "BUY",
          fulfillmentMode: "RESALE_ONLY",
          price: 100,
          quantity: 1,
          remainingQuantity: 1,
          status: "OPEN",
          idempotencyKey: null,
          createdAt: new Date(),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      ticket: {
        updateMany: ticketUpdate,
      },
      auditLog: {
        create: auditCreate,
      },
    };
    const service = createService({
      $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) =>
        operation(tx),
      ),
    });

    await expect(
      service.cancelOrder("ord_raced", { userId: "usr_buyer_demo" }),
    ).rejects.toThrow("Order is no longer open and cancellable");
    expect(tx.order.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(ticketUpdate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("keeps an authorized primary order matched and never captures while mint proof is pending", async () => {
    const order = {
      id: "ord_primary_pending",
      userId: "usr_buyer_demo",
      eventId: "evt_api_demo",
      ticketTypeId: "tt_api_demo",
      ticketId: null,
      side: "BUY",
      fulfillmentMode: "PRIMARY_ONLY",
      price: 100,
      quantity: 1,
      remainingQuantity: 1,
      status: "OPEN",
      idempotencyKey: null,
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
    };
    const updateOrder = jest.fn().mockResolvedValue({ count: 1 });
    const capture = jest.fn();
    const tx = {
      order: { updateMany: updateOrder },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "pay_primary_pending",
          captureStatus: "AUTHORIZED",
        }),
      },
    };
    const prisma = {
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(order)
          .mockResolvedValueOnce(order)
          .mockResolvedValueOnce({
            ...order,
            status: "MATCHED",
            ticketId: "tkt_primary_pending",
          }),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: updateOrder,
      },
      payment: { count: jest.fn().mockResolvedValue(1) },
      ticket: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tkt_primary_pending",
          eventId: order.eventId,
          ticketTypeId: order.ticketTypeId,
          ownerId: order.userId,
          status: "CREATED",
          tokenId: null,
        }),
      },
      $transaction: jest.fn(
        async (operation: (client: typeof tx) => Promise<unknown>) =>
          operation(tx),
      ),
    };
    const issueTicket = jest.fn().mockResolvedValue({
      id: "tkt_primary_pending",
      eventId: order.eventId,
      ticketTypeId: order.ticketTypeId,
      ownerId: order.userId,
      status: "CREATED",
      tokenId: null,
    });
    const service = createPrimarySagaService({
      prisma,
      tickets: { issueTicket },
      settlementSideEffects: {
        enqueuePaymentCaptureForPrimaryTicket: capture,
      },
      onsaleInventory: {
        orderHoldForIssuance: jest
          .fn()
          .mockResolvedValue({ id: "hold_primary_pending" }),
        releaseOrderHold: jest.fn(),
      },
    });

    await expect(
      service.settleAfterPaymentAuthorization(order.id),
    ).resolves.toMatchObject({
      orderId: order.id,
      ticketId: "tkt_primary_pending",
      fulfillmentType: "PRIMARY",
      matched: true,
      issued: false,
    });

    expect(issueTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        inventoryHoldId: "hold_primary_pending",
        orderId: order.id,
      }),
    );
    expect(updateOrder).toHaveBeenCalledTimes(1);
    expect(updateOrder).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SETTLED" }),
      }),
    );
    expect(capture).not.toHaveBeenCalled();
  });

  it("atomically settles and enqueues capture only after an active token is confirmed", async () => {
    const capture = jest.fn().mockResolvedValue(undefined);
    const updateOrder = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ status: "PUBLISHED" }]),
      ticket: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tkt_primary_confirmed",
          eventId: "evt_api_demo",
          ticketTypeId: "tt_api_demo",
          ownerId: "usr_buyer_demo",
          status: "ACTIVE",
          tokenId: "42",
        }),
      },
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: "ord_primary_confirmed",
          userId: "usr_buyer_demo",
          eventId: "evt_api_demo",
          ticketTypeId: "tt_api_demo",
          ticketId: "tkt_primary_confirmed",
          side: "BUY",
          fulfillmentMode: "PRIMARY_ONLY",
          price: 100,
          status: "MATCHED",
        }),
        updateMany: updateOrder,
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "pay_primary_confirmed",
          captureStatus: "AUTHORIZED",
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = createPrimarySagaService({
      prisma: {
        order: {
          findUnique: jest.fn().mockResolvedValue({
            id: "ord_primary_confirmed",
            eventId: "evt_api_demo",
            ticketTypeId: "tt_api_demo",
          }),
        },
        $transaction: jest.fn(
          async (operation: (client: typeof tx) => Promise<unknown>) =>
            operation(tx),
        ),
      },
      tickets: {},
      settlementSideEffects: {
        enqueuePaymentCaptureForPrimaryTicket: capture,
      },
      onsaleInventory: { releaseOrderHold: jest.fn() },
    });

    await expect(
      service.finalizePrimaryOwnershipIssue("tkt_primary_confirmed"),
    ).resolves.toMatchObject({
      orderId: "ord_primary_confirmed",
      ticketId: "tkt_primary_confirmed",
      issued: true,
    });
    expect(updateOrder).toHaveBeenCalledWith({
      where: {
        id: "ord_primary_confirmed",
        status: "MATCHED",
        side: "BUY",
        ticketId: "tkt_primary_confirmed",
      },
      data: { status: "SETTLED", remainingQuantity: 0 },
    });
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("keeps the confirmed token but compensates instead of capturing when the event closed", async () => {
    const capture = jest.fn();
    const compensate = jest.fn().mockResolvedValue(undefined);
    const releaseOrderHold = jest.fn().mockResolvedValue(undefined);
    const cancelTicket = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ status: "CANCELLED" }]),
      ticket: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tkt_primary_closed",
          eventId: "evt_api_demo",
          ticketTypeId: "tt_api_demo",
          ownerId: "usr_buyer_demo",
          status: "ACTIVE",
          tokenId: "84",
        }),
        updateMany: cancelTicket,
      },
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: "ord_primary_closed",
          userId: "usr_buyer_demo",
          eventId: "evt_api_demo",
          ticketTypeId: "tt_api_demo",
          ticketId: "tkt_primary_closed",
          side: "BUY",
          fulfillmentMode: "PRIMARY_ONLY",
          price: 100,
          status: "MATCHED",
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "pay_primary_closed",
          captureStatus: "AUTHORIZED",
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = createPrimarySagaService({
      prisma: {
        $transaction: jest.fn(
          async (operation: (client: typeof tx) => Promise<unknown>) =>
            operation(tx),
        ),
      },
      tickets: {},
      settlementSideEffects: {
        enqueuePaymentCaptureForPrimaryTicket: capture,
        enqueuePaymentCompensation: compensate,
      },
      onsaleInventory: { releaseOrderHold },
    });

    await expect(
      service.finalizePrimaryOwnershipIssue("tkt_primary_closed"),
    ).resolves.toBeNull();
    expect(cancelTicket).toHaveBeenCalledWith({
      where: {
        id: "tkt_primary_closed",
        status: { in: ["CREATED", "ACTIVE"] },
      },
      data: { status: "CANCELLED" },
    });
    expect(JSON.stringify(cancelTicket.mock.calls)).not.toContain("tokenId");
    expect(releaseOrderHold).toHaveBeenCalledWith(
      tx,
      "ord_primary_closed",
      "primary_event_closed_after_ownership_confirmation",
      true,
    );
    expect(compensate).toHaveBeenCalledWith(tx, {
      paymentId: "pay_primary_closed",
      buyOrderId: "ord_primary_closed",
      captureStatus: "AUTHORIZED",
      reason: "primary_event_closed_after_ownership_confirmation",
    });
    expect(capture).not.toHaveBeenCalled();
  });

  it("rejects the matched order, cancels the created ticket, releases inventory, and compensates a failed mint", async () => {
    const compensate = jest.fn().mockResolvedValue(undefined);
    const releaseOrderHold = jest.fn().mockResolvedValue(undefined);
    const cancelTicket = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      ticket: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tkt_primary_failed",
          eventId: "evt_api_demo",
          ticketTypeId: "tt_api_demo",
          ownerId: "usr_buyer_demo",
          status: "CREATED",
          tokenId: null,
        }),
        updateMany: cancelTicket,
      },
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: "ord_primary_failed",
          userId: "usr_buyer_demo",
          eventId: "evt_api_demo",
          ticketTypeId: "tt_api_demo",
          ticketId: "tkt_primary_failed",
          side: "BUY",
          fulfillmentMode: "PRIMARY_ONLY",
          price: 100,
          status: "MATCHED",
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "pay_primary_failed",
          captureStatus: "AUTHORIZED",
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = createPrimarySagaService({
      prisma: {
        $transaction: jest.fn(
          async (operation: (client: typeof tx) => Promise<unknown>) =>
            operation(tx),
        ),
      },
      tickets: {},
      settlementSideEffects: {
        enqueuePaymentCompensation: compensate,
      },
      onsaleInventory: { releaseOrderHold },
    });

    await expect(
      service.failPrimaryOwnershipIssue(
        "tkt_primary_failed",
        new Error("mint reverted"),
      ),
    ).resolves.toMatchObject({ failed: true });
    expect(cancelTicket).toHaveBeenCalledWith({
      where: {
        id: "tkt_primary_failed",
        status: { in: ["CREATED", "ACTIVE"] },
      },
      data: { status: "CANCELLED" },
    });
    expect(releaseOrderHold).toHaveBeenCalledWith(
      tx,
      "ord_primary_failed",
      "primary_ticket_issue_failed",
      true,
    );
    expect(compensate).toHaveBeenCalledWith(tx, {
      paymentId: "pay_primary_failed",
      buyOrderId: "ord_primary_failed",
      captureStatus: "AUTHORIZED",
      reason: "primary_ticket_issue_failed",
    });
  });
});

function primaryResaleBuyOrder() {
  return {
    id: "ord_buy_binding",
    userId: "usr_buyer_binding",
    eventId: "evt_api_demo",
    ticketTypeId: "tt_api_demo",
    ticketId: null,
    side: "BUY",
    fulfillmentMode: "RESALE_ONLY",
    price: 100,
    status: "OPEN",
  };
}

function primaryResaleSellOrder() {
  return {
    id: "ord_sell_binding",
    userId: "usr_seller_binding",
    eventId: "evt_api_demo",
    ticketTypeId: "tt_api_demo",
    ticketId: "tkt_resale_binding",
    side: "SELL",
    fulfillmentMode: "RESALE_ONLY",
    price: 100,
    status: "OPEN",
  };
}

function primaryResaleTicket() {
  return {
    id: "tkt_resale_binding",
    tokenId: "7",
    eventId: "evt_api_demo",
    ticketTypeId: "tt_api_demo",
    ownerId: "usr_seller_binding",
    transferCount: 0,
    status: "LISTED_FOR_RESALE",
    ticketType: {
      eventId: "evt_api_demo",
      transferable: true,
      resaleCap: 110,
      maxTransferCount: 1,
    },
  };
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
