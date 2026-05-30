const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const evidenceFiles = process.argv.slice(2);
const errors = [];
const expectedWorkflowPath = ".github/workflows/beta-foundation.yml";
const expectedWorkflowSha256 = sha256File(
  path.join(rootDir, expectedWorkflowPath),
);
const expectedApiTestSuites = 11;
const expectedApiTests = 57;
const verifierSnapshotFiles = [
  ".github/workflows/beta-foundation.yml",
  ".nvmrc",
  ".npmrc",
  "package.json",
  "package-lock.json",
  "scripts/beta-foundation-verify.sh",
  "scripts/ci-node22-workflow-audit.js",
  "scripts/ci-hosted-evidence-audit.js",
  "scripts/ci-hosted-evidence-audit-self-test.js",
  "docs/CI_HOSTED_EVIDENCE.md",
];
const expectedVerifierSnapshot = verifierSnapshotFiles.map((file) => ({
  file,
  sha256: sha256File(path.join(rootDir, file)),
}));

if (evidenceFiles.length === 0) {
  console.error(
    [
      "Usage: npm run security:ci-hosted:evidence -- <evidence-file...>",
      "Validate saved hosted GitHub Actions Beta foundation evidence before trusting CI run results.",
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
      workflowPath: expectedWorkflowPath,
      workflowSha256: expectedWorkflowSha256,
      verifierSnapshot: {
        source: "hosted-ci-beta-foundation-verifier-policy",
        files: expectedVerifierSnapshot,
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
  validateRun(relativePath, evidence.run);
  validateEnvironment(relativePath, evidence.environment);
  validateVerifierSnapshot(relativePath, evidence.verifierSnapshot);
  validateSteps(relativePath, evidence.steps);
  validateRedaction(relativePath, evidence.redaction);

  return {
    file: relativePath,
    checkedAt: evidence.checkedAt ?? null,
    runUrl: evidence.run?.runUrl ?? null,
    workflow: evidence.run?.workflowName ?? null,
    workflowPath: evidence.run?.workflowPath ?? null,
    workflowSha256: evidence.run?.workflowSha256 ?? null,
    verifierSnapshotFiles: evidence.verifierSnapshot?.files?.length ?? null,
    conclusion: evidence.run?.conclusion ?? null,
    nodeVersion: evidence.environment?.nodeVersion ?? null,
  };
}

function validateVerifierSnapshot(relativePath, snapshot = {}) {
  if (snapshot.source !== "hosted-ci-beta-foundation-verifier-policy") {
    errors.push(
      `${relativePath}: verifierSnapshot.source must be hosted-ci-beta-foundation-verifier-policy`,
    );
  }
  const files = Array.isArray(snapshot.files) ? snapshot.files : [];
  if (files.length !== expectedVerifierSnapshot.length) {
    errors.push(
      `${relativePath}: verifierSnapshot.files must include the current hosted CI verifier policy files`,
    );
  }
  const expectedFiles = new Set(
    expectedVerifierSnapshot.map((entry) => entry.file),
  );
  for (const entry of files) {
    if (!expectedFiles.has(entry?.file)) {
      errors.push(
        `${relativePath}: verifierSnapshot.files contains unexpected file ${entry?.file}`,
      );
    }
  }
  for (const expected of expectedVerifierSnapshot) {
    const actual = files.find((entry) => entry?.file === expected.file);
    if (!actual) {
      errors.push(
        `${relativePath}: verifierSnapshot.files missing ${expected.file}`,
      );
      continue;
    }
    if (actual.sha256 !== expected.sha256) {
      errors.push(
        `${relativePath}: verifierSnapshot.files ${expected.file} sha256 must match the current hosted CI verifier policy`,
      );
    }
  }
}

function validateNoSecretMarkers(relativePath, raw) {
  const forbiddenPatterns = [
    {
      label: "Authorization: Bearer ",
      pattern: /Authorization:\s*Bearer\s+[A-Za-z0-9._~+/=-]+/i,
    },
    {
      label: "JWT",
      pattern: /\beyJhbGci[A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+){2}\b/,
    },
    {
      label: "private key",
      pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    },
    {
      label: "Stripe secret key",
      pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{8,}/,
    },
    {
      label: "Stripe publishable key",
      pattern: /\bpk_(?:live|test)_[A-Za-z0-9]{8,}/,
    },
    {
      label: "Stripe webhook secret",
      pattern: /\bwhsec_[A-Za-z0-9]{8,}/,
    },
    {
      label: "Stripe client secret",
      pattern: /\bpi_[A-Za-z0-9_]+_secret_[A-Za-z0-9_]+/,
    },
    {
      label: "Stripe secret assignment",
      pattern: /\bSTRIPE_(?:SECRET_KEY|WEBHOOK_SECRET|PUBLISHABLE_KEY)\s*=/i,
    },
    {
      label: "Privy secret marker",
      pattern: /\bPRIVY_(?:APP_SECRET|VERIFICATION_KEY|ACCESS_TOKEN)\b/i,
    },
    {
      label: "staging admin token assignment",
      pattern:
        /\b(?:STAGING_ADMIN_ACCESS_TOKEN|FANPASS_STAGING_ADMIN_ACCESS_TOKEN)\s*=/i,
    },
    {
      label: "testnet operator private key assignment",
      pattern: /\bTESTNET_OPERATOR_PRIVATE_KEY\s*=/i,
    },
    {
      label: "database URL",
      pattern: /\bDATABASE_URL\s*=\s*(?:postgres|postgresql):\/\//i,
    },
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
      label: "GitHub secrets context",
      pattern: /\bsecrets\./i,
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
  if (evidence.provider !== "github-actions-hosted-ci") {
    errors.push(`${relativePath}: provider must be github-actions-hosted-ci`);
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

function validateRun(relativePath, run = {}) {
  if (run.workflowName !== "FanPass Beta Foundation") {
    errors.push(
      `${relativePath}: run.workflowName must be FanPass Beta Foundation`,
    );
  }
  if (run.workflowPath !== expectedWorkflowPath) {
    errors.push(
      `${relativePath}: run.workflowPath must be ${expectedWorkflowPath}`,
    );
  }
  if (run.workflowSha256 !== expectedWorkflowSha256) {
    errors.push(
      `${relativePath}: run.workflowSha256 must match the current ${expectedWorkflowPath} SHA-256`,
    );
  }
  if (run.jobName !== "Node 22 foundation gates") {
    errors.push(
      `${relativePath}: run.jobName must be Node 22 foundation gates`,
    );
  }
  if (!isGitHubActionsUrl(run.runUrl)) {
    errors.push(
      `${relativePath}: run.runUrl must be a GitHub Actions HTTPS URL`,
    );
  }
  if (typeof run.runId !== "number" || run.runId <= 0) {
    errors.push(`${relativePath}: run.runId must be a positive number`);
  }
  if (!isSha(run.commitSha)) {
    errors.push(
      `${relativePath}: run.commitSha must be a full 40-char git SHA`,
    );
  }
  if (!["push", "pull_request", "workflow_dispatch"].includes(run.event)) {
    errors.push(
      `${relativePath}: run.event must be push, pull_request, or workflow_dispatch`,
    );
  }
  if (run.conclusion !== "success") {
    errors.push(`${relativePath}: run.conclusion must be success`);
  }
  if (run.fromFork !== false) {
    errors.push(`${relativePath}: run.fromFork must be false`);
  }
}

function validateEnvironment(relativePath, environment = {}) {
  if (environment.runner !== "ubuntu-latest") {
    errors.push(`${relativePath}: environment.runner must be ubuntu-latest`);
  }
  if (
    typeof environment.nodeVersion !== "string" ||
    !/^22\./.test(environment.nodeVersion)
  ) {
    errors.push(`${relativePath}: environment.nodeVersion must start with 22.`);
  }
  if (environment.nodeVersionSource !== ".nvmrc") {
    errors.push(
      `${relativePath}: environment.nodeVersionSource must be .nvmrc`,
    );
  }
  if (environment.strictNodeRuntime !== true) {
    errors.push(`${relativePath}: environment.strictNodeRuntime must be true`);
  }
  if (environment.postgresService !== "postgres:16-alpine") {
    errors.push(
      `${relativePath}: environment.postgresService must be postgres:16-alpine`,
    );
  }
  if (environment.postgresHealthy !== true) {
    errors.push(`${relativePath}: environment.postgresHealthy must be true`);
  }
  if (environment.npmInstallCommand !== "npm ci") {
    errors.push(
      `${relativePath}: environment.npmInstallCommand must be npm ci`,
    );
  }
  if (environment.providerSecretsAvailable !== false) {
    errors.push(
      `${relativePath}: environment.providerSecretsAvailable must be false`,
    );
  }
  if (environment.deploymentCredentialsAvailable !== false) {
    errors.push(
      `${relativePath}: environment.deploymentCredentialsAvailable must be false`,
    );
  }
}

function validateSteps(relativePath, steps = {}) {
  for (const key of [
    "checkoutSucceeded",
    "setupNodeFromNvmrcSucceeded",
    "npmCiSucceeded",
    "betaFoundationVerifySucceeded",
    "dependencyAdvisoryGateRan",
    "apiUnitTestsPassed",
    "sideEffectHealthPassed",
  ]) {
    if (steps[key] !== true) {
      errors.push(`${relativePath}: steps.${key} must be true`);
    }
  }
  if (steps.apiTestSuites !== expectedApiTestSuites) {
    errors.push(
      `${relativePath}: steps.apiTestSuites must be ${expectedApiTestSuites}`,
    );
  }
  if (steps.apiTests !== expectedApiTests) {
    errors.push(`${relativePath}: steps.apiTests must be ${expectedApiTests}`);
  }
}

function validateRedaction(relativePath, redaction = {}) {
  for (const key of [
    "providerSecretsRedacted",
    "databaseUrlRedacted",
    "bearerTokensRedacted",
    "privyTokensRedacted",
    "stripeSecretsRedacted",
    "privateKeysRedacted",
    "deploymentCredentialsRedacted",
    "ciSecretMaskingCommandsRedacted",
    "noProductionCredentialsInLogs",
  ]) {
    if (redaction[key] !== true) {
      errors.push(`${relativePath}: redaction.${key} must be true`);
    }
  }
}

function isGitHubActionsUrl(value) {
  if (typeof value !== "string") {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      /\/actions\/runs\/\d+/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function isSha(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/i.test(value);
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
