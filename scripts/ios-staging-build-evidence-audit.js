const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const evidenceFiles = process.argv.slice(2);
const errors = [];
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
  "apps/ios/FanPass/FanPass/Features/Scanner/ScannerView.swift",
  "apps/ios/FanPass/FanPass/Features/Scanner/QRCodeScannerView.swift",
  "apps/ios/FanPass/FanPass/Features/Scanner/NFCPayloadScanner.swift",
  "scripts/ios-distribution-boundary-audit.js",
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
      "Usage: npm run security:ios-staging-build:evidence -- <evidence-file...>",
      "Validate saved iOS staging/TestFlight build evidence before trusting real-device or tester app configuration.",
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
  validateImplementationSnapshot(relativePath, evidence.implementationSnapshot);
  validateEnvironment(relativePath, evidence.environment);
  validateApps(relativePath, evidence.apps, evidence.environment);
  validateRuntimeChecks(relativePath, evidence.runtimeChecks);
  validateRedaction(relativePath, evidence.redaction);

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    environment: evidence.environment?.name ?? null,
    apiBaseUrl: evidence.environment?.apiBaseUrl ?? null,
    apps: Array.isArray(evidence.apps)
      ? evidence.apps.map((app) => app.name)
      : [],
    implementationSnapshotFiles:
      evidence.implementationSnapshot?.files?.length ?? null,
  };
}

function validateNoSecretMarkers(relativePath, raw) {
  const forbiddenMarkers = [
    "Authorization: Bearer ",
    "eyJhbGci",
    "-----BEGIN PRIVATE KEY-----",
    "-----BEGIN CERTIFICATE-----",
    "sk_test_",
    "sk_live_",
    "pk_test_",
    "pk_live_",
    "whsec_",
    "PRIVY_APP_SECRET",
    "PRIVY_VERIFICATION_KEY",
    "STRIPE_SECRET_KEY=",
    "STRIPE_PUBLISHABLE_KEY=",
    "STRIPE_WEBHOOK_SECRET=",
    "DATABASE_URL=",
    "STAGING_ADMIN_ACCESS_TOKEN=",
    "FANPASS_STAGING_ADMIN_ACCESS_TOKEN=",
    "PROVISIONING_PROFILE_SPECIFIER=",
    "client_secret",
    "udid",
  ];
  const lowerRaw = raw.toLowerCase();
  for (const marker of forbiddenMarkers) {
    if (lowerRaw.includes(marker.toLowerCase())) {
      errors.push(
        `${relativePath}: evidence must not include secret or device marker ${marker}`,
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
      label: "deployment or cloud credential assignment",
      pattern:
        /\b(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)\s*=\s*(?!<)[^\s"']{8,}/i,
    },
    {
      label: "deployment or cloud credential field",
      pattern:
        /"(?:awsAccessKeyId|awsSecretAccessKey|awsSessionToken|googleApplicationCredentialsJson|googleCredentials|gcpServiceAccountKey|vercelToken|githubToken|ghToken|netlifyAuthToken|cloudflareApiToken|cfApiToken|cloudflareApiKey|cfApiKey)"\s*:\s*"(?!<)[^"]{8,}"/i,
    },
    {
      label: "deployment or cloud credential environment field",
      pattern:
        /"(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)"\s*:\s*"(?!<)[^"]{8,}"/,
    },
    {
      label: "CI secret masking command literal",
      pattern:
        /(?:::add-mask::|::set-secret\s+name=[^:\r\n]+::|##vso\[task\.setvariable[^\]\r\n]*issecret=true[^\]\r\n]*\])[^\s<][^\r\n]{7,}/i,
    },
  ];
  for (const rule of forbiddenPatterns) {
    if (rule.pattern.test(raw)) {
      errors.push(
        `${relativePath}: evidence must not include secret marker ${rule.label}`,
      );
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
  if (evidence.provider !== "ios-staging-build") {
    errors.push(`${relativePath}: provider must be ios-staging-build`);
  }
  if (evidence.capabilityModel !== "qr-first-release-v1") {
    errors.push(`${relativePath}: capabilityModel must be qr-first-release-v1`);
  }
  if (evidence.localDryRun !== false) {
    errors.push(`${relativePath}: localDryRun must be false`);
  }
  if (evidence.realUserDataUsed !== false) {
    errors.push(`${relativePath}: realUserDataUsed must be false`);
  }
  if (evidence.productionCredentialsUsed !== false) {
    errors.push(`${relativePath}: productionCredentialsUsed must be false`);
  }
}

function validateEnvironment(relativePath, environment = {}) {
  if (!["staging", "beta"].includes(environment.name)) {
    errors.push(`${relativePath}: environment.name must be staging or beta`);
  }
  if (!isHttpsUrl(environment.apiBaseUrl)) {
    errors.push(`${relativePath}: environment.apiBaseUrl must be HTTPS`);
  } else if (isPlaceholderOrLocal(environment.apiBaseUrl)) {
    errors.push(
      `${relativePath}: environment.apiBaseUrl must be a real non-placeholder URL`,
    );
  }
  const expectedConfig =
    environment.name === "beta"
      ? "Config/Beta.xcconfig"
      : "Config/Staging.xcconfig";
  if (environment.configFile !== expectedConfig) {
    errors.push(
      `${relativePath}: environment.configFile must be ${expectedConfig}`,
    );
  }
  const expectedBuildConfiguration =
    environment.name === "beta" ? "Beta" : "Staging";
  if (environment.buildConfiguration !== expectedBuildConfiguration) {
    errors.push(
      `${relativePath}: environment.buildConfiguration must be ${expectedBuildConfiguration}`,
    );
  }
  if (environment.demoAuthDisabled !== true) {
    errors.push(`${relativePath}: environment.demoAuthDisabled must be true`);
  }
  if (environment.stripeMode !== "test") {
    errors.push(`${relativePath}: environment.stripeMode must be test`);
  }
  if (environment.privyAppType !== "test") {
    errors.push(`${relativePath}: environment.privyAppType must be test`);
  }
  if (environment.deploymentCredentialsAvailable !== false) {
    errors.push(
      `${relativePath}: environment.deploymentCredentialsAvailable must be false`,
    );
  }
}

function validateImplementationSnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "ios-staging-build-distribution-boundaries") {
    errors.push(
      `${relativePath}: implementationSnapshot.source must be ios-staging-build-distribution-boundaries`,
    );
  }

  if (
    !Array.isArray(snapshot.files) ||
    snapshot.files.length !== expectedImplementationSnapshot.length
  ) {
    errors.push(
      `${relativePath}: implementationSnapshot.files must include the current iOS staging/TestFlight distribution boundary files`,
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
        `${relativePath}: implementationSnapshot.files ${expected.file} sha256 must match the current iOS staging/TestFlight distribution implementation`,
      );
    }
  }
}

