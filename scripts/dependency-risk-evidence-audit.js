const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const evidenceFiles = process.argv.slice(2);
const errors = [];

const knownPackages = ["next", "postcss"];
const knownAdvisoryId = "GHSA-qx2v-qp2m-jg93";
const maxRiskWindowDays = 90;
const dependencySnapshotFiles = [
  "package.json",
  "package-lock.json",
  "apps/api/package.json",
  "apps/dashboard/package.json",
  "packages/contracts/package.json",
  "packages/shared/package.json",
];
const expectedDependencySnapshot = dependencySnapshotFiles.map((file) => ({
  file,
  sha256: sha256File(path.join(rootDir, file)),
}));
const riskPolicySnapshotFiles = [
  "scripts/dependency-advisory-check.js",
  "scripts/dependency-advisory-check-self-test.js",
  "scripts/dependency-risk-evidence-audit.js",
  "scripts/dependency-risk-evidence-audit-self-test.js",
  "scripts/dependency-tooling-audit.js",
  "docs/DEPENDENCY_ADVISORY_LOG.md",
  "docs/DEPENDENCY_RISK_EVIDENCE.md",
  "docs/PROVIDER_COST_FEASIBILITY.md",
];
const expectedRiskPolicySnapshot = riskPolicySnapshotFiles.map((file) => ({
  file,
  sha256: sha256File(path.join(rootDir, file)),
}));

if (evidenceFiles.length === 0) {
  console.error(
    [
      "Usage: npm run security:dependency-risk:evidence -- <evidence-file...>",
      "Validate saved dependency audit closeout or explicit closed-beta risk-acceptance evidence.",
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
      dependencySnapshot: {
        source: "workspace-package-manifests",
        files: expectedDependencySnapshot,
      },
      riskPolicySnapshot: {
        source: "dependency-advisory-risk-policy",
        files: expectedRiskPolicySnapshot,
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
  validateDependencySnapshot(relativePath, evidence.dependencySnapshot);
  validateRiskPolicySnapshot(relativePath, evidence.riskPolicySnapshot);
  validateRuntime(relativePath, evidence.nodeRuntime);
  validateProductionAudit(relativePath, evidence.productionAudit);
  validateFixStatus(relativePath, evidence.fixStatus);
  validateMitigations(relativePath, evidence.mitigations);
  validateRiskAcceptance(relativePath, evidence);
  validateRedaction(relativePath, evidence.redaction);

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    provider: evidence.provider ?? null,
    dependencySnapshotFiles: evidence.dependencySnapshot?.files?.length ?? null,
    riskPolicySnapshotFiles: evidence.riskPolicySnapshot?.files?.length ?? null,
    productionAuditTotal: evidence.productionAudit?.total ?? null,
    acceptedScope: evidence.riskAcceptance?.scope ?? null,
    expiresAt: evidence.riskAcceptance?.expiresAt ?? null,
  };
}

function validateDependencySnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "workspace-package-manifests") {
    errors.push(
      `${relativePath}: dependencySnapshot.source must be workspace-package-manifests`,
    );
  }
  const files = Array.isArray(snapshot.files) ? snapshot.files : [];
  if (files.length !== expectedDependencySnapshot.length) {
    errors.push(
      `${relativePath}: dependencySnapshot.files must include the current workspace package manifests and lockfile`,
    );
  }
  const expectedFiles = new Set(
    expectedDependencySnapshot.map((entry) => entry.file),
  );
  for (const entry of files) {
    if (!expectedFiles.has(entry?.file)) {
      errors.push(
        `${relativePath}: dependencySnapshot.files contains unexpected file ${entry?.file}`,
      );
    }
  }
  for (const expected of expectedDependencySnapshot) {
    const actual = files.find((entry) => entry?.file === expected.file);
    if (!actual) {
      errors.push(
        `${relativePath}: dependencySnapshot.files missing ${expected.file}`,
      );
      continue;
    }
    if (actual.sha256 !== expected.sha256) {
      errors.push(
        `${relativePath}: dependencySnapshot.files ${expected.file} sha256 must match the current workspace dependency snapshot`,
      );
    }
  }
}

function validateRiskPolicySnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "dependency-advisory-risk-policy") {
    errors.push(
      `${relativePath}: riskPolicySnapshot.source must be dependency-advisory-risk-policy`,
    );
  }
  const files = Array.isArray(snapshot.files) ? snapshot.files : [];
  if (files.length !== expectedRiskPolicySnapshot.length) {
    errors.push(
      `${relativePath}: riskPolicySnapshot.files must include the current dependency advisory risk policy files`,
    );
  }
  const expectedFiles = new Set(
    expectedRiskPolicySnapshot.map((entry) => entry.file),
  );
  for (const entry of files) {
    if (!expectedFiles.has(entry?.file)) {
      errors.push(
        `${relativePath}: riskPolicySnapshot.files contains unexpected file ${entry?.file}`,
      );
    }
  }
  for (const expected of expectedRiskPolicySnapshot) {
    const actual = files.find((entry) => entry?.file === expected.file);
    if (!actual) {
      errors.push(
        `${relativePath}: riskPolicySnapshot.files missing ${expected.file}`,
      );
      continue;
    }
    if (actual.sha256 !== expected.sha256) {
      errors.push(
        `${relativePath}: riskPolicySnapshot.files ${expected.file} sha256 must match the current dependency advisory risk policy`,
      );
    }
  }
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
    "PROVIDER_SECRET=",
    "PROVIDER_API_KEY=",
    "STRIPE_SECRET_KEY=",
    "STRIPE_PUBLISHABLE_KEY=",
    "STRIPE_WEBHOOK_SECRET=",
    "DATABASE_URL=",
    "TESTNET_OPERATOR_PRIVATE_KEY=",
    "STAGING_ADMIN_ACCESS_TOKEN=",
    "FANPASS_STAGING_ADMIN_ACCESS_TOKEN=",
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
        /(?:::add-mask::(?!<|\$\{|\*\*\*|redacted\b)[^\r\n]{8,}|::set-secret\s+name=[^:\r\n]+::(?!<|\$\{|\*\*\*|redacted\b)[^\r\n]{8,}|##vso\[task\.setvariable[^\]\r\n]*issecret=true[^\]\r\n]*\](?!<|\$\{|\*\*\*|redacted\b)[^\r\n]{8,})/i,
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
  if (evidence.provider !== "dependency-risk") {
    errors.push(`${relativePath}: provider must be dependency-risk`);
  }
  if (evidence.evidenceSource !== "node22-production-audit") {
    errors.push(
      `${relativePath}: evidenceSource must be node22-production-audit`,
    );
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
  if (evidence.deploymentCredentialsAvailable !== false) {
    errors.push(
      `${relativePath}: deploymentCredentialsAvailable must be false`,
    );
  }
}

function validateRuntime(relativePath, nodeRuntime = {}) {
  if (
    typeof nodeRuntime.nodeVersion !== "string" ||
    !/^22\./.test(nodeRuntime.nodeVersion)
  ) {
    errors.push(`${relativePath}: nodeRuntime.nodeVersion must start with 22.`);
  }
  if (nodeRuntime.engineStrict !== true) {
    errors.push(`${relativePath}: nodeRuntime.engineStrict must be true`);
  }
  if (nodeRuntime.withNode22HelperUsed !== true) {
    errors.push(
      `${relativePath}: nodeRuntime.withNode22HelperUsed must be true`,
    );
  }
  if (nodeRuntime.commands?.productionAudit !== "npm run security:audit:prod") {
    errors.push(
      `${relativePath}: nodeRuntime.commands.productionAudit must be npm run security:audit:prod`,
    );
  }
  if (
    nodeRuntime.commands?.advisoryGate !==
    "npm run security:dependency-advisories"
  ) {
    errors.push(
      `${relativePath}: nodeRuntime.commands.advisoryGate must be npm run security:dependency-advisories`,
    );
  }
}

function validateProductionAudit(relativePath, audit = {}) {
  const total = Number(audit.total ?? 0);
  const high = Number(audit.high ?? 0);
  const critical = Number(audit.critical ?? 0);
  if (high !== 0 || critical !== 0) {
    errors.push(
      `${relativePath}: production audit must have no high/critical advisories`,
    );
  }
  if (total === 0) {
    if (audit.clean !== true) {
      errors.push(
        `${relativePath}: clean production audit must set productionAudit.clean true`,
      );
    }
    return;
  }
  if (audit.clean !== false) {
    errors.push(
      `${relativePath}: unresolved production audit must set productionAudit.clean false`,
    );
  }
  if (audit.moderate !== 2 || total !== 2) {
    errors.push(
      `${relativePath}: unresolved audit must contain exactly 2 moderate advisories`,
    );
  }
  if (audit.highestSeverity !== "moderate") {
    errors.push(`${relativePath}: highestSeverity must remain moderate`);
  }
  const advisories = Array.isArray(audit.advisories) ? audit.advisories : [];
  const names = advisories.map((advisory) => advisory.package).sort();
  if (JSON.stringify(names) !== JSON.stringify(knownPackages)) {
    errors.push(
      `${relativePath}: unresolved advisories must be exactly next and postcss`,
    );
    return;
  }
  const next = advisories.find((advisory) => advisory.package === "next");
  const postcss = advisories.find((advisory) => advisory.package === "postcss");
  if (next?.isDirect !== true || next?.severity !== "moderate") {
    errors.push(`${relativePath}: next advisory must be direct and moderate`);
  }
  if (postcss?.isDirect !== false || postcss?.severity !== "moderate") {
    errors.push(
      `${relativePath}: postcss advisory must be transitive and moderate`,
    );
  }
  if (!String(postcss?.range ?? "").includes("<8.5.10")) {
    errors.push(`${relativePath}: postcss advisory range must include <8.5.10`);
  }
  if (!String(postcss?.advisoryId ?? "").includes(knownAdvisoryId)) {
    errors.push(
      `${relativePath}: postcss advisory id must include ${knownAdvisoryId}`,
    );
  }
}

function validateFixStatus(relativePath, fix = {}) {
  if (fix.npmAuditFixForceRequired !== true) {
    errors.push(
      `${relativePath}: fixStatus.npmAuditFixForceRequired must be true`,
    );
  }
  if (fix.forcedFixDowngradesNextToUnsupportedMajor !== true) {
    errors.push(
      `${relativePath}: fixStatus.forcedFixDowngradesNextToUnsupportedMajor must be true`,
    );
  }
  if (fix.safeNextPostcssPatchAvailable !== false) {
    errors.push(
      `${relativePath}: fixStatus.safeNextPostcssPatchAvailable must be false`,
    );
  }
  if (fix.latestNextChecked !== true) {
    errors.push(`${relativePath}: fixStatus.latestNextChecked must be true`);
  }
  if (!isVersion(fix.latestNextVersion)) {
    errors.push(
      `${relativePath}: fixStatus.latestNextVersion must be a semver version`,
    );
  }
  const postcssVersion = extractVersion(fix.latestNextPostcssDependency);
  if (!postcssVersion) {
    errors.push(
      `${relativePath}: fixStatus.latestNextPostcssDependency must include a semver version`,
    );
  } else if (compareVersions(postcssVersion, "8.5.10") >= 0) {
    errors.push(
      `${relativePath}: latest Next PostCSS dependency appears patched; upgrade instead of risk-accepting`,
    );
  }
}

function validateMitigations(relativePath, mitigations = {}) {
  for (const key of [
    "consoleAuthRequired",
    "consoleCspEnabled",
    "noUserControlledCssGeneration",
    "dependencyAdvisoryGateInVerifier",
    "node22RuntimeUsed",
    "externalTestingScopeClosedBetaOnly",
    "safeUpgradeRecheckBeforeTesterBuild",
  ]) {
    if (mitigations[key] !== true) {
      errors.push(`${relativePath}: mitigations.${key} must be true`);
    }
  }
}

function validateRiskAcceptance(relativePath, evidence) {
  const audit = evidence.productionAudit ?? {};
  if (Number(audit.total ?? 0) === 0) {
    if (evidence.riskAcceptance) {
      errors.push(
        `${relativePath}: clean audit evidence must not include riskAcceptance`,
      );
    }
    return;
  }

  const checkedAt = Date.parse(evidence.checkedAt);
  const acceptance = evidence.riskAcceptance ?? {};
  if (
    !["project-owner", "security-owner"].includes(acceptance.acceptedByRole)
  ) {
    errors.push(
      `${relativePath}: riskAcceptance.acceptedByRole must be project-owner or security-owner`,
    );
  }
  if (!isIsoDate(acceptance.acceptedAt)) {
    errors.push(
      `${relativePath}: riskAcceptance.acceptedAt must be an ISO timestamp`,
    );
  }
  if (!isIsoDate(acceptance.expiresAt)) {
    errors.push(
      `${relativePath}: riskAcceptance.expiresAt must be an ISO timestamp`,
    );
  }
  if (acceptance.scope !== "closed-beta-only") {
    errors.push(
      `${relativePath}: riskAcceptance.scope must be closed-beta-only`,
    );
  }
  if (
    typeof acceptance.reviewCadenceDays !== "number" ||
    acceptance.reviewCadenceDays > 30 ||
    acceptance.reviewCadenceDays < 1
  ) {
    errors.push(
      `${relativePath}: riskAcceptance.reviewCadenceDays must be between 1 and 30`,
    );
  }
  if (acceptance.rollbackOrPatchPlanDocumented !== true) {
    errors.push(
      `${relativePath}: riskAcceptance.rollbackOrPatchPlanDocumented must be true`,
    );
  }
  if (acceptance.noPublicLaunchUntilCleanOrRenewed !== true) {
    errors.push(
      `${relativePath}: riskAcceptance.noPublicLaunchUntilCleanOrRenewed must be true`,
    );
  }
  if (acceptance.realUserDataAllowed !== false) {
    errors.push(
      `${relativePath}: riskAcceptance.realUserDataAllowed must be false`,
    );
  }
  if (!isNonEmptyString(acceptance.decisionReference)) {
    errors.push(
      `${relativePath}: riskAcceptance.decisionReference must be present`,
    );
  }

  const acceptedAt = Date.parse(acceptance.acceptedAt);
  const expiresAt = Date.parse(acceptance.expiresAt);
  if (
    Number.isFinite(checkedAt) &&
    Number.isFinite(expiresAt) &&
    expiresAt <= checkedAt
  ) {
    errors.push(
      `${relativePath}: riskAcceptance.expiresAt must be after checkedAt`,
    );
  }
  if (Number.isFinite(acceptedAt) && Number.isFinite(expiresAt)) {
    const maxExpiry = acceptedAt + maxRiskWindowDays * 24 * 60 * 60 * 1000;
    if (expiresAt > maxExpiry) {
      errors.push(
        `${relativePath}: riskAcceptance.expiresAt must be within ${maxRiskWindowDays} days of acceptedAt`,
      );
    }
  }
}

function validateRedaction(relativePath, redaction = {}) {
  for (const key of [
    "providerSecretsRedacted",
    "databaseUrlRedacted",
    "bearerTokensRedacted",
    "privyTokensRedacted",
    "stripeSecretsRedacted",
    "stripePublishableKeysRedacted",
    "privateKeysRedacted",
    "deploymentCredentialsRedacted",
    "ciSecretMaskingCommandsRedacted",
    "realPersonalDataExcluded",
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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function extractVersion(value) {
  return String(value ?? "").match(/\d+\.\d+\.\d+/)?.[0] ?? null;
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] > rightParts[index]) {
      return 1;
    }
    if (leftParts[index] < rightParts[index]) {
      return -1;
    }
  }
  return 0;
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}
