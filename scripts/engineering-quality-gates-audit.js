const fs = require("fs");
const path = require("path");
const {
  expressionPath,
  parseTypeScript,
  ts,
  unwrapExpression,
} = require("./lib/typescript-audit");

const rootDir = process.env.FANPASS_ENGINEERING_GATES_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_ENGINEERING_GATES_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];

const forbiddenLocalHealthPackageScripts = [
  "side-effects:health:self-test",
  "side-effects:health:postgres:self-test",
  "side-effects:health:postgres",
  "side-effects:health:local",
  "side-effects:health:local:self-test",
];

const requiredCompositeVerifierSteps = [
  {
    label: "Root deterministic dependency install",
    kind: "npm",
    args: ["ci", "--include=dev"],
  },
  {
    label: "Console Auth deterministic dependency install",
    kind: "npm",
    args: ["--prefix", "apps/console-auth", "ci", "--include=dev"],
  },
  {
    label: "Beta foundation launcher self-test",
    kind: "node",
    args: ["scripts/beta-foundation-launcher-self-test.js"],
  },
  {
    label: "Beta foundation runner self-test",
    kind: "node",
    args: ["scripts/beta-foundation-verify-self-test.js"],
  },
  {
    label: "Provider boundary audit self-test",
    kind: "npm",
    args: ["run", "security:provider-boundaries:self-test"],
  },
  {
    label: "Provider and lifecycle boundary audit",
    kind: "npm",
    args: ["run", "security:provider-boundaries"],
  },
  {
    label: "Engineering quality gate audit self-test",
    kind: "npm",
    args: ["run", "security:engineering-gates:self-test"],
  },
  {
    label: "Engineering quality gate audit",
    kind: "npm",
    args: ["run", "security:engineering-gates"],
  },
  {
    label: "PostgreSQL side-effect health integration wrapper self-test",
    kind: "node",
    args: ["scripts/side-effects-health-postgres-self-test.js"],
  },
  {
    label: "Side-effect outbox health self-test",
    kind: "node",
    args: ["scripts/side-effects-health-unit.js"],
  },
  {
    label: "PostgreSQL side-effect health store integration",
    kind: "node",
    args: ["scripts/side-effects-health-postgres.js"],
  },
  {
    label: "Hermetic local side-effect health profile self-test",
    kind: "node",
    args: ["scripts/side-effects-health-local-self-test.js"],
  },
  {
    label: "Side-effect outbox local health check",
    kind: "node",
    args: ["scripts/side-effects-health-local.js"],
  },
];

const packageJson = readJson("package.json");
const betaVerifier = readProjectFile("scripts/beta-foundation-verify.js");
const providerAudit = readProjectFile("scripts/provider-boundary-audit.js");
const qaChecklist = readProjectFile("docs/QA_CHECKLIST.md");
const providerFeasibility = readProjectFile(
  "docs/PROVIDER_COST_FEASIBILITY.md",
);

validatePackageScripts();
validateCompositeVerifier();
validateProviderSurfaceBoundaries();
validateLifecycleBoundaries();
validateBoundaryValidatorCoverage();
validateDocs();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      compositeVerifier: {
        providerBoundarySelfTest: true,
        providerBoundaryAudit: true,
        engineeringGateAudit: true,
      },
      providerBoundaries: [
        "Stripe Node SDK",
        "ethers runtime",
        "Privy ES256 verifier",
        "Stripe iOS core",
        "Stripe iOS PaymentSheet",
        "Socket.IO Swift client",
        "Socket.IO server",
        "Socket.IO browser client",
        "Core NFC",
        "AVFoundation scanner",
      ],
      lifecycleBoundaries: [
        "OrderbookService -> SettlementSideEffectsService",
        "TicketsService -> TicketOwnershipSideEffectsService",
        "VerificationService -> TicketOwnershipSideEffectsService",
      ],
    },
    null,
    2,
  ),
);

function validatePackageScripts() {
  const scripts = packageJson.scripts ?? {};
  for (const script of [
    "security:provider-boundaries",
    "security:provider-boundaries:self-test",
    "security:engineering-gates",
    "security:engineering-gates:self-test",
  ]) {
    if (!scripts[script]) {
      errors.push(`package.json must define ${script}`);
    }
  }

  for (const script of forbiddenLocalHealthPackageScripts) {
    if (scripts[script]) {
      errors.push(
        `package.json must not expose ${script}; run the fixed Node 22 entry through the authoritative composite verifier`,
      );
    }
  }
}

