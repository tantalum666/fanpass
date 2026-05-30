const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/engineering-quality-gates-audit.js",
);

const cases = [
  {
    label: "accepts complete engineering gate coverage",
    expected: "pass",
    mutate: () => {},
  },
  {
    label: "rejects missing provider boundary self-test in composite verifier",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.sh",
        betaVerifier({ includeProviderSelfTest: false }),
      ),
  },
  {
    label: "rejects missing provider SDK surface markers",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/provider-boundary-audit.js",
        providerAudit({ includeIosAndNativeProviders: false }),
      ),
  },
  {
    label: "rejects missing lifecycle boundary markers",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/provider-boundary-audit.js",
        providerAudit({ includeLifecycleBoundaries: false }),
      ),
  },
  {
    label: "rejects missing maintainability documentation markers",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "docs/PROVIDER_COST_FEASIBILITY.md",
        "# Provider Cost And Feature Feasibility\n",
      ),
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-engineering-gates-audit-"),
  );
  try {
    writePassingFixture(fixtureRoot);
    testCase.mutate(fixtureRoot);
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_ENGINEERING_GATES_AUDIT_ROOT: fixtureRoot,
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
  writeFixtureFile(fixtureRoot, "package.json", JSON.stringify(packageJson()));
  writeFixtureFile(
    fixtureRoot,
    "scripts/beta-foundation-verify.sh",
    betaVerifier(),
  );
  writeFixtureFile(
    fixtureRoot,
    "scripts/provider-boundary-audit.js",
    providerAudit(),
  );
  writeFixtureFile(fixtureRoot, "docs/QA_CHECKLIST.md", qaChecklist());
  writeFixtureFile(
    fixtureRoot,
    "docs/PROVIDER_COST_FEASIBILITY.md",
    providerFeasibility(),
  );
}

function packageJson() {
  return {
    scripts: {
      "security:provider-boundaries": "node scripts/provider-boundary-audit.js",
      "security:provider-boundaries:self-test":
        "node scripts/provider-boundary-audit-self-test.js",
      "security:engineering-gates":
        "node scripts/engineering-quality-gates-audit.js",
      "security:engineering-gates:self-test":
        "node scripts/engineering-quality-gates-audit-self-test.js",
    },
  };
}

function betaVerifier(options = {}) {
  const includeProviderSelfTest = options.includeProviderSelfTest !== false;
  return `#!/usr/bin/env bash
${includeProviderSelfTest ? "npm run security:provider-boundaries:self-test\n" : ""}
npm run security:provider-boundaries
npm run security:engineering-gates:self-test
npm run security:engineering-gates
`;
}

function providerAudit(options = {}) {
  const includeIosAndNativeProviders =
    options.includeIosAndNativeProviders !== false;
  const includeLifecycleBoundaries =
    options.includeLifecycleBoundaries !== false;
  return `
const sourceRoots = [
  "apps/api/src",
  "apps/dashboard/app",
  "apps/dashboard/lib",
  "apps/ios/FanPass/FanPass",
  "apps/ios/FanPass/FanPassOps",
  "packages/shared/src",
];

const allowedProviderMatches = [
  { label: "Stripe Node SDK", allowedFiles: ["apps/api/src/modules/payments/payments.service.ts"] },
  { label: "ethers runtime", allowedFiles: ["apps/api/src/modules/ownership/ownership.service.ts"] },
  { label: "Privy ES256 verifier", allowedFiles: ["apps/api/src/modules/auth/privy-token.service.ts"] },
  ${
    includeIosAndNativeProviders
      ? `{ label: "Stripe iOS core", allowedFiles: ["apps/ios/FanPass/FanPass/App/FanPassApp.swift"] },
  { label: "Stripe iOS PaymentSheet", allowedFiles: ["apps/ios/FanPass/FanPass/Features/Payments/StripePaymentSheetPresenter.swift"] },
  { label: "Socket.IO Swift client", allowedFiles: ["apps/ios/FanPass/FanPass/Services/FanPassOrderbookRealtimeClient.swift"] },
  { label: "Socket.IO server", allowedFiles: ["apps/api/src/modules/orders/orderbook.gateway.ts"] },
  { label: "Socket.IO browser client", allowedFiles: ["apps/dashboard/app/orderbook-live-panel.tsx"] },
  { label: "Core NFC", allowedFiles: ["apps/ios/FanPass/FanPass/Features/Scanner/NFCPayloadScanner.swift"] },
  { label: "AVFoundation scanner", allowedFiles: ["apps/ios/FanPass/FanPass/Features/Scanner/QRCodeScannerView.swift"] },`
      : ""
  }
];

const blockedProviderMatches = [
  { label: "Privy React SDK", pattern: /@privy-io\\/react-auth/, reason: "FanPass Console must pass the Privy React SDK isolation evidence gate before @privy-io/react-auth is added to the workspace" },
];

const dependencyManifestFiles = listDependencyManifestFiles(rootDir);
const checkedDependencyManifests = dependencyManifestFiles;
const providerDependencyPlacementRules = [
  { packageName: "stripe", allowedLocations: [{ file: "apps/api/package.json", sections: ["dependencies"] }] },
  { packageName: "socket.io-client", allowedLocations: [{ file: "apps/dashboard/package.json", sections: ["dependencies"] }, { file: "apps/api/package.json", sections: ["devDependencies"] }] },
];

function validateProviderDependencyPlacement() {
  return providerDependencyPlacementRules;
}

function validateProviderDependencyLockfilePlacement() {
  return providerDependencyPlacementRules;
}

const checkedProviderLockfilePackages = ["<root>", "apps/api", "apps/dashboard"];

function listDependencyManifestFiles() {
  return ["package.json", "apps/dashboard/package.json", "package-lock.json"];
}

const lifecycleBoundaryRules = [
  ${
    includeLifecycleBoundaries
      ? `{ file: "apps/api/src/modules/orders/orderbook.service.ts", label: "Orderbook lifecycle service", replacement: "SettlementSideEffectsService", forbiddenImports: ["../ownership/ownership.service", "../payments/payments.service", "../side-effects/side-effect-outbox.service"] },
  { file: "apps/api/src/modules/tickets/tickets.service.ts", label: "Ticket lifecycle service", replacement: "TicketOwnershipSideEffectsService", forbiddenImports: ["../ownership/ownership.service"] },
  { file: "apps/api/src/modules/verification/verification.service.ts", label: "Verification lifecycle service", replacement: "TicketOwnershipSideEffectsService", forbiddenImports: ["../ownership/ownership.service"] },`
      : ""
  }
];

validatePaymentSideEffectIdempotency();
validatePrivyAuthBoundary();
validateTestnetOwnershipProductionGuard();
validateOwnershipAsyncSagaBoundary();
validateSideEffectStaleLockRecovery();
validateXcodeGenProject();
`;
}

function qaChecklist() {
  return `
Keep Stripe, Privy, chain, NFC, QR, email, and other provider SDK code behind dedicated services/adapters.
Keep ticket lifecycle, order settlement, payment state, ownership transfer, and check-in rules in domain services rather than UI components.
`;
}

function providerFeasibility() {
  return `
## Engineering Maintainability Rule
Keep provider integrations behind narrow service boundaries.
Keep domain lifecycle code separate from Stripe, Privy, chain, NFC, and QR provider code.
\`npm run security:provider-boundaries\` scans API, Console, shared, and iOS source files.
`;
}

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}
