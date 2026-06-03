const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const evidenceFiles = process.argv.slice(2);
const errors = [];
const implementationSnapshotFiles = [
  "apps/console-auth/app/page.tsx",
  "apps/console-auth/app/privy-console-login.tsx",
  "apps/console-auth/next.config.ts",
  "apps/console-auth/package.json",
  "apps/console-auth/package-lock.json",
  "apps/dashboard/app/api/console/privy-session/route.ts",
  "apps/dashboard/app/console-login-form.tsx",
  "apps/dashboard/lib/api.ts",
  "apps/dashboard/package.json",
  "package.json",
  "package-lock.json",
  "scripts/console-route-contract-audit.js",
  "scripts/provider-boundary-audit.js",
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
      "Usage: npm run security:privy-console-react-sdk:isolation -- <evidence-file...>",
      "Validate saved Privy React SDK dependency-isolation evidence before adding Console SDK login.",
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
  validateSdk(relativePath, evidence.sdk);
  validateIntegration(relativePath, evidence.integration);
  validateImplementationSnapshot(relativePath, evidence.implementationSnapshot);
  validateDependencyAudit(
    relativePath,
    evidence.dependencyAudit,
    evidence.integration?.mode,
  );
  validateBoundaries(relativePath, evidence.boundaries);
  validateRedaction(relativePath, evidence.redaction);

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    sdkVersion: evidence.sdk?.version ?? null,
    integrationMode: evidence.integration?.mode ?? null,
    productionAuditTotal:
      evidence.dependencyAudit?.productionAuditAfter?.total ?? null,
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
    "sk_test_",
    "sk_live_",
    "pk_test_",
    "pk_live_",
    "whsec_",
    "PRIVY_APP_SECRET",
    "PRIVY_VERIFICATION_KEY",
    "PRIVY_ACCESS_TOKEN",
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
  if (evidence.provider !== "privy-console-react-sdk-isolation") {
    errors.push(
      `${relativePath}: provider must be privy-console-react-sdk-isolation`,
    );
  }
  if (evidence.evidenceSource !== "node22-dependency-isolation-review") {
    errors.push(
      `${relativePath}: evidenceSource must be node22-dependency-isolation-review`,
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

function validateSdk(relativePath, sdk = {}) {
  if (sdk.package !== "@privy-io/react-auth") {
    errors.push(`${relativePath}: sdk.package must be @privy-io/react-auth`);
  }
  if (!isVersion(sdk.version)) {
    errors.push(`${relativePath}: sdk.version must be a concrete semver`);
  }
  if (
    sdk.metadataCommand !==
    "npm view @privy-io/react-auth@latest version dependencies peerDependencies --json"
  ) {
    errors.push(
      `${relativePath}: sdk.metadataCommand must record the npm view command`,
    );
  }
}

function validateIntegration(relativePath, integration = {}) {
  const mode = integration.mode;
  if (
    mode !== "direct-console-dependency-clean-audit" &&
    mode !== "isolated-auth-workspace"
  ) {
    errors.push(
      `${relativePath}: integration.mode must be direct-console-dependency-clean-audit or isolated-auth-workspace`,
    );
  }
  if (
    integration.sessionBridgeRoute !== "/api/console/privy-session" ||
    integration.serverRouteStoresHttpOnlyCookie !== true ||
    integration.serverSideApiReadsUseCookieOrConfiguredToken !== true
  ) {
    errors.push(
      `${relativePath}: Console integration must use the existing HttpOnly session bridge`,
    );
  }
  if (integration.accessTokensStoredInBrowserStorage !== false) {
    errors.push(
      `${relativePath}: Privy access tokens must not be stored in browser storage`,
    );
  }
  if (!Array.isArray(integration.sdkImportsLimitedTo)) {
    errors.push(`${relativePath}: sdkImportsLimitedTo must be an array`);
  }
  if (mode === "isolated-auth-workspace") {
    const imports = Array.isArray(integration.sdkImportsLimitedTo)
      ? integration.sdkImportsLimitedTo
      : [];
    if (
      imports.length !== 1 ||
      imports[0] !== "apps/console-auth/app/privy-console-login.tsx"
    ) {
      errors.push(
        `${relativePath}: isolated-auth-workspace sdkImportsLimitedTo must only allow apps/console-auth/app/privy-console-login.tsx`,
      );
    }
    if (integration.fanPassConsoleProductionDependency !== false) {
      errors.push(
        `${relativePath}: isolated-auth-workspace evidence must keep the SDK out of FanPass Console production dependencies`,
      );
    }
    if (integration.isolatedRuntimeBoundary !== true) {
      errors.push(
        `${relativePath}: isolated-auth-workspace evidence must prove an isolated runtime boundary`,
      );
    }
  }
  if (mode === "direct-console-dependency-clean-audit") {
    if (integration.fanPassConsoleProductionDependency !== true) {
      errors.push(
        `${relativePath}: direct Console evidence must acknowledge the SDK is a production dependency`,
      );
    }
  }
}

function validateImplementationSnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "privy-console-sdk-isolation-boundaries") {
    errors.push(
      `${relativePath}: implementationSnapshot.source must be privy-console-sdk-isolation-boundaries`,
    );
  }

  if (
    !Array.isArray(snapshot.files) ||
    snapshot.files.length !== expectedImplementationSnapshot.length
  ) {
    errors.push(
      `${relativePath}: implementationSnapshot.files must include the current Console SDK isolation boundary files`,
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
        `${relativePath}: implementationSnapshot.files ${expected.file} sha256 must match the current Console SDK isolation implementation`,
      );
    }
  }
}

