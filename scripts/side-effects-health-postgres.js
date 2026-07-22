const path = require("path");
const {
  isAllowedLocalPostgresTarget,
} = require("./local-postgres-target-guard");
const {
  assertNode22,
  buildHealthEnvironment,
  resolveProjectModule,
  rootDir,
  runHermeticNode,
} = require("./lib/side-effect-health-gate");

const fallbackDatabaseUrl =
  "postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass";

function runPostgresHealth(options = {}) {
  const databaseUrl =
    options.databaseUrl ?? process.env.DATABASE_URL ?? fallbackDatabaseUrl;
  if (!isAllowedLocalPostgresTarget(databaseUrl, "fanpass")) {
    throw new Error(
      "PostgreSQL side-effect health integration refused a non-local database target",
    );
  }
  const jestCli = resolveProjectModule("jest/bin/jest");
  return runHermeticNode(
    [
      jestCli,
      "--config",
      path.join(rootDir, "apps/api/jest.config.cjs"),
      "--runInBand",
      "--no-cache",
      "--runTestsByPath",
      "test/postgres-side-effect-health.store.spec.ts",
    ],
    {
      cwd: path.join(rootDir, "apps/api"),
      env: buildHealthEnvironment({
        FANPASS_ENV: "test",
        FANPASS_RUN_DATABASE_TESTS: "true",
        FANPASS_CHAIN_PROOF_SYNC_OUTBOX: "false",
        FANPASS_SIDE_EFFECT_HEALTH_LOCAL_ONLY: "true",
        DATABASE_URL: databaseUrl,
      }),
      spawnSyncImpl: options.spawnSyncImpl,
      stdio: options.stdio,
    },
  );
}

function main() {
  assertNode22();
  runPostgresHealth();
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error
        ? `PostgreSQL side-effect health integration failed: ${error.message}`
        : "PostgreSQL side-effect health integration failed",
    );
    process.exit(1);
  }
}

module.exports = { fallbackDatabaseUrl, runPostgresHealth };
