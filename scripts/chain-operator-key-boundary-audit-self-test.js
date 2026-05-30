const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/chain-operator-key-boundary-audit.js",
);

const fixturePrivateKey =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

const cases = [
  {
    label: "accepts complete chain operator key boundary coverage",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects removed production-like ownership guard",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "apps/api/src/config/security-config.ts",
        "OWNERSHIP_ADAPTER=testnet is blocked in production-like environments",
      ),
  },
  {
    label: "rejects static ethers import in OwnershipService",
    expected: "fail",
    mutate: (fixtureRoot) =>
      prependFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/ownership/ownership.service.ts",
        'import { Wallet } from "ethers";\n',
      ),
  },
  {
    label: "rejects operator private-key logging",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/ownership/ownership.service.ts",
        "\nconsole.log(privateKey);\n",
      ),
  },
  {
    label: "rejects local Beta startup using testnet ownership",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceMarker(
        fixtureRoot,
        "scripts/beta-local-start.sh",
        "OWNERSHIP_ADAPTER=mock",
        "OWNERSHIP_ADAPTER=testnet",
      ),
  },
  {
    label: "rejects exact private-key assignment in env examples",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceMarker(
        fixtureRoot,
        "apps/api/.env.example",
        "TESTNET_OPERATOR_PRIVATE_KEY=replace-with-non-production-testnet-operator-private-key",
        `TESTNET_OPERATOR_PRIVATE_KEY=${fixturePrivateKey}`,
      ),
  },
  {
    label: "rejects copyable 0x ellipsis operator key docs",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceMarker(
        fixtureRoot,
        "docs/ALPHA_RUNBOOK.md",
        "TESTNET_OPERATOR_PRIVATE_KEY=replace-with-non-production-testnet-operator-private-key",
        "TESTNET_OPERATOR_PRIVATE_KEY=" + "0x...",
      ),
  },
  {
    label: "rejects missing composite verifier wiring",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.sh",
        "#!/usr/bin/env bash\nnpm run security:provider-boundaries\n",
      ),
  },
  {
    label: "rejects missing ASR-014 documentation status",
    expected: "fail",
    mutate: (fixtureRoot) =>
      removeMarker(
        fixtureRoot,
        "docs/ALPHA_SECURITY_REVIEW.md",
        "Status after Security Pass 82",
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-chain-operator-key-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_CHAIN_OPERATOR_AUDIT_ROOT: fixtureRoot,
      },
      encoding: "utf8",
    });
    const passed = result.status === 0;
    const expectedPass = testCase.expected === "pass";
    return {
      label: testCase.label,
      expected: testCase.expected,
      status: result.status,
      ok: passed === expectedPass,
      stderr: result.stderr.trim(),
    };
  } finally {
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        failures,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      cases: results.map(({ label, expected, status }) => ({
        label,
        expected,
        status,
      })),
    },
    null,
    2,
  ),
);

function writePassingFixture(fixtureRoot) {
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/modules/ownership/ownership.service.ts",
    [
      "export class OwnershipService {",
      "  adapter() {",
      '    if (this.config.get<string>("OWNERSHIP_ADAPTER") !== "testnet") return mock;',
      '    if (isProductionLikeEnvironment()) throw new Error("OWNERSHIP_ADAPTER=testnet is blocked in production-like environments");',
      "    return testnet;",
      "  }",
      "}",
      "class TestnetOwnershipAdapter {",
      "  async contract() {",
      '    const privateKey = this.requiredConfig("TESTNET_OPERATOR_PRIVATE_KEY");',
      '    const { Wallet } = await import("ethers");',
      "    return new Wallet(privateKey, provider);",
      "  }",
      "}",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/src/config/security-config.ts",
    [
      "export function validateEnvironment(config, errors) {",
      "  validateOwnershipConfiguration(config, errors);",
      "}",
      "function validateOwnershipConfiguration(config, errors) {",
      '  if (stringValue(config.OWNERSHIP_ADAPTER) !== "testnet") return;',
      '  errors.push("OWNERSHIP_ADAPTER=testnet is blocked in production-like environments");',
      "}",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-local-start.sh",
    [
      "OWNERSHIP_ADAPTER=mock \\",
      "FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true \\",
      "npm run dev",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/.env.example",
    [
      "OWNERSHIP_ADAPTER=mock",
      "TESTNET_RPC_URL=",
      "TESTNET_OPERATOR_PRIVATE_KEY=replace-with-non-production-testnet-operator-private-key",
      "FANPASS_TICKET_CONTRACT_ADDRESS=",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "apps/api/.env.staging.example",
    "OWNERSHIP_ADAPTER=mock\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.sh",
    [
      "npm run security:chain-operator-key:self-test",
      "npm run security:chain-operator-key",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/ALPHA_RUNBOOK.md",
    [
      "TESTNET_OPERATOR_PRIVATE_KEY=replace-with-non-production-testnet-operator-private-key",
      "never commit, log, or paste a real private key",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/ALPHA_SECURITY_REVIEW.md",
    [
      "### ASR-014 - Chain operator key model is centralized",
      "Status after Security Pass 82",
      "security:chain-operator-key",
      "vault/KMS",
      "delegated signer",
      "multisig/timelock",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/QA_CHECKLIST.md",
    [
      "security:chain-operator-key:self-test",
      "security:chain-operator-key",
      "operator private key",
      "",
    ].join("\n"),
  );
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function appendFixtureFile(fixtureRoot, relativePath, contents) {
  fs.appendFileSync(path.join(fixtureRoot, relativePath), contents);
}

function prependFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.writeFileSync(
    absolutePath,
    contents + fs.readFileSync(absolutePath, "utf8"),
  );
}

function removeMarker(fixtureRoot, relativePath, marker) {
  replaceMarker(fixtureRoot, relativePath, marker, "");
}

function replaceMarker(fixtureRoot, relativePath, marker, replacement) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  const contents = fs.readFileSync(absolutePath, "utf8");
  fs.writeFileSync(absolutePath, contents.replace(marker, replacement));
}