function validateDependencyAudit(relativePath, audit = {}, integrationMode) {
  if (audit.integrationMode !== integrationMode) {
    errors.push(
      `${relativePath}: dependencyAudit.integrationMode must match integration.mode`,
    );
  }
  if (
    typeof audit.nodeVersion !== "string" ||
    !/^22\./.test(audit.nodeVersion)
  ) {
    errors.push(
      `${relativePath}: dependencyAudit.nodeVersion must start with 22.`,
    );
  }
  if (audit.engineStrict !== true) {
    errors.push(`${relativePath}: dependencyAudit.engineStrict must be true`);
  }
  if (audit.withNode22HelperUsed !== true) {
    errors.push(
      `${relativePath}: dependencyAudit.withNode22HelperUsed must be true`,
    );
  }
  if (audit.safeNextPostcssPathChecked !== true) {
    errors.push(
      `${relativePath}: dependencyAudit.safeNextPostcssPathChecked must be true`,
    );
  }
  const commands = Array.isArray(audit.commands) ? audit.commands : [];
  for (const command of [
    "npm run security:audit:prod",
    "npm run security:dependency-advisories",
  ]) {
    if (!commands.includes(command)) {
      errors.push(
        `${relativePath}: dependencyAudit.commands must include ${command}`,
      );
    }
  }

  const before = audit.productionAuditBefore ?? {};
  const after = audit.productionAuditAfter ?? {};
  validateAuditCounts(relativePath, "productionAuditBefore", before);
  validateAuditCounts(relativePath, "productionAuditAfter", after);
  if (after.high !== 0 || after.critical !== 0) {
    errors.push(
      `${relativePath}: productionAuditAfter must have no high or critical advisories`,
    );
  }
  if (after.knownNextPostcssOnly !== true) {
    errors.push(
      `${relativePath}: productionAuditAfter must remain limited to the known Next/PostCSS advisories or be clean`,
    );
  }
  const newPackages = Array.isArray(after.newAdvisoryPackages)
    ? after.newAdvisoryPackages
    : [];
  if (newPackages.length > 0) {
    errors.push(
      `${relativePath}: productionAuditAfter must not introduce new advisory packages`,
    );
  }
  const beforeTotal = Number(before.total ?? 0);
  const afterTotal = Number(after.total ?? 0);
  if (
    integrationMode === "direct-console-dependency-clean-audit" &&
    afterTotal > beforeTotal
  ) {
    errors.push(
      `${relativePath}: direct Console SDK integration must not increase production audit findings`,
    );
  }
}

function validateAuditCounts(relativePath, label, audit = {}) {
  for (const key of ["total", "moderate", "high", "critical"]) {
    if (!Number.isInteger(audit[key]) || audit[key] < 0) {
      errors.push(
        `${relativePath}: ${label}.${key} must be a non-negative integer`,
      );
    }
  }
}

function validateBoundaries(relativePath, boundaries = {}) {
  for (const key of [
    "consoleRouteAuditPassed",
    "providerBoundaryAuditPassed",
    "dependencyAdvisoryGatePassed",
    "noProviderSecretsInEnvOrBundle",
    "noRawPrivyTokenLogging",
    "noRawUpstreamSessionForwarding",
  ]) {
    if (boundaries[key] !== true) {
      errors.push(`${relativePath}: boundaries.${key} must be true`);
    }
  }
}

function validateRedaction(relativePath, redaction = {}) {
  for (const key of [
    "accessTokensRedacted",
    "appSecretRedacted",
    "verificationKeyRedacted",
    "providerSecretsRedacted",
    "stripePublishableKeysRedacted",
    "databaseUrlsRedacted",
    "deploymentCredentialsRedacted",
    "userIdentifiersRedacted",
    "dependencyLogsReviewed",
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

function isVersion(value) {
  return typeof value === "string" && /^\d+\.\d+\.\d+/.test(value);
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}
