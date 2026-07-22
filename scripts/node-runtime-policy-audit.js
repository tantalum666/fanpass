#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  assertOrderedNpmScripts,
  loadBetaFoundationGateSteps,
} = require("./lib/beta-foundation-gate-audit");

const rootDir = process.env.FANPASS_NODE_RUNTIME_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_NODE_RUNTIME_AUDIT_ROOT)
  : path.resolve(__dirname, "..");
const strictRuntime = process.env.FANPASS_STRICT_NODE_RUNTIME === "true";

const requiredNodeRange = ">=22 <23";
const requiredVersionPin = "22";
const gateErrors = [];

function read(file) {
  return fs.readFileSync(path.join(rootDir, file), "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function includesAll(file, markers) {
  const text = read(file);
  for (const marker of markers) {
    assert(text.includes(marker), `${file} missing marker: ${marker}`);
  }
}

assert(read(".nvmrc").trim() === requiredVersionPin, ".nvmrc must pin Node 22");
assert(
  read(".node-version").trim() === requiredVersionPin,
  ".node-version must pin Node 22",
);
assert(
  read(".npmrc")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .includes("engine-strict=true"),
  ".npmrc must set engine-strict=true",
);

const packageJson = readJson("package.json");
assert(
  packageJson.engines?.node === requiredNodeRange,
  `package.json engines.node must be ${requiredNodeRange}`,
);
assert(
  packageJson.scripts?.["security:node-runtime-policy"] ===
    "node scripts/node-runtime-policy-audit.js",
  "package.json missing security:node-runtime-policy script",
);
assert(
  packageJson.scripts?.["security:node-runtime-policy:self-test"] ===
    "node scripts/node-runtime-policy-audit-self-test.js",
  "package.json missing security:node-runtime-policy:self-test script",
);
assert(
  packageJson.scripts?.["tooling:node22"] === "bash scripts/with-node-22.sh",
  "package.json missing tooling:node22 helper script",
);
assert(
  packageJson.scripts?.["tooling:node22:verify"] ===
    "bash scripts/with-node-22.sh npm run security:node-runtime-policy",
  "package.json missing tooling:node22:verify script",
);

const packageLock = readJson("package-lock.json");
assert(
  packageLock.packages?.[""]?.engines?.node === requiredNodeRange,
  `package-lock root engines.node must be ${requiredNodeRange}`,
);

const betaGateSteps = loadBetaFoundationGateSteps(rootDir, gateErrors);
assertOrderedNpmScripts(
  betaGateSteps,
  ["security:node-runtime-policy:self-test", "security:node-runtime-policy"],
  gateErrors,
);
assert(gateErrors.length === 0, gateErrors.join("; "));

const helper = read("scripts/with-node-22.sh");
for (const marker of [
  "FANPASS_NODE22_BIN_DIR",
  "/opt/homebrew/opt/node@22/bin",
  "/usr/local/opt/node@22/bin",
  "v22.",
  "Node 22 LTS was not found",
]) {
  assert(
    helper.includes(marker),
    `scripts/with-node-22.sh missing marker: ${marker}`,
  );
}

for (const file of [
  "docs/QA_CHECKLIST.md",
  "docs/ALPHA_SECURITY_REVIEW.md",
  "docs/DEPENDENCY_ADVISORY_LOG.md",
  "docs/CODEX_HANDOFF.md",
]) {
  includesAll(file, ["Node 22 LTS", "Hardhat"]);
}
includesAll("docs/QA_CHECKLIST.md", [".npmrc", "engine-strict"]);
includesAll("docs/DEPENDENCY_ADVISORY_LOG.md", [".npmrc", "engine-strict"]);
includesAll("docs/CODEX_HANDOFF.md", [".npmrc", "engine-strict"]);

const currentMajor = Number.parseInt(
  process.versions.node.split(".")[0] ?? "",
  10,
);
const runtimeWarning =
  currentMajor === 22
    ? ""
    : `Current runtime is Node ${process.versions.node}; use Node 22 LTS for contract/security tooling.`;

if (strictRuntime && currentMajor !== 22) {
  fail(runtimeWarning);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      nodePolicy: requiredNodeRange,
      pins: [".nvmrc", ".node-version", ".npmrc engine-strict"],
      currentRuntime: process.versions.node,
      runtimeWarning,
      strictRuntime,
    },
    null,
    2,
  ),
);
