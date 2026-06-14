const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_PROVIDER_AUDIT_ROOT
  ? path.resolve(process.env.FANPASS_PROVIDER_AUDIT_ROOT)
  : path.resolve(__dirname, "..");

const sourceRoots = [
  "apps/api/src",
  "apps/console-auth/app",
  "apps/dashboard/lib",
  "apps/dashboard/server",
  "apps/dashboard/src",
  "apps/ios/FanPass/FanPass",
  "apps/ios/FanPass/FanPassOps",
  "packages/shared/src",
];

const allowedProviderMatches = [
  {
    label: "Stripe Node SDK",
    pattern:
      /\bimport\s+Stripe\s+from\s+["']stripe["']|require\(["']stripe["']\)/,
    allowedFiles: ["apps/api/src/modules/payments/payments.service.ts"],
  },
  {
    label: "ethers runtime",
    pattern:
      /\bfrom\s+["']ethers["']|\brequire\(["']ethers["']\)|\bimport\(["']ethers["']\)/,
    allowedFiles: ["apps/api/src/modules/ownership/ownership.service.ts"],
  },
  {
    label: "Privy ES256 verifier",
    pattern: /\bverify\s+as\s+verifySignature\b/,
    allowedFiles: ["apps/api/src/modules/auth/privy-token.service.ts"],
  },
  {
    label: "Privy Swift SDK",
    pattern: /^import PrivySDK$/m,
    allowedFiles: ["apps/ios/FanPass/FanPass/Services/PrivyAuthProvider.swift"],
  },
  {
    label: "Privy React SDK",
    pattern:
      /\bfrom\s+["']@privy-io\/react-auth["']|\brequire\(["']@privy-io\/react-auth["']\)|\bimport\(["']@privy-io\/react-auth["']\)/,
    allowedFiles: ["apps/console-auth/app/privy-console-login.tsx"],
  },
  {
    label: "Stripe iOS core",
    pattern: /^import StripeCore$/m,
    allowedFiles: ["apps/ios/FanPass/FanPass/App/FanPassApp.swift"],
  },
  {
    label: "Stripe iOS PaymentSheet",
    pattern: /^import StripePaymentSheet$/m,
    allowedFiles: [
      "apps/ios/FanPass/FanPass/Features/Payments/StripePaymentSheetPresenter.swift",
    ],
  },
  {
    label: "Socket.IO Swift client",
    pattern: /^import SocketIO$/m,
    allowedFiles: [
      "apps/ios/FanPass/FanPass/Services/FanPassOrderbookRealtimeClient.swift",
    ],
  },
  {
    label: "Socket.IO server",
    pattern: /\bfrom\s+["']socket\.io["']|\brequire\(["']socket\.io["']\)/,
    allowedFiles: [
      "apps/api/src/common/fanpass-socket-io.adapter.ts",
      "apps/api/src/modules/orders/orderbook.gateway.ts",
      "apps/api/src/modules/orders/orderbook-realtime.service.ts",
    ],
  },
  {
    label: "Socket.IO browser client",
    pattern:
      /\bfrom\s+["']socket\.io-client["']|\brequire\(["']socket\.io-client["']\)|\bimport\(["']socket\.io-client["']\)/,
    allowedFiles: ["apps/dashboard/src/OrderbookLivePanel.tsx"],
  },
  {
    label: "Core NFC",
    pattern: /^import CoreNFC$/m,
    allowedFiles: [
      "apps/ios/FanPass/FanPass/Features/Scanner/NFCPayloadScanner.swift",
    ],
  },
  {
    label: "AVFoundation scanner",
    pattern: /^import AVFoundation$/m,
    allowedFiles: [
      "apps/ios/FanPass/FanPass/Features/Scanner/QRCodeScannerView.swift",
    ],
  },
];

const blockedProviderMatches = [
  {
    label: "Privy React SDK",
    pattern:
      /\bfrom\s+["']@privy-io\/react-auth["']|\brequire\(["']@privy-io\/react-auth["']\)|\bimport\(["']@privy-io\/react-auth["']\)/,
    allowedFiles: ["apps/console-auth/app/privy-console-login.tsx"],
    reason:
      "Privy React SDK imports are only allowed in the isolated Console auth runtime after the isolation evidence gate passes",
  },
];

