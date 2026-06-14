const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const evidenceFiles = process.argv.slice(2);
const errors = [];
const implementationSnapshotFiles = [
  "apps/api/src/main.ts",
  "apps/api/src/modules/auth/auth.controller.ts",
  "apps/api/src/modules/auth/auth.service.ts",
  "apps/api/src/modules/alpha/alpha.controller.ts",
  "apps/api/src/modules/alpha/alpha-persistence.service.ts",
  "apps/api/src/modules/verification/verification.service.ts",
  "apps/dashboard/server/console-bff.ts",
  "apps/dashboard/lib/gate-assignment-response.ts",
  "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
  "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
  "scripts/staff-invite-policy-audit.js",
  "scripts/console-route-contract-audit.js",
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
      "Usage: npm run security:staff-tenant:staging-evidence -- <evidence-file...>",
      "Validate saved staging tenant and staff-policy evidence before closing production tenant/staff Beta blockers.",
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

  validateNoSensitiveMarkers(relativePath, raw);
  const evidence = extractJsonObject(relativePath, raw);
  if (!evidence) {
    return { file: relativePath, ok: false };
  }

  validateTopLevel(relativePath, evidence);
  validateRuntime(relativePath, evidence.runtime);
  validateTenantIsolation(relativePath, evidence.tenantIsolation);
  validateAuthSession(relativePath, evidence.authSession);
  validateImplementationSnapshot(relativePath, evidence.implementationSnapshot);
  validateStaffPolicy(relativePath, evidence.staffPolicy);
  validateOpsGateAccess(relativePath, evidence.opsGateAccess);
  validateRedaction(relativePath, evidence.redaction);

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    environment: evidence.environment ?? null,
    apiBaseUrl: evidence.runtime?.apiBaseUrl ?? null,
    consoleBaseUrl: evidence.runtime?.consoleBaseUrl ?? null,
    implementationSnapshotFiles:
      evidence.implementationSnapshot?.files?.length ?? null,
  };
}

