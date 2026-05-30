import { SideEffectWorkerService } from "../src/modules/side-effects/side-effect-worker.service";

describe("SideEffectWorkerService", () => {
  it("claims and completes an ownership transfer side-effect", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_TRANSFER",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          fromOwnerId: "usr_fan_demo",
          fromWalletAddress: null,
          toOwnerId: "usr_buyer_demo",
          toWalletAddress: null,
        },
      }),
    ]);
    const ownership = {
      transferTicket: jest.fn(async () => ({
        adapter: "mock",
        status: "CONFIRMED",
        tokenId: "1",
        ownershipRef: "mock:transfer:tkt_demo_001:usr_buyer_demo",
        transactionHash: "mock_tx",
      })),
    };

    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn() } as never,
    );
    const result = await worker.workOnce();

    expect(result).toEqual({
      recovered: 0,
      processed: 1,
      completed: 1,
      retried: 0,
      dead: 0,
    });
    expect(ownership.transferTicket).toHaveBeenCalledWith({
      ticketId: "tkt_demo_001",
      tokenId: "1",
      fromOwnerId: "usr_fan_demo",
      fromWalletAddress: null,
      toOwnerId: "usr_buyer_demo",
      toWalletAddress: null,
    });
    expect(outbox.completed[0]).toMatchObject({
      id: "sfx_demo",
      result: expect.objectContaining({
        ownershipAdapter: "mock",
        transactionHash: "mock_tx",
      }),
    });
  });

  it("enqueues ownership settlement finalization after a provider transfer succeeds", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_TRANSFER",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          fromOwnerId: "usr_fan_demo",
          fromWalletAddress: null,
          toOwnerId: "usr_buyer_demo",
          toWalletAddress: null,
          buyOrderId: "ord_buy_demo",
          sellOrderId: "ord_sell_demo",
        },
      }),
    ]);
    const ownership = {
      transferTicket: jest.fn(async () => ({
        adapter: "mock",
        status: "CONFIRMED",
        tokenId: "1",
        ownershipRef: "mock:transfer:tkt_demo_001:usr_buyer_demo",
        transactionHash: "mock_tx",
      })),
    };

    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn(), finalizeOwnershipTransfer: jest.fn() } as never,
    );
    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(outbox.enqueued[0]).toMatchObject({
      type: "OWNERSHIP_SETTLEMENT_FINALIZE",
      idempotencyKey: "ownership-finalize:ord_buy_demo:ord_sell_demo",
      aggregateType: "trade",
      aggregateId: "ord_buy_demo:ord_sell_demo",
      payload: expect.objectContaining({
        ticketId: "tkt_demo_001",
        buyOrderId: "ord_buy_demo",
        sellOrderId: "ord_sell_demo",
        ownershipAdapter: "mock",
        ownershipStatus: "CONFIRMED",
        ownershipRef: "mock:transfer:tkt_demo_001:usr_buyer_demo",
        transactionHash: "mock_tx",
      }),
    });
  });

  it("finalizes ownership settlement without re-running the provider transfer", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_SETTLEMENT_FINALIZE",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          fromOwnerId: "usr_fan_demo",
          fromWalletAddress: null,
          toOwnerId: "usr_buyer_demo",
          toWalletAddress: null,
          buyOrderId: "ord_buy_demo",
          sellOrderId: "ord_sell_demo",
          ownershipAdapter: "mock",
          ownershipStatus: "CONFIRMED",
          ownershipRef: "mock:transfer:tkt_demo_001:usr_buyer_demo",
          transactionHash: "mock_tx",
        },
      }),
    ]);
    const ownership = {
      transferTicket: jest.fn(),
    };
    const orderbook = {
      finalizeOwnershipTransfer: jest.fn(async () => ({
        id: "trd_demo",
      })),
    };

    const worker = new SideEffectWorkerService(
      outbox as never,
      ownership as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
    );
    const result = await worker.workOnce();

    expect(result.completed).toBe(1);
    expect(ownership.transferTicket).not.toHaveBeenCalled();
    expect(orderbook.finalizeOwnershipTransfer).toHaveBeenCalledWith({
      buyOrderId: "ord_buy_demo",
      sellOrderId: "ord_sell_demo",
      ticketId: "tkt_demo_001",
      ownership: {
        adapter: "mock",
        status: "CONFIRMED",
        tokenId: "1",
        ownershipRef: "mock:transfer:tkt_demo_001:usr_buyer_demo",
        transactionHash: "mock_tx",
      },
    });
    expect(outbox.completed[0]).toMatchObject({
      id: "sfx_demo",
      result: {
        buyOrderId: "ord_buy_demo",
        sellOrderId: "ord_sell_demo",
        ticketId: "tkt_demo_001",
        tradeId: "trd_demo",
        finalized: true,
      },
    });
  });

  it("marks unknown side-effect types for retry", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "UNKNOWN",
        payloadJson: {},
      }),
    ]);
    const worker = new SideEffectWorkerService(
      outbox as never,
      { transferTicket: jest.fn() } as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result).toEqual({
      recovered: 0,
      processed: 1,
      completed: 0,
      retried: 1,
      dead: 0,
    });
    expect(outbox.retried[0]).toMatchObject({
      id: "sfx_demo",
      attempts: 1,
    });
  });

  it("recovers stale processing locks before reading due jobs", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "OWNERSHIP_TRANSFER",
        payloadJson: {
          ticketId: "tkt_demo_001",
          tokenId: "1",
          fromOwnerId: "usr_fan_demo",
          fromWalletAddress: null,
          toOwnerId: "usr_buyer_demo",
          toWalletAddress: null,
        },
      }),
    ]);
    outbox.recoveredCount = 1;
    const worker = new SideEffectWorkerService(
      outbox as never,
      {
        transferTicket: jest.fn(async () => ({
          adapter: "mock",
          status: "CONFIRMED",
          tokenId: "1",
          ownershipRef: "mock:transfer:tkt_demo_001:usr_buyer_demo",
          transactionHash: "mock_tx",
        })),
      } as never,
      { processCreateIntentJob: jest.fn() } as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result.recovered).toBe(1);
    expect(outbox.recoveredBeforePending).toBe(true);
    expect(result.completed).toBe(1);
  });

  it("claims and completes a payment intent side-effect", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "PAYMENT_INTENT_CREATE",
        payloadJson: {
          paymentId: "pay_demo",
        },
      }),
    ]);
    const payments = {
      processCreateIntentJob: jest.fn(async () => ({
        paymentId: "pay_demo",
        orderId: "ord_demo",
        stripePaymentIntentId: "pi_mock_pay_demo",
        status: "requires_payment_method",
        captureStatus: "NOT_CAPTURED",
      })),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      { transferTicket: jest.fn() } as never,
      payments as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result).toEqual({
      recovered: 0,
      processed: 1,
      completed: 1,
      retried: 0,
      dead: 0,
    });
    expect(payments.processCreateIntentJob).toHaveBeenCalledWith("pay_demo");
    expect(outbox.completed[0]).toMatchObject({
      id: "sfx_demo",
      result: expect.objectContaining({
        stripePaymentIntentId: "pi_mock_pay_demo",
      }),
    });
  });

  it("claims and completes a payment capture side-effect", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "PAYMENT_CAPTURE",
        idempotencyKey: "payment-capture:pay_demo:trd_demo",
        payloadJson: {
          paymentId: "pay_demo",
          tradeId: "trd_demo",
        },
      }),
    ]);
    const payments = {
      processCaptureJob: jest.fn(async () => ({
        paymentId: "pay_demo",
        orderId: "ord_demo",
        stripePaymentIntentId: "pi_mock_pay_demo",
        status: "succeeded",
        captureStatus: "CAPTURED",
      })),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      { transferTicket: jest.fn() } as never,
      payments as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result).toEqual({
      recovered: 0,
      processed: 1,
      completed: 1,
      retried: 0,
      dead: 0,
    });
    expect(payments.processCaptureJob).toHaveBeenCalledWith(
      "pay_demo",
      "trd_demo",
      "payment-capture:pay_demo:trd_demo",
    );
    expect(outbox.completed[0]).toMatchObject({
      id: "sfx_demo",
      result: expect.objectContaining({
        captureStatus: "CAPTURED",
      }),
    });
  });

  it("claims payment compensation side-effects", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        id: "sfx_cancel",
        type: "PAYMENT_CANCEL_AUTHORIZATION",
        idempotencyKey: "payment-cancel:pay_auth:ownership_transfer_failed",
        payloadJson: {
          paymentId: "pay_auth",
          reason: "ownership_transfer_failed",
        },
      }),
      fakeJob({
        id: "sfx_refund",
        type: "PAYMENT_REFUND",
        idempotencyKey: "payment-refund:pay_capture:event_cancelled",
        payloadJson: {
          paymentId: "pay_capture",
          reason: "event_cancelled",
        },
      }),
      fakeJob({
        id: "sfx_reconcile",
        type: "PAYMENT_RECONCILE",
        payloadJson: {
          paymentId: "pay_capture",
        },
      }),
    ]);
    const payments = {
      processCancelAuthorizationJob: jest.fn(async () => ({
        paymentId: "pay_auth",
        captureStatus: "CANCELLED",
      })),
      processRefundJob: jest.fn(async () => ({
        paymentId: "pay_capture",
        captureStatus: "REFUNDED",
      })),
      processReconcileJob: jest.fn(async () => ({
        paymentId: "pay_capture",
        captureStatus: "CAPTURED",
      })),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      { transferTicket: jest.fn() } as never,
      payments as never,
      { tryMatch: jest.fn() } as never,
    );

    const result = await worker.workOnce();

    expect(result).toEqual({
      recovered: 0,
      processed: 3,
      completed: 3,
      retried: 0,
      dead: 0,
    });
    expect(payments.processCancelAuthorizationJob).toHaveBeenCalledWith(
      "pay_auth",
      "ownership_transfer_failed",
      "payment-cancel:pay_auth:ownership_transfer_failed",
    );
    expect(payments.processRefundJob).toHaveBeenCalledWith(
      "pay_capture",
      "event_cancelled",
      "payment-refund:pay_capture:event_cancelled",
    );
    expect(payments.processReconcileJob).toHaveBeenCalledWith("pay_capture");
  });

  it("claims and completes an order match retry after payment authorization", async () => {
    const outbox = new FakeOutbox([
      fakeJob({
        type: "ORDER_MATCH_AFTER_PAYMENT_AUTH",
        payloadJson: {
          paymentId: "pay_demo",
          orderId: "ord_buy_demo",
        },
      }),
    ]);
    const orderbook = {
      tryMatch: jest.fn(async () => ({
        id: "trd_demo",
        buyOrderId: "ord_buy_demo",
        sellOrderId: "ord_sell_demo",
      })),
    };
    const worker = new SideEffectWorkerService(
      outbox as never,
      { transferTicket: jest.fn() } as never,
      { processCreateIntentJob: jest.fn() } as never,
      orderbook as never,
    );

    const result = await worker.workOnce();

    expect(result).toEqual({
      recovered: 0,
      processed: 1,
      completed: 1,
      retried: 0,
      dead: 0,
    });
    expect(orderbook.tryMatch).toHaveBeenCalledWith("ord_buy_demo");
    expect(outbox.completed[0]).toMatchObject({
      id: "sfx_demo",
      result: expect.objectContaining({
        orderId: "ord_buy_demo",
        paymentId: "pay_demo",
        tradeId: "trd_demo",
        matched: true,
      }),
    });
  });
});