const projectYmlPath = "apps/ios/FanPass/project.yml";
const errors = [];
const sourceFiles = sourceRoots.flatMap((sourceRoot) =>
  listSourceFiles(path.join(rootDir, sourceRoot)),
);
const dependencyManifestFiles = listDependencyManifestFiles(rootDir);
const providerDependencyPlacementRules = [
  {
    packageName: "stripe",
    allowedLocations: [
      {
        file: "apps/api/package.json",
        sections: ["dependencies"],
      },
    ],
    reason: "Stripe Node SDK must stay behind the API PaymentsService boundary",
  },
  {
    packageName: "socket.io-client",
    allowedLocations: [
      {
        file: "apps/dashboard/package.json",
        sections: ["dependencies"],
      },
      {
        file: "apps/api/package.json",
        sections: ["devDependencies"],
      },
    ],
    reason:
      "Socket.IO browser client must stay in the Console live panel or API verifier tooling",
  },
  {
    packageName: "socket.io",
    allowedLocations: [
      {
        file: "apps/api/package.json",
        sections: ["dependencies", "devDependencies"],
      },
    ],
    reason: "Socket.IO server runtime must stay in the API realtime boundary",
  },
];
const lifecycleBoundaryRules = [
  {
    file: "apps/api/src/modules/orders/orderbook.service.ts",
    label: "Orderbook lifecycle service",
    replacement: "SettlementSideEffectsService",
    forbiddenImports: [
      "../ownership/ownership.service",
      "../payments/payments.service",
      "../side-effects/side-effect-outbox.service",
    ],
  },
  {
    file: "apps/api/src/modules/tickets/tickets.service.ts",
    label: "Ticket lifecycle service",
    replacement: "TicketOwnershipSideEffectsService",
    forbiddenImports: ["../ownership/ownership.service"],
  },
  {
    file: "apps/api/src/modules/verification/verification.service.ts",
    label: "Verification lifecycle service",
    replacement: "TicketOwnershipSideEffectsService",
    forbiddenImports: ["../ownership/ownership.service"],
  },
];

for (const rule of allowedProviderMatches) {
  for (const absoluteFile of sourceFiles) {
    const relativeFile = normalizePath(path.relative(rootDir, absoluteFile));
    const contents = fs.readFileSync(absoluteFile, "utf8");
    if (!rule.pattern.test(contents)) {
      continue;
    }
    if (!rule.allowedFiles.includes(relativeFile)) {
      errors.push(
        `${rule.label} is only allowed in ${rule.allowedFiles.join(
          ", ",
        )}; found in ${relativeFile}`,
      );
    }
  }
}

for (const rule of blockedProviderMatches) {
  for (const absoluteFile of sourceFiles) {
    const relativeFile = normalizePath(path.relative(rootDir, absoluteFile));
    const contents = fs.readFileSync(absoluteFile, "utf8");
    if (rule.pattern.test(contents)) {
      if (rule.allowedFiles?.includes(relativeFile)) {
        continue;
      }
      errors.push(
        `${rule.label} is blocked in ${relativeFile}: ${rule.reason}`,
      );
    }
  }
}

validateBlockedProviderDependencyManifests();
validateProviderDependencyPlacement();
validateProviderDependencyLockfilePlacement();
validatePrivyReactSdkIsolationWorkspace();

for (const rule of lifecycleBoundaryRules) {
  const absoluteFile = path.join(rootDir, rule.file);
  const contents = fs.readFileSync(absoluteFile, "utf8");
  for (const forbiddenImport of rule.forbiddenImports) {
    const escaped = forbiddenImport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`from\\s+["']${escaped}["']`);
    if (pattern.test(contents)) {
      errors.push(
        `${rule.label} must not import ${forbiddenImport}; route provider side effects through ${rule.replacement}`,
      );
    }
  }
}

validatePaymentSideEffectIdempotency();
validatePrivyAuthBoundary();
validateTestnetOwnershipProductionGuard();
validateOwnershipAsyncSagaBoundary();
validateSideEffectStaleLockRecovery();
validateXcodeGenProject();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedFiles: sourceFiles.length,
      providerBoundaries: allowedProviderMatches.map((rule) => ({
        provider: rule.label,
        allowedFiles: rule.allowedFiles,
      })),
      blockedProviderBoundaries: blockedProviderMatches.map((rule) => ({
        provider: rule.label,
        reason: rule.reason,
      })),
      providerDependencyPlacement: providerDependencyPlacementRules.map(
        (rule) => ({
          packageName: rule.packageName,
          allowedLocations: rule.allowedLocations,
        }),
      ),
      checkedDependencyManifests: dependencyManifestFiles.map((file) =>
        normalizePath(path.relative(rootDir, file)),
      ),
      checkedProviderLockfilePackages: checkedProviderLockfilePackages(),
      xcodegen: {
        fanPassExcludesScanner: true,
        fanPassOpsExcludesStripeAndSocketIo: true,
        privySdkLinkedThroughProvider: true,
      },
      lifecycleBoundaries: lifecycleBoundaryRules,
      paymentSideEffectIdempotency: true,
      privyAuthBoundary: true,
      testnetOwnershipProductionGuard: true,
      ownershipAsyncSagaBoundary: true,
      sideEffectStaleLockRecovery: true,
    },
    null,
    2,
  ),
);