function validateNoSensitiveMarkers(relativePath, raw) {
  const forbiddenMarkers = [
    "Authorization: Bearer ",
    "eyJhbGci",
    "-----BEGIN PRIVATE KEY-----",
    "sk_test_",
    "sk_live_",
    "pk_test_",
    "pk_live_",
    "whsec_",
    "STRIPE_SECRET_KEY=",
    "STRIPE_PUBLISHABLE_KEY=",
    "STRIPE_WEBHOOK_SECRET=",
    "PRIVY_APP_SECRET",
    "PRIVY_VERIFICATION_KEY",
    "PRIVY_ACCESS_TOKEN",
    "DATABASE_URL=",
    "STAGING_ADMIN_ACCESS_TOKEN=",
    "FANPASS_CONSOLE_ACCESS_TOKEN=",
    "STAFF_INVITE_TOKEN=",
    "inviteToken:",
  ];
  const lowerRaw = raw.toLowerCase();
  for (const marker of forbiddenMarkers) {
    if (lowerRaw.includes(marker.toLowerCase())) {
      errors.push(
        `${relativePath}: evidence must not include sensitive marker ${marker}`,
      );
    }
  }

  const forbiddenPatterns = [
    {
      pattern:
        /"(inviteToken|privyAccessToken|accessToken|bearerToken|email|walletAddress|staffUserId|organizerUserId)"\s*:/i,
      message:
        "evidence must not include raw identity or token JSON fields such as inviteToken, accessToken, email, walletAddress, or staffUserId",
    },
    {
      pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
      message: "evidence must not include raw email addresses",
    },
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
  if (evidence.provider !== "staff-tenant-staging") {
    errors.push(`${relativePath}: provider must be staff-tenant-staging`);
  }
  if (evidence.environment !== "staging") {
    errors.push(`${relativePath}: environment must be staging`);
  }
  if (evidence.localDryRun !== false) {
    errors.push(`${relativePath}: localDryRun must be false`);
  }
  if (evidence.demoAuthUsed !== false) {
    errors.push(`${relativePath}: demoAuthUsed must be false`);
  }
  if (evidence.realUserDataUsed !== false) {
    errors.push(`${relativePath}: realUserDataUsed must be false`);
  }
  if (evidence.productionCredentialsUsed !== false) {
    errors.push(`${relativePath}: productionCredentialsUsed must be false`);
  }
}

function validateRuntime(relativePath, runtime = {}) {
  if (!isHttpsUrl(runtime.apiBaseUrl)) {
    errors.push(`${relativePath}: runtime.apiBaseUrl must be HTTPS`);
  }
  if (!isHttpsUrl(runtime.consoleBaseUrl)) {
    errors.push(`${relativePath}: runtime.consoleBaseUrl must be HTTPS`);
  }
  for (const key of [
    "productionLikeConfig",
    "seededDemoUsersDisabled",
    "stagingDatabaseIsolated",
    "adminBearerFromVerifiedAuth",
  ]) {
    if (runtime[key] !== true) {
      errors.push(`${relativePath}: runtime.${key} must be true`);
    }
  }
  if (runtime.deploymentCredentialsAvailable !== false) {
    errors.push(
      `${relativePath}: runtime.deploymentCredentialsAvailable must be false`,
    );
  }
}

function validateTenantIsolation(relativePath, tenantIsolation = {}) {
  for (const key of [
    "stagingTenantCreated",
    "organizerScopedEventCreated",
    "secondOrganizerIsolationVerified",
    "crossOrganizerConsoleReadRejected",
    "crossOrganizerStaffAssignmentRejected",
    "adminCanAuditWithoutPiiLeakage",
    "noSeededDemoTenantUsed",
  ]) {
    if (tenantIsolation[key] !== true) {
      errors.push(`${relativePath}: tenantIsolation.${key} must be true`);
    }
  }
}

function validateAuthSession(relativePath, authSession = {}) {
  for (const key of [
    "privyLoginUsed",
    "verifiedPrivyTokensUsed",
    "demoSessionRejected",
    "consoleHttpOnlyCookieVerified",
    "consoleLockedWhenUnauthenticated",
    "fanRoleRejectedFromConsole",
  ]) {
    if (authSession[key] !== true) {
      errors.push(`${relativePath}: authSession.${key} must be true`);
    }
  }
}

function validateImplementationSnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "staff-tenant-staging-policy-boundaries") {
    errors.push(
      `${relativePath}: implementationSnapshot.source must be staff-tenant-staging-policy-boundaries`,
    );
  }

  if (
    !Array.isArray(snapshot.files) ||
    snapshot.files.length !== expectedImplementationSnapshot.length
  ) {
    errors.push(
      `${relativePath}: implementationSnapshot.files must include the current staff tenant staging policy boundary files`,
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
        `${relativePath}: implementationSnapshot.files ${expected.file} sha256 must match the current staff tenant staging policy implementation`,
      );
    }
  }
}

function validateStaffPolicy(relativePath, staffPolicy = {}) {
  for (const key of [
    "inviteCreatedByOrganizerScopedConsole",
    "inviteTokenShownOnce",
    "inviteTokenNotPersistedInUrlOrSnapshot",
    "inviteAcceptedWithVerifiedPrivyToken",
    "inviteReplayRejected",
    "supersededInviteRejected",
    "deactivatedAssignmentRevokesAccess",
    "linkedStaffCannotRotateInvite",
    "crossOrganizerInviteRotationRejected",
  ]) {
    if (staffPolicy[key] !== true) {
      errors.push(`${relativePath}: staffPolicy.${key} must be true`);
    }
  }
}

function validateOpsGateAccess(relativePath, opsGateAccess = {}) {
  for (const key of [
    "opsLoginWithLinkedStaff",
    "assignedGateRedeemAllowed",
    "unassignedGateRedeemRejected",
    "clientSuppliedStaffRejected",
    "checkInSummaryScopedToAssignment",
    "assignmentDeactivationBlocksOpsAccess",
  ]) {
    if (opsGateAccess[key] !== true) {
      errors.push(`${relativePath}: opsGateAccess.${key} must be true`);
    }
  }
}

function validateRedaction(relativePath, redaction = {}) {
  for (const key of [
    "bearerTokensRedacted",
    "privyTokensRedacted",
    "inviteTokensRedacted",
    "emailsRedacted",
    "walletAddressesRedacted",
    "providerSecretsRedacted",
    "stripePublishableKeysRedacted",
    "databaseUrlsRedacted",
    "deploymentCredentialsRedacted",
    "ciSecretMaskingCommandsRedacted",
    "staffIdentifiersRedacted",
    "organizerIdentifiersRedacted",
    "ticketIdentifiersRedacted",
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
