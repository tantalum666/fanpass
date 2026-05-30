const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/privy-plan-evidence-audit.js");
const policySnapshotFiles = [
  "apps/api/src/modules/auth/privy-token.service.ts",
  "apps/api/src/modules/auth/auth.service.ts",
  "apps/api/src/modules/auth/auth.controller.ts",
  "apps/dashboard/app/api/console/privy-session/route.ts",
  "apps/ios/FanPass/FanPass/Services/PrivyAuthProvider.swift",
  "scripts/privy-plan-evidence-audit.js",
  "scripts/privy-webhook-optionality-audit.js",
  "docs/PRIVY_PLAN_EVIDENCE.md",
  "docs/PROVIDER_COST_FEASIBILITY.md",
];
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-privy-evidence-"),
);
const cases = [];
const errors = [];

try {
  expectPass(
    "accepts complete Privy dashboard evidence without secrets",
    writeEvidence("valid.txt", withProgressText(createEvidence())),
  );

  expectPass(
    "accepts plan-gated webhooks when webhooks remain optional",
    writeEvidence(
      "plan-gated-webhooks.txt",
      withProgressText(
        createEvidence({
          features: { webhooks: "plan-gated" },
          decisions: { webhookPlanGate: "optional-until-supported" },
        }),
      ),
    ),
  );

  expectFail(
    "rejects evidence that was not dashboard reviewed",
    writeEvidence(
      "not-reviewed.txt",
      withProgressText(createEvidence({ dashboardReviewed: false })),
    ),
    ["dashboardReviewed must be true"],
  );

  expectFail(
    "rejects leaked Privy secret markers",
    writeEvidence(
      "secret-marker.txt",
      `${withProgressText(createEvidence())}\nPRIVY_APP_SECRET=should-not-appear\n`,
    ),
    ["PRIVY_APP_SECRET"],
  );

  expectFail(
    "rejects leaked provider key and database URL markers",
    writeEvidence(
      "provider-marker.txt",
      `${withProgressText(createEvidence())}\nSTRIPE_PUBLISHABLE_KEY=pk_test_fixturepublishable1234\nDATABASE_URL=postgresql://fixture:secret@db/fanpass\n`,
    ),
    ["STRIPE_PUBLISHABLE_KEY=", "pk_test_", "DATABASE_URL=", "database URLs"],
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
        "::add-mask::literal-ci-secret",
        "::set-secret name=PRIVY_TOKEN::literal-privy-secret",
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
    "rejects unknown feature support status",
    writeEvidence(
      "unknown-feature.txt",
      withProgressText(
        createEvidence({ features: { mobileSdkUse: "unknown" } }),
      ),
    ),
    ["features.mobileSdkUse"],
  );

  expectFail(
    "rejects stale Privy plan auth policy snapshot proof",
    writeEvidence(
      "stale-policy-snapshot.txt",
      withProgressText(
        createEvidence({
          policySnapshot: {
            source: "old-privy-plan-policy",
            files: [
              {
                file: "apps/api/src/modules/auth/privy-token.service.ts",
                sha256: "stale",
              },
              {
                file: "unexpected/privy-plan-policy.md",
                sha256: "abc123",
              },
            ],
          },
        }),
      ),
    ),
    [
      "policySnapshot.source must be privy-plan-auth-policy-boundaries",
      "policySnapshot.files must include the current Privy plan auth policy boundary files",
      "policySnapshot.files contains unexpected file unexpected/privy-plan-policy.md",
      "policySnapshot.files apps/api/src/modules/auth/privy-token.service.ts sha256 must match the current Privy plan auth policy implementation",
      "policySnapshot.files missing apps/api/src/modules/auth/auth.service.ts",
    ],
  );

  expectFail(
    "rejects webhooks as required for Beta",
    writeEvidence(
      "webhooks-required.txt",
      withProgressText(
        createEvidence({ decisions: { webhooksRequiredForBeta: true } }),
      ),
    ),
    ["webhooksRequiredForBeta must remain false"],
  );

  expectFail(
    "rejects SDK unblock claim without required feature support",
    writeEvidence(
      "sdk-unblock-drift.txt",
      withProgressText(
        createEvidence({
          features: { embeddedWalletCreation: "unsupported" },
          decisions: { sdkIntegrationUnblocked: true },
        }),
      ),
    ),
    ["sdkIntegrationUnblocked cannot be true"],
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
      provider: "privy",
      dashboardReviewed: true,
      selectedPlan: "Developer Free",
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      deploymentCredentialsAvailable: false,
      policySnapshot: createPolicySnapshot(),
      features: {
        mobileSdkUse: "supported",
        embeddedWalletCreation: "supported",
        backendAccessTokenVerification: "supported",
        webhooks: "plan-gated",
        customAuthUi: "supported",
        mfaOrPolicyControls: "plan-gated",
      },
      decisions: {
        coreAuthUsesAccessTokenSync: true,
        webhooksRequiredForBeta: false,
        webhookPlanGate: "optional-until-supported",
        sdkIntegrationUnblocked: true,
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
    },
    overrides,
  );
}

function withProgressText(evidence) {
  return [
    "Checking FanPass Privy dashboard evidence...",
    JSON.stringify(evidence, null, 2),
  ].join("\n");
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

function createPolicySnapshot() {
  return {
    source: "privy-plan-auth-policy-boundaries",
    files: policySnapshotFiles.map((file) => ({
      file,
      sha256: sha256File(file),
    })),
  };
}

function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(rootDir, file)))
    .digest("hex");
}
