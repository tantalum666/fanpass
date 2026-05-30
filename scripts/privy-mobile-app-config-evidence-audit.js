const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const evidenceFiles = process.argv.slice(2);
const errors = [];
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
const expectedImplementationSnapshot = implementationSnapshotFiles.map(
  (file) => ({
    file,
    sha256: sha256File(path.join(rootDir, file)),
  }),
);

if (evidenceFiles.length === 0) {
  console.error(
    [
      "Usage: npm run security:privy-mobile-app-config:evidence -- <evidence-file...>",
      "Validate saved Privy mobile app configuration evidence before using real iOS app/client IDs.",
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
  validateApps(relativePath, evidence.apps);
  validateConfiguration(relativePath, evidence.configuration);
  validateImplementationSnapshot(relativePath, evidence.implementationSnapshot);
  validateLinkedEvidence(relativePath, evidence.linkedEvidence);
  validateRedaction(relativePath, evidence.redaction);

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    environment: evidence.environment ?? null,
    apps: Array.isArray(evidence.apps)
      ? evidence.apps.map((app) => app.name)
      : null,
    implementationSnapshotFiles:
      evidence.implementationSnapshot?.files?.length ?? null,
  };
}

function validateNoSecretMarkers(relativePath, raw) {
  const forbiddenMarkers = [
    "Authorization: Bearer ",
    "eyJhbGci",
    "-----BEGIN PRIVATE KEY-----",
    "-----BEGIN RSA PRIVATE KEY-----",
    "PRIVY_APP_SECRET",
    "PRIVY_VERIFICATION_KEY",
    "PRIVY_ACCESS_TOKEN",
    "privy_app_secret",
    "privy_verification_key",
    "PROVIDER_SECRET=",
    "PROVIDER_API_KEY=",
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
    "secrets.",
  ];
  const lowerRaw = raw.toLowerCase();
  for (const marker of forbiddenMarkers) {
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
  if (evidence.provider !== "privy-mobile-app-config") {
    errors.push(`${relativePath}: provider must be privy-mobile-app-config`);
  }
  if (evidence.dashboardReviewed !== true) {
    errors.push(`${relativePath}: dashboardReviewed must be true`);
  }
  if (!["staging", "beta"].includes(evidence.environment)) {
    errors.push(`${relativePath}: environment must be staging or beta`);
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

function validateApps(relativePath, apps) {
  if (!Array.isArray(apps) || apps.length !== 2) {
    errors.push(
      `${relativePath}: apps must list exactly FanPass and FanPass Ops`,
    );
    return;
  }
  const byName = new Map(apps.map((app) => [app.name, app]));
  for (const [name, bundleId] of [
    ["FanPass", "com.fanpass.app"],
    ["FanPass Ops", "com.fanpass.ops"],
  ]) {
    const app = byName.get(name);
    if (!app) {
      errors.push(`${relativePath}: apps must include ${name}`);
      continue;
    }
    if (app.bundleId !== bundleId) {
      errors.push(`${relativePath}: ${name} bundleId must be ${bundleId}`);
    }
    for (const key of [
      "appIdConfigured",
      "appClientIdConfigured",
      "appIdPublicOrRedacted",
      "appClientIdPublicOrRedacted",
      "appSecretAbsent",
      "verificationKeyAbsent",
    ]) {
      if (app[key] !== true) {
        errors.push(`${relativePath}: ${name}.${key} must be true`);
      }
    }
  }
}

function validateConfiguration(relativePath, configuration = {}) {
  for (const key of [
    "checkedInXcconfigsRemainPlaceholderOnly",
    "buildSettingsInjectedOutsideSourceControl",
    "generatedInfoPlistKeysVerified",
    "fanPassEnvironmentRejectsEmptyOrPlaceholderValues",
    "fanPassEnvironmentRejectsSecretLikeValues",
    "privySwiftProviderBoundaryPassed",
    "iosDistributionBoundaryPassed",
  ]) {
    if (configuration[key] !== true) {
      errors.push(`${relativePath}: configuration.${key} must be true`);
    }
  }
}

function validateImplementationSnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "privy-ios-auth-config-boundaries") {
    errors.push(
      `${relativePath}: implementationSnapshot.source must be privy-ios-auth-config-boundaries`,
    );
  }

  if (
    !Array.isArray(snapshot.files) ||
    snapshot.files.length !== expectedImplementationSnapshot.length
  ) {
    errors.push(
      `${relativePath}: implementationSnapshot.files must include the current Privy iOS auth/config boundary files`,
    );
  }

  const byFile = new Map(
    Array.isArray(snapshot.files)
      ? snapshot.files.map((entry) => [entry?.file, entry])
      : [],
  );
  const expectedFiles = new Set(
    expectedImplementationSnapshot.map((entry) => entry.file),
  );

  for (const entry of Array.isArray(snapshot.files) ? snapshot.files : []) {
    if (!expectedFiles.has(entry?.file)) {
      errors.push(
        `${relativePath}: implementationSnapshot.files contains unexpected file ${entry?.file}`,
      );
    }
  }

  for (const expected of expectedImplementationSnapshot) {
    const actual = byFile.get(expected.file);
    if (!actual) {
      errors.push(
        `${relativePath}: implementationSnapshot.files missing ${expected.file}`,
      );
      continue;
    }
    if (actual.sha256 !== expected.sha256) {
      errors.push(
        `${relativePath}: implementationSnapshot.files ${expected.file} sha256 must match the current Privy iOS auth/config implementation`,
      );
    }
  }
}

function validateLinkedEvidence(relativePath, linkedEvidence = {}) {
  for (const key of [
    "privyPlanEvidencePassed",
    "iosStagingBuildEvidenceRequired",
    "staffTenantEvidenceRequired",
  ]) {
    if (linkedEvidence[key] !== true) {
      errors.push(`${relativePath}: linkedEvidence.${key} must be true`);
    }
  }
  if (
    linkedEvidence.webhooksRequiredForMobileConfig !== false ||
    linkedEvidence.privyWebhooksOptionalUntilPlanConfirmed !== true
  ) {
    errors.push(
      `${relativePath}: mobile config evidence must keep Privy webhooks optional`,
    );
  }
}

function validateRedaction(relativePath, redaction = {}) {
  for (const key of [
    "appSecretsRedacted",
    "verificationKeysRedacted",
    "accessTokensRedacted",
    "providerSecretsRedacted",
    "stripePublishableKeysRedacted",
    "databaseUrlsRedacted",
    "deploymentCredentialsRedacted",
    "ciSecretMaskingCommandsRedacted",
    "userIdentifiersRedacted",
    "dashboardScreenshotsReviewedForSecrets",
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

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}