function validateBlockedProviderDependencyManifests() {
  const blockedPackages = ["@privy-io/react-auth"];
  const allowedManifestFiles = new Set([
    "apps/console-auth/package.json",
    "apps/console-auth/package-lock.json",
  ]);
  for (const absoluteFile of dependencyManifestFiles) {
    const relativeFile = normalizePath(path.relative(rootDir, absoluteFile));
    const contents = fs.readFileSync(absoluteFile, "utf8");
    for (const packageName of blockedPackages) {
      if (contents.includes(`"${packageName}"`)) {
        if (allowedManifestFiles.has(relativeFile)) {
          continue;
        }
        errors.push(
          `${packageName} must not be added to ${relativeFile}; it is only allowed in apps/console-auth after Console SDK isolation evidence passes and the provider boundary policy is intentionally updated`,
        );
      }
    }
  }
}

function validateProviderDependencyPlacement() {
  for (const absoluteFile of dependencyManifestFiles) {
    if (path.basename(absoluteFile) !== "package.json") {
      continue;
    }
    const relativeFile = normalizePath(path.relative(rootDir, absoluteFile));
    const manifest = JSON.parse(fs.readFileSync(absoluteFile, "utf8"));
    validateDependencyDeclarationPlacement({
      relativeFile,
      dependencyRecord: manifest,
      sourceLabel: `${relativeFile}`,
    });
  }
}

function validateProviderDependencyLockfilePlacement() {
  for (const absoluteFile of dependencyManifestFiles) {
    if (path.basename(absoluteFile) !== "package-lock.json") {
      continue;
    }
    const relativeFile = normalizePath(path.relative(rootDir, absoluteFile));
    const lockfileDirectory = normalizePath(path.dirname(relativeFile));
    const lockfile = JSON.parse(fs.readFileSync(absoluteFile, "utf8"));
    for (const [packagePath, dependencyRecord] of Object.entries(
      lockfile.packages ?? {},
    )) {
      if (!dependencyRecord || packagePath.includes("node_modules")) {
        continue;
      }
      validateDependencyDeclarationPlacement({
        relativeFile: normalizePath(
          lockfileDirectory === "."
            ? packagePath
              ? `${packagePath}/package.json`
              : "package.json"
            : packagePath
              ? path.join(lockfileDirectory, packagePath, "package.json")
              : path.join(lockfileDirectory, "package.json"),
        ),
        dependencyRecord,
        sourceLabel: `${relativeFile} packages[${packagePath || "<root>"}]`,
      });
    }
  }
}

function validatePrivyReactSdkIsolationWorkspace() {
  const rootManifest = readJsonIfExists("package.json") ?? {};
  const rootWorkspaces = Array.isArray(rootManifest.workspaces)
    ? rootManifest.workspaces
    : [];
  for (const workspacePattern of rootWorkspaces) {
    if (
      workspacePattern === "apps/*" ||
      workspacePattern === "apps/console-auth"
    ) {
      errors.push(
        "apps/console-auth must stay outside root workspaces so @privy-io/react-auth stays out of the default FanPass production audit path",
      );
    }
  }

  const rootLockfile = readJsonIfExists("package-lock.json");
  if (rootLockfile?.packages?.["apps/console-auth"]) {
    errors.push(
      "root package-lock.json must not include apps/console-auth as a workspace package",
    );
  }

  const isolatedManifest =
    readJsonIfExists("apps/console-auth/package.json") ?? {};
  const isolatedDependencies = isolatedManifest.dependencies ?? {};
  if (isolatedDependencies["@privy-io/react-auth"] !== "3.28.0") {
    errors.push(
      "apps/console-auth/package.json must pin @privy-io/react-auth to the reviewed 3.28.0 SDK version",
    );
  }

  const isolatedLockfile = readJsonIfExists(
    "apps/console-auth/package-lock.json",
  );
  if (
    !isolatedLockfile?.packages?.[""]?.dependencies?.["@privy-io/react-auth"] ||
    !isolatedLockfile?.packages?.["node_modules/@privy-io/react-auth"]
  ) {
    errors.push(
      "apps/console-auth/package-lock.json must capture the isolated @privy-io/react-auth dependency tree",
    );
  }
}

