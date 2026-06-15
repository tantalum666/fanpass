const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/ios-staging-build-evidence-audit.js",
);
const implementationSnapshotFiles = [
  "apps/ios/FanPass/project.yml",
  "apps/ios/FanPass/Config/Local.xcconfig",
  "apps/ios/FanPass/Config/Staging.xcconfig",
  "apps/ios/FanPass/Config/Beta.xcconfig",
  "apps/ios/FanPass/Config/Production.xcconfig",
  "apps/ios/FanPass/FanPass/Generated/Info.plist",
  "apps/ios/FanPass/FanPassOps/Generated/Info.plist",
  "apps/ios/FanPass/FanPassOps/FanPassOps.entitlements",
  "apps/ios/FanPass/FanPass/App/FanPassApp.swift",
  "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
  "apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift",
  "apps/ios/FanPass/FanPass/Features/Payments/StripePaymentSheetPresenter.swift",
  "apps/ios/FanPass/FanPass/Services/FanPassPaymentCoordinator.swift",
  "apps/ios/FanPass/FanPass/Services/PrivyAuthProvider.swift",
  "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
  "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
  "scripts/ios-distribution-boundary-audit.js",
];
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-ios-staging-build-evidence-"),
);
const cases = [];
const errors = [];

try {
  expectPass(
    "accepts complete signed staging build evidence",
    writeEvidence("staging.txt", withProgressText(createEvidence())),
  );

  expectPass(
    "accepts complete closed external TestFlight beta evidence",
    writeEvidence(
      "beta.txt",
      withProgressText(
        createEvidence({
          environment: {
            name: "beta",
            apiBaseUrl: "https://beta-api.fanpass.test",
            configFile: "Config/Beta.xcconfig",
            buildConfiguration: "Beta",
          },
          apps: [
            {
              distributionChannel: "closed-external-testflight",
              apiBaseUrlObserved: "https://beta-api.fanpass.test",
            },
            {
              distributionChannel: "closed-external-testflight",
              apiBaseUrlObserved: "https://beta-api.fanpass.test",
            },
          ],
        }),
      ),
    ),
  );

  expectFail(
    "rejects local dry-run and placeholder URLs",
    writeEvidence(
      "local-placeholder.txt",
      withProgressText(
        createEvidence({
          localDryRun: true,
          environment: {
            apiBaseUrl: "https://replace-me-staging-api.fanpass.invalid",
          },
        }),
      ),
    ),
    [
      "localDryRun must be false",
      "environment.apiBaseUrl must be a real non-placeholder URL",
    ],
  );

  expectFail(
    "rejects HTTP or local API evidence",
    writeEvidence(
      "http-local.txt",
      withProgressText(
        createEvidence({
          environment: {
            apiBaseUrl: "http://localhost:4000",
          },
        }),
      ),
    ),
    ["environment.apiBaseUrl must be HTTPS"],
  );

  expectFail(
    "rejects missing app evidence",
    writeEvidence(
      "missing-app.txt",
      withProgressText(
        createEvidence({
          apps: [fanPassApp()],
        }),
      ),
    ),
    ["apps must include FanPass and FanPass Ops"],
  );

  expectFail(
    "rejects debug build and fallback payload helpers",
    writeEvidence(
      "debug-build.txt",
      withProgressText(
        createEvidence({
          apps: [
            {
              debugCompilationDisabled: false,
              debugPayloadHelpersUnavailable: false,
            },
            {
              debugCompilationDisabled: false,
              debugPayloadHelpersUnavailable: false,
            },
          ],
        }),
      ),
    ),
    [
      "debugCompilationDisabled must be true",
      "debugPayloadHelpersUnavailable must be true",
    ],
  );

  expectFail(
    "rejects product capability or role leakage",
    writeEvidence(
      "role-leakage.txt",
      withProgressText(
        createEvidence({
          apps: [
            {
              cameraPermissionPresent: true,
              staffControlsPresent: true,
            },
            {
              stripePaymentSheetPresent: true,
              marketplacePresent: true,
            },
          ],
        }),
      ),
    ),
    [
      "FanPass cameraPermissionPresent must be false",
      "FanPass staffControlsPresent must be false",
      "FanPass Ops marketplacePresent must be false",
      "FanPass Ops stripePaymentSheetPresent must be false",
    ],
  );

  expectFail(
    "rejects missing deployed runtime proof",
    writeEvidence(
      "missing-runtime.txt",
      withProgressText(
        createEvidence({
          environment: {
            demoAuthDisabled: false,
          },
          runtimeChecks: {
            demoAuthRejected: false,
            stagingRuntimeEvidencePassedOrLinked: false,
          },
        }),
      ),
    ),
    [
      "environment.demoAuthDisabled must be true",
      "runtimeChecks.demoAuthRejected must be true",
      "runtimeChecks.stagingRuntimeEvidencePassedOrLinked must be true",
    ],
  );

  expectFail(
    "rejects stale iOS staging build implementation snapshot proof",
    writeEvidence(
      "stale-implementation-snapshot.txt",
      withProgressText(
        createEvidence({
          implementationSnapshot: {
            source: "stale-ios-build-boundaries",
            files: [
              {
                file: "apps/ios/FanPass/project.yml",
                sha256: "0".repeat(64),
              },
              {
                file: "unexpected/ios-build-config.xcconfig",
                sha256: "1".repeat(64),
              },
            ],
          },
        }),
      ),
    ),
    [
      "implementationSnapshot.source must be ios-staging-build-distribution-boundaries",
      "implementationSnapshot.files must include the current iOS staging/TestFlight distribution boundary files",
      "implementationSnapshot.files contains unexpected file unexpected/ios-build-config.xcconfig",
      "implementationSnapshot.files apps/ios/FanPass/project.yml sha256 must match the current iOS staging/TestFlight distribution implementation",
      "implementationSnapshot.files missing apps/ios/FanPass/Config/Local.xcconfig",
    ],
  );

  expectFail(
    "rejects secret and device markers",
    writeEvidence(
      "secret-device.txt",
      `${withProgressText(createEvidence())}\nAuthorization: Bearer eyJhbGci\nPROVISIONING_PROFILE_SPECIFIER=private-profile\nUDID=00008030\n`,
    ),
    ["Authorization: Bearer", "PROVISIONING_PROFILE_SPECIFIER=", "udid"],
  );

  expectFail(
    "rejects leaked Stripe publishable key markers",
    writeEvidence(
      "stripe-publishable-key.txt",
      `${withProgressText(createEvidence())}\nSTRIPE_PUBLISHABLE_KEY=pk_test_fixturepublishable1234\n`,
    ),
    ["pk_test_", "STRIPE_PUBLISHABLE_KEY="],
  );

  expectFail(
    "rejects leaked database URL markers",
    writeEvidence(
      "database-url.txt",
      `${withProgressText(createEvidence())}\nDATABASE_URL=postgresql://fixture:secret@db/fanpass\n`,
    ),
    ["DATABASE_URL=", "database URLs"],
  );

  expectFail(
    "rejects leaked deployment and cloud credential markers",
    writeEvidence(
      "deployment-cloud-credentials.txt",
      [
        withProgressText(createEvidence()),
        "VERCEL_TOKEN=fixture-vercel-deploy-token",
        "AWS_SECRET_ACCESS_KEY=fixture-aws-secret-key",
        JSON.stringify({
          CLOUDFLARE_API_TOKEN: "fixture-cloudflare-token",
          githubToken: "fixture-github-token",
        }),
      ].join("\n"),
    ),
    [
      "deployment or cloud credential assignment",
      "deployment or cloud credential field",
      "deployment or cloud credential environment field",
    ],
  );

  expectFail(
    "rejects CI secret masking command literals",
    writeEvidence(
      "ci-masking-command.txt",
      [
        withProgressText(createEvidence()),
        "::add-mask::fixture-app-store-connect-api-key",
        "##vso[task.setvariable variable=APPLE_SIGNING_PASSWORD;issecret=true]fixture-signing-password",
      ].join("\n"),
    ),
    ["CI secret masking command literal"],
  );

  expectFail(
    "rejects missing deployment credential availability and redaction proof",
    writeEvidence(
      "missing-deployment-credential-redaction.txt",
      withProgressText(
        createEvidence({
          environment: {
            deploymentCredentialsAvailable: true,
          },
          redaction: {
            deploymentCredentialsRedacted: false,
          },
        }),
      ),
    ),
    [
      "environment.deploymentCredentialsAvailable must be false",
      "redaction.deploymentCredentialsRedacted must be true",
    ],
  );

  expectFail(
    "rejects missing CI secret masking command redaction proof",
    writeEvidence(
      "missing-ci-masking-redaction.txt",
      withProgressText(
        createEvidence({
          redaction: {
            ciSecretMaskingCommandsRedacted: false,
          },
        }),
      ),
    ),
    ["redaction.ciSecretMaskingCommandsRedacted must be true"],
  );

  expectFail(
    "rejects missing redaction proof",
    writeEvidence(
      "missing-redaction.txt",
      withProgressText(
        createEvidence({
          redaction: {
            appleSigningMaterialRedacted: false,
            deviceIdentifiersRedacted: false,
            realPersonalDataExcluded: false,
          },
        }),
      ),
    ),
    [
      "redaction.appleSigningMaterialRedacted must be true",
      "redaction.deviceIdentifiersRedacted must be true",
      "redaction.realPersonalDataExcluded must be true",
    ],
  );

  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, cases }, null, 2));
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