function validateApps(relativePath, apps, environment = {}) {
  if (!Array.isArray(apps)) {
    errors.push(`${relativePath}: apps must be an array`);
    return;
  }
  const names = apps.map((app) => app.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(["FanPass", "FanPass Ops"])) {
    errors.push(`${relativePath}: apps must include FanPass and FanPass Ops`);
    return;
  }
  for (const app of apps) {
    validateSharedAppBuild(relativePath, app, environment);
    if (app.name === "FanPass") {
      validateFanPass(relativePath, app);
    } else if (app.name === "FanPass Ops") {
      validateFanPassOps(relativePath, app);
    }
  }
}

function validateSharedAppBuild(relativePath, app, environment) {
  const prefix = `${relativePath}: ${app.name}`;
  if (app.archiveSucceeded !== true) {
    errors.push(`${prefix} archiveSucceeded must be true`);
  }
  if (app.signedWithAppleTeam !== true) {
    errors.push(`${prefix} signedWithAppleTeam must be true`);
  }
  if (
    ![
      "development-device",
      "internal-testflight",
      "closed-external-testflight",
    ].includes(app.distributionChannel)
  ) {
    errors.push(
      `${prefix} distributionChannel must be development-device, internal-testflight, or closed-external-testflight`,
    );
  }
  if (
    environment.name === "beta" &&
    !app.distributionChannel?.includes("testflight")
  ) {
    errors.push(
      `${prefix} beta evidence must use a TestFlight distribution channel`,
    );
  }
  if (app.installVerifiedOnPhysicalDevice !== true) {
    errors.push(`${prefix} installVerifiedOnPhysicalDevice must be true`);
  }
  if (app.apiBaseUrlObserved !== environment.apiBaseUrl) {
    errors.push(
      `${prefix} apiBaseUrlObserved must match environment.apiBaseUrl`,
    );
  }
  if (app.debugCompilationDisabled !== true) {
    errors.push(`${prefix} debugCompilationDisabled must be true`);
  }
  if (app.debugPayloadHelpersUnavailable !== true) {
    errors.push(`${prefix} debugPayloadHelpersUnavailable must be true`);
  }
  if (app.secretsInBundle !== false) {
    errors.push(`${prefix} secretsInBundle must be false`);
  }
  if (!isNonEmptyString(app.bundleId)) {
    errors.push(`${prefix} bundleId must be present`);
  }
  if (!isNonEmptyString(app.scheme)) {
    errors.push(`${prefix} scheme must be present`);
  }
}

