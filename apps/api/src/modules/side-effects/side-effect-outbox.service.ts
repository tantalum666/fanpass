import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, SideEffectOutbox } from "@prisma/client";
import { randomUUID } from "crypto";
import { readIntegerConfig } from "../../config/security-config";
import { PrismaService } from "../../common/prisma.service";

type PrismaWriter = Prisma.TransactionClient | PrismaService;

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
    return this.prisma.sideEffectOutbox.updateMany({
      where: {
        status: "PROCESSING",
        lockedAt: {
          lte: staleBefore,
        },
      },
      data: {
        status: "RETRYING",
        lockedAt: null,
        availableAt: now,
        lastError: `Recovered stale PROCESSING lock after ${timeoutSeconds} seconds`,
      },
    });
  }

  async claim(job: SideEffectOutbox) {
    if (!this.prisma) {
      return null;
    }
    const claimed = await this.prisma.sideEffectOutbox.updateMany({
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
        attempts: {
          increment: 1,
        },
      },
    });
    if (claimed.count !== 1) {
      return null;
    }
    return this.prisma.sideEffectOutbox.findUnique({
      where: {
        id: job.id,
      },
    });
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
        attempts: {
          increment: 1,
        },
        lastError:
          error instanceof Error ? error.message : "Side effect failed",
      },
    });
  }

  async completeJob(id: string, result: Prisma.InputJsonValue) {
    if (!this.prisma) {
      return null;
    }
    return this.prisma.sideEffectOutbox.update({
      where: {
        id,
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        lockedAt: null,
        payloadJson: result,
        lastError: null,
      },
    });
  }

  async retryOrDeadJob(
    id: string,
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
    return this.prisma.sideEffectOutbox.update({
      where: {
        id,
      },
      data: {
        status: terminal ? "DEAD" : "RETRYING",
        lockedAt: null,
        lastError: message,
        availableAt: terminal ? new Date() : this.nextAvailableAt(attempts),
      },
    });
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
}
