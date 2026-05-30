import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SideEffectOutbox } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { readIntegerConfig } from "../../config/security-config";

interface SideEffectHealthFailure {
  reason:
    | "stale_processing_lock"
    | "stale_runnable_job"
    | "terminal_or_failed_job";
  id: string;
  type: string;
  status: string;
  aggregateType: string;
  aggregateId: string;
  attempts: number;
  ageSeconds: number;
  lastError: string | null;
}

export interface SideEffectHealthResult {
  ok: boolean;
  checkedAt: string;
  thresholds: {
    processingStaleSeconds: number;
    pendingStaleSeconds: number;
  };
  counts: Record<string, number>;
  failures: SideEffectHealthFailure[];
}

@Injectable()
export class SideEffectHealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async check(): Promise<SideEffectHealthResult> {
    const now = new Date();
    const processingStaleSeconds = this.processingStaleSeconds();
    const pendingStaleSeconds = this.pendingStaleSeconds();
    const processingStaleBefore = new Date(
      now.getTime() - processingStaleSeconds * 1000,
    );
    const pendingStaleBefore = new Date(
      now.getTime() - pendingStaleSeconds * 1000,
    );

    const [statusCounts, staleProcessing, staleRunnable, recentFailures] =
      await Promise.all([
        this.prisma.sideEffectOutbox.groupBy({
          by: ["status"],
          _count: {
            _all: true,
          },
        }),
        this.prisma.sideEffectOutbox.findMany({
          where: {
            status: "PROCESSING",
            lockedAt: {
              lte: processingStaleBefore,
            },
          },
          orderBy: [{ lockedAt: "asc" }, { createdAt: "asc" }],
          take: 20,
        }),
        this.prisma.sideEffectOutbox.findMany({
          where: {
            status: {
              in: ["PENDING", "RETRYING"],
            },
            availableAt: {
              lte: pendingStaleBefore,
            },
          },
          orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
          take: 20,
        }),
        this.prisma.sideEffectOutbox.findMany({
          where: {
            status: {
              in: ["FAILED", "DEAD"],
            },
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 20,
        }),
      ]);

    const counts = Object.fromEntries(
      statusCounts.map((row) => [row.status, row._count._all]),
    );
    const failures = [
      ...staleProcessing.map((job) =>
        this.summarizeJob(job, "stale_processing_lock", now),
      ),
      ...staleRunnable.map((job) =>
        this.summarizeJob(job, "stale_runnable_job", now),
      ),
      ...recentFailures.map((job) =>
        this.summarizeJob(job, "terminal_or_failed_job", now),
      ),
    ];

    return {
      ok: failures.length === 0,
      checkedAt: now.toISOString(),
      thresholds: {
        processingStaleSeconds,
        pendingStaleSeconds,
      },
      counts,
      failures,
    };
  }

  private summarizeJob(
    job: SideEffectOutbox,
    reason: SideEffectHealthFailure["reason"],
    now: Date,
  ): SideEffectHealthFailure {
    const referenceDate =
      job.lockedAt ?? job.availableAt ?? job.updatedAt ?? job.createdAt;
    return {
      reason,
      id: job.id,
      type: job.type,
      status: job.status,
      aggregateType: job.aggregateType,
      aggregateId: job.aggregateId,
      attempts: job.attempts,
      ageSeconds: Math.max(
        0,
        Math.floor((now.getTime() - referenceDate.getTime()) / 1000),
      ),
      lastError: job.lastError,
    };
  }

  private processingStaleSeconds() {
    return readIntegerConfig(
      this.config ?? { get: () => undefined },
      "SIDE_EFFECT_HEALTH_PROCESSING_STALE_SECONDS",
      readIntegerConfig(
        this.config ?? { get: () => undefined },
        "FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS",
        300,
      ),
    );
  }

  private pendingStaleSeconds() {
    return readIntegerConfig(
      this.config ?? { get: () => undefined },
      "SIDE_EFFECT_HEALTH_PENDING_STALE_SECONDS",
      900,
    );
  }
}
