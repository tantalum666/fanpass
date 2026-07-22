#!/usr/bin/env node
"use strict";

const {
  PREFLIGHT_VERSION,
  collectReadOnlyDatabaseIdentity,
  collectReadOnlySnapshot,
  deriveDatabaseIdentityDigest,
  evaluateDatabaseIdentity,
  evaluateIdentityOnlySnapshot,
  evaluateSnapshot,
} = require("./lib/staging-db-release-preflight");

const args = process.argv.slice(2);
const compact = args.includes("--json");
const printIdentityDigest = args.includes("--print-identity-digest");
const identityOnly = args.includes("--identity-only");

if (args.includes("--help")) {
  process.stdout.write(
    [
      "FanPass Staging database release preflight (read-only)",
      "",
      "Usage: npm run staging:db:preflight -- [--json] [--identity-only] [--print-identity-digest]",
      "",
      "Required environment: DATABASE_URL, OWNERSHIP_ADAPTER=privy,",
      "FANPASS_CHAIN_PROOF_SYNC_OUTBOX=true,",
      "FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true,",
      "FANPASS_SIDE_EFFECT_WORKER_ENABLED=false,",
      "FANPASS_STAGING_DATABASE_IDENTITY_SHA256=<64 lowercase hex>.",
      "",
      "Exit codes: 0 ready, 1 release gate blocked, 2 preflight unavailable.",
    ].join("\n") + "\n",
  );
  process.exit(0);
}

const unknownArgs = args.filter(
  (arg) =>
    arg !== "--json" &&
    arg !== "--identity-only" &&
    arg !== "--print-identity-digest",
);
if (unknownArgs.length > 0) {
  emit(
    identityOnly
      ? identityUnavailableResult("PREFLIGHT_ARGUMENT_INVALID")
      : unavailableResult("PREFLIGHT_ARGUMENT_INVALID"),
    compact,
    process.stderr,
  );
  process.exit(2);
}

if (identityOnly && printIdentityDigest) {
  emit(
    identityUnavailableResult("PREFLIGHT_MODE_CONFLICT"),
    compact,
    process.stderr,
  );
  process.exit(2);
}

if (!process.env.DATABASE_URL?.trim()) {
  emit(
    identityOnly
      ? identityUnavailableResult("DATABASE_URL_REQUIRED")
      : unavailableResult("DATABASE_URL_REQUIRED"),
    compact,
    process.stderr,
  );
  process.exit(2);
}

if (printIdentityDigest) {
  const digest = deriveDatabaseIdentityDigest(process.env.DATABASE_URL);
  if (!digest) {
    emit(
      unavailableResult("DATABASE_URL_IDENTITY_INVALID"),
      compact,
      process.stderr,
    );
    process.exit(2);
  }
  emit(
    {
      version: PREFLIGHT_VERSION,
      ok: true,
      setupOnly: true,
      databaseIdentityDigest: digest,
    },
    compact,
    process.stdout,
  );
  process.exit(0);
}

const identityPrecheck = evaluateDatabaseIdentity(process.env);
if (!identityPrecheck.readyForQuery) {
  emit(
    identityOnly
      ? identityUnavailableResult(
          identityPrecheck.blocker,
          identityPrecheck.public,
        )
      : unavailableResult(identityPrecheck.blocker, identityPrecheck.public),
    compact,
    process.stderr,
  );
  process.exit(2);
}

void main();

async function main() {
  let prisma;
  try {
    const { PrismaClient } = require("@prisma/client");
    prisma = new PrismaClient({ log: [] });
    if (identityOnly) {
      const identitySnapshot = await collectReadOnlyDatabaseIdentity(prisma);
      const result = evaluateIdentityOnlySnapshot(
        identitySnapshot,
        process.env,
      );
      emit(result, compact, result.ok ? process.stdout : process.stderr);
      process.exitCode = result.ok ? 0 : 2;
      return;
    }
    const snapshot = await collectReadOnlySnapshot(prisma);
    const result = {
      ...evaluateSnapshot(snapshot, process.env),
      checkedAt: new Date().toISOString(),
    };
    emit(result, compact, result.ok ? process.stdout : process.stderr);
    process.exitCode = result.ok ? 0 : 1;
  } catch {
    emit(
      identityOnly
        ? identityUnavailableResult(
            "DATABASE_IDENTITY_QUERY_FAILED",
            identityPrecheck.public,
          )
        : unavailableResult(
            "DATABASE_PREFLIGHT_QUERY_FAILED",
            identityPrecheck.public,
          ),
      compact,
      process.stderr,
    );
    process.exitCode = 2;
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(() => undefined);
    }
  }
}

function identityUnavailableResult(code, databaseIdentity = null) {
  return {
    version: PREFLIGHT_VERSION,
    ok: false,
    mode: "database-identity-only",
    redaction: {
      databaseUrlRedacted: true,
      databaseIdentityDigestRedacted: true,
      databaseNameRedacted: true,
      databaseUserRedacted: true,
      databaseSchemaRedacted: true,
      databaseSessionUserRedacted: true,
    },
    databaseIdentity: databaseIdentity ?? {
      expectedDigestConfigured: false,
      expectedDigestValid: false,
      targetConfigurationValid: false,
      matched: false,
      databaseNameChecked: false,
      databaseNameMatched: false,
      databaseUserChecked: false,
      databaseUserMatched: false,
      databaseSchemaChecked: false,
      databaseSchemaMatched: false,
      databaseSessionUserChecked: false,
      databaseSessionUserMatched: false,
    },
    readOnlyTransaction: false,
    blockers: [code],
  };
}

function unavailableResult(code, databaseIdentity = null) {
  return {
    version: PREFLIGHT_VERSION,
    ok: false,
    mode: "database-read-only",
    redaction: {
      databaseUrlRedacted: true,
      databaseIdentityDigestRedacted: true,
      recordIdentifiersExcluded: true,
      walletAndPaymentDetailsExcluded: true,
    },
    schema: { ready: false, checks: null },
    databaseIdentity,
    counts: null,
    worker: {
      preflightProcessConfiguredDisabled: false,
      databaseDispatchPaused: false,
      dispatchClaimsBlockedAtDatabase: false,
      shouldRemainDisabled: true,
      safeForControlledEnable: false,
      externalRuntimeProofRequired: true,
    },
    blockers: [code],
  };
}

function emit(value, compactOutput, stream) {
  stream.write(`${JSON.stringify(value, null, compactOutput ? 0 : 2)}\n`);
}
