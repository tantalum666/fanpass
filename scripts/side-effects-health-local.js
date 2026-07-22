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

function runLocalHealth(options = {}) {
  const databaseUrl =
    options.databaseUrl ?? process.env.DATABASE_URL ?? fallbackDatabaseUrl;
  if (!isAllowedLocalPostgresTarget(databaseUrl, "fanpass")) {
    throw new Error(
      "Local side-effect health check refused a non-local database target",
    );
  }
  const tsNodeCli = resolveProjectModule("ts-node/dist/bin.js");
  return runHermeticNode(
    [
      tsNodeCli,
      "--project",
      path.join(rootDir, "apps/api/tsconfig.json"),
      path.join(rootDir, "apps/api/src/workers/side-effect-health-check.ts"),
    ],
    {
      cwd: rootDir,
      env: buildHealthEnvironment({
        TS_NODE_CACHE: "false",
        FANPASS_ENV: "local",
        FANPASS_ASYNC_OWNERSHIP_SETTLEMENT: "true",
        FANPASS_CHAIN_PROOF_SYNC_OUTBOX: "true",
        FANPASS_TRUST_PROXY_HOPS: "1",
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
  runLocalHealth();
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error
        ? `Local side-effect health check failed: ${error.message}`
        : "Local side-effect health check failed",
    );
    process.exit(1);
  }
}

module.exports = { fallbackDatabaseUrl, runLocalHealth };
