import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, SideEffectOutbox } from "@prisma/client";
import { randomUUID } from "crypto";
import { readIntegerConfig } from "../../config/security-config";
import { PrismaService } from "../../common/prisma.service";

type PrismaWriter = Prisma.TransactionClient | PrismaService;

export const OWNERSHIP_SUBMISSION_STARTED_MARKER =
  "OWNERSHIP_SUBMISSION_STARTED";
export const OWNERSHIP_SUBMISSION_STARTED_PAYLOAD_KEY =
  "_fanpassOwnershipSubmissionStarted";

export class SideEffectDispatchFencedError extends Error {
  constructor() {
    super("Side-effect dispatch claim is no longer current");
    this.name = "SideEffectDispatchFencedError";
  }
}

export interface DirectProviderMutationFence {
  readonly revision: bigint;
}

export interface EnqueueSideEffectInput {
  type: string;
  idempotencyKey: string;
  aggregateType: string;
  aggregateId: string;
  payload: Prisma.InputJsonValue;
  availableAt?: Date;
}

@Injectable()
export class SideEffectOutboxService {
  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  enqueue(writer: PrismaWriter, input: EnqueueSideEffectInput) {
    return writer.sideEffectOutbox.upsert({
      where: {
        idempotencyKey: input.idempotencyKey,
      },
      create: {
        id: `sfx_${randomUUID()}`,
        type: input.type,
        status: "PENDING",
        idempotencyKey: input.idempotencyKey,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payloadJson: input.payload,
        availableAt: input.availableAt ?? new Date(),
      },
      update: {},
    });
  }

  enqueueStandalone(input: EnqueueSideEffectInput) {
    if (!this.prisma) {
      return null;
    }
    return this.enqueue(this.prisma, input);
  }

  async pending(limit = 10) {
    if (!this.prisma) {
      return [];
    }
    return this.prisma.sideEffectOutbox.findMany({
      where: {
        status: {
          in: ["PENDING", "RETRYING"],
        },
        availableAt: {
          lte: new Date(),
        },
      },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    });
  }

  async recoverStaleProcessingJobs() {
    if (!this.prisma) {
      return { count: 0 };
    }
    const timeoutSeconds = this.lockTimeoutSeconds();
    const now = new Date();
    const staleBefore = new Date(now.getTime() - timeoutSeconds * 1000);
    const receiptPollTypes = [
      "OWNERSHIP_ISSUE_RECEIPT_POLL",
      "OWNERSHIP_RECEIPT_POLL",
      "OWNERSHIP_REDEEM_RECEIPT_POLL",
    ];
    const recoveredReceiptPolls = await this.prisma.sideEffectOutbox.updateMany(
      {
        where: {
          status: "PROCESSING",
          type: { in: receiptPollTypes },
          lockedAt: {
            lte: staleBefore,
          },
        },
        data: {
          status: "RETRYING",
          lockedAt: null,
          dispatchRevision: null,
          availableAt: now,
          attempts: { decrement: 1 },
          lastError: `Recovered stale PROCESSING lock after ${timeoutSeconds} seconds`,
        },
      },
    );
    const recoveredOtherJobs = await this.prisma.sideEffectOutbox.updateMany({
      where: {
        status: "PROCESSING",
        type: { notIn: receiptPollTypes },
        lockedAt: {
          lte: staleBefore,
        },
      },
      data: {
        status: "RETRYING",
        lockedAt: null,
        dispatchRevision: null,
        availableAt: now,
        lastError: `Recovered stale PROCESSING lock after ${timeoutSeconds} seconds`,
      },
    });
    return { count: recoveredReceiptPolls.count + recoveredOtherJobs.count };
  }

  async claim(job: SideEffectOutbox) {
    if (!this.prisma) {
      return null;
    }
    const [control] = await this.prisma.$queryRaw<Array<{ revision: bigint }>>`
      SELECT revision
      FROM side_effect_dispatch_control
      WHERE id = 'global'
        AND paused = false
        AND (remaining_claims IS NULL OR remaining_claims > 0)
    `;
    if (!control) {
      return null;
    }
    let claimed: { count: number };
    try {
      claimed = await this.prisma.sideEffectOutbox.updateMany({
        where: {
          id: job.id,
          status: {
            in: ["PENDING", "RETRYING"],
          },
          availableAt: {
            lte: new Date(),
          },
        },
        data: {
          status: "PROCESSING",
          lockedAt: new Date(),
          dispatchRevision: control.revision,
          attempts: {
            increment: 1,
          },
        },
      });
    } catch (error) {
      if (this.isDispatchControlRejection(error)) {
        return null;
      }
      throw error;
    }
    if (claimed.count !== 1) {
      return null;
    }
    return this.prisma.sideEffectOutbox.findUnique({
      where: {
        id: job.id,
      },
    });
  }

  async captureDirectProviderMutationFence(): Promise<DirectProviderMutationFence> {
    if (!this.prisma) {
      throw new SideEffectDispatchFencedError();
    }
    const control = await this.prisma.sideEffectDispatchControl.findFirst({
      where: {
        id: "global",
        paused: false,
        remainingClaims: null,
        probeJobId: null,
      },
      select: { revision: true },
    });
    if (!control) {
      throw new SideEffectDispatchFencedError();
    }
    return Object.freeze({ revision: control.revision });
  }

  async assertDirectProviderMutationFenceCurrent(
    fence: DirectProviderMutationFence,
  ) {
    if (!this.prisma) {
      throw new SideEffectDispatchFencedError();
    }
    const control = await this.prisma.sideEffectDispatchControl.findFirst({
      where: {
        id: "global",
        paused: false,
        revision: fence.revision,
        remainingClaims: null,
        probeJobId: null,
      },
      select: { id: true },
    });
    if (!control) {
      throw new SideEffectDispatchFencedError();
    }
  }

