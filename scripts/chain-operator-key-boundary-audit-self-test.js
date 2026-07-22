const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  renderBetaFoundationGateFixture,
} = require("./lib/beta-foundation-gate-audit");

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
    label: "rejects removed executable production-like ownership guard",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/config/security-config.ts",
        markerOnlySecurityConfig(),
      ),
  },
  {
    label: "rejects ownership guards preserved only in comments",
    expected: "fail",
    mutate: (fixtureRoot) => {
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/modules/ownership/ownership.service.ts",
        markerOnlyOwnershipService(),
      );
      writeFixtureFile(
        fixtureRoot,
        "apps/api/src/config/security-config.ts",
        markerOnlySecurityConfig(),
      );
    },
  },
  {
    label: "rejects inverted unsafe-testnet runtime guard",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceMarker(
        fixtureRoot,
        "apps/api/src/modules/ownership/ownership.service.ts",
        "this.productionLike() && !this.privateKeyTestnetWritesAllowed()",
        "!this.productionLike() && this.privateKeyTestnetWritesAllowed()",
      ),
  },
  {
    label: "rejects ownership guard made unreachable by an early return",
    expected: "fail",
    mutate: (fixtureRoot) =>
      replaceMarker(
        fixtureRoot,
        "apps/api/src/modules/ownership/ownership.service.ts",
        '    const adapter = this.config.get("OWNERSHIP_ADAPTER");',
        '    return new MockOwnershipAdapter();\n    const adapter = this.config.get("OWNERSHIP_ADAPTER");',
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
    label: "rejects missing staging ownership configuration",
    expected: "fail",
    mutate: (fixtureRoot) =>
      fs.rmSync(path.join(fixtureRoot, "apps/api/.env.staging.example"), {
        force: true,
      }),
  },
  {
    label: "rejects commented safe staging values with active unsafe overrides",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "apps/api/.env.staging.example",
        [
          "# OWNERSHIP_ADAPTER=privy",
          "# FANPASS_CHAIN_PROOF_SYNC_OUTBOX=true",
          "OWNERSHIP_ADAPTER=mock",
          "FANPASS_CHAIN_PROOF_SYNC_OUTBOX=false",
          "",
        ].join("\n"),
      ),
  },
  {
    label: "rejects duplicate staging ownership assignments",
    expected: "fail",
    mutate: (fixtureRoot) =>
      appendFixtureFile(
        fixtureRoot,
        "apps/api/.env.staging.example",
        "OWNERSHIP_ADAPTER=mock\n",
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
        "scripts/beta-foundation-verify.js",
        renderBetaFoundationGateFixture(["security:provider-boundaries"]),
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
      'import { isProductionLikeEnvironment } from "../../config/security-config";',
      "export class OwnershipService {",
      "  private adapter() {",
      '    const adapter = this.config.get("OWNERSHIP_ADAPTER");',
      '    if (adapter === "privy") return new PrivySponsoredOwnershipAdapter();',
      '    if (adapter === "mock") {',
      '      if (this.productionLike()) throw new Error("OWNERSHIP_ADAPTER=mock is forbidden in production-like environments");',
      "      return new MockOwnershipAdapter();",
      "    }",
      '    if (adapter !== "testnet") throw new Error("OWNERSHIP_ADAPTER must be explicitly configured");',
      '    if (this.productionLike() && !this.privateKeyTestnetWritesAllowed()) throw new Error("OWNERSHIP_ADAPTER=testnet is blocked in production-like environments");',
      "    return new TestnetOwnershipAdapter();",
      "  }",
      "  private productionLike() { return isProductionLikeEnvironment(); }",
      "  private privateKeyTestnetWritesAllowed() { return allowsPrivateKeyTestnetWrites(); }",
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
      "  const productionLike = isProductionLikeEnvironment(config);",
      "  if (productionLike) {",
      "    validateOwnershipConfiguration(config, errors);",
      "  }",
      "}",
      "function validateOwnershipConfiguration(config, errors) {",
      "  const adapter = rawStringValue(config.OWNERSHIP_ADAPTER);",
      '  if (adapter === "mock") {',
      '    errors.push("OWNERSHIP_ADAPTER=mock is forbidden in production-like environments");',
      "    return;",
      "  }",
      '  if (adapter === "privy") return;',
      "  if (!allowsPrivateKeyTestnetWrites(config)) {",
      '    errors.push("OWNERSHIP_ADAPTER=testnet is blocked in production-like environments");',
      "    return;",
      "  }",
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
    "OWNERSHIP_ADAPTER=privy\nFANPASS_CHAIN_PROOF_SYNC_OUTBOX=true\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.js",
    renderBetaFoundationGateFixture([
      "security:chain-operator-key:self-test",
      "security:chain-operator-key",
    ]),
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

function markerOnlyOwnershipService() {
  return [
    "export class OwnershipService {",
    '  adapter() { return "mock"; }',
    "}",
    "class TestnetOwnershipAdapter {",
    "  async contract() {",
    '    const privateKey = this.requiredConfig("TESTNET_OPERATOR_PRIVATE_KEY");',
    '    const { Wallet } = await import("ethers");',
    "    return new Wallet(privateKey, provider);",
    "  }",
    "}",
    "/*",
    'if (adapter === "privy") return new PrivySponsoredOwnershipAdapter();',
    'if (adapter === "mock") { if (this.productionLike()) throw new Error("OWNERSHIP_ADAPTER=mock is forbidden in production-like environments"); }',
    'if (adapter !== "testnet") throw new Error("invalid");',
    'if (this.productionLike() && !this.privateKeyTestnetWritesAllowed()) throw new Error("OWNERSHIP_ADAPTER=testnet is blocked in production-like environments");',
    "*/",
    "",
  ].join("\n");
}

function markerOnlySecurityConfig() {
  return [
    "export function validateEnvironment(config, errors) { return config; }",
    "function validateOwnershipConfiguration(config, errors) { return; }",
    "/*",
    "if (productionLike) validateOwnershipConfiguration(config, errors);",
    'if (adapter === "mock") errors.push("OWNERSHIP_ADAPTER=mock is forbidden in production-like environments");',
    'if (!allowsPrivateKeyTestnetWrites(config)) errors.push("OWNERSHIP_ADAPTER=testnet is blocked in production-like environments");',
    "*/",
    "",
  ].join("\n");
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