function validateCompositeVerifier() {
  const verifierSteps = parseVerifierSteps(betaVerifier);
  if (!verifierSteps) {
    return;
  }
  validateHardenedEnvironment(betaVerifier);
  const labels = verifierSteps.map((step) => step.label);
  if (new Set(labels).size !== labels.length) {
    errors.push("beta foundation verifier step labels must be unique");
  }
  for (const step of verifierSteps) {
    if (!["npm", "node"].includes(step.kind)) {
      errors.push(
        `beta foundation verifier has unsupported step kind: ${step.kind}`,
      );
    }
    if (step.args.some((arg) => /(?:\|\||&&|;|`|\$\()/.test(arg))) {
      errors.push(
        `beta foundation verifier step ${step.label} contains shell syntax`,
      );
    }
  }
  assertOrderedVerifierSteps(verifierSteps);
  for (const marker of [
    "shell: false",
    '"--script-shell=/bin/sh"',
    'process.versions.node.split(".")[0] !== "22"',
  ]) {
    if (!betaVerifier.includes(marker)) {
      errors.push(
        `beta foundation verifier is missing hardening marker: ${marker}`,
      );
    }
  }
}

function validateHardenedEnvironment(source) {
  let sourceFile;
  try {
    sourceFile = parseTypeScript("scripts/beta-foundation-verify.js", source);
  } catch (error) {
    errors.push(error.message);
    return;
  }
  const functionNode = sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "buildHardenedEnvironment",
  );
  if (!functionNode?.body) {
    errors.push(
      "beta foundation verifier must define buildHardenedEnvironment",
    );
    return;
  }

  const expectedKeys = [
    "CI",
    "DATABASE_URL",
    "FANPASS_DATA_SOURCE",
    "FANPASS_GATE_HARDENED",
    "FANPASS_SKIP_DOCKER_POSTGRES",
    "FANPASS_STRICT_NODE_RUNTIME",
    "GITHUB_ACTIONS",
    "HOME",
    "NPM_CONFIG_SCRIPT_SHELL",
    "PATH",
    "RUNNER_TEMP",
    "TMPDIR",
    "npm_config_script_shell",
  ].sort();
  const observedKeys = [];
  let invalidEnvironmentShape = false;

  visitNode(functionNode.body, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "env"
    ) {
      const initializer = unwrapExpression(node.initializer);
      if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
        invalidEnvironmentShape = true;
        return;
      }
      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property)) {
          invalidEnvironmentShape = true;
          continue;
        }
        const key = staticPropertyName(property.name);
        if (!key) {
          invalidEnvironmentShape = true;
          continue;
        }
        observedKeys.push(key);
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const left = unwrapExpression(node.left);
      if (
        ts.isPropertyAccessExpression(left) &&
        ts.isIdentifier(left.expression) &&
        left.expression.text === "env"
      ) {
        observedKeys.push(left.name.text);
      } else if (
        ts.isElementAccessExpression(left) &&
        ts.isIdentifier(left.expression) &&
        left.expression.text === "env"
      ) {
        invalidEnvironmentShape = true;
      }
    }
  });

  const uniqueKeys = [...new Set(observedKeys)].sort();
  if (
    invalidEnvironmentShape ||
    JSON.stringify(uniqueKeys) !== JSON.stringify(expectedKeys)
  ) {
    errors.push(
      `beta foundation verifier hardened environment must expose exactly: ${expectedKeys.join(", ")}`,
    );
  }

  for (const marker of [
    'isAllowedLocalPostgresTarget(databaseUrl, "fanpass")',
    'FANPASS_DATA_SOURCE: "prisma"',
    'FANPASS_SKIP_DOCKER_POSTGRES: "true"',
    'FANPASS_STRICT_NODE_RUNTIME: "true"',
    'fs.mkdtempSync("/tmp/fanpass-beta-gate-")',
    "fs.chmodSync(isolationRoot, 0o700)",
  ]) {
    if (!source.includes(marker)) {
      errors.push(
        `beta foundation verifier is missing fixed environment marker: ${marker}`,
      );
    }
  }
}

function visitNode(node, callback) {
  callback(node);
  ts.forEachChild(node, (child) => visitNode(child, callback));
}

function staticPropertyName(node) {
  return ts.isIdentifier(node) || ts.isStringLiteralLike(node)
    ? node.text
    : null;
}

function validateProviderSurfaceBoundaries() {
  const requiredProviderMarkers = [
    ["Stripe Node SDK", "apps/api/src/modules/payments/payments.service.ts"],
    ["ethers runtime", "apps/api/src/modules/ownership/ownership.service.ts"],
    [
      "Privy ES256 verifier",
      "apps/api/src/modules/auth/privy-token.service.ts",
    ],
    ["Stripe iOS core", "apps/ios/FanPass/FanPass/App/FanPassApp.swift"],
    [
      "Stripe iOS PaymentSheet",
      "apps/ios/FanPass/FanPass/Features/Payments/StripePaymentSheetPresenter.swift",
    ],
    [
      "Socket.IO Swift client",
      "apps/ios/FanPass/FanPass/Services/FanPassOrderbookRealtimeClient.swift",
    ],
    ["Socket.IO server", "apps/api/src/modules/orders/orderbook.gateway.ts"],
    ["Socket.IO browser client", "apps/dashboard/src/OrderbookLivePanel.tsx"],
    [
      "Core NFC",
      "apps/ios/FanPass/FanPass/Features/Scanner/NFCPayloadScanner.swift",
    ],
    [
      "AVFoundation scanner",
      "apps/ios/FanPass/FanPass/Features/Scanner/QRCodeScannerView.swift",
    ],
  ];

  for (const [label, allowedFile] of requiredProviderMarkers) {
    if (
      !providerAudit.includes(label) ||
      !providerAudit.includes(allowedFile)
    ) {
      errors.push(
        `provider boundary audit must keep ${label} isolated to ${allowedFile}`,
      );
    }
  }

  for (const sourceRoot of [
    "apps/api/src",
    "apps/console-auth/server",
    "apps/console-auth/src",
    "apps/dashboard/lib",
    "apps/dashboard/server",
    "apps/dashboard/src",
    "apps/ios/FanPass/FanPass",
    "apps/ios/FanPass/FanPassOps",
    "packages/shared/src",
  ]) {
    if (!providerAudit.includes(`"${sourceRoot}"`)) {
      errors.push(`provider boundary audit must scan ${sourceRoot}`);
    }
  }

  if (
    !providerAudit.includes("Privy React SDK") ||
    !providerAudit.includes("@privy-io/react-auth") ||
    !providerAudit.includes("blockedProviderMatches") ||
    !providerAudit.includes("dependencyManifestFiles") ||
    !providerAudit.includes("listDependencyManifestFiles") ||
    !providerAudit.includes("providerDependencyPlacementRules") ||
    !providerAudit.includes("validateProviderDependencyPlacement") ||
    !providerAudit.includes("validateProviderDependencyLockfilePlacement") ||
    !providerAudit.includes("providerDependencyPlacement") ||
    !providerAudit.includes("checkedProviderLockfilePackages") ||
    !providerAudit.includes("checkedDependencyManifests")
  ) {
    errors.push(
      "provider boundary audit must block @privy-io/react-auth source imports and dependency manifests until Console SDK isolation evidence passes and keep provider dependency placement rules",
    );
  }
}

function validateLifecycleBoundaries() {
  const lifecycleMarkers = [
    [
      "apps/api/src/modules/orders/orderbook.service.ts",
      "Orderbook lifecycle service",
      "SettlementSideEffectsService",
      "../ownership/ownership.service",
      "../payments/payments.service",
      "../side-effects/side-effect-outbox.service",
    ],
    [
      "apps/api/src/modules/tickets/tickets.service.ts",
      "Ticket lifecycle service",
      "TicketOwnershipSideEffectsService",
      "../ownership/ownership.service",
    ],
    [
      "apps/api/src/modules/verification/verification.service.ts",
      "Verification lifecycle service",
      "TicketOwnershipSideEffectsService",
      "../ownership/ownership.service",
    ],
  ];

  for (const markers of lifecycleMarkers) {
    for (const marker of markers) {
      if (!providerAudit.includes(marker)) {
        errors.push(
          `provider boundary audit must keep lifecycle boundary marker: ${marker}`,
        );
      }
    }
  }
}

function validateBoundaryValidatorCoverage() {
  for (const marker of [
    "validatePaymentSideEffectIdempotency();",
    "validatePrivyAuthBoundary();",
    "validatePrivyReactSdkIsolationWorkspace();",
    "validateTestnetOwnershipProductionGuard();",
    "validateOwnershipAsyncSagaBoundary();",
    "validateSideEffectStaleLockRecovery();",
    "validateXcodeGenProject();",
  ]) {
    if (!providerAudit.includes(marker)) {
      errors.push(`provider boundary audit must call ${marker}`);
    }
  }
}

function validateDocs() {
  for (const marker of [
    "Keep Stripe, Privy, chain, NFC, QR, email, and other provider SDK code behind dedicated services/adapters.",
    "Keep ticket lifecycle, order settlement, payment state, ownership transfer, and check-in rules in domain services rather than UI components.",
  ]) {
    if (!qaChecklist.includes(marker)) {
      errors.push(`QA checklist must keep maintainability marker: ${marker}`);
    }
  }

  for (const marker of [
    "## Engineering Maintainability Rule",
    "Keep provider integrations behind narrow service boundaries",
    "Keep domain lifecycle code separate from Stripe, Privy, chain, NFC, and QR provider code.",
    "`npm run security:provider-boundaries` scans API, Console, shared, and iOS source files",
  ]) {
    if (!providerFeasibility.includes(marker)) {
      errors.push(
        `provider feasibility doc must keep maintainability marker: ${marker}`,
      );
    }
  }
}

function assertOrderedVerifierSteps(verifierSteps) {
  let previousIndex = -1;
  for (const expected of requiredCompositeVerifierSteps) {
    const indexes = verifierSteps.flatMap((step, index) =>
      step.label === expected.label ? [index] : [],
    );
    if (indexes.length !== 1) {
      errors.push(
        `beta foundation verifier must contain exactly one step: ${expected.label}`,
      );
      continue;
    }
    const [index] = indexes;
    const actual = verifierSteps[index];
    if (
      actual.kind !== expected.kind ||
      JSON.stringify(actual.args) !== JSON.stringify(expected.args)
    ) {
      errors.push(
        `beta foundation verifier step ${expected.label} must use ${expected.kind} ${expected.args.join(" ")}`,
      );
    }
    if (index <= previousIndex) {
      errors.push(
        `beta foundation verifier must run ${expected.label} after the previous engineering gate step`,
      );
    }
    if (
      expected.label === "Beta foundation launcher self-test" &&
      index !== 2
    ) {
      errors.push(
        "beta foundation launcher self-test must immediately follow the two deterministic install steps",
      );
    }
    previousIndex = index;
  }
}

function parseVerifierSteps(source) {
  let sourceFile;
  try {
    sourceFile = parseTypeScript("scripts/beta-foundation-verify.js", source);
  } catch (error) {
    errors.push(error.message);
    return null;
  }
  let initializer = null;
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "gateSteps"
      ) {
        initializer = unwrapExpression(declaration.initializer);
      }
    }
  }
  if (
    !initializer ||
    !ts.isCallExpression(initializer) ||
    expressionPath(initializer.expression) !== "Object.freeze" ||
    initializer.arguments.length !== 1 ||
    !ts.isArrayLiteralExpression(unwrapExpression(initializer.arguments[0]))
  ) {
    errors.push(
      "beta foundation verifier must define gateSteps as one Object.freeze array",
    );
    return null;
  }

  const helperKinds = new Map([
    ["npmStep", "npm"],
    ["nodeStep", "node"],
    ["shStep", "sh"],
  ]);
  const steps = [];
  for (const element of unwrapExpression(initializer.arguments[0]).elements) {
    const call = unwrapExpression(element);
    if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) {
      errors.push(
        "beta foundation verifier gateSteps may contain only typed helper calls",
      );
      return null;
    }
    const kind = helperKinds.get(call.expression.text);
    const values = call.arguments.map((argument) =>
      ts.isStringLiteralLike(unwrapExpression(argument))
        ? unwrapExpression(argument).text
        : null,
    );
    if (!kind || values.length < 2 || values.some((value) => value === null)) {
      errors.push(
        "beta foundation verifier steps require one allowed helper and literal label/argv values",
      );
      return null;
    }
    steps.push({ label: values[0], kind, args: values.slice(1) });
  }
  return steps;
}

function readJson(relativePath) {
  return JSON.parse(readProjectFile(relativePath));
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}
