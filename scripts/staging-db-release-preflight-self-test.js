#!/usr/bin/env node
"use strict";

const assert = require("assert/strict");
const { readFileSync } = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  AGGREGATE_QUERY,
  IDENTITY_QUERY,
  KNOWN_SIDE_EFFECT_TYPES,
  REQUIRED_SCHEMA_CHECKS,
  SCHEMA_QUERY,
  collectReadOnlyDatabaseIdentity,
  collectReadOnlySnapshot,
  deriveDatabaseIdentityDigest,
  evaluateIdentityOnlySnapshot,
  evaluateSnapshot,
} = require("./lib/staging-db-release-preflight");

const tests = [];
const TEST_DATABASE_URL =
  "postgresql://fanpass_staging_user:never-output@staging-db.example:5432/fanpass_staging?sslmode=require&sslaccept=strict&schema=public";
const TEST_DATABASE_IDENTITY = deriveDatabaseIdentityDigest(TEST_DATABASE_URL);

assert.ok(TEST_DATABASE_IDENTITY);

void run();

async function run() {
  await test("uses one read-only transaction and fixed aggregate SELECTs", async () => {
    const executed = [];
    const queried = [];
    const snapshot = await collectReadOnlySnapshot(
      fakePrisma({
        execute(sql) {
          executed.push(sql);
          return 0;
        },
        query(sql) {
          queried.push(sql);
          if (sql === SCHEMA_QUERY) {
            return [completeSchema()];
          }
          if (sql === AGGREGATE_QUERY) {
            return [completeCounts({ ownershipJobsPending: 2n })];
          }
          throw new Error("unexpected query");
        },
      }),
    );

    assert.deepEqual(executed, [
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      "SET LOCAL statement_timeout = '15000ms'",
    ]);
    assert.equal(queried.length, 2);
    assert.match(queried[0].trim(), /^SELECT\b/);
    assert.match(queried[1].trim(), /^WITH\b/);
    for (const sql of queried) {
      assert.doesNotMatch(
        sql.replace(/'(?:''|[^'])*'/g, "''"),
        /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|CALL|COPY)\b/i,
      );
    }
    assert.equal(snapshot.aggregates.ownershipJobsPending, 2n);
  });

  await test("validates database identity without reading application schema", async () => {
    const executed = [];
    const queried = [];
    const snapshot = await collectReadOnlyDatabaseIdentity(
      fakePrisma({
        execute(sql) {
          executed.push(sql);
          return 0;
        },
        query(sql) {
          queried.push(sql);
          assert.equal(sql, IDENTITY_QUERY);
          return [
            {
              transactionReadOnly: true,
              databaseName: "fanpass_staging",
              databaseUser: "fanpass_staging_user",
              databaseSchema: "public",
              databaseSessionUser: "fanpass_staging_user",
            },
          ];
        },
      }),
    );
    assert.deepEqual(executed, [
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      "SET LOCAL statement_timeout = '15000ms'",
    ]);
    assert.deepEqual(queried, [IDENTITY_QUERY]);
    assert.doesNotMatch(IDENTITY_QUERY, /information_schema|pg_catalog/i);
    assert.deepEqual(
      evaluateIdentityOnlySnapshot(snapshot, readyEnvironment()),
      {
        version: "fanpass-staging-db-release-preflight-v1",
        ok: true,
        mode: "database-identity-only",
        redaction: {
          databaseUrlRedacted: true,
          databaseIdentityDigestRedacted: true,
          databaseNameRedacted: true,
          databaseUserRedacted: true,
          databaseSchemaRedacted: true,
          databaseSessionUserRedacted: true,
        },
        databaseIdentity: {
          expectedDigestConfigured: true,
          expectedDigestValid: true,
          targetConfigurationValid: true,
          matched: true,
          databaseNameChecked: true,
          databaseNameMatched: true,
          databaseUserChecked: true,
          databaseUserMatched: true,
          databaseSchemaChecked: true,
          databaseSchemaMatched: true,
          databaseSessionUserChecked: true,
          databaseSessionUserMatched: true,
        },
        readOnlyTransaction: true,
        blockers: [],
      },
    );
    const wrongConnectedDatabase = evaluateIdentityOnlySnapshot(
      { ...snapshot, databaseName: "fanpass_wrong_target" },
      readyEnvironment(),
    );
    assert.deepEqual(wrongConnectedDatabase.blockers, [
      "STAGING_DATABASE_NAME_MISMATCH",
    ]);
    assert.equal(
      JSON.stringify(wrongConnectedDatabase).includes("fanpass_wrong_target"),
      false,
    );
    const wrongConnectedSchema = evaluateIdentityOnlySnapshot(
      { ...snapshot, databaseSchema: "private" },
      readyEnvironment(),
    );
    assert.deepEqual(wrongConnectedSchema.blockers, [
      "STAGING_DATABASE_SCHEMA_MISMATCH",
    ]);
    assert.equal(
      JSON.stringify(wrongConnectedSchema).includes("private"),
      false,
    );
    const wrongSessionUser = evaluateIdentityOnlySnapshot(
      { ...snapshot, databaseSessionUser: "unexpected_session_user" },
      readyEnvironment(),
    );
    assert.deepEqual(wrongSessionUser.blockers, [
      "STAGING_DATABASE_SESSION_USER_MISMATCH",
    ]);
    assert.equal(
      JSON.stringify(wrongSessionUser).includes("unexpected_session_user"),
      false,
    );
    const writableTransaction = evaluateIdentityOnlySnapshot(
      { ...snapshot, transactionReadOnly: false },
      readyEnvironment(),
    );
    assert.deepEqual(writableTransaction.blockers, [
      "DATABASE_IDENTITY_TRANSACTION_NOT_READ_ONLY",
    ]);
  });

  await test("forces identity validation before every mutation chain", () => {
    const apiPackage = JSON.parse(
      readFileSync(path.join(__dirname, "../apps/api/package.json"), "utf8"),
    );
    const scripts = apiPackage.scripts;
    assert.equal(
      scripts["prisma:identity-gate"],
      "node ../../scripts/staging-db-release-preflight.js --identity-only --json",
    );
    assert.equal(
      scripts["prisma:after-identity"],
      "npm run prisma:predeploy && npm run prisma:push:raw && npm run prisma:postdeploy && npm run public-events:upsert:source",
    );
    for (const entrypoint of ["prisma:push", "prisma:deploy"]) {
      assert.equal(
        scripts[entrypoint],
        "npm run prisma:identity-gate && npm run prisma:after-identity",
      );
    }
    const workflow = readFileSync(
      path.join(__dirname, "../.github/workflows/beta-foundation.yml"),
      "utf8",
    );
    assert.match(workflow, /npm run prisma:push:raw -w apps\/api/);
    assert.match(workflow, /npm run prisma:after-identity -w apps\/api/);
    assert.doesNotMatch(
      workflow,
      /npm run prisma:(?:push|deploy) -w apps\/api/,
    );
    assert.ok(
      workflow.indexOf("npm run prisma:push:raw -w apps/api") <
        workflow.indexOf("npm run prisma:after-identity -w apps/api"),
    );
  });

  await test("keeps the unknown-type allowlist synchronized with worker dispatch", () => {
    const workerSource = readFileSync(
      path.join(
        __dirname,
        "../apps/api/src/modules/side-effects/side-effect-worker.service.ts",
      ),
      "utf8",
    );
    const dispatchedTypes = [
      ...workerSource.matchAll(/case ["']([A-Z0-9_]+)["']:/g),
    ]
      .map((match) => match[1])
      .sort();
    assert.deepEqual(dispatchedTypes, [...KNOWN_SIDE_EFFECT_TYPES].sort());
  });

  await test("does not query business tables when schema prerequisites are absent", async () => {
    let queryCount = 0;
    const schema = completeSchema({ ticketsTable: false });
    const snapshot = await collectReadOnlySnapshot(
      fakePrisma({
        execute() {
          return 0;
        },
        query(sql) {
          queryCount += 1;
          assert.equal(sql, SCHEMA_QUERY);
          return [schema];
        },
      }),
    );
    assert.equal(queryCount, 1);
    assert.equal(snapshot.aggregates, null);
  });

  await test("binds evidence to a redacted canonical Staging database identity", () => {
    const equivalent = deriveDatabaseIdentityDigest(
      "postgres://fanpass_staging_user:different-password@STAGING-DB.EXAMPLE/fanpass_staging?connect_timeout=2&sslmode=REQUIRE&sslaccept=STRICT",
    );
    assert.equal(equivalent, TEST_DATABASE_IDENTITY);
    assert.equal(
      deriveDatabaseIdentityDigest(
        "postgresql://fanpass_staging_user:x@staging-db.example/fanpass_staging?sslmode=require&sslmode=require&sslaccept=strict",
      ),
      null,
    );
    for (const unsafeUrl of [
      "postgresql://fanpass_staging_user:x@staging-db.example/fanpass_staging?sslmode=require",
      "postgresql://fanpass_staging_user:x@staging-db.example/fanpass_staging?sslmode=require&sslaccept=accept_invalid_certs",
      "postgresql://fanpass_staging_user:x@staging-db.example/fanpass_staging?sslmode=verify-full&sslaccept=strict",
      "postgresql://fanpass_staging_user:x@staging-db.example/fanpass_staging?sslmode=require&sslaccept=strict&sslaccept=strict",
      "postgresql://fanpass_staging_user:x@staging-db.example/fanpass_staging?sslmode=require&sslaccept=strict&host=%2Ftmp",
      "postgresql://fanpass_staging_user:x@staging-db.example/fanpass_staging?sslmode=require&sslaccept=strict&options=-csearch_path%3Devil",
      "postgresql://fanpass_staging_user:x@staging-db.example/fanpass_staging?sslmode=require&sslaccept=strict&schema=private",
      "postgresql://fanpass_staging_user:x@staging-db.example/fanpass_staging?sslmode=require&sslaccept=strict&schema=public&schema=public",
      "postgresql://fanpass_staging_user:x@staging-db.example/fanpass_staging?sslmode=require&sslaccept=strict&channel_binding=disable",
      "postgresql://fanpass_staging_user:x@staging-db.example/fanpass_staging?sslmode=require&sslaccept=strict&sslcert=other-ca.pem",
      "postgresql://fanpass_staging_user:x@staging-db.example/fanpass_staging?sslmode=require&SSLACCEPT=strict",
    ]) {
      assert.equal(deriveDatabaseIdentityDigest(unsafeUrl), null);
    }

    const result = evaluateSnapshot(readySnapshot(), readyEnvironment());
    assert.equal(result.ok, true);
    assert.deepEqual(result.databaseIdentity, {
      expectedDigestConfigured: true,
      expectedDigestValid: true,
      targetConfigurationValid: true,
      matched: true,
      databaseNameChecked: true,
      databaseNameMatched: true,
      databaseUserChecked: true,
      databaseUserMatched: true,
      databaseSchemaChecked: true,
      databaseSchemaMatched: true,
      databaseSessionUserChecked: true,
      databaseSessionUserMatched: true,
    });
    assert.equal(JSON.stringify(result).includes("never-output"), false);
    assert.equal(
      JSON.stringify(result).includes(TEST_DATABASE_IDENTITY),
      false,
    );
  });

  await test("fails closed on a missing, mismatched, or wrong connected identity", () => {
    const missing = evaluateSnapshot(readySnapshot(), {
      ...readyEnvironment(),
      FANPASS_STAGING_DATABASE_IDENTITY_SHA256: undefined,
    });
    assert.ok(
      missing.blockers.includes("STAGING_DATABASE_IDENTITY_DIGEST_MISSING"),
    );

    const mismatched = evaluateSnapshot(readySnapshot(), {
      ...readyEnvironment(),
      FANPASS_STAGING_DATABASE_IDENTITY_SHA256: "0".repeat(64),
    });
    assert.ok(
      mismatched.blockers.includes("STAGING_DATABASE_IDENTITY_MISMATCH"),
    );

    const wrongDatabase = evaluateSnapshot(
      {
        ...readySnapshot(),
        schema: completeSchema({ databaseName: "fanpass_local_clone" }),
      },
      readyEnvironment(),
    );
    assert.ok(
      wrongDatabase.blockers.includes("STAGING_DATABASE_NAME_MISMATCH"),
    );
  });

  await test("passes only when ownership and provider queues are drained", () => {
    const result = evaluateSnapshot(
      {
        schema: completeSchema(),
        aggregates: completeCounts({
          ticketsTotal: 20n,
          ticketsTokenized: 8n,
          ticketsRouteComplete: 8n,
          ownershipJobsTotal: 4n,
          ownershipJobsCompleted: 4n,
        }),
      },
      readyEnvironment(),
    );
    assert.equal(result.ok, true);
    assert.equal(result.counts.ownershipJobsPending, 0);
    assert.equal(result.worker.preflightProcessConfiguredDisabled, true);
    assert.equal(result.worker.databaseDispatchPaused, true);
    assert.equal(result.worker.dispatchClaimsBlockedAtDatabase, true);
    assert.equal(result.worker.shouldRemainDisabled, true);
    assert.equal(result.worker.safeForControlledEnable, false);
    assert.equal(result.worker.externalRuntimeProofRequired, false);
    assert.deepEqual(result.blockers, []);
  });

  await test("fails closed when the worker is enabled", () => {
    const result = evaluateSnapshot(
      readySnapshot(),
      readyEnvironment({ FANPASS_SIDE_EFFECT_WORKER_ENABLED: "true" }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.worker.preflightProcessConfiguredDisabled, false);
    assert.equal(result.worker.shouldRemainDisabled, true);
    assert.equal(result.worker.safeForControlledEnable, false);
    assert.ok(
      result.blockers.includes("SIDE_EFFECT_WORKER_NOT_EXPLICITLY_DISABLED"),
    );
  });

  await test("blocks pending and retrying ownership work", () => {
    const result = evaluateSnapshot(
      {
        schema: completeSchema(),
        aggregates: completeCounts({
          ownershipJobsPending: 1n,
          ownershipJobsRetrying: 1n,
          ownershipJobsActiveIssue: 1n,
        }),
      },
      readyEnvironment(),
    );
    assert.equal(result.ok, false);
    assert.ok(result.blockers.includes("OWNERSHIP_JOBS_PENDING"));
    assert.ok(result.blockers.includes("OWNERSHIP_JOBS_RETRYING"));
    assert.ok(result.blockers.includes("OWNERSHIP_JOBS_ACTIVE_ISSUE"));
  });

  await test("blocks when the database dispatch fence is not paused", () => {
    const result = evaluateSnapshot(
      {
        schema: completeSchema(),
        aggregates: completeCounts({
          dispatchControlPausedReadyRows: 0n,
          dispatchControlUnpausedRows: 1n,
        }),
      },
      readyEnvironment(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.worker.databaseDispatchPaused, false);
    assert.equal(result.worker.dispatchClaimsBlockedAtDatabase, false);
    assert.ok(result.blockers.includes("DISPATCH_CONTROL_NOT_PAUSED_READY"));
    assert.ok(result.blockers.includes("DISPATCH_CONTROL_UNPAUSED_ROWS"));
  });

  await test("blocks a consumed or armed probe budget until an explicit pause", () => {
    const result = evaluateSnapshot(
      {
        schema: completeSchema(),
        aggregates: completeCounts({
          dispatchControlPausedReadyRows: 0n,
          dispatchControlProbeBudgetActiveRows: 1n,
        }),
      },
      readyEnvironment(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.worker.databaseDispatchPaused, false);
    assert.ok(result.blockers.includes("DISPATCH_CONTROL_NOT_PAUSED_READY"));
    assert.ok(
      result.blockers.includes("DISPATCH_CONTROL_PROBE_BUDGET_ACTIVE_ROWS"),
    );
  });

  await test("rejects non-canonical Staging configuration", () => {
    const result = evaluateSnapshot(
      readySnapshot(),
      readyEnvironment({
        OWNERSHIP_ADAPTER: "Privy",
        FANPASS_CHAIN_PROOF_SYNC_OUTBOX: " true ",
        FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: " true ",
        FANPASS_SIDE_EFFECT_WORKER_ENABLED: " false ",
      }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.configuration.sideEffectWorker, "invalid");
    assert.equal(result.configuration.chainProofSync, "invalid");
    assert.equal(result.configuration.asyncOwnershipSettlement, "invalid");
    assert.equal(result.configuration.ownershipAdapter, "invalid");
    assert.ok(
      result.blockers.includes("SIDE_EFFECT_WORKER_NOT_EXPLICITLY_DISABLED"),
    );
    assert.ok(
      result.blockers.includes("CHAIN_PROOF_SYNC_NOT_EXPLICITLY_ENABLED"),
    );
    assert.ok(
      result.blockers.includes(
        "ASYNC_OWNERSHIP_SETTLEMENT_NOT_EXPLICITLY_ENABLED",
      ),
    );
    assert.ok(result.blockers.includes("STAGING_OWNERSHIP_ADAPTER_NOT_PRIVY"));
  });

  await test("blocks ambiguous, processing, and malformed ownership work", () => {
    const result = evaluateSnapshot(
      {
        schema: completeSchema(),
        aggregates: completeCounts({
          ownershipJobsProcessing: 1n,
          ownershipJobsAmbiguousUnresolved: 1n,
          ownershipJobsActiveRouteInvalid: 2n,
        }),
      },
      readyEnvironment(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.worker.shouldRemainDisabled, true);
    assert.ok(result.blockers.includes("OWNERSHIP_JOBS_PROCESSING"));
    assert.ok(result.blockers.includes("OWNERSHIP_JOBS_AMBIGUOUS_UNRESOLVED"));
    assert.ok(result.blockers.includes("OWNERSHIP_JOBS_ACTIVE_ROUTE_INVALID"));
  });

  await test("blocks ticket-route mismatch and unresolved provider state", () => {
    const result = evaluateSnapshot(
      {
        schema: completeSchema(),
        aggregates: completeCounts({
          ownershipJobsTicketRouteMismatch: 1n,
          providerJobsUnresolved: 1n,
          providerIncompleteCardPaymentsTotal: 1n,
          providerIncompleteCardPaymentsWithoutActiveIntentJob: 1n,
          sponsoredCryptoSubmissionsNonterminal: 1n,
          sponsoredCryptoSubmissionsExpiredLease: 1n,
        }),
      },
      readyEnvironment(),
    );
    assert.equal(result.ok, false);
    assert.ok(result.blockers.includes("OWNERSHIP_JOBS_TICKET_ROUTE_MISMATCH"));
    assert.ok(result.blockers.includes("PROVIDER_JOBS_UNRESOLVED"));
    assert.ok(
      result.blockers.includes(
        "PROVIDER_INCOMPLETE_CARD_PAYMENTS_WITHOUT_ACTIVE_INTENT_JOB",
      ),
    );
    assert.ok(
      result.blockers.includes("SPONSORED_CRYPTO_SUBMISSIONS_NONTERMINAL"),
    );
    assert.ok(
      result.blockers.includes("SPONSORED_CRYPTO_SUBMISSIONS_EXPIRED_LEASE"),
    );
  });

  await test("blocks global unknown statuses and unrecognized outbox types", () => {
    const result = evaluateSnapshot(
      {
        schema: completeSchema(),
        aggregates: completeCounts({
          outboxJobsUnknownStatus: 1n,
          outboxJobsUnrecognizedTypeUnresolved: 2n,
          outboxJobsUnrecognizedTypeProcessing: 1n,
        }),
      },
      readyEnvironment(),
    );
    assert.equal(result.ok, false);
    assert.ok(result.blockers.includes("OUTBOX_JOBS_UNKNOWN_STATUS"));
    assert.ok(
      result.blockers.includes("OUTBOX_JOBS_UNRECOGNIZED_TYPE_UNRESOLVED"),
    );
    assert.ok(
      result.blockers.includes("OUTBOX_JOBS_UNRECOGNIZED_TYPE_PROCESSING"),
    );
  });

  await test("reports legacy backfill readiness without exposing route values", () => {
    const secretAddress = `0x${"a".repeat(40)}`;
    const result = evaluateSnapshot(
      {
        schema: completeSchema(),
        aggregates: completeCounts({
          ticketsTotal: 1n,
          ticketsTokenized: 1n,
          ticketsTokenizedRouteIncomplete: 1n,
        }),
      },
      readyEnvironment({
        FANPASS_LEGACY_OWNERSHIP_ADAPTER: "privy",
        FANPASS_LEGACY_TICKET_CONTRACT_ADDRESS: secretAddress,
        FANPASS_LEGACY_TICKET_CHAIN_ID: "11155111",
      }),
    );
    const serialized = JSON.stringify(result);
    assert.equal(result.ok, false);
    assert.equal(result.configuration.legacyRoute.requiredForCurrentData, true);
    assert.equal(result.ownershipRoute.legacyBackfillConfigurationReady, true);
    assert.equal(serialized.includes(secretAddress), false);
  });

  await test("treats missing counts and schema checks as unavailable", () => {
    const result = evaluateSnapshot(
      { schema: completeSchema({ ownershipRouteGuardTrigger: false }) },
      readyEnvironment(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.counts, null);
    assert.equal(result.configuration.legacyRoute.readyForBackfill, false);
    assert.ok(result.blockers.includes("AGGREGATE_STATE_UNAVAILABLE"));
    assert.ok(
      result.blockers.includes("SCHEMA_OWNERSHIP_ROUTE_GUARD_TRIGGER_MISSING"),
    );
  });

  await test("CLI rejects missing DATABASE_URL without printing environment secrets", () => {
    const cli = path.join(__dirname, "staging-db-release-preflight.js");
    const sentinel = "must-never-appear-in-preflight-output";
    const env = {
      ...process.env,
      DATABASE_URL: "",
      FANPASS_LEGACY_TICKET_CONTRACT_ADDRESS: sentinel,
    };
    const result = spawnSync(process.execPath, [cli, "--json"], {
      cwd: path.resolve(__dirname, ".."),
      env,
      encoding: "utf8",
    });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes(sentinel), false);
    const output = JSON.parse(result.stderr);
    assert.deepEqual(output.blockers, ["DATABASE_URL_REQUIRED"]);
    assert.equal(output.redaction.databaseUrlRedacted, true);
  });

  await test("CLI rejects an identity mismatch before opening a database client", () => {
    const cli = path.join(__dirname, "staging-db-release-preflight.js");
    const sentinel = "identity-password-must-never-appear";
    const result = spawnSync(
      process.execPath,
      [cli, "--identity-only", "--json"],
      {
        cwd: path.resolve(__dirname, ".."),
        env: {
          ...process.env,
          DATABASE_URL: `postgresql://fanpass_staging_user:${sentinel}@staging-db.example/fanpass_staging?sslmode=require&sslaccept=strict`,
          FANPASS_STAGING_DATABASE_IDENTITY_SHA256: "0".repeat(64),
        },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes(sentinel), false);
    assert.equal(result.stderr.includes("0".repeat(64)), false);
    const output = JSON.parse(result.stderr);
    assert.deepEqual(output.blockers, ["STAGING_DATABASE_IDENTITY_MISMATCH"]);
    assert.equal(output.mode, "database-identity-only");
    assert.equal(output.readOnlyTransaction, false);
    assert.equal(output.databaseIdentity.matched, false);
  });

  await test("rejects conflicting identity-only arguments without disclosure", () => {
    const cli = path.join(__dirname, "staging-db-release-preflight.js");
    const sentinel = "identity-mode-secret-must-not-appear";
    const result = spawnSync(
      process.execPath,
      [cli, "--identity-only", "--print-identity-digest", "--json"],
      {
        cwd: path.resolve(__dirname, ".."),
        env: {
          ...process.env,
          DATABASE_URL: `postgresql://fanpass_staging_user:${sentinel}@staging-db.example/fanpass_staging?sslmode=require`,
        },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes(sentinel), false);
    const output = JSON.parse(result.stderr);
    assert.equal(output.mode, "database-identity-only");
    assert.deepEqual(output.blockers, ["PREFLIGHT_MODE_CONFLICT"]);
  });

  await test("CLI derives the setup digest without printing database credentials", () => {
    const cli = path.join(__dirname, "staging-db-release-preflight.js");
    const result = spawnSync(
      process.execPath,
      [cli, "--print-identity-digest", "--json"],
      {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout.includes("never-output"), false);
    assert.deepEqual(JSON.parse(result.stdout), {
      version: "fanpass-staging-db-release-preflight-v1",
      ok: true,
      setupOnly: true,
      databaseIdentityDigest: TEST_DATABASE_IDENTITY,
    });
  });

  const failed = tests.filter((entry) => !entry.ok);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: failed.length === 0,
        tests: tests.length,
        passed: tests.length - failed.length,
        failed: failed.map((entry) => entry.name),
        externalDatabaseUsed: false,
      },
      null,
      2,
    )}\n`,
  );
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function test(name, callback) {
  try {
    await callback();
    tests.push({ name, ok: true });
  } catch (error) {
    tests.push({ name, ok: false });
    process.stderr.write(
      `${name}: ${error instanceof Error ? error.message : "failed"}\n`,
    );
  }
}

function fakePrisma(handler) {
  return {
    async $transaction(callback, options) {
      assert.deepEqual(options, { maxWait: 5_000, timeout: 30_000 });
      return callback({
        $executeRawUnsafe: handler.execute,
        $queryRawUnsafe: handler.query,
      });
    },
  };
}

function completeSchema(overrides = {}) {
  return {
    ...Object.fromEntries(REQUIRED_SCHEMA_CHECKS.map((key) => [key, true])),
    databaseName: "fanpass_staging",
    databaseUser: "fanpass_staging_user",
    databaseSchema: "public",
    databaseSessionUser: "fanpass_staging_user",
    ...overrides,
  };
}

function completeCounts(overrides = {}) {
  return {
    ticketsTotal: 0n,
    ticketsTokenized: 0n,
    ticketsRouteComplete: 0n,
    ticketsRouteShapeInvalid: 0n,
    ticketsTokenizedRouteIncomplete: 0n,
    ownershipJobsTotal: 0n,
    ownershipJobsPending: 0n,
    ownershipJobsRetrying: 0n,
    ownershipJobsProcessing: 0n,
    ownershipJobsFailed: 0n,
    ownershipJobsDead: 0n,
    ownershipJobsCompleted: 0n,
    ownershipJobsRunnableBacklog: 0n,
    ownershipJobsUnknownStatus: 0n,
    ownershipJobsAmbiguousUnresolved: 0n,
    ownershipJobsActiveIssue: 0n,
    ownershipJobsUnsafeIssueCutover: 0n,
    ownershipJobsActiveAdapterMismatch: 0n,
    ownershipJobsActiveRouteInvalid: 0n,
    ownershipJobsTicketRouteMismatch: 0n,
    providerJobsTotal: 0n,
    providerJobsUnresolved: 0n,
    providerJobsProcessing: 0n,
    providerJobsFailed: 0n,
    providerJobsDead: 0n,
    providerJobsUnknownStatus: 0n,
    providerIncompleteCardPaymentsTotal: 0n,
    providerIncompleteCardPaymentsWithoutActiveIntentJob: 0n,
    sponsoredCryptoSubmissionsTotal: 0n,
    sponsoredCryptoSubmissionsNonterminal: 0n,
    sponsoredCryptoSubmissionsAmbiguous: 0n,
    sponsoredCryptoSubmissionsCompensationRequired: 0n,
    sponsoredCryptoSubmissionsFailed: 0n,
    sponsoredCryptoSubmissionsExpiredLease: 0n,
    sponsoredCryptoSubmissionsUnknownStatus: 0n,
    outboxJobsUnknownStatus: 0n,
    outboxJobsUnrecognizedTypeUnresolved: 0n,
    outboxJobsUnrecognizedTypeProcessing: 0n,
    dispatchControlRows: 1n,
    dispatchControlPausedReadyRows: 1n,
    dispatchControlUnpausedRows: 0n,
    dispatchControlProbeBudgetActiveRows: 0n,
    dispatchControlInvalidRows: 0n,
    ...overrides,
  };
}

function readySnapshot() {
  return { schema: completeSchema(), aggregates: completeCounts() };
}

function readyEnvironment(overrides = {}) {
  return {
    DATABASE_URL: TEST_DATABASE_URL,
    FANPASS_STAGING_DATABASE_IDENTITY_SHA256: TEST_DATABASE_IDENTITY,
    OWNERSHIP_ADAPTER: "privy",
    FANPASS_CHAIN_PROOF_SYNC_OUTBOX: "true",
    FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: "true",
    FANPASS_SIDE_EFFECT_WORKER_ENABLED: "false",
    ...overrides,
  };
}