function validateDependencyDeclarationPlacement({
  relativeFile,
  dependencyRecord,
  sourceLabel,
}) {
  for (const rule of providerDependencyPlacementRules) {
    for (const section of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      const dependencies = dependencyRecord[section] ?? {};
      if (
        !Object.prototype.hasOwnProperty.call(dependencies, rule.packageName)
      ) {
        continue;
      }
      const allowed = rule.allowedLocations.some(
        (location) =>
          location.file === relativeFile && location.sections.includes(section),
      );
      if (!allowed) {
        const allowedLocations = rule.allowedLocations
          .map((location) => `${location.file} ${location.sections.join("/")}`)
          .join(", ");
        errors.push(
          `${rule.packageName} must only be declared in ${allowedLocations}; found in ${sourceLabel} ${section}: ${rule.reason}`,
        );
      }
    }
  }
}

function checkedProviderLockfilePackages() {
  return dependencyManifestFiles.flatMap((absoluteFile) => {
    if (path.basename(absoluteFile) !== "package-lock.json") {
      return [];
    }
    const lockfile = JSON.parse(fs.readFileSync(absoluteFile, "utf8"));
    return Object.keys(lockfile.packages ?? {})
      .filter((packagePath) => !packagePath.includes("node_modules"))
      .map((packagePath) => packagePath || "<root>");
  });
}

