const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  fixedPath,
  resolveProjectModule,
  rootDir,
} = require("./lib/side-effect-health-gate");
const {
  fallbackDatabaseUrl,
  runLocalHealth,
} = require("./side-effects-health-local");

const healthCliPath = path.join(
  rootDir,
  "apps/api/src/workers/side-effect-health-check.ts",
);
const storePath = path.join(
  rootDir,
  "apps/api/src/workers/postgres-side-effect-health.store.ts",
);
const prismaStorePath = path.join(
  rootDir,
  "apps/api/src/modules/side-effects/prisma-side-effect-health.store.ts",
);
const healthCliSource = fs.readFileSync(healthCliPath, "utf8");
const storeSource = fs.readFileSync(storePath, "utf8");
const prismaStoreSource = fs.readFileSync(prismaStorePath, "utf8");
const results = [];

runCase("uses process.execPath and the real ts-node CLI", () => {
  const call = captureLocal();
  assert.equal(call.executable, process.execPath);
  assert.equal(call.options.shell, false);
  assert.equal(call.options.cwd, rootDir);
  assert.equal(call.args[0], resolveProjectModule("ts-node/dist/bin.js"));
  assert.deepEqual(call.args.slice(1), [
    "--project",
    path.join(rootDir, "apps/api/tsconfig.json"),
    healthCliPath,
  ]);
});
runCase("uses the reviewed local-only profile", () => {
  const env = captureLocal().options.env;
  assert.equal(env.DATABASE_URL, fallbackDatabaseUrl);
  assert.equal(env.PATH, fixedPath);
  assert.equal(env.HOME, path.join(rootDir, ".fanpass-hermetic-home"));
  assert.equal(env.TS_NODE_CACHE, "false");
  assert.equal(env.TZ, "UTC");
  assert.equal(env.NODE_ENV, "test");
  assert.equal(env.FANPASS_ENV, "local");
  assert.equal(env.FANPASS_ENABLE_PAYMENTS, "false");
  assert.equal(env.FANPASS_REQUIRE_PAYMENT_AUTHORIZATION, "true");
  assert.equal(env.FANPASS_ALLOW_MANUAL_CRYPTO_CONFIRMATION, "false");
  assert.equal(env.FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES, "false");
  assert.equal(env.FANPASS_ALLOW_UNVERIFIED_USDC_RATE, "false");
  assert.equal(env.FANPASS_ASYNC_OWNERSHIP_SETTLEMENT, "true");
  assert.equal(env.FANPASS_CHAIN_PROOF_SYNC_OUTBOX, "true");
  assert.equal(env.FANPASS_SIDE_EFFECT_WORKER_ENABLED, "false");
  assert.equal(env.FANPASS_TRUST_PROXY_HOPS, "1");
  assert.equal(env.FANPASS_SIDE_EFFECT_HEALTH_LOCAL_ONLY, "true");
  assert.equal(env.OWNERSHIP_ADAPTER, "mock");
});
runCase(
  "does not inherit provider, startup, npm, or env-loader controls",
  () => {
    const env = captureLocal().options.env;
    for (const key of [
      "BASH_ENV",
      "ENV",
      "SHELLOPTS",
      "NODE_OPTIONS",
      "NPM_CONFIG_SCRIPT_SHELL",
      "FANPASS_DATA_SOURCE",
      "FANPASS_ENABLE_PRISMA_CONNECT",
      "FANPASS_SIDE_EFFECT_HEALTH_IGNORE_ENV_FILE",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "PRIVY_APP_SECRET",
      "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY",
      "TESTNET_OPERATOR_PRIVATE_KEY",
    ]) {
      assert.equal(env[key], undefined);
    }
  },
);
for (const [label, databaseUrl] of [
  [
    "accepts explicit IPv4 loopback",
    "postgresql://u:p@127.0.0.1:55432/fanpass",
  ],
  ["accepts explicit IPv6 loopback", "postgresql://u:p@[::1]:55432/fanpass"],
]) {
  runCase(label, () => {
    assert.equal(
      captureLocal(databaseUrl).options.env.DATABASE_URL,
      databaseUrl,
    );
  });
}
for (const [label, databaseUrl] of [
  ["rejects remote targets", "postgresql://u:p@db.example.test:5432/fanpass"],
  ["rejects localhost aliases", "postgresql://u:p@localhost:5432/fanpass"],
  ["rejects numeric aliases", "postgresql://u:p@2130706433:5432/fanpass"],
  [
    "rejects query overrides",
    "postgresql://u:p@127.0.0.1:5432/fanpass?host=evil.test",
  ],
  [
    "rejects the wrong database",
    "postgresql://u:p@127.0.0.1:5432/fanpass_prod",
  ],
  ["rejects missing credentials", "postgresql://u@127.0.0.1:5432/fanpass"],
]) {
  runCase(label, () => {
    let spawned = false;
    assert.throws(() =>
      runLocalHealth({
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
runCase("fails closed on a child failure", () => {
  assert.throws(() =>
    runLocalHealth({
      databaseUrl: fallbackDatabaseUrl,
      spawnSyncImpl: () => ({ status: 2 }),
      stdio: "pipe",
    }),
  );
});
runCase("keeps the health CLI narrow and redacted", () => {
  const assertion = "assertLocalSideEffectHealthRuntime(environmentConfig);";
  const firstAssertion = healthCliSource.indexOf(assertion);
  const connect = healthCliSource.indexOf(
    "PostgresSideEffectHealthStore.connect(",
  );
  const check = healthCliSource.indexOf("await health.check();");
  const secondAssertion = healthCliSource.indexOf(
    assertion,
    firstAssertion + assertion.length,
  );
  assert.ok(firstAssertion >= 0 && connect > firstAssertion);
  assert.ok(check > connect && secondAssertion > check);
  for (const blocked of [
    "../app.module",
    "@prisma/client",
    "@nestjs/config",
    "PrismaService",
    "NestFactory",
    "ConfigModule",
    "console.error(error)",
  ]) {
    assert.ok(!healthCliSource.includes(blocked));
  }
  assert.ok(healthCliSource.includes("if (require.main === module)"));
});
runCase(
  "keeps the PostgreSQL health transaction read-only and redacted",
  () => {
    assert.ok(
      storeSource.includes("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"),
    );
    assert.ok(storeSource.includes("current_setting('transaction_read_only')"));
    assert.ok(
      storeSource.includes('(last_error IS NOT NULL) AS "hasRecordedError"'),
    );
    assert.ok(!storeSource.includes('last_error AS "lastError"'));
    assert.ok(!storeSource.includes("payload_json"));
    assert.ok(!storeSource.includes("@prisma/client"));
  },
);
runCase(
  "keeps production Prisma health reads payload- and error-text-free",
  () => {
    assert.ok(
      prismaStoreSource.includes("$queryRaw<SideEffectHealthRecord[]>"),
    );
    assert.ok(prismaStoreSource.includes("Prisma.sql"));
    assert.ok(
      prismaStoreSource.includes(
        '(last_error IS NOT NULL) AS "hasRecordedError"',
      ),
    );
    assert.ok(!prismaStoreSource.includes("payload_json"));
    assert.ok(!prismaStoreSource.includes('last_error AS "lastError"'));
  },
);
runCase(
  "imports the real health CLI graph without Prisma, dotenv, pgpass, config files, or env mutation",
  () => assert.equal(runImportGraph(healthCliPath).status, 0),
);
for (const blocked of ["@prisma/client", "dotenv"]) {
  runCase(`rejects an indirect ${blocked} import`, () => {
    const fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "fanpass-health-import-"),
    );
    try {
      const fixture = path.join(fixtureRoot, "blocked.js");
      fs.writeFileSync(fixture, `require(${JSON.stringify(blocked)});\n`);
      assert.notEqual(runImportGraph(fixture).status, 0);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
}

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, cases: results }, null, 2));

function captureLocal(databaseUrl = fallbackDatabaseUrl) {
  let call;
  runLocalHealth({
    databaseUrl,
    stdio: "pipe",
    spawnSyncImpl: (executable, args, options) => {
      call = { executable, args, options };
      return { status: 0 };
    },
  });
  assert.ok(call);
  return call;
}

function runImportGraph(targetPath) {
  const script = `
const fs = require("fs");
const Module = require("module");
const before = new Set(Object.keys(process.env));
const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;
const blockedPackages = ["@prisma/client", "dotenv", "dotenv-expand", "pgpass"];
Module._load = function(request, parent, isMain) {
  let resolved = "";
  try { resolved = String(originalResolveFilename.call(Module, request, parent, isMain)); } catch {}
  const requested = String(request).toLowerCase();
  const normalized = resolved.replace(/\\\\/g, "/").toLowerCase();
  if (blockedPackages.some((name) => requested === name || requested.startsWith(name + "/")) ||
      normalized.endsWith("/app.module.ts") || normalized.endsWith("/app.module.js") ||
      normalized.endsWith("/prisma.service.ts") || normalized.endsWith("/prisma.service.js")) {
    throw new Error("Blocked config or Prisma import in health CLI graph");
  }
  return originalLoad.apply(this, arguments);
};
const sensitivePath = (value) => {
  const base = String(value ?? "").replace(/\\\\/g, "/").toLowerCase().split("/").pop();
  return base === ".env" || base.startsWith(".env.") || base === ".pgpass" || base === "pgpass.conf";
};
for (const method of ["accessSync", "existsSync", "openSync", "readFileSync", "statSync"]) {
  const original = fs[method];
  fs[method] = function(file) {
    if (sensitivePath(file)) throw new Error("Blocked sensitive config path in health CLI graph");
    return original.apply(this, arguments);
  };
}
require(process.argv[1]);
if (Object.keys(process.env).some((key) => !before.has(key))) process.exit(1);
`;
  return spawnSync(
    process.execPath,
    ["-r", "ts-node/register/transpile-only", "-e", script, targetPath],
    {
      cwd: rootDir,
      env: {
        HOME: path.join(rootDir, ".fanpass-hermetic-home"),
        PATH: fixedPath,
        TMPDIR: "/tmp",
        TS_NODE_CACHE: "false",
        TS_NODE_PROJECT: path.join(rootDir, "apps/api/tsconfig.json"),
      },
      encoding: "utf8",
    },
  );
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
