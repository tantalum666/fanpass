import { SideEffectHealthService } from "../src/modules/side-effects/side-effect-health.service";

describe("SideEffectHealthService", () => {
  it("reports healthy outbox status without exposing payloads", async () => {
    const prisma = new FakePrisma([
      fakeJob({
        id: "sfx_completed",
        status: "COMPLETED",
        payloadJson: {
          secret: "must-not-appear",
        },
      }),
    ]);
    const service = new SideEffectHealthService(prisma as never);

    const result = await service.check();

    expect(result.ok).toBe(true);
    expect(result.counts).toEqual({ COMPLETED: 1 });
    expect(result.failures).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("must-not-appear");
  });

  it("flags stale and terminal outbox jobs without returning payloads", async () => {
    const now = Date.now();
    const prisma = new FakePrisma([
      fakeJob({
        id: "sfx_stale_processing",
        type: "OWNERSHIP_TRANSFER",
        status: "PROCESSING",
        lockedAt: new Date(now - 10 * 60 * 1000),
        payloadJson: {
          token: "hidden-processing-payload",
        },
      }),
      fakeJob({
        id: "sfx_stale_pending",
        type: "PAYMENT_CAPTURE",
        status: "PENDING",
        availableAt: new Date(now - 20 * 60 * 1000),
        payloadJson: {
          token: "hidden-pending-payload",
        },
      }),
      fakeJob({
        id: "sfx_stale_retrying",
        type: "PAYMENT_CANCEL_AUTHORIZATION",
        status: "RETRYING",
        availableAt: new Date(now - 25 * 60 * 1000),
        lastError: "Temporary provider failure",
        payloadJson: {
          token: "hidden-retrying-payload",
        },
      }),
      fakeJob({
        id: "sfx_failed",
        type: "PAYMENT_RECONCILE",
        status: "FAILED",
        attempts: 3,
        lastError: "Provider returned inconsistent state",
        payloadJson: {
          token: "hidden-failed-payload",
        },
      }),
      fakeJob({
        id: "sfx_dead",
        type: "PAYMENT_REFUND",
        status: "DEAD",
        attempts: 5,
        lastError: "Provider timeout",
        payloadJson: {
          token: "hidden-dead-payload",
        },
      }),
    ]);
    const service = new SideEffectHealthService(prisma as never);

    const result = await service.check();

    expect(result.ok).toBe(false);
    expect(result.counts).toEqual({
      DEAD: 1,
      FAILED: 1,
      PENDING: 1,
      PROCESSING: 1,
      RETRYING: 1,
    });
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: "stale_processing_lock",
          id: "sfx_stale_processing",
          type: "OWNERSHIP_TRANSFER",
        }),
        expect.objectContaining({
          reason: "stale_runnable_job",
          id: "sfx_stale_pending",
          type: "PAYMENT_CAPTURE",
        }),
        expect.objectContaining({
          reason: "stale_runnable_job",
          id: "sfx_stale_retrying",
          type: "PAYMENT_CANCEL_AUTHORIZATION",
          lastError: "Temporary provider failure",
        }),
        expect.objectContaining({
          reason: "terminal_or_failed_job",
          id: "sfx_failed",
          type: "PAYMENT_RECONCILE",
          lastError: "Provider returned inconsistent state",
        }),
        expect.objectContaining({
          reason: "terminal_or_failed_job",
          id: "sfx_dead",
          type: "PAYMENT_REFUND",
          lastError: "Provider timeout",
        }),
      ]),
    );
    expect(JSON.stringify(result)).not.toContain("hidden-");
  });
});

class FakePrisma {
  sideEffectOutbox = {
    groupBy: async () => {
      const counts = new Map<string, number>();
      for (const job of this.jobs) {
        counts.set(job.status, (counts.get(job.status) ?? 0) + 1);
      }
      return [...counts].map(([status, count]) => ({
        status,
        _count: {
          _all: count,
        },
      }));
    },
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      return this.jobs.filter((job) => matchesWhere(job, where));
    },
  };

  constructor(private readonly jobs: Array<Record<string, any>>) {}
}

function matchesWhere(job: Record<string, any>, where: Record<string, any>) {
  if (where.status === "PROCESSING" && job.status !== "PROCESSING") {
    return false;
  }
  if (where.status?.in && !where.status.in.includes(job.status)) {
    return false;
  }
  if (where.lockedAt?.lte) {
    return job.lockedAt && job.lockedAt <= where.lockedAt.lte;
  }
  if (where.availableAt?.lte) {
    return job.availableAt && job.availableAt <= where.availableAt.lte;
  }
  return true;
}

function fakeJob(overrides: Record<string, unknown>) {
  const now = new Date();
  return {
    id: "sfx_demo",
    type: "OWNERSHIP_TRANSFER",
    status: "PENDING",
    idempotencyKey: "side-effect-demo",
    aggregateType: "trade",
    aggregateId: "trade-demo",
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
