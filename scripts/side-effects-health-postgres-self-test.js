const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  buildHealthEnvironment,
  fixedPath,
  resolveProjectModule,
  rootDir,
  runHermeticNode,
} = require("./lib/side-effect-health-gate");
const { runUnitHealth } = require("./side-effects-health-unit");
const {
  fallbackDatabaseUrl,
  runPostgresHealth,
} = require("./side-effects-health-postgres");

const results = [];
runCase("uses the running Node binary for the unit health gate", () => {
  const call = capture((spawnSyncImpl) =>
    runUnitHealth({ spawnSyncImpl, stdio: "pipe" }),
  );
  assertHealthSpawn(call, "test/side-effect-health.service.spec.ts");
  assert.equal(call.options.env.DATABASE_URL, undefined);
});
runCase("uses the running Node binary for PostgreSQL integration", () => {
  const call = capture((spawnSyncImpl) =>
    runPostgresHealth({ spawnSyncImpl, stdio: "pipe" }),
  );
  assertHealthSpawn(call, "test/postgres-side-effect-health.store.spec.ts");
  assert.equal(call.options.env.DATABASE_URL, fallbackDatabaseUrl);
  assert.equal(call.options.env.FANPASS_RUN_DATABASE_TESTS, "true");
  assert.equal(call.options.env.FANPASS_SIDE_EFFECT_HEALTH_LOCAL_ONLY, "true");
});
runCase("accepts an explicit credentialed IPv4 loopback target", () => {
  const databaseUrl =
    "postgresql://fixture:postgres-health-password-canary@127.0.0.1:55432/fanpass";
  const call = capture((spawnSyncImpl) =>
    runPostgresHealth({ databaseUrl, spawnSyncImpl, stdio: "pipe" }),
  );
  assert.equal(call.options.env.DATABASE_URL, databaseUrl);
});
runCase("accepts an explicit IPv6 loopback target", () => {
  const databaseUrl = "postgresql://fixture:fixture@[::1]:55432/fanpass";
  const call = capture((spawnSyncImpl) =>
    runPostgresHealth({ databaseUrl, spawnSyncImpl, stdio: "pipe" }),
  );
  assert.equal(call.options.env.DATABASE_URL, databaseUrl);
});
for (const [label, databaseUrl] of [
  [
    "rejects a remote PostgreSQL host",
    "postgresql://u:p@db.example.test:5432/fanpass",
  ],
  ["rejects localhost aliases", "postgresql://u:p@localhost:5432/fanpass"],
  [
    "rejects numeric loopback aliases",
    "postgresql://u:p@2130706433:5432/fanpass",
  ],
  [
    "rejects connection overrides",
    "postgresql://u:p@127.0.0.1:5432/fanpass?host=db.example.test",
  ],
  [
    "rejects the wrong database",
    "postgresql://u:p@127.0.0.1:5432/fanpass_prod",
  ],
  ["rejects missing passwords", "postgresql://u@127.0.0.1:5432/fanpass"],
]) {
  runCase(label, () => {
    let spawned = false;
    assert.throws(() =>
      runPostgresHealth({
        databaseUrl,
        spawnSyncImpl: () => {
          spawned = true;
          return { status: 0 };
        },
      }),
    );
    assert.equal(spawned, false);
  });
}
runCase("does not inherit hostile PATH or provider credentials", () => {
  const env = buildHealthEnvironment({ FANPASS_ENV: "test" });
  assert.equal(env.PATH, fixedPath);
  for (const key of [
    "BASH_ENV",
    "ENV",
    "SHELLOPTS",
    "NODE_OPTIONS",
    "NPM_CONFIG_SCRIPT_SHELL",
    "STRIPE_SECRET_KEY",
    "PRIVY_APP_SECRET",
    "TESTNET_OPERATOR_PRIVATE_KEY",
  ]) {
    assert.equal(env[key], undefined);
  }
});
runCase("resolves fixed real CLI files below project node_modules", () => {
  for (const specifier of ["jest/bin/jest", "ts-node/dist/bin.js"]) {
    const resolved = resolveProjectModule(specifier);
    assert.equal(fs.statSync(resolved).isFile(), true);
    assert.ok(
      resolved.startsWith(
        `${fs.realpathSync(path.join(rootDir, "node_modules"))}${path.sep}`,
      ),
    );
  }
});
runCase("fails closed on a child non-zero exit", () => {
  assert.throws(() =>
    runHermeticNode(["fixture"], {
      spawnSyncImpl: () => ({ status: 9 }),
      stdio: "pipe",
    }),
  );
});
runCase("fails closed when a child exits by signal", () => {
  assert.throws(() =>
    runHermeticNode(["fixture"], {
      spawnSyncImpl: () => ({ status: null, signal: "SIGTERM" }),
      stdio: "pipe",
    }),
  );
});
runCase("fails closed on a spawn error", () => {
  assert.throws(() =>
    runHermeticNode(["fixture"], {
      spawnSyncImpl: () => ({ error: new Error("fixture spawn error") }),
      stdio: "pipe",
    }),
  );
});
runCase(
  "contains no shell, npm, Prisma, dotenv, or bare-node execution",
  () => {
    const sources = [
      "scripts/lib/side-effect-health-gate.js",
      "scripts/side-effects-health-unit.js",
      "scripts/side-effects-health-postgres.js",
    ].map((file) => fs.readFileSync(path.join(rootDir, file), "utf8"));
    const combined = sources.join("\n");
    assert.ok(combined.includes("shell: false"));
    assert.ok(combined.includes("process.execPath"));
    assert.ok(!combined.includes("npm run"));
    assert.ok(!combined.includes("prisma generate"));
    assert.ok(!combined.includes("@prisma/client"));
    assert.ok(!combined.includes('require("dotenv")'));
    assert.ok(!combined.includes('spawnSync("node"'));
  },
);

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, cases: results }, null, 2));

function capture(run) {
  let call;
  run((executable, args, options) => {
    call = { executable, args, options };
    return { status: 0 };
  });
  assert.ok(call);
  return call;
}

function assertHealthSpawn(call, testPath) {
  assert.equal(call.executable, process.execPath);
  assert.equal(call.options.shell, false);
  assert.equal(call.options.cwd, path.join(rootDir, "apps/api"));
  assert.equal(call.options.env.PATH, fixedPath);
  assert.equal(
    call.options.env.HOME,
    path.join(rootDir, ".fanpass-hermetic-home"),
  );
  assert.equal(call.options.env.FANPASS_ENABLE_PAYMENTS, "false");
  assert.equal(call.options.env.FANPASS_SIDE_EFFECT_WORKER_ENABLED, "false");
  assert.equal(call.options.env.OWNERSHIP_ADAPTER, "mock");
  assert.equal(call.args[0], resolveProjectModule("jest/bin/jest"));
  assert.deepEqual(call.args.slice(1), [
    "--config",
    path.join(rootDir, "apps/api/jest.config.cjs"),
    "--runInBand",
    "--no-cache",
    "--runTestsByPath",
    testPath,
  ]);
}

function runCase(label, check) {
  try {
    check();
    results.push({ label, status: 0, ok: true });
  } catch (error) {
    results.push({
      label,
      status: 1,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
