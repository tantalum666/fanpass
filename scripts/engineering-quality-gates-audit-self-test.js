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
        "scripts/beta-foundation-verify.js",
        betaVerifier({ includeProviderSelfTest: false }),
      ),
  },
  {
    label:
      "rejects missing hermetic local health self-test in composite verifier",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        betaVerifier({ includeLocalHealthSelfTest: false }),
      ),
  },
  {
    label: "rejects a commented local health command",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        betaVerifier({ commentLocalHealth: true }),
      ),
  },
  {
    label: "rejects local health commands hidden in a dead branch",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        betaVerifier({ deadBranchLocalHealth: true }),
      ),
  },
  {
    label: "rejects a local health command with a success suffix",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        betaVerifier({ suffixLocalHealth: true }),
      ),
  },
  {
    label: "rejects reordered local health commands",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        betaVerifier({ reverseLocalHealthOrder: true }),
      ),
  },
  {
    label: "rejects a no-op composite verifier runner",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        betaVerifier({ noopRunStep: true }),
      ),
  },
  {
    label: "rejects inherited environment spread in the composite verifier",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "scripts/beta-foundation-verify.js",
        betaVerifier({ unsafeEnvironmentSpread: true }),
      ),
  },
  {
    label: "rejects a no-op PostgreSQL health integration package script",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "package.json",
        JSON.stringify(packageJson({ noopPostgresHealth: true })),
      ),
  },
  {
    label: "rejects a no-op local health package script",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "package.json",
        JSON.stringify(packageJson({ noopLocalHealth: true })),
      ),
  },
  {
    label: "rejects a no-op local health self-test package script",
    expected: "fail",
    mutate: (fixtureRoot) =>
      writeFixtureFile(
        fixtureRoot,
        "package.json",
        JSON.stringify(packageJson({ noopLocalHealthSelfTest: true })),
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
    "scripts/beta-foundation-verify.js",
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

function packageJson(options = {}) {
  return {
    scripts: {
      "security:provider-boundaries": "node scripts/provider-boundary-audit.js",
      "security:provider-boundaries:self-test":
        "node scripts/provider-boundary-audit-self-test.js",
      "security:engineering-gates":
        "node scripts/engineering-quality-gates-audit.js",
      "security:engineering-gates:self-test":
        "node scripts/engineering-quality-gates-audit-self-test.js",
      ...(options.noopPostgresHealth
        ? { "side-effects:health:postgres": 'node -e "process.exit(0)"' }
        : {}),
      ...(options.noopLocalHealth
        ? { "side-effects:health:local": 'node -e "process.exit(0)"' }
        : {}),
      ...(options.noopLocalHealthSelfTest
        ? {
            "side-effects:health:local:self-test": 'node -e "process.exit(0)"',
          }
        : {}),
    },
  };
}

function betaVerifier(options = {}) {
  const steps = [
    ["npmStep", "Root deterministic dependency install", "ci", "--include=dev"],
    [
      "npmStep",
      "Console Auth deterministic dependency install",
      "--prefix",
      "apps/console-auth",
      "ci",
      "--include=dev",
    ],
    [
      "nodeStep",
      "Beta foundation launcher self-test",
      "scripts/beta-foundation-launcher-self-test.js",
    ],
    [
      "nodeStep",
      "Beta foundation runner self-test",
      "scripts/beta-foundation-verify-self-test.js",
    ],
    [
      "npmStep",
      "Provider boundary audit self-test",
      "run",
      "security:provider-boundaries:self-test",
    ],
    [
      "npmStep",
      "Provider and lifecycle boundary audit",
      "run",
      "security:provider-boundaries",
    ],
    [
      "npmStep",
      "Engineering quality gate audit self-test",
      "run",
      "security:engineering-gates:self-test",
    ],
    [
      "npmStep",
      "Engineering quality gate audit",
      "run",
      "security:engineering-gates",
    ],
    [
      "nodeStep",
      "PostgreSQL side-effect health integration wrapper self-test",
      "scripts/side-effects-health-postgres-self-test.js",
    ],
    [
      "nodeStep",
      "Side-effect outbox health self-test",
      "scripts/side-effects-health-unit.js",
    ],
    [
      "nodeStep",
      "PostgreSQL side-effect health store integration",
      "scripts/side-effects-health-postgres.js",
    ],
    [
      "nodeStep",
      "Hermetic local side-effect health profile self-test",
      "scripts/side-effects-health-local-self-test.js",
    ],
    [
      "nodeStep",
      "Side-effect outbox local health check",
      "scripts/side-effects-health-local.js",
    ],
  ].filter(
    ([, label]) =>
      !(
        label === "Provider boundary audit self-test" &&
        options.includeProviderSelfTest === false
      ) &&
      !(
        label === "Hermetic local side-effect health profile self-test" &&
        options.includeLocalHealthSelfTest === false
      ),
  );

  if (options.reverseLocalHealthOrder) {
    const selfTestIndex = steps.findIndex(
      ([, label]) =>
        label === "Hermetic local side-effect health profile self-test",
    );
    const healthIndex = steps.findIndex(
      ([, label]) => label === "Side-effect outbox local health check",
    );
    [steps[selfTestIndex], steps[healthIndex]] = [
      steps[healthIndex],
      steps[selfTestIndex],
    ];
  }

  const stepLines = steps.map(
    ([helper, label, ...args]) =>
      `${helper}(${[label, ...args].map((value) => JSON.stringify(value)).join(", ")}),`,
  );
  const healthIndex = stepLines.findIndex((line) =>
    line.includes('"Side-effect outbox local health check"'),
  );

  if (options.commentLocalHealth) {
    stepLines[healthIndex] = `# ${stepLines[healthIndex]}`;
  }
  if (options.suffixLocalHealth) {
    stepLines[healthIndex] = stepLines[healthIndex].replace(
      '"scripts/side-effects-health-local.js"',
      '"scripts/side-effects-health-local.js || true"',
    );
  }
  if (options.deadBranchLocalHealth) {
    const firstHealthIndex = stepLines.findIndex((line) =>
      line.includes("Side-effect outbox local health check"),
    );
    const [deadStep] = stepLines.splice(firstHealthIndex, 1);
    stepLines.push(`if (false) { ${deadStep} }`);
  }

  return `const npmStep = (label, ...args) => ({ label, kind: "npm", args });
const nodeStep = (label, script) => ({ label, kind: "node", args: [script] });
const gateSteps = Object.freeze([
${stepLines.map((line) => `  ${line}`).join("\n")}
]);
const fs = require("fs");
const gateIsolationRoot = createGateIsolationRoot();
function createGateIsolationRoot() {
  const isolationRoot = fs.mkdtempSync("/tmp/fanpass-beta-gate-");
  fs.chmodSync(isolationRoot, 0o700);
  return isolationRoot;
}
function isAllowedLocalPostgresTarget() { return true; }
function buildHardenedEnvironment(source = {}) {
  const databaseUrl = "postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass";
  if (!isAllowedLocalPostgresTarget(databaseUrl, "fanpass")) throw new Error("local only");
  const env = {
    ${options.unsafeEnvironmentSpread ? "...source," : ""}
    HOME: gateIsolationRoot,
    TMPDIR: gateIsolationRoot,
    RUNNER_TEMP: gateIsolationRoot,
    DATABASE_URL: databaseUrl,
    FANPASS_DATA_SOURCE: "prisma",
    FANPASS_SKIP_DOCKER_POSTGRES: "true",
    FANPASS_STRICT_NODE_RUNTIME: "true",
  };
  if (source.CI === "true") env.CI = "true";
  if (source.GITHUB_ACTIONS === "true") env.GITHUB_ACTIONS = "true";
  env.PATH = "/trusted/node:/usr/bin:/bin:/usr/sbin:/sbin";
  env.FANPASS_GATE_HARDENED = "true";
  env.NPM_CONFIG_SCRIPT_SHELL = "/bin/sh";
  env.npm_config_script_shell = "/bin/sh";
  return env;
}
const npmArgs = ["--script-shell=/bin/sh"];
const nodeMajorOk = process.versions.node.split(".")[0] !== "22";
const spawnOptions = { shell: ${options.noopRunStep ? "true" : "false"} };
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
  "apps/console-auth/server",
  "apps/console-auth/src",
  "apps/dashboard/lib",
  "apps/dashboard/server",
  "apps/dashboard/src",
  "apps/ios/FanPass/FanPass",
  "apps/ios/FanPass/FanPassOps",
  "packages/shared/src",
];

const allowedProviderMatches = [
  { label: "Stripe Node SDK", allowedFiles: ["apps/api/src/modules/payments/payments.service.ts"] },
  { label: "ethers runtime", allowedFiles: ["apps/api/src/modules/ownership/ownership.service.ts"] },
  { label: "Privy ES256 verifier", allowedFiles: ["apps/api/src/modules/auth/privy-token.service.ts"] },
  { label: "Privy React SDK", allowedFiles: ["apps/console-auth/src/PrivyConsoleLogin.tsx"] },
  ${
    includeIosAndNativeProviders
      ? `{ label: "Stripe iOS core", allowedFiles: ["apps/ios/FanPass/FanPass/App/FanPassApp.swift"] },
  { label: "Stripe iOS PaymentSheet", allowedFiles: ["apps/ios/FanPass/FanPass/Features/Payments/StripePaymentSheetPresenter.swift"] },
  { label: "Socket.IO Swift client", allowedFiles: ["apps/ios/FanPass/FanPass/Services/FanPassOrderbookRealtimeClient.swift"] },
  { label: "Socket.IO server", allowedFiles: ["apps/api/src/modules/orders/orderbook.gateway.ts"] },
  { label: "Socket.IO browser client", allowedFiles: ["apps/dashboard/src/OrderbookLivePanel.tsx"] },
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
validatePrivyReactSdkIsolationWorkspace();
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