function createEvidence(overrides = {}) {
  return deepMerge(
    {
      ok: true,
      checkedAt: "2026-05-30T00:00:00.000Z",
      provider: "ios-staging-build",
      localDryRun: false,
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      implementationSnapshot: createImplementationSnapshot(),
      environment: {
        name: "staging",
        apiBaseUrl: "https://staging-api.fanpass.test",
        configFile: "Config/Staging.xcconfig",
        buildConfiguration: "Staging",
        demoAuthDisabled: true,
        stripeMode: "test",
        privyAppType: "test",
        deploymentCredentialsAvailable: false,
      },
      apps: [fanPassApp(), fanPassOpsApp()],
      runtimeChecks: {
        apiHealthReachable: true,
        tlsVerified: true,
        demoAuthRejected: true,
        iosDistributionBoundaryAuditPassed: true,
        stagingRuntimeEvidencePassedOrLinked: true,
      },
      redaction: {
        bearerTokensRedacted: true,
        privyTokensRedacted: true,
        stripeSecretsRedacted: true,
        providerSecretsRedacted: true,
        stripePublishableKeysRedacted: true,
        databaseUrlsRedacted: true,
        deploymentCredentialsRedacted: true,
        ciSecretMaskingCommandsRedacted: true,
        appleSigningMaterialRedacted: true,
        provisioningProfilesRedacted: true,
        deviceIdentifiersRedacted: true,
        realPersonalDataExcluded: true,
      },
    },
    overrides,
  );
}

