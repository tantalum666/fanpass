const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const evidenceFiles = process.argv.slice(2);
const errors = [];
const supportValues = new Set(["supported", "unsupported", "plan-gated"]);
const policySnapshotFiles = [
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
const expectedPolicySnapshot = policySnapshotFiles.map((file) => ({
  file,
  sha256: sha256File(file),
}));

if (evidenceFiles.length === 0) {
  console.error(
    [
      "Usage: npm run security:privy-plan:evidence -- <evidence-file...>",
      "Validate saved Privy dashboard/plan evidence before closing Privy Beta gates.",
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
  validateFeatures(relativePath, evidence.features);
  validateDecisions(relativePath, evidence.decisions, evidence.features);
  validateRedaction(relativePath, evidence.redaction);

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    selectedPlan: evidence.selectedPlan ?? null,
    dashboardReviewed: evidence.dashboardReviewed ?? null,
    policySnapshotFiles: evidence.policySnapshot?.files?.length ?? null,
    features: evidence.features ?? null,
    decisions: evidence.decisions ?? null,
  };
}

function validatePolicySnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "privy-plan-auth-policy-boundaries") {
    errors.push(
      `${relativePath}: policySnapshot.source must be privy-plan-auth-policy-boundaries`,
    );
  }
  if (
    !Array.isArray(snapshot.files) ||
    snapshot.files.length !== expectedPolicySnapshot.length
  ) {
    errors.push(
      `${relativePath}: policySnapshot.files must include the current Privy plan auth policy boundary files`,
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
        `${relativePath}: policySnapshot.files ${expected.file} sha256 must match the current Privy plan auth policy implementation`,
      );
    }
  }
}

function validateNoSecretMarkers(relativePath, raw) {
  const forbidden = [
    "PRIVY_APP_SECRET",
    "PRIVY_VERIFICATION_KEY",
    "privy_app_secret",
    "privy_verification_key",
    "Authorization: Bearer ",
    "-----BEGIN PRIVATE KEY-----",
    "-----BEGIN PUBLIC KEY-----",
    "eyJhbGci",
    "sk_test_",
    "sk_live_",
    "pk_test_",
    "pk_live_",
    "whsec_",
    "STRIPE_SECRET_KEY=",
    "STRIPE_PUBLISHABLE_KEY=",
    "STRIPE_WEBHOOK_SECRET=",
    "DATABASE_URL=",
    "client_secret",
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

function validateTopLevel(relativePath, evidence) {
  if (evidence.ok !== true) {
    errors.push(`${relativePath}: evidence ok must be true`);
  }
  if (!isIsoDate(evidence.checkedAt)) {
    errors.push(`${relativePath}: evidence checkedAt must be an ISO timestamp`);
  }
  if (evidence.provider !== "privy") {
    errors.push(`${relativePath}: provider must be privy`);
  }
  if (evidence.dashboardReviewed !== true) {
    errors.push(`${relativePath}: dashboardReviewed must be true`);
  }
  if (
    typeof evidence.selectedPlan !== "string" ||
    evidence.selectedPlan.length < 3
  ) {
    errors.push(
      `${relativePath}: selectedPlan must name the checked Privy plan`,
    );
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

function validateFeatures(relativePath, features = {}) {
  for (const key of [
    "mobileSdkUse",
    "embeddedWalletCreation",
    "backendAccessTokenVerification",
    "webhooks",
    "customAuthUi",
    "mfaOrPolicyControls",
  ]) {
    if (!supportValues.has(features[key])) {
      errors.push(
        `${relativePath}: features.${key} must be supported, unsupported, or plan-gated`,
      );
    }
  }
}

function validateDecisions(relativePath, decisions = {}, features = {}) {
  if (decisions.coreAuthUsesAccessTokenSync !== true) {
    errors.push(
      `${relativePath}: coreAuthUsesAccessTokenSync must remain true`,
    );
  }
  if (decisions.webhooksRequiredForBeta !== false) {
    errors.push(`${relativePath}: webhooksRequiredForBeta must remain false`);
  }
  if (
    features.webhooks !== "supported" &&
    decisions.webhookPlanGate !== "optional-until-supported"
  ) {
    errors.push(
      `${relativePath}: webhookPlanGate must be optional-until-supported when webhooks are not supported`,
    );
  }
  if (
    features.mobileSdkUse === "supported" &&
    features.embeddedWalletCreation === "supported" &&
    features.backendAccessTokenVerification === "supported" &&
    decisions.sdkIntegrationUnblocked !== true
  ) {
    errors.push(
      `${relativePath}: sdkIntegrationUnblocked must be true when mobile SDK, embedded wallets, and backend token verification are supported`,
    );
  }
  if (
    decisions.sdkIntegrationUnblocked === true &&
    (features.mobileSdkUse !== "supported" ||
      features.embeddedWalletCreation !== "supported" ||
      features.backendAccessTokenVerification !== "supported")
  ) {
    errors.push(
      `${relativePath}: sdkIntegrationUnblocked cannot be true unless mobile SDK, embedded wallets, and backend token verification are supported`,
    );
  }
}

function validateRedaction(relativePath, redaction = {}) {
  for (const key of [
    "appSecretRedacted",
    "verificationKeyRedacted",
    "accessTokensRedacted",
    "appIdRedactedOrNonSecret",
    "providerSecretsRedacted",
    "stripePublishableKeysRedacted",
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

function isIsoDate(value) {
  if (typeof value !== "string" || !value) {
    return false;
  }
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}

function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(rootDir, file)))
    .digest("hex");
}
