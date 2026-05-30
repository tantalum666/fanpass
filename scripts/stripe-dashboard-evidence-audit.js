const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const evidenceFiles = process.argv.slice(2);
const errors = [];
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
const expectedPolicySnapshot = policySnapshotFiles.map((file) => ({
  file,
  sha256: sha256File(file),
}));

if (evidenceFiles.length === 0) {
  console.error(
    [
      "Usage: npm run security:stripe-dashboard:evidence -- <evidence-file...>",
      "Validate saved Stripe dashboard feasibility evidence before closing provider plan checks.",
    ].join("\n"),
  );
  process.exit(1);
}

const results = evidenceFiles.map(validateEvidenceFile);

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      policySnapshot: {
        source: "stripe-dashboard-payment-webhook-policy",
        files: expectedPolicySnapshot,
      },
      checkedFiles: results.length,
      evidence: results,
    },
    null,
    2,
  ),
);

function validateEvidenceFile(filePath) {
  const absolutePath = path.resolve(rootDir, filePath);
  const relativePath = path.relative(rootDir, absolutePath);
  let raw;
  try {
    raw = fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    errors.push(
      `${relativePath}: could not read evidence file: ${error.message}`,
    );
    return { file: relativePath, ok: false };
  }

  validateNoSecretMarkers(relativePath, raw);
  const evidence = extractJsonObject(relativePath, raw);
  if (!evidence) {
    return { file: relativePath, ok: false };
  }

  validateTopLevel(relativePath, evidence);
  validatePolicySnapshot(relativePath, evidence.policySnapshot);
  validateDashboard(relativePath, evidence.dashboard);
  validatePaymentIntents(relativePath, evidence.paymentIntents);
  validateWebhookEndpoint(relativePath, evidence.webhookEndpoint);
  validateDecisions(relativePath, evidence.decisions);
  validateRedaction(relativePath, evidence.redaction);

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    selectedAccountMode: evidence.dashboard?.accountMode ?? null,
    policySnapshotFiles: evidence.policySnapshot?.files?.length ?? null,
    paymentIntentRoute: evidence.paymentIntents?.fanPassRoute ?? null,
    webhookRoute: evidence.webhookEndpoint?.fanPassRoute ?? null,
  };
}

function validateTopLevel(relativePath, evidence) {
  if (evidence.ok !== true) {
    errors.push(`${relativePath}: evidence ok must be true`);
  }
  if (!isIsoDate(evidence.checkedAt)) {
    errors.push(`${relativePath}: evidence checkedAt must be an ISO timestamp`);
  }
  if (evidence.provider !== "stripe") {
    errors.push(`${relativePath}: provider must be stripe`);
  }
  if (evidence.evidenceSource !== "stripe-dashboard-review") {
    errors.push(
      `${relativePath}: evidenceSource must be stripe-dashboard-review`,
    );
  }
  if (evidence.dashboardReviewed !== true) {
    errors.push(`${relativePath}: dashboardReviewed must be true`);
  }
  if (evidence.stripeMode !== "test") {
    errors.push(`${relativePath}: stripeMode must be test`);
  }
  if (evidence.realUserDataUsed !== false) {
    errors.push(`${relativePath}: realUserDataUsed must be false`);
  }
  if (evidence.productionCredentialsUsed !== false) {
    errors.push(`${relativePath}: productionCredentialsUsed must be false`);
  }
  if (evidence.deploymentCredentialsAvailable !== false) {
    errors.push(
      `${relativePath}: deploymentCredentialsAvailable must be false`,
    );
  }
}

function validatePolicySnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "stripe-dashboard-payment-webhook-policy") {
    errors.push(
      `${relativePath}: policySnapshot.source must be stripe-dashboard-payment-webhook-policy`,
    );
  }
  if (
    !Array.isArray(snapshot.files) ||
    snapshot.files.length !== expectedPolicySnapshot.length
  ) {
    errors.push(
      `${relativePath}: policySnapshot.files must include the current Stripe dashboard payment/webhook policy files`,
    );
  }

  const actual = new Map(
    Array.isArray(snapshot.files)
      ? snapshot.files.map((entry) => [entry?.file, entry])
      : [],
  );
  for (const entry of Array.isArray(snapshot.files) ? snapshot.files : []) {
    if (
      !expectedPolicySnapshot.some((expected) => expected.file === entry?.file)
    ) {
      errors.push(
        `${relativePath}: policySnapshot.files contains unexpected file ${entry?.file}`,
      );
    }
  }
  for (const expected of expectedPolicySnapshot) {
    const entry = actual.get(expected.file);
    if (!entry) {
      errors.push(
        `${relativePath}: policySnapshot.files missing ${expected.file}`,
      );
      continue;
    }
    if (entry.sha256 !== expected.sha256) {
      errors.push(
        `${relativePath}: policySnapshot.files ${expected.file} sha256 must match the current Stripe dashboard payment/webhook policy implementation`,
      );
    }
  }
}

function validateDashboard(relativePath, dashboard = {}) {
  if (dashboard.accountMode !== "test") {
    errors.push(`${relativePath}: dashboard.accountMode must be test`);
  }
  if (dashboard.testModeToggleVisible !== true) {
    errors.push(
      `${relativePath}: dashboard.testModeToggleVisible must be true`,
    );
  }
  if (dashboard.paymentsEnabled !== true) {
    errors.push(`${relativePath}: dashboard.paymentsEnabled must be true`);
  }
  if (dashboard.liveModeUsed !== false) {
    errors.push(`${relativePath}: dashboard.liveModeUsed must be false`);
  }
}

function validatePaymentIntents(relativePath, paymentIntents = {}) {
  if (paymentIntents.testModeCreationAvailable !== true) {
    errors.push(
      `${relativePath}: paymentIntents.testModeCreationAvailable must be true`,
    );
  }
  if (paymentIntents.manualCaptureAvailable !== true) {
    errors.push(
      `${relativePath}: paymentIntents.manualCaptureAvailable must be true`,
    );
  }
  if (paymentIntents.fanPassRoute !== "POST /payments/intents") {
    errors.push(
      `${relativePath}: paymentIntents.fanPassRoute must be POST /payments/intents`,
    );
  }
  if (paymentIntents.idempotencyKeyRequired !== true) {
    errors.push(
      `${relativePath}: paymentIntents.idempotencyKeyRequired must be true`,
    );
  }
  if (paymentIntents.clientSecretRedacted !== true) {
    errors.push(
      `${relativePath}: paymentIntents.clientSecretRedacted must be true`,
    );
  }
}

function validateWebhookEndpoint(relativePath, webhookEndpoint = {}) {
  if (webhookEndpoint.dashboardEndpointCreated !== true) {
    errors.push(
      `${relativePath}: webhookEndpoint.dashboardEndpointCreated must be true`,
    );
  }
  if (!isHttpsUrl(webhookEndpoint.url)) {
    errors.push(`${relativePath}: webhookEndpoint.url must be HTTPS`);
  }
  if (webhookEndpoint.fanPassRoute !== "POST /payments/webhook") {
    errors.push(
      `${relativePath}: webhookEndpoint.fanPassRoute must be POST /payments/webhook`,
    );
  }
  if (webhookEndpoint.signingSecretAvailable !== true) {
    errors.push(
      `${relativePath}: webhookEndpoint.signingSecretAvailable must be true`,
    );
  }
  if (webhookEndpoint.signingSecretRecorded !== false) {
    errors.push(
      `${relativePath}: webhookEndpoint.signingSecretRecorded must be false`,
    );
  }
  if (webhookEndpoint.rawBodySignatureRequired !== true) {
    errors.push(
      `${relativePath}: webhookEndpoint.rawBodySignatureRequired must be true`,
    );
  }

  const events = Array.isArray(webhookEndpoint.enabledEvents)
    ? webhookEndpoint.enabledEvents
    : [];
  for (const event of [
    "payment_intent.amount_capturable_updated",
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
  ]) {
    if (!events.includes(event)) {
      errors.push(
        `${relativePath}: webhookEndpoint.enabledEvents must include ${event}`,
      );
    }
  }
}

