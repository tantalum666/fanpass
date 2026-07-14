const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const args = parseArgs(process.argv.slice(2));
const kind = args.kind ?? args._[0];

const planSnapshotFiles = [
  "apps/api/src/modules/auth/privy-token.service.ts",
  "apps/api/src/modules/auth/auth.service.ts",
  "apps/api/src/modules/auth/auth.controller.ts",
  "apps/dashboard/server/console-bff.ts",
  "apps/ios/FanPass/FanPass/Services/PrivyAuthProvider.swift",
  "scripts/privy-plan-evidence-audit.js",
  "scripts/privy-webhook-optionality-audit.js",
  "docs/PRIVY_PLAN_EVIDENCE.md",
  "docs/PROVIDER_COST_FEASIBILITY.md",
];

const mobileSnapshotFiles = [
  "apps/ios/FanPass/FanPass/Services/PrivyAuthProvider.swift",
  "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
  "apps/ios/FanPass/FanPass/App/AppState.swift",
  "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
  "apps/ios/FanPass/FanPass/Features/Auth/AuthView.swift",
  "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
  "apps/ios/FanPass/project.yml",
  "apps/ios/FanPass/FanPass/Generated/Info.plist",
  "apps/ios/FanPass/FanPassOps/Generated/Info.plist",
  "apps/ios/FanPass/Config/Local.xcconfig",
  "apps/ios/FanPass/Config/Staging.xcconfig",
  "apps/ios/FanPass/Config/Beta.xcconfig",
  "apps/ios/FanPass/Config/Production.xcconfig",
];

const consoleSnapshotFiles = [
  "apps/console-auth/src/AuthApp.tsx",
  "apps/console-auth/src/PrivyConsoleLogin.tsx",
  "apps/console-auth/src/runtime-config.ts",
  "apps/console-auth/server/config.ts",
  "apps/console-auth/server/index.ts",
  "apps/console-auth/server/security.ts",
  "apps/console-auth/server/static-files.ts",
  "apps/console-auth/vite.config.ts",
  "apps/console-auth/package.json",
  "apps/console-auth/package-lock.json",
  "apps/dashboard/server/console-bff.ts",
  "apps/dashboard/src/ConsoleApp.tsx",
  "apps/dashboard/lib/console-auth.ts",
  "apps/dashboard/package.json",
  "package.json",
  "package-lock.json",
  "render.yaml",
  "scripts/console-auth-runtime-audit.js",
  "scripts/console-route-contract-audit.js",
  "scripts/console-session-handoff-integration-test.js",
  "scripts/provider-boundary-audit.js",
];

if (!["plan", "mobile", "console"].includes(kind)) {
  console.error(
    [
      "Usage: node scripts/privy-evidence-draft.js <plan|mobile|console> [--out <file>] [--checked-at <iso>]",
      "",
      "Creates a non-passing, secret-free draft evidence JSON with current SHA-256 snapshot fields.",
      "Fill only facts reviewed in the real Privy dashboard, then run the matching security validator.",
    ].join("\n"),
  );
  process.exit(1);
}

const checkedAt = args["checked-at"] ?? new Date().toISOString();
if (!isIsoDate(checkedAt)) {
  console.error("--checked-at must be an ISO timestamp");
  process.exit(1);
}

const draft = buildDraft(kind, checkedAt);
const output = `${JSON.stringify(draft, null, 2)}\n`;

if (args.out) {
  const outPath = path.resolve(rootDir, args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output);
  console.log(
    JSON.stringify(
      { ok: true, written: path.relative(rootDir, outPath) },
      null,
      2,
    ),
  );
} else {
  process.stdout.write(output);
}