  async assertClaimRevisionCurrent(job: SideEffectOutbox) {
    if (!this.prisma) {
      return;
    }
    if (job.dispatchRevision === null) {
      throw new SideEffectDispatchFencedError();
    }
    const [claim] = await this.prisma.$queryRaw<Array<{ current: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM side_effect_dispatch_control AS control
        JOIN side_effect_outbox AS claimed_job
          ON claimed_job.id = ${job.id}
        WHERE control.id = 'global'
          AND control.revision = ${job.dispatchRevision}
          AND claimed_job.status = 'PROCESSING'
          AND claimed_job.dispatch_revision = ${job.dispatchRevision}
          AND claimed_job.attempts = ${job.attempts}
          AND claimed_job.locked_at AT TIME ZONE 'UTC' = ${job.lockedAt}
      ) AS current
    `;
    if (!claim?.current) {
      throw new SideEffectDispatchFencedError();
    }
  }

  async markCompleted(idempotencyKey: string, result: Prisma.InputJsonValue) {
    if (!this.prisma) {
      return null;
    }
    return this.prisma.sideEffectOutbox.update({
      where: {
        idempotencyKey,
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        dispatchRevision: null,
        payloadJson: result,
        lastError: null,
      },
    });
  }

  async markFailed(idempotencyKey: string, error: unknown) {
    if (!this.prisma) {
      return null;
    }
    return this.prisma.sideEffectOutbox.update({
      where: {
        idempotencyKey,
      },
      data: {
        status: "FAILED",
        dispatchRevision: null,
        attempts: {
          increment: 1,
        },
        lastError:
          error instanceof Error ? error.message : "Side effect failed",
      },
    });
  }

  async completeJob(job: SideEffectOutbox, result: Prisma.InputJsonValue) {
    if (!this.prisma) {
      return null;
    }
    const completed = await this.prisma.sideEffectOutbox.updateMany({
      where: this.processingClaimWhere(job),
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        lockedAt: null,
        dispatchRevision: null,
        payloadJson: result,
        lastError: null,
      },
    });
    if (completed.count !== 1) {
      return null;
    }
    return this.prisma.sideEffectOutbox.findUnique({ where: { id: job.id } });
  }

  async markOwnershipSubmissionStarted(job: SideEffectOutbox) {
    if (!this.prisma) {
      return null;
    }
    if (
      !job.payloadJson ||
      typeof job.payloadJson !== "object" ||
      Array.isArray(job.payloadJson)
    ) {
      return null;
    }
    const marked = await this.prisma.sideEffectOutbox.updateMany({
      where: this.processingClaimWhere(job),
      data: {
        payloadJson: {
          ...(job.payloadJson as Prisma.JsonObject),
          [OWNERSHIP_SUBMISSION_STARTED_PAYLOAD_KEY]: true,
        },
        lastError: OWNERSHIP_SUBMISSION_STARTED_MARKER,
      },
    });
    if (marked.count !== 1) {
      return null;
    }
    return this.prisma.sideEffectOutbox.findUnique({ where: { id: job.id } });
  }

  async retryOrDeadJob(
    job: SideEffectOutbox,
    error: unknown,
    attempts: number,
    maxAttempts = 5,
  ) {
    if (!this.prisma) {
      return null;
    }
    const message =
      error instanceof Error ? error.message : "Side effect failed";
    const terminal = attempts >= maxAttempts;
    const transitioned = await this.prisma.sideEffectOutbox.updateMany({
      where: this.processingClaimWhere(job),
      data: {
        status: terminal ? "DEAD" : "RETRYING",
        lockedAt: null,
        dispatchRevision: null,
        lastError: message,
        availableAt: terminal ? new Date() : this.nextAvailableAt(attempts),
      },
    });
    if (transitioned.count !== 1) {
      return null;
    }
    return this.prisma.sideEffectOutbox.findUnique({ where: { id: job.id } });
  }

  async reschedulePendingReceiptJob(job: SideEffectOutbox) {
    if (!this.prisma) {
      return null;
    }
    const rescheduled = await this.prisma.sideEffectOutbox.updateMany({
      where: this.processingClaimWhere(job),
      data: {
        status: "RETRYING",
        lockedAt: null,
        dispatchRevision: null,
        attempts: Math.max(0, job.attempts - 1),
        lastError: null,
        availableAt: this.nextAvailableAt(1),
      },
    });
    if (rescheduled.count !== 1) {
      return null;
    }
    return this.prisma.sideEffectOutbox.findUnique({ where: { id: job.id } });
  }

  private processingClaimWhere(job: SideEffectOutbox) {
    return {
      id: job.id,
      status: "PROCESSING",
      dispatchRevision: job.dispatchRevision,
      attempts: job.attempts,
      lockedAt: job.lockedAt,
    } satisfies Prisma.SideEffectOutboxWhereInput;
  }

  private nextAvailableAt(attempts: number) {
    const delaySeconds = Math.min(300, 2 ** Math.max(0, attempts - 1) * 15);
    return new Date(Date.now() + delaySeconds * 1000);
  }

  private lockTimeoutSeconds() {
    const value = readIntegerConfig(
      this.config ?? { get: () => undefined },
      "FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS",
      300,
    );
    return Math.min(3600, Math.max(30, value));
  }

  private isDispatchControlRejection(error: unknown) {
    return (
      error instanceof Error &&
      error.message.includes("fanpass_side_effect_dispatch_blocked")
    );
  }
}
