const path = require("path");
const {
  assertNode22,
  buildHealthEnvironment,
  resolveProjectModule,
  rootDir,
  runHermeticNode,
} = require("./lib/side-effect-health-gate");

function runUnitHealth(options = {}) {
  const jestCli = resolveProjectModule("jest/bin/jest");
  return runHermeticNode(
    [
      jestCli,
      "--config",
      path.join(rootDir, "apps/api/jest.config.cjs"),
      "--runInBand",
      "--no-cache",
      "--runTestsByPath",
      "test/side-effect-health.service.spec.ts",
    ],
    {
      cwd: path.join(rootDir, "apps/api"),
      env: buildHealthEnvironment({
        FANPASS_ENV: "test",
        FANPASS_CHAIN_PROOF_SYNC_OUTBOX: "false",
      }),
      spawnSyncImpl: options.spawnSyncImpl,
      stdio: options.stdio,
    },
  );
}

function main() {
  assertNode22();
  runUnitHealth();
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error
        ? `Side-effect health unit gate failed: ${error.message}`
        : "Side-effect health unit gate failed",
    );
    process.exit(1);
  }
}

module.exports = { runUnitHealth };