function validateFanPass(relativePath, app) {
  const prefix = `${relativePath}: FanPass`;
  if (app.scheme !== "FanPass") {
    errors.push(`${prefix} scheme must be FanPass`);
  }
  rejectLegacyCapabilityFields(prefix, app);
  if (app.cameraUsageDescriptionPresent !== true) {
    errors.push(`${prefix} cameraUsageDescriptionPresent must be true`);
  }
  for (const key of [
    "scannerSourceIncluded",
    "releaseNfcEntitlementPresent",
    "staffControlsPresent",
  ]) {
    if (app[key] !== false) {
      errors.push(`${prefix} ${key} must be false`);
    }
  }
  if (app.paymentReturnUrlSchemePresent !== true) {
    errors.push(`${prefix} paymentReturnUrlSchemePresent must be true`);
  }
}

function validateFanPassOps(relativePath, app) {
  const prefix = `${relativePath}: FanPass Ops`;
  if (app.scheme !== "FanPassOps") {
    errors.push(`${prefix} scheme must be FanPassOps`);
  }
  rejectLegacyCapabilityFields(prefix, app);
  for (const key of [
    "cameraUsageDescriptionPresent",
    "qrScannerSourceIncluded",
    "nfcUsageDescriptionPresent",
    "nativeNfcDebugOnly",
  ]) {
    if (app[key] !== true) {
      errors.push(`${prefix} ${key} must be true`);
    }
  }
  if (app.releaseNfcEntitlementPresent !== false) {
    errors.push(`${prefix} releaseNfcEntitlementPresent must be false`);
  }
  for (const key of [
    "consumerWalletPresent",
    "marketplacePresent",
    "stripePaymentSheetPresent",
  ]) {
    if (app[key] !== false) {
      errors.push(`${prefix} ${key} must be false`);
    }
  }
}

function rejectLegacyCapabilityFields(prefix, app) {
  for (const key of ["cameraPermissionPresent", "nfcEntitlementPresent"]) {
    if (Object.hasOwn(app, key)) {
      errors.push(`${prefix} ${key} is a legacy ambiguous field`);
    }
  }
}

function validateRuntimeChecks(relativePath, runtime = {}) {
  for (const key of [
    "apiHealthReachable",
    "tlsVerified",
    "demoAuthRejected",
    "iosDistributionBoundaryAuditPassed",
    "stagingRuntimeEvidencePassedOrLinked",
  ]) {
    if (runtime[key] !== true) {
      errors.push(`${relativePath}: runtimeChecks.${key} must be true`);
    }
  }
}

function validateRedaction(relativePath, redaction = {}) {
  for (const key of [
    "bearerTokensRedacted",
    "privyTokensRedacted",
    "stripeSecretsRedacted",
    "providerSecretsRedacted",
    "stripePublishableKeysRedacted",
    "databaseUrlsRedacted",
    "deploymentCredentialsRedacted",
    "ciSecretMaskingCommandsRedacted",
    "appleSigningMaterialRedacted",
    "provisioningProfilesRedacted",
    "deviceIdentifiersRedacted",
    "realPersonalDataExcluded",
  ]) {
    if (redaction[key] !== true) {
      errors.push(`${relativePath}: redaction.${key} must be true`);
    }
  }
}

function isHttpsUrl(value) {
  if (typeof value !== "string") {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isPlaceholderOrLocal(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".invalid") ||
      host.includes("replace-me") ||
      host.includes("example.com")
    );
  } catch {
    return true;
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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}
