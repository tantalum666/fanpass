const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/privy-mobile-app-config-evidence-audit.js",
);
const implementationSnapshotFiles = [
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
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-privy-mobile-config-"),
);
const cases = [];
const errors = [];

try {
  expectPass(
    "accepts complete Privy mobile app config evidence",
    writeEvidence("valid.txt", withProgressText(createEvidence())),
  );

  expectFail(
    "rejects leaked Privy verification key marker",
    writeEvidence(
      "secret-marker.txt",
      `${withProgressText(createEvidence())}\nPRIVY_VERIFICATION_KEY=do-not-commit\n`,
    ),
    ["PRIVY_VERIFICATION_KEY"],
  );

  expectFail(
    "rejects leaked Stripe publishable key marker",
    writeEvidence(
      "stripe-publishable-key.txt",
      `${withProgressText(createEvidence())}\nSTRIPE_PUBLISHABLE_KEY=pk_test_fixturepublishable1234\n`,
    ),
    ["STRIPE_PUBLISHABLE_KEY=", "pk_test_"],
  );

  expectFail(
    "rejects leaked provider secret and database URL markers",
    writeEvidence(
      "provider-secret-database-url.txt",
      `${withProgressText(createEvidence())}\nPROVIDER_SECRET=fixture-provider-secret\nDATABASE_URL=postgresql://fixture:secret@db/fanpass\n`,
    ),
    ["PROVIDER_SECRET=", "DATABASE_URL=", "database URLs"],
  );

  expectFail(
    "rejects leaked deployment and cloud credential markers",
    writeEvidence(
      "deployment-cloud-credential-marker.txt",
      [
        withProgressText(createEvidence()),
        "VERCEL_TOKEN=fixture-vercel-token",
        JSON.stringify({
          AWS_SECRET_ACCESS_KEY: "fixture-aws-secret",
          cloudflareApiToken: "fixture-cloudflare-token",
        }),
      ].join("\n"),
    ),
    [
      "deployment or cloud credential assignments",
      "deployment or cloud credential JSON fields",
      "deployment or cloud credential environment fields",
    ],
  );

  expectFail(
    "rejects CI secret masking command literals",
    writeEvidence(
      "ci-secret-masking-command-literal.txt",
      [
        withProgressText(createEvidence()),
        "::add-mask::literal-mobile-config-secret",
        "::set-secret name=PRIVY_MOBILE_CONFIG::literal-privy-config",
        "##vso[task.setvariable variable=TOKEN;issecret=true]literal-azure-secret",
      ].join("\n"),
    ),
    [
      "evidence must not include CI secret masking commands with literal values",
    ],
  );

  expectFail(
    "rejects missing deployment credential availability and redaction proof",
    writeEvidence(
      "missing-deployment-credential-redaction.txt",
      withProgressText(
        createEvidence({
          deploymentCredentialsAvailable: true,
          redaction: {
            deploymentCredentialsRedacted: false,
          },
        }),
      ),
    ),
    [
      "deploymentCredentialsAvailable must be false",
      "redaction.deploymentCredentialsRedacted must be true",
    ],
  );

  expectFail(
    "rejects missing CI secret masking command redaction proof",
    writeEvidence(
      "missing-ci-secret-masking-redaction.txt",
      withProgressText(
        createEvidence({
          redaction: { ciSecretMaskingCommandsRedacted: false },
        }),
      ),
    ),
    ["redaction.ciSecretMaskingCommandsRedacted must be true"],
  );

  expectFail(
    "rejects missing dashboard review",
    writeEvidence(
      "not-reviewed.txt",
      withProgressText(createEvidence({ dashboardReviewed: false })),
    ),
    ["dashboardReviewed must be true"],
  );

  expectFail(
    "rejects missing FanPass Ops app evidence",
    writeEvidence(
      "missing-ops.txt",
      withProgressText(createEvidence({ apps: [createApp("FanPass")] })),
    ),
    ["apps must list exactly FanPass and FanPass Ops"],
  );

  expectFail(
    "rejects wrong bundle id",
    writeEvidence(
      "wrong-bundle.txt",
      withProgressText(
        createEvidence({
          apps: [
            createApp("FanPass", { bundleId: "com.example.fanpass" }),
            createApp("FanPass Ops"),
          ],
        }),
      ),
    ),
    ["FanPass bundleId must be com.fanpass.app"],
  );

  expectFail(
    "rejects missing public app client id proof",
    writeEvidence(
      "missing-client-id.txt",
      withProgressText(
        createEvidence({
          apps: [
            createApp("FanPass", { appClientIdConfigured: false }),
            createApp("FanPass Ops"),
          ],
        }),
      ),
    ),
    ["FanPass.appClientIdConfigured must be true"],
  );

  expectFail(
    "rejects non-placeholder checked-in config",
    writeEvidence(
      "non-placeholder-config.txt",
      withProgressText(
        createEvidence({
          configuration: { checkedInXcconfigsRemainPlaceholderOnly: false },
        }),
      ),
    ),
    ["configuration.checkedInXcconfigsRemainPlaceholderOnly must be true"],
  );

  expectFail(
    "rejects stale Privy iOS implementation snapshot proof",
    writeEvidence(
      "stale-implementation-snapshot.txt",
      withProgressText(
        createEvidence({
          implementationSnapshot: {
            source: "stale-privy-ios-config",
            files: [
              {
                file: "apps/ios/FanPass/FanPass/Services/PrivyAuthProvider.swift",
                sha256: "0".repeat(64),
              },
              {
                file: "unexpected/privy.swift",
                sha256: "1".repeat(64),
              },
            ],
          },
        }),
      ),
    ),
    [
      "implementationSnapshot.source must be privy-ios-auth-config-boundaries",
      "implementationSnapshot.files must include the current Privy iOS auth/config boundary files",
      "implementationSnapshot.files contains unexpected file unexpected/privy.swift",
      "implementationSnapshot.files apps/ios/FanPass/FanPass/Services/PrivyAuthProvider.swift sha256 must match the current Privy iOS auth/config implementation",
      "implementationSnapshot.files missing apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
    ],
  );

  expectFail(
    "rejects missing FanPassEnvironment secret-like value guard",
    writeEvidence(
      "missing-runtime-secret-guard.txt",
      withProgressText(
        createEvidence({
          configuration: { fanPassEnvironmentRejectsSecretLikeValues: false },
        }),
      ),
    ),
    ["configuration.fanPassEnvironmentRejectsSecretLikeValues must be true"],
  );

  expectFail(
    "rejects mobile config that requires webhooks",
    writeEvidence(
      "webhooks-required.txt",
      withProgressText(
        createEvidence({
          linkedEvidence: { webhooksRequiredForMobileConfig: true },
        }),
      ),
    ),
    ["mobile config evidence must keep Privy webhooks optional"],
  );

  expectFail(
    "rejects missing redaction proof",
    writeEvidence(
      "missing-redaction.txt",
      withProgressText(
        createEvidence({ redaction: { accessTokensRedacted: false } }),
      ),
    ),
    ["redaction.accessTokensRedacted must be true"],
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
      provider: "privy-mobile-app-config",
      dashboardReviewed: true,
      environment: "staging",
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      deploymentCredentialsAvailable: false,
      apps: [createApp("FanPass"), createApp("FanPass Ops")],
      implementationSnapshot: createImplementationSnapshot(),
      configuration: {
        checkedInXcconfigsRemainPlaceholderOnly: true,
        buildSettingsInjectedOutsideSourceControl: true,
        generatedInfoPlistKeysVerified: true,
        fanPassEnvironmentRejectsEmptyOrPlaceholderValues: true,
        fanPassEnvironmentRejectsSecretLikeValues: true,
        privySwiftProviderBoundaryPassed: true,
        iosDistributionBoundaryPassed: true,
      },
      linkedEvidence: {
        privyPlanEvidencePassed: true,
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
        dashboardScreenshotsReviewedForSecrets: true,
      },
    },
    overrides,
  );
}

function createApp(name, overrides = {}) {
  const bundleId = name === "FanPass" ? "com.fanpass.app" : "com.fanpass.ops";
  return {
    name,
    bundleId,
    appIdConfigured: true,
    appClientIdConfigured: true,
    appIdPublicOrRedacted: true,
    appClientIdPublicOrRedacted: true,
    appSecretAbsent: true,
    verificationKeyAbsent: true,
    ...overrides,
  };
}

function withProgressText(evidence) {
  return [
    "Checking FanPass Privy mobile app config evidence...",
    JSON.stringify(evidence, null, 2),
  ].join("\n");
}

function createImplementationSnapshot() {
  return {
    source: "privy-ios-auth-config-boundaries",
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
