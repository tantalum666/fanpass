const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const evidenceFiles = process.argv.slice(2);
const errors = [];
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
const expectedImplementationSnapshot = implementationSnapshotFiles.map(
  (file) => ({
    file,
    sha256: sha256File(path.join(rootDir, file)),
  }),
);

if (evidenceFiles.length === 0) {
  console.error(
    [
      "Usage: npm run security:stripe-testmode:evidence -- <evidence-file...>",
      "Validate saved Stripe test-mode evidence JSON before closing real Stripe Beta gates.",
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
      implementationSnapshot: {
        source: "stripe-api-ios-payment-boundaries",
        files: expectedImplementationSnapshot,
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
  validateImplementationSnapshot(relativePath, evidence.implementationSnapshot);
  validatePaymentIntent(relativePath, evidence.paymentIntent);
  validateMobileClient(relativePath, evidence.mobileClient);
  validateWebhooks(relativePath, evidence.webhooks);
  validateSideEffects(relativePath, evidence.sideEffects);
  validateIdempotency(relativePath, evidence.idempotency);
  validateRedaction(relativePath, evidence.redaction);

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    stripeMode: evidence.stripeMode ?? null,
    localMock: evidence.localMock ?? null,
    apiBaseUrl: evidence.apiBaseUrl ?? null,
    implementationSnapshotFiles:
      evidence.implementationSnapshot?.files?.length ?? null,
    paymentIntentId: evidence.paymentIntent?.id ?? null,
    mobileClient: evidence.mobileClient ?? null,
    webhookEvents: evidence.webhooks?.eventIds ?? [],
    sideEffects: evidence.sideEffects ?? null,
  };
}

function validateImplementationSnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "stripe-api-ios-payment-boundaries") {
    errors.push(
      `${relativePath}: implementationSnapshot.source must be stripe-api-ios-payment-boundaries`,
    );
  }
  const files = Array.isArray(snapshot.files) ? snapshot.files : [];
  if (files.length !== expectedImplementationSnapshot.length) {
    errors.push(
      `${relativePath}: implementationSnapshot.files must include the current Stripe API/iOS payment boundary files`,
    );
  }
  const expectedFiles = new Set(
    expectedImplementationSnapshot.map((entry) => entry.file),
  );
  for (const entry of files) {
    if (!expectedFiles.has(entry?.file)) {
      errors.push(
        `${relativePath}: implementationSnapshot.files contains unexpected file ${entry?.file}`,
      );
    }
  }
  for (const expected of expectedImplementationSnapshot) {
    const actual = files.find((entry) => entry?.file === expected.file);
    if (!actual) {
      errors.push(
        `${relativePath}: implementationSnapshot.files missing ${expected.file}`,
      );
      continue;
    }
    if (actual.sha256 !== expected.sha256) {
      errors.push(
        `${relativePath}: implementationSnapshot.files ${expected.file} sha256 must match the current Stripe API/iOS payment implementation`,
      );
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
  for (const pattern of [
    /postgres:\/\/[^\s"']+/i,
    /postgresql:\/\/[^\s"']+/i,
  ]) {
    if (pattern.test(raw)) {
      errors.push(`${relativePath}: evidence must not include database URLs`);
    }
  }
  const forbiddenPatterns = [
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
  if (evidence.stripeMode !== "test") {
    errors.push(`${relativePath}: stripeMode must be test`);
  }
  if (evidence.localMock !== false) {
    errors.push(
      `${relativePath}: localMock must be false for real Stripe evidence`,
    );
  }
  if (evidence.usesRealMoney !== false) {
    errors.push(`${relativePath}: usesRealMoney must be false`);
  }
  if (!isUrl(evidence.apiBaseUrl)) {
    errors.push(`${relativePath}: apiBaseUrl must be a valid URL`);
  }
  if (evidence.deploymentCredentialsAvailable !== false) {
    errors.push(
      `${relativePath}: deploymentCredentialsAvailable must be false`,
    );
  }
}

function validatePaymentIntent(relativePath, paymentIntent = {}) {
  if (paymentIntent.created !== true) {
    errors.push(`${relativePath}: paymentIntent.created must be true`);
  }
  if (!matches(paymentIntent.id, /^pi_/)) {
    errors.push(
      `${relativePath}: paymentIntent.id must use a Stripe pi_ test id`,
    );
  }
  if (paymentIntent.captureMethod !== "manual") {
    errors.push(`${relativePath}: paymentIntent.captureMethod must be manual`);
  }
  if (paymentIntent.clientSecretObserved !== false) {
    errors.push(
      `${relativePath}: paymentIntent.clientSecretObserved must be false`,
    );
  }
  if (paymentIntent.publishableKeyType !== "test") {
    errors.push(
      `${relativePath}: paymentIntent.publishableKeyType must be test`,
    );
  }
}

function validateMobileClient(relativePath, mobileClient) {
  if (!mobileClient || typeof mobileClient !== "object") {
    errors.push(`${relativePath}: mobileClient evidence is required`);
    return;
  }

  if (mobileClient.platform !== "ios") {
    errors.push(`${relativePath}: mobileClient.platform must be ios`);
  }
  if (mobileClient.app !== "FanPass") {
    errors.push(`${relativePath}: mobileClient.app must be FanPass`);
  }
  if (mobileClient.paymentSheetPresented !== true) {
    errors.push(
      `${relativePath}: mobileClient.paymentSheetPresented must be true`,
    );
  }
  if (mobileClient.usesNativePaymentSheet !== true) {
    errors.push(
      `${relativePath}: mobileClient.usesNativePaymentSheet must be true`,
    );
  }
  if (mobileClient.usesBackendPaymentIntent !== true) {
    errors.push(
      `${relativePath}: mobileClient.usesBackendPaymentIntent must be true`,
    );
  }
  if (mobileClient.clientSecretSource !== "backend-payment-intent") {
    errors.push(
      `${relativePath}: mobileClient.clientSecretSource must be backend-payment-intent`,
    );
  }
  if (mobileClient.clientSecretRecorded !== false) {
    errors.push(
      `${relativePath}: mobileClient.clientSecretRecorded must be false`,
    );
  }
  if (mobileClient.publishableKeyType !== "test") {
    errors.push(
      `${relativePath}: mobileClient.publishableKeyType must be test`,
    );
  }
  if (mobileClient.publishableKeyRecorded !== false) {
    errors.push(
      `${relativePath}: mobileClient.publishableKeyRecorded must be false`,
    );
  }
  if (mobileClient.localMockClientSecretBlocked !== true) {
    errors.push(
      `${relativePath}: mobileClient.localMockClientSecretBlocked must be true`,
    );
  }
  if (mobileClient.returnUrlScheme !== "fanpass-payments") {
    errors.push(
      `${relativePath}: mobileClient.returnUrlScheme must be fanpass-payments`,
    );
  }
  if (mobileClient.fanPassOpsCheckoutAbsent !== true) {
    errors.push(
      `${relativePath}: mobileClient.fanPassOpsCheckoutAbsent must be true`,
    );
  }
}

function validateWebhooks(relativePath, webhooks = {}) {
  if (webhooks.signedDeliveryVerified !== true) {
    errors.push(
      `${relativePath}: signed Stripe webhook delivery must be verified`,
    );
  }
  if (webhooks.rawBodySignatureVerified !== true) {
    errors.push(
      `${relativePath}: raw-body Stripe signature verification must be proven`,
    );
  }
  if (webhooks.duplicateReplayAcknowledged !== true) {
    errors.push(
      `${relativePath}: duplicate webhook replay must be acknowledged once`,
    );
  }
  const eventIds = Array.isArray(webhooks.eventIds) ? webhooks.eventIds : [];
  if (eventIds.length < 2 || !eventIds.every((id) => matches(id, /^evt_/))) {
    errors.push(
      `${relativePath}: at least two Stripe evt_ webhook ids are required`,
    );
  }
}

function validateSideEffects(relativePath, sideEffects = {}) {
  for (const key of [
    "captureVerified",
    "cancelAuthorizationVerified",
    "refundVerified",
    "reconciliationVerified",
  ]) {
    if (sideEffects[key] !== true) {
      errors.push(`${relativePath}: sideEffects.${key} must be true`);
    }
  }
  if (sideEffects.outboxHealthAfterRetries !== "healthy") {
    errors.push(
      `${relativePath}: sideEffects.outboxHealthAfterRetries must be healthy`,
    );
  }
}

function validateIdempotency(relativePath, idempotency = {}) {
  for (const key of [
    "paymentIntentCreate",
    "webhookReplay",
    "captureRetry",
    "cancelRetry",
    "refundRetry",
    "adminOperationRetry",
  ]) {
    if (idempotency[key] !== true) {
      errors.push(`${relativePath}: idempotency.${key} must be true`);
    }
  }
}

function validateRedaction(relativePath, redaction = {}) {
  for (const key of [
    "secretKeyRedacted",
    "webhookSecretRedacted",
    "publishableKeyRedacted",
    "clientSecretRedacted",
    "bearerTokensRedacted",
    "providerSecretsRedacted",
    "databaseUrlsRedacted",
    "deploymentCredentialsRedacted",
    "ciSecretMaskingCommandsRedacted",
  ]) {
    if (redaction[key] !== true) {
      errors.push(`${relativePath}: redaction.${key} must be true`);
    }
  }
}

function isUrl(value) {
  if (typeof value !== "string") {
    return false;
  }
  try {
    new URL(value);
    return true;
  } catch {
    return false;
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

function matches(value, pattern) {
  return typeof value === "string" && pattern.test(value);
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}