class FakeOutbox {
  completed: Array<{ id: string; result: unknown }> = [];
  enqueued: unknown[] = [];
  retried: Array<{ id: string; attempts: number; error: unknown }> = [];
  recoveredCount = 0;
  recoveredBeforePending = false;
  private recovered = false;

  constructor(private readonly jobs: Array<Record<string, unknown>>) {}

  async recoverStaleProcessingJobs() {
    this.recovered = true;
    return { count: this.recoveredCount };
  }

  async pending() {
    this.recoveredBeforePending = this.recovered;
    return this.jobs;
  }

  async claim(job: Record<string, unknown>) {
    return {
      ...job,
      attempts: Number(job.attempts ?? 0) + 1,
    };
  }

  async completeJob(id: string, result: unknown) {
    this.completed.push({ id, result });
    return null;
  }

  async enqueueStandalone(input: unknown) {
    this.enqueued.push(input);
    return input;
  }

  async retryOrDeadJob(id: string, error: unknown, attempts: number) {
    this.retried.push({ id, error, attempts });
    return {
      id,
      status: attempts >= 5 ? "DEAD" : "RETRYING",
    };
  }
}

function fakeJob(overrides: Record<string, unknown>) {
  const now = new Date();
  return {
    id: "sfx_demo",
    type: "OWNERSHIP_TRANSFER",
    status: "PENDING",
    idempotencyKey: "ownership-transfer:buy:sell",
    aggregateType: "trade",
    aggregateId: "buy:sell",
    payloadJson: {},
    attempts: 0,
    lastError: null,
    availableAt: now,
    lockedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