function buildDraft(draftKind, checkedAtIso) {
  if (draftKind === "plan") {
    return {
      ok: false,
      draft: true,
      draftStatus: "requires-real-privy-dashboard-review",
      checkedAt: checkedAtIso,
      provider: "privy",
      dashboardReviewed: false,
      selectedPlan: "<fill-from-privy-dashboard>",
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      deploymentCredentialsAvailable: false,
      policySnapshot: {
        source: "privy-plan-auth-policy-boundaries",
        files: snapshot(planSnapshotFiles),
      },
      features: {
        mobileSdkUse: "<supported|unsupported|plan-gated>",
        embeddedWalletCreation: "<supported|unsupported|plan-gated>",
        backendAccessTokenVerification: "<supported|unsupported|plan-gated>",
        webhooks: "<supported|unsupported|plan-gated>",
        customAuthUi: "<supported|unsupported|plan-gated>",
        mfaOrPolicyControls: "<supported|unsupported|plan-gated>",
      },
      decisions: {
        coreAuthUsesAccessTokenSync: true,
        webhooksRequiredForBeta: false,
        webhookPlanGate: "optional-until-supported",
        sdkIntegrationUnblocked: false,
      },
      redaction: {
        appSecretRedacted: true,
        verificationKeyRedacted: true,
        accessTokensRedacted: true,
        appIdRedactedOrNonSecret: true,
        providerSecretsRedacted: true,
        stripePublishableKeysRedacted: true,
        databaseUrlsRedacted: true,
        deploymentCredentialsRedacted: true,
        ciSecretMaskingCommandsRedacted: true,
        userIdentifiersRedacted: true,
      },
      nextValidator:
        "npm run security:privy-plan:evidence -- <saved-json-output>",
    };
  }

  if (draftKind === "mobile") {
    return {
      ok: false,
      draft: true,
      draftStatus: "requires-real-privy-dashboard-review",
      checkedAt: checkedAtIso,
      provider: "privy-mobile-app-config",
      dashboardReviewed: false,
      environment: "staging",
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      deploymentCredentialsAvailable: false,
      implementationSnapshot: {
        source: "privy-ios-auth-config-boundaries",
        files: snapshot(mobileSnapshotFiles),
      },
      apps: [
        mobileAppDraft("FanPass", "fun.fanpass.app"),
        mobileAppDraft("FanPass Ops", "com.fanpass.ops"),
      ],
      configuration: {
        checkedInXcconfigsRemainPlaceholderOnly:
          "<verify-with-local-config-check>",
        buildSettingsInjectedOutsideSourceControl:
          "<verify-in-build-or-scheme>",
        generatedInfoPlistKeysVerified: "<verify-in-xcode-build-output>",
        fanPassEnvironmentRejectsEmptyOrPlaceholderValues: true,
        fanPassEnvironmentRejectsSecretLikeValues: true,
        privySwiftProviderBoundaryPassed: "<run-security-provider-boundaries>",
        iosDistributionBoundaryPassed:
          "<run-security-ios-distribution-boundaries>",
      },
      linkedEvidence: {
        privyPlanEvidencePassed: "<run-privy-plan-evidence-validator>",
        iosStagingBuildEvidenceRequired: true,
        staffTenantEvidenceRequired: true,
        webhooksRequiredForMobileConfig: false,
        privyWebhooksOptionalUntilPlanConfirmed: true,
      },
      redaction: {
        appSecretsRedacted: true,
        verificationKeysRedacted: true,
        accessTokensRedacted: true,
        providerSecretsRedacted: true,
        stripePublishableKeysRedacted: true,
        databaseUrlsRedacted: true,
        deploymentCredentialsRedacted: true,
        ciSecretMaskingCommandsRedacted: true,
        userIdentifiersRedacted: true,
        dashboardScreenshotsReviewedForSecrets: false,
      },
      nextValidator:
        "npm run security:privy-mobile-app-config:evidence -- <saved-json-output>",
    };
  }

  return {
    ok: false,
    draft: true,
    draftStatus: "requires-console-sdk-dependency-isolation-review",
    checkedAt: checkedAtIso,
    provider: "privy-console-react-sdk-isolation",
    evidenceSource: "node22-dependency-isolation-review",
    realUserDataUsed: false,
    productionCredentialsUsed: false,
    deploymentCredentialsAvailable: false,
    releaseScope: "staging-only",
    implementationSnapshot: {
      source: "privy-console-sdk-isolation-boundaries",
      files: snapshot(consoleSnapshotFiles),
    },
    sdk: {
      package: "@privy-io/react-auth",
      version: "<fill-from-npm-view>",
      metadataCommand:
        "npm view @privy-io/react-auth@latest version dependencies peerDependencies --json",
    },
    integration: {
      mode: "<direct-console-dependency-clean-audit|isolated-auth-workspace>",
      fanPassConsoleProductionDependency:
        "<true-for-direct|false-for-isolated>",
      isolatedRuntimeBoundary: "<true-when-isolated>",
      sdkImportsLimitedTo: ["<approved-console-auth-component-path>"],
      sessionBridgeRoute: "/api/console/privy-session",
      serverRouteStoresHttpOnlyCookie: true,
      fanPassCodeStoresAccessTokensInBrowserStorage: false,
      stagingPrivySessionMode: "browser-sdk",
      productionPrivySessionMode: "httponly-cookie",
      privyDefaultStorageRiskDocumented: true,
      serverSideApiReadsUseCookieOrConfiguredToken: true,
    },
    dependencyAudit: {
      integrationMode: "<match-integration.mode>",
      nodeVersion: process.versions.node,
      engineStrict: true,
      withNode22HelperUsed: true,
      safeNextPostcssPathChecked: "<run-security-dependency-advisories>",
      commands: [
        "npm run security:audit:prod",
        "npm run security:dependency-advisories",
      ],
      productionAuditBefore: auditCountDraft(),
      productionAuditAfter: {
        ...auditCountDraft(),
        knownNextPostcssOnly: "<true-or-clean>",
        newAdvisoryPackages: [],
      },
      isolatedWorkspaceAudit: {
        command: "npm audit --omit=dev --audit-level=low",
        workspacePath: "apps/console-auth",
        defaultFanPassProductionAuditPath: false,
        runtime: "vite-node-static",
        nextDependencyPresent: false,
        ...auditCountDraft(),
        advisoryPackages: ["<fill-from-isolated-npm-audit>"],
      },
    },
    boundaries: {
      consoleRouteAuditPassed: "<run-security-console-routes>",
      providerBoundaryAuditPassed: "<run-security-provider-boundaries>",
      dependencyAdvisoryGatePassed: "<run-security-dependency-advisories>",
      noProviderSecretsInEnvOrBundle: true,
      noRawPrivyTokenLogging: true,
      noRawUpstreamSessionForwarding: true,
    },
    productionReadiness: {
      dedicatedProductionPrivyApp: false,
      stagingAndProductionAppIdsDiffer: false,
      stableProductionDomainVerified: false,
      exactProductionAllowedOriginsVerified: false,
      privyHttpOnlyCookieModeVerified: false,
      administratorAllowlistEnforced: false,
      administratorMfaOrPasskeyRequired: false,
      organizerAdminBackendRoleGateVerified: true,
      isolatedAuditHighCriticalZero: "<verify-isolated-audit>",
      isolatedModerateRiskReviewed: false,
      liveProductionLoginE2ePassed: false,
      unresolvedBlockers: [
        "dedicated-production-privy-app",
        "stable-production-domain",
        "production-allowed-origins",
        "privy-httponly-cookie-mode",
        "administrator-allowlist",
        "administrator-mfa-or-passkey",
        "production-login-e2e",
      ],
    },
    redaction: {
      accessTokensRedacted: true,
      appSecretRedacted: true,
      verificationKeyRedacted: true,
      providerSecretsRedacted: true,
      stripePublishableKeysRedacted: true,
      databaseUrlsRedacted: true,
      deploymentCredentialsRedacted: true,
      userIdentifiersRedacted: true,
      dependencyLogsReviewed: false,
    },
    nextValidator:
      "npm run security:privy-console-react-sdk:isolation -- --require-production <saved-json-output>",
  };
}

function mobileAppDraft(name, bundleId) {
  return {
    name,
    bundleId,
    appIdConfigured: "<verify-in-privy-dashboard>",
    appClientIdConfigured: "<verify-in-privy-dashboard>",
    appIdPublicOrRedacted: true,
    appClientIdPublicOrRedacted: true,
    appSecretAbsent: "<verify-not-in-mobile-config>",
    verificationKeyAbsent: "<verify-not-in-mobile-config>",
  };
}

function auditCountDraft() {
  return {
    total: "<integer>",
    moderate: "<integer>",
    high: 0,
    critical: 0,
  };
}

function snapshot(files) {
  return files.map((file) => ({
    file,
    sha256: sha256File(file),
  }));
}

function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(rootDir, file)))
    .digest("hex");
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      parsed._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function isIsoDate(value) {
  if (typeof value !== "string" || !value) {
    return false;
  }
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}
