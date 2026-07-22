import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import {
  SideEffectHealthRecord,
  SideEffectHealthStatusCount,
  SideEffectHealthStore,
} from "./side-effect-health.service";

@Injectable()
export class PrismaSideEffectHealthStore extends SideEffectHealthStore {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async countByStatus(): Promise<SideEffectHealthStatusCount[]> {
    const rows = await this.prisma.sideEffectOutbox.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
    });
    return rows.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));
  }

  async listStaleProcessing(staleBefore: Date, limit: number) {
    return this.prisma.$queryRaw<SideEffectHealthRecord[]>(Prisma.sql`
      SELECT
        id,
        type,
        status,
        aggregate_type AS "aggregateType",
        aggregate_id AS "aggregateId",
        attempts,
        COALESCE(locked_at, available_at, updated_at, created_at)
          AT TIME ZONE 'UTC' AS "referenceAt",
        (last_error IS NOT NULL) AS "hasRecordedError"
      FROM side_effect_outbox
      WHERE status = 'PROCESSING'
        AND locked_at AT TIME ZONE 'UTC' <= ${staleBefore}
      ORDER BY locked_at ASC, created_at ASC
      LIMIT ${limit}
    `);
  }

  async listStaleRunnable(staleBefore: Date, limit: number) {
    return this.prisma.$queryRaw<SideEffectHealthRecord[]>(Prisma.sql`
      SELECT
        id,
        type,
        status,
        aggregate_type AS "aggregateType",
        aggregate_id AS "aggregateId",
        attempts,
        COALESCE(locked_at, available_at, updated_at, created_at)
          AT TIME ZONE 'UTC' AS "referenceAt",
        (last_error IS NOT NULL) AS "hasRecordedError"
      FROM side_effect_outbox
      WHERE status IN ('PENDING', 'RETRYING')
        AND available_at AT TIME ZONE 'UTC' <= ${staleBefore}
      ORDER BY available_at ASC, created_at ASC
      LIMIT ${limit}
    `);
  }

  async listRecentFailures(limit: number) {
    return this.prisma.$queryRaw<SideEffectHealthRecord[]>(Prisma.sql`
      SELECT
        id,
        type,
        status,
        aggregate_type AS "aggregateType",
        aggregate_id AS "aggregateId",
        attempts,
        COALESCE(locked_at, available_at, updated_at, created_at)
          AT TIME ZONE 'UTC' AS "referenceAt",
        (last_error IS NOT NULL) AS "hasRecordedError"
      FROM side_effect_outbox
      WHERE status IN ('FAILED', 'DEAD')
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `);
  }
}
