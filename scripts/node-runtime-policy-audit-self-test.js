#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  renderBetaFoundationGateFixture,
} = require("./lib/beta-foundation-gate-audit");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/node-runtime-policy-audit.js");

function write(file, content) {
  const target = path.join(fixtureRoot, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function buildFixture(overrides = {}) {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fanpass-node-policy-"));
  write(".nvmrc", overrides.nvmrc ?? "22\n");
  write(".node-version", overrides.nodeVersion ?? "22\n");
  write(".npmrc", overrides.npmrc ?? "engine-strict=true\n");
  write(
    "package.json",
    JSON.stringify(
      {
        scripts: {
          "tooling:node22": "bash scripts/with-node-22.sh",
          "tooling:node22:verify":
            "bash scripts/with-node-22.sh npm run security:node-runtime-policy",
          "security:node-runtime-policy":
            "node scripts/node-runtime-policy-audit.js",
          "security:node-runtime-policy:self-test":
            "node scripts/node-runtime-policy-audit-self-test.js",
        },
        engines: { node: overrides.engine ?? ">=22 <23" },
      },
      null,
      2,
    ),
  );
  write(
    "package-lock.json",
    JSON.stringify(
      {
        packages: {
          "": { engines: { node: overrides.lockEngine ?? ">=22 <23" } },
        },
      },
      null,
      2,
    ),
  );
  write(
    "scripts/beta-foundation-verify.js",
    overrides.verifier ??
      renderBetaFoundationGateFixture([
        "security:node-runtime-policy:self-test",
        "security:node-runtime-policy",
      ]),
  );
  write(
    "scripts/with-node-22.sh",
    overrides.helper ??
      [
        "FANPASS_NODE22_BIN_DIR",
        "/opt/homebrew/opt/node@22/bin",
        "/usr/local/opt/node@22/bin",
        "v22.",
        "Node 22 LTS was not found",
      ].join("\n"),
  );
  const doc =
    overrides.doc ??
    "Use Node 22 LTS and .npmrc engine-strict for Hardhat contract/security tooling.\n";
  for (const file of [
    "docs/QA_CHECKLIST.md",
    "docs/ALPHA_SECURITY_REVIEW.md",
    "docs/DEPENDENCY_ADVISORY_LOG.md",
    "docs/CODEX_HANDOFF.md",
  ]) {
    write(file, doc);
  }
  return fixtureRoot;
}

function runAudit(fixture) {
  return spawnSync(process.execPath, [auditScript], {
    cwd: rootDir,
    env: {
      ...process.env,
      FANPASS_NODE_RUNTIME_AUDIT_ROOT: fixture,
      FANPASS_STRICT_NODE_RUNTIME: "false",
    },
    encoding: "utf8",
  });
}

function runCase(label, expected, overrides) {
  const fixture = buildFixture(overrides);
  const result = runAudit(fixture);
  fs.rmSync(fixture, { recursive: true, force: true });
  const passed = result.status === 0;
  if ((expected === "pass" && !passed) || (expected === "fail" && passed)) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          label,
          expected,
          status: result.status,
          stdout: result.stdout,
          stderr: result.stderr,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  return { label, expected, status: result.status };
}

let fixtureRoot;
const cases = [
  runCase(
    "accepts Node 22 LTS pins, engines, docs, and verifier wiring",
    "pass",
    {},
  ),
  runCase("rejects missing .nvmrc Node 22 pin", "fail", { nvmrc: "20\n" }),
  runCase("rejects missing npm engine-strict policy", "fail", {
    npmrc: "fund=false\n",
  }),
  runCase("rejects loose package engine range", "fail", { engine: ">=22" }),
  runCase("rejects package-lock engine drift", "fail", { lockEngine: ">=22" }),
  runCase("rejects missing composite verifier wiring", "fail", {
    verifier: renderBetaFoundationGateFixture([
      "security:dependency-advisories",
    ]),
  }),
  runCase("rejects missing Node 22 helper markers", "fail", {
    helper: "echo missing helper\n",
  }),
  runCase("rejects missing Node 22 Hardhat documentation markers", "fail", {
    doc: "Use current Node for tooling.\n",
  }),
];

console.log(JSON.stringify({ ok: true, cases }, null, 2));
