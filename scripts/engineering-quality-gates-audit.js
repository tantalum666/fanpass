const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_ENGINEERING_GATES_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_ENGINEERING_GATES_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const errors = [];

const packageJson = readJson("package.json");
const betaVerifier = readProjectFile("scripts/beta-foundation-verify.sh");
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
}

function validateCompositeVerifier() {
  assertOrderedVerifierSteps([
    "security:provider-boundaries:self-test",
    "security:provider-boundaries",
    "security:engineering-gates:self-test",
    "security:engineering-gates",
  ]);
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

function assertOrderedVerifierSteps(steps) {
  let previousIndex = -1;
  for (const step of steps) {
    const pattern = new RegExp(`npm\\s+run\\s+${escapeRegExp(step)}(?=\\s|$)`);
    const match = pattern.exec(betaVerifier);
    const index = match?.index ?? -1;
    if (index === -1) {
      errors.push(`beta foundation verifier must run npm run ${step}`);
      continue;
    }
    if (index <= previousIndex) {
      errors.push(
        `beta foundation verifier must run npm run ${step} after the previous engineering gate step`,
      );
    }
    previousIndex = index;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readJson(relativePath) {
  return JSON.parse(readProjectFile(relativePath));
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}
