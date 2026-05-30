const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/stripe-testmode-evidence-audit.js",
);
const implementationSnapshotFiles = [
  "apps/api/src/modules/payments/payments.controller.ts",
  "apps/api/src/modules/payments/payments.service.ts",
  "apps/api/src/modules/side-effects/settlement-side-effects.service.ts",
  "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
  "apps/ios/FanPass/FanPass/App/FanPassApp.swift",
  "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
  "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
  "apps/ios/FanPass/FanPass/Features/Events/EventListView.swift",
  "apps/ios/FanPass/FanPass/Features/Payments/StripePaymentSheetPresenter.swift",
];
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-stripe-evidence-"),
);
const cases = [];
const errors = [];

try {
  expectPass(
    "accepts complete Stripe test-mode evidence without secrets",
    writeEvidence("valid.txt", withProgressText(createEvidence())),
  );

  expectFail(
    "rejects local mock evidence",
    writeEvidence(
      "local-mock.txt",
      withProgressText(createEvidence({ localMock: true })),
    ),
    ["localMock must be false"],
  );

  expectFail(
    "rejects stale Stripe implementation snapshot proof",
    writeEvidence(
      "stale-implementation-snapshot.txt",
      withProgressText(
        createEvidence({
          implementationSnapshot: {
            source: "old-stripe-boundary",
            files: [
              {
                file: "apps/api/src/modules/payments/payments.service.ts",
                sha256:
                  "2222222222222222222222222222222222222222222222222222222222222222",
              },
              {
                file: "unexpected/stripe.ts",
                sha256:
                  "3333333333333333333333333333333333333333333333333333333333333333",
              },
            ],
          },
        }),
      ),
    ),
    [
      "implementationSnapshot.source must be stripe-api-ios-payment-boundaries",
      "implementationSnapshot.files must include the current Stripe API/iOS payment boundary files",
      "implementationSnapshot.files contains unexpected file unexpected/stripe.ts",
      "implementationSnapshot.files apps/api/src/modules/payments/payments.service.ts sha256 must match the current Stripe API/iOS payment implementation",
      "implementationSnapshot.files missing apps/api/src/modules/payments/payments.controller.ts",
    ],
  );

  expectFail(
    "rejects leaked Stripe secret markers",
    writeEvidence(
      "secret-marker.txt",
      `${withProgressText(createEvidence())}\nSTRIPE_SECRET_KEY=sk_test_should_not_appear\n`,
    ),
    ["sk_test_"],
  );

  expectFail(
    "rejects leaked Stripe publishable key markers",
    writeEvidence(
      "publishable-key-marker.txt",
      `${withProgressText(createEvidence())}\nSTRIPE_PUBLISHABLE_KEY=pk_test_should_not_appear\n`,
    ),
    ["pk_test_"],
  );

  expectFail(
    "rejects leaked database URL markers",
    writeEvidence(
      "database-url-marker.txt",
      `${withProgressText(createEvidence())}\nDATABASE_URL=postgresql://fixture:secret@db/fanpass\n`,
    ),
    ["DATABASE_URL=", "database URLs"],
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
      "ci-secret-masking-commands.txt",
      [
        withProgressText(createEvidence()),
        "::add-mask::fixture-stripe-ci-secret",
        "::set-secret name=STRIPE_WEBHOOK_SECRET::fixture-legacy-stripe-secret",
        "##vso[task.setvariable variable=STRIPE_SECRET_KEY;issecret=true]fixture-azure-stripe-secret",
      ].join("\n"),
    ),
    ["CI secret masking commands with literal values"],
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
      "missing-ci-mask-redaction.txt",
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
    "rejects leaked client secret markers",
    writeEvidence(
      "client-secret-marker.txt",
      `${withProgressText(createEvidence())}\npayment_intent_client_secret should not appear\n`,
    ),
    ["client_secret"],
  );

  expectFail(
    "rejects missing iOS PaymentSheet proof",
    writeEvidence(
      "missing-mobile-client.txt",
      withProgressText(createEvidence({ mobileClient: undefined })),
    ),
    ["mobileClient evidence is required"],
  );

  expectFail(
    "rejects iOS PaymentSheet proof without backend client secret boundary",
    writeEvidence(
      "weak-mobile-client.txt",
      withProgressText(
        createEvidence({
          mobileClient: {
            usesBackendPaymentIntent: false,
            clientSecretSource: "manual-fixture",
            localMockClientSecretBlocked: false,
          },
        }),
      ),
    ),
    [
      "mobileClient.usesBackendPaymentIntent must be true",
      "mobileClient.clientSecretSource must be backend-payment-intent",
      "mobileClient.localMockClientSecretBlocked must be true",
    ],
  );

  expectFail(
    "rejects missing signed webhook verification",
    writeEvidence(
      "unsigned-webhook.txt",
      withProgressText(
        createEvidence({
          webhooks: { signedDeliveryVerified: false },
        }),
      ),
    ),
    ["signed Stripe webhook delivery must be verified"],
  );

  expectFail(
    "rejects missing capture refund and reconciliation proof",
    writeEvidence(
      "missing-side-effects.txt",
      withProgressText(
        createEvidence({
          sideEffects: {
            captureVerified: false,
            refundVerified: false,
            reconciliationVerified: false,
          },
        }),
      ),
    ),
    [
      "sideEffects.captureVerified must be true",
      "sideEffects.refundVerified must be true",
      "sideEffects.reconciliationVerified must be true",
    ],
  );

  expectFail(
    "rejects missing idempotency retry proof",
    writeEvidence(
      "missing-idempotency.txt",
      withProgressText(
        createEvidence({
          idempotency: { webhookReplay: false, captureRetry: false },
        }),
      ),
    ),
    [
      "idempotency.webhookReplay must be true",
      "idempotency.captureRetry must be true",
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
      stripeMode: "test",
      localMock: false,
      usesRealMoney: false,
      apiBaseUrl: "https://api.staging.fanpass.example",
      deploymentCredentialsAvailable: false,
      implementationSnapshot: createImplementationSnapshot(),
      paymentIntent: {
        created: true,
        id: "pi_testmode_evidence_fixture",
        captureMethod: "manual",
        clientSecretObserved: false,
        publishableKeyType: "test",
      },
      mobileClient: {
        platform: "ios",
        app: "FanPass",
        paymentSheetPresented: true,
        usesNativePaymentSheet: true,
        usesBackendPaymentIntent: true,
        clientSecretSource: "backend-payment-intent",
        clientSecretRecorded: false,
        publishableKeyType: "test",
        publishableKeyRecorded: false,
        localMockClientSecretBlocked: true,
        returnUrlScheme: "fanpass-payments",
        fanPassOpsCheckoutAbsent: true,
      },
      webhooks: {
        signedDeliveryVerified: true,
        rawBodySignatureVerified: true,
        duplicateReplayAcknowledged: true,
        eventIds: ["evt_testmode_authorized", "evt_testmode_capture"],
      },
      sideEffects: {
        captureVerified: true,
        cancelAuthorizationVerified: true,
        refundVerified: true,
        reconciliationVerified: true,
        outboxHealthAfterRetries: "healthy",
      },
      idempotency: {
        paymentIntentCreate: true,
        webhookReplay: true,
        captureRetry: true,
        cancelRetry: true,
        refundRetry: true,
        adminOperationRetry: true,
      },
      redaction: {
        secretKeyRedacted: true,
        webhookSecretRedacted: true,
        publishableKeyRedacted: true,
        clientSecretRedacted: true,
        bearerTokensRedacted: true,
        providerSecretsRedacted: true,
        databaseUrlsRedacted: true,
        deploymentCredentialsRedacted: true,
        ciSecretMaskingCommandsRedacted: true,
      },
    },
    overrides,
  );
}

function createImplementationSnapshot() {
  return {
    source: "stripe-api-ios-payment-boundaries",
    files: implementationSnapshotFiles.map((file) => ({
      file,
      sha256: crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(rootDir, file)))
        .digest("hex"),
    })),
  };
}

function withProgressText(evidence) {
  return [
    "Checking FanPass Stripe test-mode evidence...",
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
