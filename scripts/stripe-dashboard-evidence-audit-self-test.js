const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/stripe-dashboard-evidence-audit.js",
);
const policySnapshotFiles = [
  "apps/api/src/modules/payments/payments.controller.ts",
  "apps/api/src/modules/payments/payments.service.ts",
  "apps/api/src/config/security-config.ts",
  "apps/api/.env.staging.example",
  "scripts/stripe-dashboard-evidence-audit.js",
  "scripts/stripe-testmode-evidence-audit.js",
  "docs/STRIPE_DASHBOARD_EVIDENCE.md",
  "docs/STRIPE_TESTMODE_EVIDENCE.md",
  "docs/PROVIDER_COST_FEASIBILITY.md",
];
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-stripe-dashboard-evidence-"),
);
const cases = [];
const errors = [];

try {
  expectPass(
    "accepts complete Stripe dashboard feasibility evidence",
    writeEvidence("valid.txt", withProgressText(createEvidence())),
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
    "rejects live mode dashboard evidence",
    writeEvidence(
      "live-mode.txt",
      withProgressText(
        createEvidence({
          stripeMode: "live",
          dashboard: {
            accountMode: "live",
            liveModeUsed: true,
          },
        }),
      ),
    ),
    [
      "stripeMode must be test",
      "dashboard.accountMode must be test",
      "dashboard.liveModeUsed must be false",
    ],
  );

  expectFail(
    "rejects stale Stripe dashboard policy snapshot proof",
    writeEvidence(
      "stale-policy-snapshot.txt",
      withProgressText(
        createEvidence({
          policySnapshot: {
            source: "old-stripe-dashboard-policy",
            files: [
              {
                file: "apps/api/src/modules/payments/payments.controller.ts",
                sha256: "stale",
              },
              {
                file: "unexpected/stripe-dashboard.md",
                sha256: "abc123",
              },
            ],
          },
        }),
      ),
    ),
    [
      "policySnapshot.source must be stripe-dashboard-payment-webhook-policy",
      "policySnapshot.files must include the current Stripe dashboard payment/webhook policy files",
      "policySnapshot.files contains unexpected file unexpected/stripe-dashboard.md",
      "policySnapshot.files apps/api/src/modules/payments/payments.controller.ts sha256 must match the current Stripe dashboard payment/webhook policy implementation",
      "policySnapshot.files missing apps/api/src/modules/payments/payments.service.ts",
    ],
  );

  expectFail(
    "rejects leaked Stripe and database markers",
    writeEvidence(
      "secret-marker.txt",
      [
        withProgressText(createEvidence()),
        "STRIPE_SECRET_KEY=sk_test_fixture",
        "STRIPE_WEBHOOK_SECRET=whsec_fixture",
        "DATABASE_URL=postgresql://fixture:secret@db/fanpass",
      ].join("\n"),
    ),
    [
      "STRIPE_SECRET_KEY=",
      "STRIPE_WEBHOOK_SECRET=",
      "DATABASE_URL=",
      "database URLs",
    ],
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
          redaction: { deploymentCredentialsRedacted: false },
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
    "rejects incomplete PaymentIntent route evidence",
    writeEvidence(
      "payment-intent-route-drift.txt",
      withProgressText(
        createEvidence({
          paymentIntents: {
            fanPassRoute: "POST /payments/legacy-intents",
            idempotencyKeyRequired: false,
          },
        }),
      ),
    ),
    [
      "paymentIntents.fanPassRoute must be POST /payments/intents",
      "paymentIntents.idempotencyKeyRequired must be true",
    ],
  );

  expectFail(
    "rejects incomplete webhook endpoint evidence",
    writeEvidence(
      "webhook-drift.txt",
      withProgressText(
        createEvidence({
          webhookEndpoint: {
            url: "http://api.staging.fanpass.example/payments/webhook",
            fanPassRoute: "POST /payments/legacy-webhook",
            signingSecretRecorded: true,
            enabledEvents: ["payment_intent.succeeded"],
          },
        }),
      ),
    ),
    [
      "webhookEndpoint.url must be HTTPS",
      "webhookEndpoint.fanPassRoute must be POST /payments/webhook",
      "webhookEndpoint.signingSecretRecorded must be false",
      "webhookEndpoint.enabledEvents must include payment_intent.amount_capturable_updated",
      "webhookEndpoint.enabledEvents must include payment_intent.payment_failed",
    ],
  );

  expectFail(
    "rejects missing redaction proof",
    writeEvidence(
      "missing-redaction.txt",
      withProgressText(
        createEvidence({
          redaction: {
            webhookSecretRedacted: false,
            clientSecretRedacted: false,
          },
        }),
      ),
    ),
    [
      "redaction.webhookSecretRedacted must be true",
      "redaction.clientSecretRedacted must be true",
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
      provider: "stripe",
      evidenceSource: "stripe-dashboard-review",
      dashboardReviewed: true,
      stripeMode: "test",
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      deploymentCredentialsAvailable: false,
      policySnapshot: createPolicySnapshot(),
      dashboard: {
        accountMode: "test",
        testModeToggleVisible: true,
        paymentsEnabled: true,
        liveModeUsed: false,
      },
      paymentIntents: {
        testModeCreationAvailable: true,
        manualCaptureAvailable: true,
        fanPassRoute: "POST /payments/intents",
        idempotencyKeyRequired: true,
        clientSecretRedacted: true,
      },
      webhookEndpoint: {
        dashboardEndpointCreated: true,
        url: "https://api.staging.fanpass.example/payments/webhook",
        fanPassRoute: "POST /payments/webhook",
        signingSecretAvailable: true,
        signingSecretRecorded: false,
        rawBodySignatureRequired: true,
        enabledEvents: [
          "payment_intent.amount_capturable_updated",
          "payment_intent.succeeded",
          "payment_intent.payment_failed",
        ],
      },
      decisions: {
        useStripeTestModeForBeta: true,
        noRealMoneyBeforeEvidence: true,
        requiresSignedWebhooksBeforeBeta: true,
        connectRequiredForClosedBeta: false,
      },
      redaction: {
        secretKeyRedacted: true,
        webhookSecretRedacted: true,
        publishableKeyRedacted: true,
        clientSecretRedacted: true,
        providerSecretsRedacted: true,
        databaseUrlsRedacted: true,
        deploymentCredentialsRedacted: true,
        ciSecretMaskingCommandsRedacted: true,
        userIdentifiersRedacted: true,
      },
    },
    overrides,
  );
}

function createPolicySnapshot() {
  return {
    source: "stripe-dashboard-payment-webhook-policy",
    files: policySnapshotFiles.map((file) => ({
      file,
      sha256: sha256File(file),
    })),
  };
}

function withProgressText(evidence) {
  return [
    "Checking FanPass Stripe dashboard feasibility evidence...",
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

function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(rootDir, file)))
    .digest("hex");
}