function fanPassApp() {
  return {
    name: "FanPass",
    scheme: "FanPass",
    bundleId: "fun.fanpass.app",
    archiveSucceeded: true,
    signedWithAppleTeam: true,
    distributionChannel: "development-device",
    installVerifiedOnPhysicalDevice: true,
    apiBaseUrlObserved: "https://staging-api.fanpass.test",
    debugCompilationDisabled: true,
    debugPayloadHelpersUnavailable: true,
    secretsInBundle: false,
    cameraPermissionPresent: false,
    nfcEntitlementPresent: false,
    staffControlsPresent: false,
    paymentReturnUrlSchemePresent: true,
  };
}

function fanPassOpsApp() {
  return {
    name: "FanPass Ops",
    scheme: "FanPassOps",
    bundleId: "com.fanpass.ops",
    archiveSucceeded: true,
    signedWithAppleTeam: true,
    distributionChannel: "development-device",
    installVerifiedOnPhysicalDevice: true,
    apiBaseUrlObserved: "https://staging-api.fanpass.test",
    debugCompilationDisabled: true,
    debugPayloadHelpersUnavailable: true,
    secretsInBundle: false,
    cameraPermissionPresent: true,
    nfcEntitlementPresent: true,
    consumerWalletPresent: false,
    marketplacePresent: false,
    stripePaymentSheetPresent: false,
  };
}

function withProgressText(evidence) {
  return [
    "Checking FanPass iOS staging build evidence...",
    JSON.stringify(evidence, null, 2),
  ].join("\n");
}

function createImplementationSnapshot() {
  return {
    source: "ios-staging-build-distribution-boundaries",
    files: implementationSnapshotFiles.map((file) => ({
      file,
      sha256: crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(rootDir, file)))
        .digest("hex"),
    })),
  };
}

function writeEvidence(fileName, contents) {
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

function expectPass(label, filePath) {
  const result = runAudit(filePath);
  cases.push({ label, expected: "pass", status: result.status });
  if (result.status !== 0) {
    errors.push(
      `${label}: expected pass, got ${result.status}: ${result.stderr || result.stdout}`,
    );
  }
}

function expectFail(label, filePath, requiredMessages) {
  const result = runAudit(filePath);
  cases.push({ label, expected: "fail", status: result.status });
  if (result.status === 0) {
    errors.push(`${label}: expected failure, got success`);
    return;
  }
  const output = `${result.stderr}\n${result.stdout}`;
  for (const message of requiredMessages) {
    if (!output.includes(message)) {
      errors.push(`${label}: failure output did not include ${message}`);
    }
  }
}

function runAudit(filePath) {
  return spawnSync(process.execPath, [auditScript, filePath], {
    cwd: rootDir,
    encoding: "utf8",
  });
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (
      Array.isArray(value) &&
      Array.isArray(target[key]) &&
      value.length === target[key].length &&
      value.every(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    ) {
      target[key] = target[key].map((item, index) =>
        value[index] ? deepMerge(item, value[index]) : item,
      );
    } else if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}
