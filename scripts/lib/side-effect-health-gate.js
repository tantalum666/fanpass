const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "../..");
const fixedPath = [
  path.dirname(process.execPath),
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
]
  .filter((entry, index, entries) => entries.indexOf(entry) === index)
  .join(path.delimiter);

function assertNode22() {
  if (process.versions.node.split(".")[0] !== "22") {
    throw new Error("The side-effect health gate requires Node 22 LTS");
  }
}

function buildHealthEnvironment(overrides = {}) {
  return {
    HOME: path.join(rootDir, ".fanpass-hermetic-home"),
    PATH: fixedPath,
    TMPDIR: "/tmp",
    TZ: "UTC",
    NODE_ENV: "test",
    FANPASS_GATE_HARDENED: "true",
    FANPASS_ENABLE_DEMO_AUTH: "false",
    FANPASS_ENABLE_PAYMENTS: "false",
    FANPASS_REQUIRE_PAYMENT_AUTHORIZATION: "true",
    FANPASS_ALLOW_MANUAL_CRYPTO_CONFIRMATION: "false",
    FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES: "false",
    FANPASS_ALLOW_UNVERIFIED_USDC_RATE: "false",
    FANPASS_SIDE_EFFECT_WORKER_ENABLED: "false",
    OWNERSHIP_ADAPTER: "mock",
    ...overrides,
  };
}

function resolveProjectModule(specifier) {
  const modulePath = fs.realpathSync(
    require.resolve(specifier, { paths: [rootDir] }),
  );
  const nodeModulesRoot = `${fs.realpathSync(
    path.join(rootDir, "node_modules"),
  )}${path.sep}`;
  if (!modulePath.startsWith(nodeModulesRoot)) {
    throw new Error(`Refusing a health-gate module outside node_modules`);
  }
  return modulePath;
}

function runHermeticNode(args, options = {}) {
  const spawn = options.spawnSyncImpl ?? spawnSync;
  const result = spawn(process.execPath, args, {
    cwd: options.cwd ?? rootDir,
    env: options.env ?? buildHealthEnvironment(),
    shell: false,
    stdio: options.stdio ?? "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const status = result.status ?? `signal ${result.signal ?? "unknown"}`;
    throw new Error(`Side-effect health gate failed with ${status}`);
  }
  return result;
}

module.exports = {
  assertNode22,
  buildHealthEnvironment,
  fixedPath,
  resolveProjectModule,
  rootDir,
  runHermeticNode,
};
