import { Inject, Injectable, Optional } from "@nestjs/common";
import { readIntegerConfig } from "../../config/security-config";

export const SIDE_EFFECT_HEALTH_CONFIG = Symbol("SIDE_EFFECT_HEALTH_CONFIG");

export interface SideEffectHealthRecord {
  id: string;
  type: string;
  status: string;
  aggregateType: string;
  aggregateId: string;
  attempts: number;
  referenceAt: Date;
  hasRecordedError: boolean;
}

export interface SideEffectHealthStatusCount {
  status: string;
  count: number;
}

interface SideEffectHealthConfigReader {
  get<T = string>(key: string): T | undefined;
}

export abstract class SideEffectHealthStore {
  abstract countByStatus(): Promise<SideEffectHealthStatusCount[]>;

  abstract listStaleProcessing(
    staleBefore: Date,
    limit: number,
  ): Promise<SideEffectHealthRecord[]>;

  abstract listStaleRunnable(
    staleBefore: Date,
    limit: number,
  ): Promise<SideEffectHealthRecord[]>;

  abstract listRecentFailures(limit: number): Promise<SideEffectHealthRecord[]>;
}

interface SideEffectHealthFailure {
  reason:
    "stale_processing_lock" | "stale_runnable_job" | "terminal_or_failed_job";
  id: string;
  type: string;
  status: string;
  aggregateType: string;
  aggregateId: string;
  attempts: number;
  ageSeconds: number;
  hasRecordedError: boolean;
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
    private readonly store: SideEffectHealthStore,
    @Optional()
    @Inject(SIDE_EFFECT_HEALTH_CONFIG)
    private readonly config?: SideEffectHealthConfigReader,
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
        this.store.countByStatus(),
        this.store.listStaleProcessing(processingStaleBefore, 20),
        this.store.listStaleRunnable(pendingStaleBefore, 20),
        this.store.listRecentFailures(20),
      ]);

    const counts = Object.fromEntries(
      statusCounts.map((row) => [row.status, row.count]),
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
    job: SideEffectHealthRecord,
    reason: SideEffectHealthFailure["reason"],
    now: Date,
  ): SideEffectHealthFailure {
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
        Math.floor((now.getTime() - job.referenceAt.getTime()) / 1000),
      ),
      hasRecordedError: job.hasRecordedError,
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