function validateDecisions(relativePath, decisions = {}) {
  if (decisions.useStripeTestModeForBeta !== true) {
    errors.push(
      `${relativePath}: decisions.useStripeTestModeForBeta must be true`,
    );
  }
  if (decisions.noRealMoneyBeforeEvidence !== true) {
    errors.push(
      `${relativePath}: decisions.noRealMoneyBeforeEvidence must be true`,
    );
  }
  if (decisions.requiresSignedWebhooksBeforeBeta !== true) {
    errors.push(
      `${relativePath}: decisions.requiresSignedWebhooksBeforeBeta must be true`,
    );
  }
  if (decisions.connectRequiredForClosedBeta !== false) {
    errors.push(
      `${relativePath}: decisions.connectRequiredForClosedBeta must be false`,
    );
  }
}

function validateRedaction(relativePath, redaction = {}) {
  for (const key of [
    "secretKeyRedacted",
    "webhookSecretRedacted",
    "publishableKeyRedacted",
    "clientSecretRedacted",
    "providerSecretsRedacted",
    "databaseUrlsRedacted",
    "deploymentCredentialsRedacted",
    "ciSecretMaskingCommandsRedacted",
    "userIdentifiersRedacted",
  ]) {
    if (redaction[key] !== true) {
      errors.push(`${relativePath}: redaction.${key} must be true`);
    }
  }
}

function validateNoSecretMarkers(relativePath, raw) {
  const forbidden = [
    "sk_test_",
    "rk_test_",
    "whsec_",
    "sk_live_",
    "pk_live_",
    "pk_test_",
    "STRIPE_SECRET_KEY=",
    "STRIPE_PUBLISHABLE_KEY=",
    "STRIPE_WEBHOOK_SECRET=",
    "stripe_secret_key",
    "stripe_webhook_secret",
    "stripe_publishable_key",
    "client_secret",
    "DATABASE_URL=",
    "Authorization: Bearer ",
    "-----BEGIN PRIVATE KEY-----",
  ];
  const lowerRaw = raw.toLowerCase();
  for (const marker of forbidden) {
    if (lowerRaw.includes(marker.toLowerCase())) {
      errors.push(
        `${relativePath}: evidence must not include secret marker ${marker}`,
      );
    }
  }

  const forbiddenPatterns = [
    {
      pattern: /\bpostgres(?:ql)?:\/\/[^\s"']+/i,
      message: "evidence must not include database URLs",
    },
    {
      pattern:
        /\b(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)\s*=\s*(?!<)[^\s"']{8,}/i,
      message:
        "evidence must not include deployment or cloud credential assignments",
    },
    {
      pattern:
        /"(?:awsAccessKeyId|awsSecretAccessKey|awsSessionToken|googleApplicationCredentialsJson|googleCredentials|gcpServiceAccountKey|vercelToken|githubToken|ghToken|netlifyAuthToken|cloudflareApiToken|cfApiToken|cloudflareApiKey|cfApiKey)"\s*:\s*"(?!<)[^"]{8,}"/i,
      message:
        "evidence must not include deployment or cloud credential JSON fields",
    },
    {
      pattern:
        /"(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)"\s*:\s*"(?!<)[^"]{8,}"/,
      message:
        "evidence must not include deployment or cloud credential environment fields",
    },
    {
      pattern:
        /(?:::add-mask::(?!<redacted>)[^\s"'<>]{4,}|::set-secret\s+name=[^:\s]+::(?!<redacted>)[^\s"'<>]{4,}|##vso\[task\.setvariable[^\]]*issecret=true[^\]]*\](?!<redacted>)[^\s"'<>]{4,})/i,
      message:
        "evidence must not include CI secret masking commands with literal values",
    },
  ];
  for (const { pattern, message } of forbiddenPatterns) {
    if (pattern.test(raw)) {
      errors.push(`${relativePath}: ${message}`);
    }
  }
}

function extractJsonObject(relativePath, raw) {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    errors.push(`${relativePath}: evidence does not contain a JSON object`);
    return null;
  }
  const candidate = raw.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    errors.push(
      `${relativePath}: could not parse evidence JSON: ${error.message}`,
    );
    return null;
  }
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

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(rootDir, file)))
    .digest("hex");
}