function validatePaymentSideEffectIdempotency() {
  const worker = readProjectFile(
    "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
  );
  const payments = readProjectFile(
    "apps/api/src/modules/payments/payments.service.ts",
  );

  const workerRules = [
    {
      label: "PAYMENT_CAPTURE worker dispatch",
      pattern: /processCaptureJob\([\s\S]*job\.idempotencyKey[\s\S]*\)/,
    },
    {
      label: "PAYMENT_CANCEL_AUTHORIZATION worker dispatch",
      pattern:
        /processCancelAuthorizationJob\([\s\S]*job\.idempotencyKey[\s\S]*\)/,
    },
    {
      label: "PAYMENT_REFUND worker dispatch",
      pattern: /processRefundJob\([\s\S]*job\.idempotencyKey[\s\S]*\)/,
    },
  ];
  for (const rule of workerRules) {
    if (!rule.pattern.test(worker)) {
      errors.push(
        `${rule.label} must pass the outbox job idempotency key into PaymentsService`,
      );
    }
  }

  const paymentRules = [
    {
      label: "capture provider idempotency",
      pattern:
        /captureProviderPaymentIntent\([\s\S]*sideEffectIdempotencyKey[\s\S]*idempotencyKey:\s*sideEffectIdempotencyKey\s*\?\?\s*this\.paymentCaptureSideEffectKey\(payment\.id\)/,
    },
    {
      label: "cancel provider idempotency",
      pattern:
        /cancelProviderPaymentIntent\([\s\S]*sideEffectIdempotencyKey[\s\S]*idempotencyKey:\s*sideEffectIdempotencyKey\s*\?\?\s*this\.paymentCancelSideEffectKey\(payment\.id\)/,
    },
    {
      label: "refund provider idempotency",
      pattern:
        /refundProviderPaymentIntent\([\s\S]*sideEffectIdempotencyKey[\s\S]*idempotencyKey:\s*sideEffectIdempotencyKey\s*\?\?\s*this\.paymentRefundSideEffectKey\(payment\.id\)/,
    },
  ];
  for (const rule of paymentRules) {
    if (!rule.pattern.test(payments)) {
      errors.push(
        `PaymentsService must use the outbox side-effect idempotency key for ${rule.label}`,
      );
    }
  }
}

function validatePrivyAuthBoundary() {
  const auth = readProjectFile("apps/api/src/modules/auth/auth.service.ts");
  const privy = readProjectFile(
    "apps/api/src/modules/auth/privy-token.service.ts",
  );
  const appModule = readProjectFile("apps/api/src/app.module.ts");

  if (!/import \{ PrivyTokenService \}/.test(auth)) {
    errors.push(
      "AuthService must depend on PrivyTokenService for Privy JWT verification",
    );
  }
  if (!/this\.privyTokens\.verifyAccessToken\(token\)/.test(auth)) {
    errors.push(
      "AuthService must route Privy access-token verification through PrivyTokenService",
    );
  }
  if (!/this\.privyTokens\.readJwtAlgorithm\(token\)/.test(auth)) {
    errors.push(
      "AuthService must route JWT algorithm detection through PrivyTokenService",
    );
  }
  for (const forbidden of [
    "PRIVY_VERIFICATION_KEY",
    "verifySignature",
    "assertPrivyClaims",
    "privyVerificationKey",
  ]) {
    if (auth.includes(forbidden)) {
      errors.push(
        `AuthService must not own Privy verifier detail: ${forbidden}`,
      );
    }
  }
  for (const marker of [
    'header.alg !== "ES256"',
    'payload.iss !== "privy.io"',
    "this.audienceMatches(payload.aud, this.privyAppId())",
    "payload.exp",
    "payload.nbf",
    "PRIVY_VERIFICATION_KEY",
    'dsaEncoding: "ieee-p1363"',
  ]) {
    if (!privy.includes(marker)) {
      errors.push(`PrivyTokenService must keep verifier marker: ${marker}`);
    }
  }
  if (!/PrivyTokenService/.test(appModule)) {
    errors.push(
      "AppModule must register PrivyTokenService as the backend Privy verifier boundary",
    );
  }
}

function validateTestnetOwnershipProductionGuard() {
  const securityConfig = readProjectFile(
    "apps/api/src/config/security-config.ts",
  );
  const ownership = readProjectFile(
    "apps/api/src/modules/ownership/ownership.service.ts",
  );

  for (const marker of [
    "validateOwnershipConfiguration(config, errors)",
    'stringValue(config.OWNERSHIP_ADAPTER) !== "testnet"',
    "OWNERSHIP_ADAPTER=testnet is blocked in production-like environments",
  ]) {
    if (!securityConfig.includes(marker)) {
      errors.push(
        `security-config must keep production-like testnet ownership guard marker: ${marker}`,
      );
    }
  }

  for (const marker of [
    "isProductionLikeEnvironment",
    'this.config.get<string>("OWNERSHIP_ADAPTER") !== "testnet"',
    "OWNERSHIP_ADAPTER=testnet is blocked in production-like environments",
  ]) {
    if (!ownership.includes(marker)) {
      errors.push(
        `OwnershipService must keep runtime testnet ownership guard marker: ${marker}`,
      );
    }
  }
}

function validateOwnershipAsyncSagaBoundary() {
  const worker = readProjectFile(
    "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
  );
  const outbox = readProjectFile(
    "apps/api/src/modules/side-effects/side-effect-outbox.service.ts",
  );
  const orderbook = readProjectFile(
    "apps/api/src/modules/orders/orderbook.service.ts",
  );

  for (const marker of [
    'case "OWNERSHIP_ISSUE"',
    'case "OWNERSHIP_SETTLEMENT_FINALIZE"',
    'case "OWNERSHIP_REDEEM"',
    'type: "OWNERSHIP_SETTLEMENT_FINALIZE"',
    "this.ownership.issueTicket(",
    "this.ownership.redeemTicket(",
    "this.outbox.enqueueStandalone",
    "this.orderbook.finalizeOwnershipTransfer",
    "ownership-finalize:",
  ]) {
    if (!worker.includes(marker)) {
      errors.push(
        `SideEffectWorkerService must keep async ownership saga marker: ${marker}`,
      );
    }
  }

  if (!outbox.includes("enqueueStandalone(input: EnqueueSideEffectInput)")) {
    errors.push(
      "SideEffectOutboxService must keep standalone enqueue support for worker-created saga continuation jobs",
    );
  }

  for (const marker of [
    "async finalizeOwnershipTransfer",
    "Ownership settlement finalization requires Prisma persistence",
    "FANPASS_ASYNC_OWNERSHIP_SETTLEMENT",
    "usesAsyncOwnershipSettlement()",
  ]) {
    if (!orderbook.includes(marker)) {
      errors.push(
        `OrderbookService must keep async ownership settlement marker: ${marker}`,
      );
    }
  }
}

function validateSideEffectStaleLockRecovery() {
  const worker = readProjectFile(
    "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
  );
  const outbox = readProjectFile(
    "apps/api/src/modules/side-effects/side-effect-outbox.service.ts",
  );
  const securityConfig = readProjectFile(
    "apps/api/src/config/security-config.ts",
  );
  const verifier = readProjectFile("scripts/side-effects-worker-verify.sh");

  for (const marker of [
    "this.outbox.recoverStaleProcessingJobs()",
    "recovered: recovered.count",
  ]) {
    if (!worker.includes(marker)) {
      errors.push(
        `SideEffectWorkerService must keep stale lock recovery marker: ${marker}`,
      );
    }
  }

  for (const marker of [
    "recoverStaleProcessingJobs()",
    'status: "PROCESSING"',
    'status: "RETRYING"',
    "FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS",
    "Recovered stale PROCESSING lock",
  ]) {
    if (!outbox.includes(marker)) {
      errors.push(
        `SideEffectOutboxService must keep stale lock recovery marker: ${marker}`,
      );
    }
  }

  if (!securityConfig.includes("FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS")) {
    errors.push(
      "security-config must validate FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS",
    );
  }
  if (!verifier.includes("sfx_worker_stale_recovery")) {
    errors.push(
      "side-effects worker verifier must cover stale PROCESSING lock recovery",
    );
  }
}

function listSourceFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name.endsWith(".xcodeproj")
      ) {
        return [];
      }
      return listSourceFiles(absolutePath);
    }
    if (!/\.(ts|tsx|js|swift)$/.test(entry.name)) {
      return [];
    }
    return [absolutePath];
  });
}

function listDependencyManifestFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const ignoredDirectories = new Set([
    ".git",
    ".next",
    ".turbo",
    "build",
    "coverage",
    "dist",
    "DerivedData",
    "node_modules",
    "outputs",
  ]);
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (
        ignoredDirectories.has(entry.name) ||
        entry.name.endsWith(".xcodeproj")
      ) {
        return [];
      }
      return listDependencyManifestFiles(absolutePath);
    }
    if (entry.name !== "package.json" && entry.name !== "package-lock.json") {
      return [];
    }
    return [absolutePath];
  });
}

function validateXcodeGenProject() {
  const projectPath = path.join(rootDir, projectYmlPath);
  const project = fs.readFileSync(projectPath, "utf8");
  const fanPassBlock = targetBlock(project, "FanPass", "FanPassOps");
  const fanPassOpsBlock = targetBlock(project, "FanPassOps", null);

  if (!/excludes:\s*\n\s*-\s*Features\/Scanner/.test(fanPassBlock)) {
    errors.push("FanPass target must exclude Features/Scanner in project.yml");
  }
  if (
    !/package:\s*Stripe[\s\S]*product:\s*StripePaymentSheet/.test(fanPassBlock)
  ) {
    errors.push(
      "FanPass target must keep StripePaymentSheet as a FanPass-only dependency",
    );
  }
  if (!/package:\s*SocketIO[\s\S]*product:\s*SocketIO/.test(fanPassBlock)) {
    errors.push(
      "FanPass target must keep SocketIO as a FanPass-only dependency",
    );
  }
  if (/StripePaymentSheet|package:\s*Stripe/.test(fanPassOpsBlock)) {
    errors.push("FanPassOps target must not depend on Stripe");
  }
  if (/product:\s*SocketIO|package:\s*SocketIO/.test(fanPassOpsBlock)) {
    errors.push("FanPassOps target must not depend on SocketIO");
  }
  for (const [targetName, block] of [
    ["FanPass", fanPassBlock],
    ["FanPassOps", fanPassOpsBlock],
  ]) {
    if (!/package:\s*Privy[\s\S]*product:\s*Privy/.test(block)) {
      errors.push(
        `${targetName} target must link the Privy Swift SDK only through the shared PrivyAuthProvider boundary`,
      );
    }
  }
  if (
    !/excludes:\s*\n\s*-\s*FanPassOrderbookRealtimeClient\.swift/.test(
      fanPassOpsBlock,
    )
  ) {
    errors.push(
      "FanPassOps target must exclude the consumer realtime orderbook client",
    );
  }
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function readJsonIfExists(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function targetBlock(project, targetName, nextTargetName) {
  const start = project.indexOf(`  ${targetName}:\n`);
  if (start === -1) {
    errors.push(`Missing ${targetName} target in ${projectYmlPath}`);
    return "";
  }
  const end = nextTargetName
    ? project.indexOf(`  ${nextTargetName}:\n`, start + targetName.length)
    : project.length;
  return project.slice(start, end === -1 ? project.length : end);
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}
