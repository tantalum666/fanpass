import { Client } from "pg";
import type { QueryResult, QueryResultRow } from "pg";
import {
  SideEffectHealthRecord,
  SideEffectHealthStatusCount,
  SideEffectHealthStore,
} from "../modules/side-effects/side-effect-health.service";

interface StatusCountRow {
  status: string;
  count: string;
}

interface HealthRecordRow {
  id: string;
  type: string;
  status: string;
  aggregateType: string;
  aggregateId: string;
  attempts: number;
  referenceAt: Date;
  hasRecordedError: boolean;
}

export class PostgresSideEffectHealthStore extends SideEffectHealthStore {
  private transactionOpen = false;
  private queryTail: Promise<unknown> = Promise.resolve();

  private constructor(private readonly client: Client) {
    super();
  }

  static async connect(connectionString: string) {
    const client = new Client({
      application_name: "fanpass-side-effect-health",
      connectionString,
      connectionTimeoutMillis: 5_000,
      query_timeout: 5_000,
      statement_timeout: 5_000,
    });
    try {
      await client.connect();
      const store = new PostgresSideEffectHealthStore(client);
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      store.transactionOpen = true;
      const identity = await client.query<{
        databaseName: string;
        readOnly: string;
      }>(`
        SELECT
          current_database() AS "databaseName",
          current_setting('transaction_read_only') AS "readOnly"
      `);
      if (
        identity.rows[0]?.databaseName !== "fanpass" ||
        identity.rows[0]?.readOnly !== "on"
      ) {
        throw new Error(
          "Local side-effect health database identity or read-only transaction check failed",
        );
      }
      return store;
    } catch (error) {
      await client.end().catch(() => undefined);
      throw error;
    }
  }

  async countByStatus(): Promise<SideEffectHealthStatusCount[]> {
    this.assertReadable();
    const result = await this.query<StatusCountRow>(`
      SELECT status, COUNT(*)::bigint AS count
      FROM side_effect_outbox
      GROUP BY status
      ORDER BY status ASC
    `);
    return result.rows.map((row) => ({
      status: row.status,
      count: safeCount(row.count),
    }));
  }

  async listStaleProcessing(staleBefore: Date, limit: number) {
    return this.listHealthRecords(
      `
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
          AND locked_at <= ($1::timestamptz AT TIME ZONE 'UTC')
        ORDER BY locked_at ASC, created_at ASC
        LIMIT $2
      `,
      [staleBefore, limit],
    );
  }

  async listStaleRunnable(staleBefore: Date, limit: number) {
    return this.listHealthRecords(
      `
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
          AND available_at <= ($1::timestamptz AT TIME ZONE 'UTC')
        ORDER BY available_at ASC, created_at ASC
        LIMIT $2
      `,
      [staleBefore, limit],
    );
  }

  async listRecentFailures(limit: number) {
    return this.listHealthRecords(
      `
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
        LIMIT $1
      `,
      [limit],
    );
  }

  async close() {
    await this.queryTail.catch(() => undefined);
    if (this.transactionOpen) {
      await this.client.query("ROLLBACK").catch(() => undefined);
      this.transactionOpen = false;
    }
    await this.client.end().catch(() => undefined);
  }

  private async listHealthRecords(
    query: string,
    values: unknown[],
  ): Promise<SideEffectHealthRecord[]> {
    this.assertReadable();
    const result = await this.query<HealthRecordRow>(query, values);
    return result.rows.map((row) => ({
      ...row,
      referenceAt:
        row.referenceAt instanceof Date
          ? row.referenceAt
          : new Date(row.referenceAt),
    }));
  }

  private assertReadable() {
    if (!this.transactionOpen) {
      throw new Error("Side-effect health read-only transaction is not open");
    }
  }

  private query<Row extends QueryResultRow>(
    query: string,
    values: unknown[] = [],
  ): Promise<QueryResult<Row>> {
    const result = this.queryTail.then(() =>
      this.client.query<Row>(query, values),
    );
    this.queryTail = result.catch(() => undefined);
    return result;
  }
}

function safeCount(value: string) {
  const count = BigInt(value);
  if (count > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Side-effect health status count exceeds the safe range");
  }
  return Number(count);
}
