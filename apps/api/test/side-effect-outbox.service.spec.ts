import {
  OWNERSHIP_SUBMISSION_STARTED_MARKER,
  OWNERSHIP_SUBMISSION_STARTED_PAYLOAD_KEY,
  SideEffectDispatchFencedError,
  SideEffectOutboxService,
} from "../src/modules/side-effects/side-effect-outbox.service";

describe("SideEffectOutboxService receipt polling", () => {
  it("fails closed without an active dispatch lease", async () => {
    const updateMany = jest.fn();
    const service = new SideEffectOutboxService({
      $queryRaw: jest.fn().mockResolvedValue([]),
      sideEffectOutbox: { updateMany },
    } as never);

    await expect(service.claim(outboxJob())).resolves.toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("stamps the current dispatch revision on a claimed job", async () => {
    const claimed = {
      ...outboxJob(),
      status: "PROCESSING",
      dispatchRevision: 7n,
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUnique = jest.fn().mockResolvedValue(claimed);
    const service = new SideEffectOutboxService({
      $queryRaw: jest.fn().mockResolvedValue([{ revision: 7n }]),
      sideEffectOutbox: { updateMany, findUnique },
    } as never);

    await expect(service.claim(outboxJob())).resolves.toEqual(claimed);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dispatchRevision: 7n }),
      }),
    );
  });

  it("treats a database dispatch-guard race as an unclaimed job", async () => {
    const service = new SideEffectOutboxService({
      $queryRaw: jest.fn().mockResolvedValue([{ revision: 3n }]),
      sideEffectOutbox: {
        updateMany: jest
          .fn()
          .mockRejectedValue(
            new Error(
              "fanpass_side_effect_dispatch_blocked: stale dispatch revision",
            ),
          ),
      },
    } as never);

    await expect(service.claim(outboxJob())).resolves.toBeNull();
  });

  it("captures direct provider admission only from unpaused unlimited dispatch", async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({ revision: 9n })
      .mockResolvedValueOnce({ id: "global" });
    const service = new SideEffectOutboxService({
      sideEffectDispatchControl: { findFirst },
    } as never);

    const fence = await service.captureDirectProviderMutationFence();
    await expect(
      service.assertDirectProviderMutationFenceCurrent(fence),
    ).resolves.toBeUndefined();

    expect(findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        id: "global",
        paused: false,
        remainingClaims: null,
        probeJobId: null,
      },
      select: { revision: true },
    });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        id: "global",
        paused: false,
        revision: 9n,
        remainingClaims: null,
        probeJobId: null,
      },
      select: { id: true },
    });
  });

  it("fails direct provider admission closed while paused or in probe mode", async () => {
    const service = new SideEffectOutboxService({
      sideEffectDispatchControl: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as never);

    await expect(
      service.captureDirectProviderMutationFence(),
    ).rejects.toBeInstanceOf(SideEffectDispatchFencedError);
  });

  it("fences a direct provider mutation after the captured revision changes", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new SideEffectOutboxService({
      sideEffectDispatchControl: { findFirst },
    } as never);

    await expect(
      service.assertDirectProviderMutationFenceCurrent({ revision: 4n }),
    ).rejects.toBeInstanceOf(SideEffectDispatchFencedError);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "global",
        paused: false,
        revision: 4n,
        remainingClaims: null,
        probeJobId: null,
      },
      select: { id: true },
    });
  });

  it("fences a claim whose revision is no longer current", async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ current: false }]);
    const claimedAt = new Date("2026-07-20T00:00:00.000Z");
    const service = new SideEffectOutboxService({
      $queryRaw: queryRaw,
    } as never);

    await expect(
      service.assertClaimRevisionCurrent({
        ...outboxJob(),
        status: "PROCESSING",
        attempts: 2,
        lockedAt: claimedAt,
        dispatchRevision: 4n,
      }),
    ).rejects.toBeInstanceOf(SideEffectDispatchFencedError);
    const sql = (queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join("?");
    expect(sql).toContain("claimed_job.status = 'PROCESSING'");
    expect(sql).toContain("claimed_job.attempts =");
    expect(sql).toContain("claimed_job.locked_at AT TIME ZONE 'UTC' =");
    expect(queryRaw.mock.calls[0]?.slice(1)).toEqual([
      "sfx_dispatch_control_test",
      4n,
      4n,
      2,
      claimedAt,
    ]);
  });

  it("persists a sticky ownership submission marker before provider I/O", async () => {
    const lockedAt = new Date("2026-07-20T01:00:00.000Z");
    const payloadJson = {
      ticketId: "tkt_submit_started",
      buyOrderId: "ord_buy_submit_started",
    };
    const markedPayload = {
      ...payloadJson,
      [OWNERSHIP_SUBMISSION_STARTED_PAYLOAD_KEY]: true,
    };
    const claimed = {
      ...outboxJob(),
      id: "sfx_submit_started",
      status: "PROCESSING",
      attempts: 2,
      lockedAt,
      dispatchRevision: 4n,
      payloadJson,
    };
    const findUnique = jest.fn().mockResolvedValue({
      id: "sfx_submit_started",
      status: "PROCESSING",
      payloadJson: markedPayload,
      lastError: OWNERSHIP_SUBMISSION_STARTED_MARKER,
    });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new SideEffectOutboxService({
      sideEffectOutbox: { findUnique, updateMany },
    } as never);

    await expect(
      service.markOwnershipSubmissionStarted(claimed),
    ).resolves.toMatchObject({
      payloadJson: markedPayload,
      lastError: OWNERSHIP_SUBMISSION_STARTED_MARKER,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "sfx_submit_started",
        status: "PROCESSING",
        dispatchRevision: 4n,
        attempts: 2,
        lockedAt,
      },
      data: {
        payloadJson: markedPayload,
        lastError: OWNERSHIP_SUBMISSION_STARTED_MARKER,
      },
    });
  });

  it("does not let a stale ownership claimant mark a recovered claim", async () => {
    const staleClaim = {
      ...outboxJob(),
      status: "PROCESSING",
      attempts: 1,
      lockedAt: new Date("2026-07-20T01:00:00.000Z"),
      dispatchRevision: 4n,
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const findUnique = jest.fn();
    const service = new SideEffectOutboxService({
      sideEffectOutbox: { updateMany, findUnique },
    } as never);

    await expect(
      service.markOwnershipSubmissionStarted(staleClaim),
    ).resolves.toBeNull();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: staleClaim.id,
          status: "PROCESSING",
          dispatchRevision: 4n,
          attempts: 1,
          lockedAt: staleClaim.lockedAt,
        },
      }),
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("does not let a stale claimant complete a newer recovered claim", async () => {
    const staleClaim = {
      ...outboxJob(),
      status: "PROCESSING",
      attempts: 3,
      lockedAt: new Date("2026-07-20T01:00:00.000Z"),
      dispatchRevision: 5n,
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const findUnique = jest.fn();
    const service = new SideEffectOutboxService({
      sideEffectOutbox: { updateMany, findUnique },
    } as never);

    await expect(
      service.completeJob(staleClaim, { ok: true }),
    ).resolves.toBeNull();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: staleClaim.id,
          status: "PROCESSING",
          dispatchRevision: 5n,
          attempts: 3,
          lockedAt: staleClaim.lockedAt,
        },
        data: expect.objectContaining({
          status: "COMPLETED",
          dispatchRevision: null,
        }),
      }),
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("restores the pre-claim attempt count when a receipt remains pending", async () => {
    const claimedAt = new Date("2026-07-20T02:00:00.000Z");
    const claimed = {
      ...outboxJob(),
      id: "sfx_pending_receipt",
      status: "PROCESSING",
      attempts: 9,
      lockedAt: claimedAt,
      dispatchRevision: 6n,
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUnique = jest.fn().mockResolvedValue({
      id: "sfx_pending_receipt",
      status: "RETRYING",
      attempts: 8,
    });
    const service = new SideEffectOutboxService({
      sideEffectOutbox: { updateMany, findUnique },
    } as never);

    await expect(
      service.reschedulePendingReceiptJob(claimed),
    ).resolves.toMatchObject({ status: "RETRYING", attempts: 8 });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "sfx_pending_receipt",
        status: "PROCESSING",
        dispatchRevision: 6n,
        attempts: 9,
        lockedAt: claimedAt,
      },
      data: {
        status: "RETRYING",
        lockedAt: null,
        dispatchRevision: null,
        attempts: 8,
        lastError: null,
        availableAt: expect.any(Date),
      },
    });
  });

  it("does not charge stale receipt polls against the failure budget", async () => {
    const updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 3 });
    const service = new SideEffectOutboxService(
      { sideEffectOutbox: { updateMany } } as never,
      { get: jest.fn(() => "120") } as never,
    );

    await expect(service.recoverStaleProcessingJobs()).resolves.toEqual({
      count: 5,
    });

    const receiptPollTypes = [
      "OWNERSHIP_ISSUE_RECEIPT_POLL",
      "OWNERSHIP_RECEIPT_POLL",
      "OWNERSHIP_REDEEM_RECEIPT_POLL",
    ];
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: "PROCESSING",
        type: { in: receiptPollTypes },
        lockedAt: { lte: expect.any(Date) },
      },
      data: {
        status: "RETRYING",
        lockedAt: null,
        dispatchRevision: null,
        availableAt: expect.any(Date),
        attempts: { decrement: 1 },
        lastError: "Recovered stale PROCESSING lock after 120 seconds",
      },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        status: "PROCESSING",
        type: { notIn: receiptPollTypes },
        lockedAt: { lte: expect.any(Date) },
      },
      data: {
        status: "RETRYING",
        lockedAt: null,
        dispatchRevision: null,
        availableAt: expect.any(Date),
        lastError: "Recovered stale PROCESSING lock after 120 seconds",
      },
    });
  });
});

function outboxJob() {
  const now = new Date();
  return {
    id: "sfx_dispatch_control_test",
    type: "PAYMENT_CAPTURE",
    status: "PENDING",
    idempotencyKey: "payment-capture:dispatch-control-test",
    aggregateType: "payment",
    aggregateId: "pay_dispatch_control_test",
    payloadJson: { paymentId: "pay_dispatch_control_test" },
    attempts: 0,
    lastError: null,
    availableAt: now,
    lockedAt: null,
    dispatchRevision: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
