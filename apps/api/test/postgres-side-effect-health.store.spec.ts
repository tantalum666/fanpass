import { Client } from "pg";
import { SideEffectHealthService } from "../src/modules/side-effects/side-effect-health.service";
import { PostgresSideEffectHealthStore } from "../src/workers/postgres-side-effect-health.store";
import {
  findUnexpectedSensitiveEnvironmentKeys,
  isAllowedLocalHealthDatabase,
} from "../src/workers/side-effect-health-runtime";

const runDatabaseTests = process.env.FANPASS_RUN_DATABASE_TESTS === "true";
const describeDatabase = runDatabaseTests ? describe : describe.skip;

describeDatabase("PostgreSQL side-effect health store", () => {
  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass";
  const suffix = process.pid.toString(36);
  const processingId = `sfx_health_processing_${suffix}`;
  const retryingId = `sfx_health_retrying_${suffix}`;
  const failedId = `sfx_health_failed_${suffix}`;
  const ids = [processingId, retryingId, failedId];
  let writer: Client;

  beforeAll(async () => {
    expect(
      findUnexpectedSensitiveEnvironmentKeys(Object.keys(process.env)),
    ).toEqual([]);
    if (!isAllowedLocalHealthDatabase(databaseUrl)) {
      throw new Error(
        "PostgreSQL health integration tests require the explicit local fanpass database",
      );
    }
    writer = new Client({ connectionString: databaseUrl });
    await writer.connect();
  });

  beforeEach(async () => {
    await cleanup();
    await writer.query("SET TIME ZONE 'Pacific/Kiritimati'");
    await insertHealthFixtures();
  });

  afterEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await writer.end();
  });

  it("reads a non-UTC fixture in one redacted, read-only snapshot", async () => {
    const store = await PostgresSideEffectHealthStore.connect(databaseUrl);
    try {
      const result = await new SideEffectHealthService(store).check();
      const serialized = JSON.stringify(result);

      expect(result.ok).toBe(false);
      expect(result.failures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: processingId,
            reason: "stale_processing_lock",
            hasRecordedError: false,
          }),
          expect.objectContaining({
            id: retryingId,
            reason: "stale_runnable_job",
            hasRecordedError: true,
          }),
          expect.objectContaining({
            id: failedId,
            reason: "terminal_or_failed_job",
            hasRecordedError: true,
            ageSeconds: expect.any(Number),
          }),
        ]),
      );
      expect(
        result.failures.find((failure) => failure.id === failedId)?.ageSeconds,
      ).toBeGreaterThanOrEqual(1_700);
      expect(serialized).not.toContain("payload-must-not-appear");
      expect(serialized).not.toContain("must-not-appear");
      expect(serialized).not.toContain("provider.example");

      const readOnlyClient = (store as unknown as { client: Client }).client;
      await expect(
        readOnlyClient.query(
          "DELETE FROM side_effect_outbox WHERE id = 'must-never-execute'",
        ),
      ).rejects.toMatchObject({ code: "25006" });
    } finally {
      await store.close();
    }
  });

  async function insertHealthFixtures() {
    await writer.query("BEGIN");
    try {
      const resumed = await writer.query<{ revision: string }>(`
        UPDATE side_effect_dispatch_control
        SET
          paused = false,
          revision = revision + 1,
          remaining_claims = NULL,
          probe_job_id = NULL,
          updated_at = now()
        WHERE id = 'global'
          AND paused = true
          AND remaining_claims IS NULL
          AND probe_job_id IS NULL
        RETURNING revision
      `);
      if (resumed.rowCount !== 1 || !resumed.rows[0]?.revision) {
        throw new Error(
          "Health fixture requires the local side-effect dispatch fence to start paused",
        );
      }
      const dispatchRevision = resumed.rows[0].revision;
      await writer.query(
        `
        INSERT INTO side_effect_outbox (
          id,
          type,
          status,
          idempotency_key,
          aggregate_type,
          aggregate_id,
          payload_json,
          attempts,
          last_error,
          available_at,
          locked_at,
          dispatch_revision,
          created_at,
          updated_at
        )
        VALUES
          (
            $1,
            'HEALTH_TEST',
            'PROCESSING',
            $4,
            'health-test',
            $1,
            '{"secret":"payload-must-not-appear"}'::jsonb,
            1,
            NULL,
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC' - INTERVAL '10 minutes',
            $7,
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC' - INTERVAL '10 minutes',
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
          ),
          (
            $2,
            'HEALTH_TEST',
            'RETRYING',
            $5,
            'health-test',
            $2,
            '{"secret":"payload-must-not-appear"}'::jsonb,
            2,
            'Provider URL https://provider.example/path?token=must-not-appear',
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC' - INTERVAL '20 minutes',
            NULL,
            NULL,
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC' - INTERVAL '20 minutes',
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
          ),
          (
            $3,
            'HEALTH_TEST',
            'FAILED',
            $6,
            'health-test',
            $3,
            '{"secret":"payload-must-not-appear"}'::jsonb,
            3,
            'Provider failure must-not-appear',
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC' - INTERVAL '30 minutes',
            NULL,
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC' - INTERVAL '30 minutes',
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
          )
      `,
        [
          processingId,
          retryingId,
          failedId,
          `${processingId}-key`,
          `${retryingId}-key`,
          `${failedId}-key`,
          dispatchRevision,
        ],
      );
      const paused = await writer.query(
        `
          UPDATE side_effect_dispatch_control
          SET
            paused = true,
            revision = revision + 1,
            remaining_claims = NULL,
            probe_job_id = NULL,
            updated_at = now()
          WHERE id = 'global'
            AND paused = false
            AND revision = $1
          RETURNING paused
        `,
        [dispatchRevision],
      );
      if (paused.rowCount !== 1 || paused.rows[0]?.paused !== true) {
        throw new Error(
          "Health fixture could not restore the local side-effect dispatch fence",
        );
      }
      await writer.query("COMMIT");
    } catch (error) {
      await writer.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  }

  async function cleanup() {
    if (!writer) {
      return;
    }
    await writer.query("DELETE FROM side_effect_outbox WHERE id = ANY($1)", [
      ids,
    ]);
  }
});
