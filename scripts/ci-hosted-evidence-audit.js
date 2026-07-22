const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const expectedWorkflowPath = ".github/workflows/beta-foundation.yml";
const expectedWorkflowName = "FanPass Beta Foundation";
const expectedJobName = "Node 22 foundation gates";
const expectedApiTestSuites = 32;
const expectedApiTests = 386;
const githubApiVersion = "2022-11-28";
const maximumClockSkewMs = 5 * 60 * 1000;
const verifierSnapshotFiles = [
  ".github/workflows/beta-foundation.yml",
  ".nvmrc",
  ".npmrc",
  "package.json",
  "apps/api/package.json",
  "apps/dashboard/package.json",
  "apps/console-auth/package.json",
  "package-lock.json",
  "render.yaml",
  "scripts/beta-foundation-launcher.js",
  "scripts/beta-foundation-launcher-self-test.js",
  "scripts/beta-foundation-verify.js",
  "scripts/beta-foundation-verify-self-test.js",
  "scripts/lib/beta-foundation-bootstrap.js",
  "scripts/lib/beta-foundation-gate-audit.js",
  "scripts/ci-node22-workflow-audit.js",
  "scripts/render-rc-config-audit.js",
  "scripts/render-rc-config-audit-self-test.js",
  "scripts/ci-hosted-evidence-audit.js",
  "scripts/ci-hosted-evidence-audit-self-test.js",
  "docs/CI_HOSTED_EVIDENCE.md",
];
const requiredJobSteps = [
  "Checkout",
  "Setup Node 22",
  "Verify Beta foundation",
];

if (require.main === module) {
  main().catch((error) => {
    console.error(
      `- Hosted CI evidence audit failed closed: ${safeError(error)}`,
    );
    process.exit(1);
  });
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length === 0) {
    console.error(
      [
        "Usage: npm run security:ci-hosted:evidence -- <evidence-file...>",
        "Validate saved hosted GitHub Actions Beta foundation evidence against the GitHub API.",
      ].join("\n"),
    );
    process.exit(1);
  }

  const context = createAuditContext(rootDir);
  const token = resolveGitHubToken();
  const attest = createGitHubAttestationProvider({ token });
  const results = [];
  const errors = [];

  for (const filePath of argv) {
    const absolutePath = path.resolve(rootDir, filePath);
    const relativePath = path.relative(rootDir, absolutePath);
    let raw;
    try {
      raw = fs.readFileSync(absolutePath, "utf8");
    } catch (error) {
      errors.push(
        `${relativePath}: could not read evidence file: ${safeError(error)}`,
      );
      continue;
    }

    const result = await auditEvidenceText({
      raw,
      relativePath,
      context,
      attest,
    });
    errors.push(...result.errors);
    results.push(result.summary);
  }

  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        trust: "github-api-attested",
        originRepository: context.originRepo,
        rcCommitSha: context.expectedCommitSha,
        workflowPath: expectedWorkflowPath,
        workflowSha256: context.expectedWorkflowSha256,
        verifierSnapshot: {
          source: "hosted-ci-beta-foundation-verifier-policy",
          files: context.expectedVerifierSnapshot,
        },
        checkedFiles: results.length,
        evidence: results,
      },
      null,
      2,
    ),
  );
}

function createAuditContext(repositoryRoot, overrides = {}) {
  const originUrl = git(repositoryRoot, ["remote", "get-url", "origin"]);
  const originRepo = parseGitHubRepository(originUrl);
  if (!originRepo) {
    throw new Error(
      "remote.origin.url must identify a github.com owner/repository",
    );
  }

  return {
    rootDir: repositoryRoot,
    originRepo,
    expectedCommitSha: git(repositoryRoot, ["rev-parse", "HEAD"]),
    workingTreeClean:
      git(repositoryRoot, [
        "status",
        "--porcelain",
        "--untracked-files=all",
      ]) === "",
    expectedWorkflowSha256: sha256File(
      path.join(repositoryRoot, expectedWorkflowPath),
    ),
    expectedVerifierSnapshot: verifierSnapshotFiles.map((file) => ({
      file,
      sha256: sha256File(path.join(repositoryRoot, file)),
    })),
    now: new Date(),
    ...overrides,
  };
}

async function auditEvidenceText({ raw, relativePath, context, attest }) {
  const errors = [];
  validateNoSecretMarkers(relativePath, raw, errors);
  const evidence = extractJsonObject(relativePath, raw, errors);
  if (!evidence) {
    return {
      errors,
      summary: { file: relativePath, ok: false, trust: "rejected" },
    };
  }

  validateRepositoryState(relativePath, context, errors);
  validateTopLevel(relativePath, evidence, context, errors);
  validateRun(relativePath, evidence.run, context, errors);
  validateEnvironment(relativePath, evidence.environment, errors);
  validateVerifierSnapshot(
    relativePath,
    evidence.verifierSnapshot,
    context,
    errors,
  );
  validateSteps(relativePath, evidence.steps, errors);
  validateRedaction(relativePath, evidence.redaction, errors);

  let attestation = null;
  if (errors.length === 0) {
    try {
      attestation = await attest({
        repo: context.originRepo,
        runId: evidence.run.runId,
        commitSha: context.expectedCommitSha,
      });
    } catch (error) {
      errors.push(
        `${relativePath}: GitHub API attestation unavailable; evidence remains untrusted: ${safeError(error)}`,
      );
    }
  }

  let attestationSummary = null;
  if (attestation) {
    attestationSummary = validateGitHubAttestation({
      relativePath,
      evidence,
      context,
      attestation,
      errors,
    });
  }

  return {
    errors,
    summary: {
      file: relativePath,
      ok: errors.length === 0,
      trust: errors.length === 0 ? "github-api-attested" : "rejected",
      checkedAt: evidence.checkedAt ?? null,
      runUrl: evidence.run?.runUrl ?? null,
      workflow: evidence.run?.workflowName ?? null,
      workflowPath: evidence.run?.workflowPath ?? null,
      workflowSha256: evidence.run?.workflowSha256 ?? null,
      verifierSnapshotFiles: evidence.verifierSnapshot?.files?.length ?? null,
      conclusion: evidence.run?.conclusion ?? null,
      nodeVersion: evidence.environment?.nodeVersion ?? null,
      attestation: attestationSummary,
    },
  };
}

function validateRepositoryState(relativePath, context, errors) {
  if (context.workingTreeClean !== true) {
    errors.push(
      `${relativePath}: working tree must be clean so the current RC commit attests all verifier implementations`,
    );
  }
  if (!isSha(context.expectedCommitSha)) {
    errors.push(`${relativePath}: current RC commit could not be resolved`);
  }
}

function validateTopLevel(relativePath, evidence, context, errors) {
  if (evidence.ok !== true) {
    errors.push(`${relativePath}: evidence ok must be true`);
  }
  if (!isIsoDate(evidence.checkedAt)) {
    errors.push(`${relativePath}: evidence checkedAt must be an ISO timestamp`);
  } else if (
    Date.parse(evidence.checkedAt) >
    context.now.getTime() + maximumClockSkewMs
  ) {
    errors.push(
      `${relativePath}: evidence checkedAt must not be in the future`,
    );
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

function validateRun(relativePath, run = {}, context, errors) {
  if (run.workflowName !== expectedWorkflowName) {
    errors.push(
      `${relativePath}: run.workflowName must be ${expectedWorkflowName}`,
    );
  }
  if (run.workflowPath !== expectedWorkflowPath) {
    errors.push(
      `${relativePath}: run.workflowPath must be ${expectedWorkflowPath}`,
    );
  }
  if (run.workflowSha256 !== context.expectedWorkflowSha256) {
    errors.push(
      `${relativePath}: run.workflowSha256 must match the current ${expectedWorkflowPath} SHA-256`,
    );
  }
  if (run.jobName !== expectedJobName) {
    errors.push(`${relativePath}: run.jobName must be ${expectedJobName}`);
  }

  const parsedRunUrl = parseGitHubActionsRunUrl(run.runUrl);
  if (!parsedRunUrl) {
    errors.push(
      `${relativePath}: run.runUrl must be an exact GitHub Actions HTTPS run URL`,
    );
  } else {
    if (parsedRunUrl.repo.toLowerCase() !== context.originRepo.toLowerCase()) {
      errors.push(
        `${relativePath}: run.runUrl repository must match remote.origin.url (${context.originRepo})`,
      );
    }
    if (Number.isSafeInteger(run.runId) && parsedRunUrl.runId !== run.runId) {
      errors.push(`${relativePath}: run.runUrl id must match run.runId`);
    }
  }

  if (!Number.isSafeInteger(run.runId) || run.runId <= 0) {
    errors.push(`${relativePath}: run.runId must be a positive safe integer`);
  }
  if (!isSha(run.commitSha)) {
    errors.push(
      `${relativePath}: run.commitSha must be a full 40-char git SHA`,
    );
  } else if (
    run.commitSha.toLowerCase() !== context.expectedCommitSha.toLowerCase()
  ) {
    errors.push(
      `${relativePath}: run.commitSha must match the current RC commit (${context.expectedCommitSha})`,
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

function validateGitHubAttestation({
  relativePath,
  evidence,
  context,
  attestation,
  errors,
}) {
  const run = attestation.run ?? {};
  const jobs = Array.isArray(attestation.jobs) ? attestation.jobs : [];
  const expectedRunUrl = `https://github.com/${context.originRepo}/actions/runs/${evidence.run.runId}`;
  const runPath = typeof run.path === "string" ? run.path.split("@")[0] : "";

  if (run.id !== evidence.run.runId) {
    errors.push(`${relativePath}: GitHub API run.id must match run.runId`);
  }
  if (normalizeUrl(run.html_url) !== normalizeUrl(expectedRunUrl)) {
    errors.push(
      `${relativePath}: GitHub API run URL must match origin repository and runId`,
    );
  }
  for (const [label, value] of [
    ["repository.full_name", run.repository?.full_name],
    ["head_repository.full_name", run.head_repository?.full_name],
  ]) {
    if (
      typeof value !== "string" ||
      value.toLowerCase() !== context.originRepo.toLowerCase()
    ) {
      errors.push(
        `${relativePath}: GitHub API ${label} must match ${context.originRepo}`,
      );
    }
  }
  if (
    typeof run.head_sha !== "string" ||
    run.head_sha.toLowerCase() !== context.expectedCommitSha.toLowerCase()
  ) {
    errors.push(
      `${relativePath}: GitHub API head_sha must match the current RC commit`,
    );
  }
  if (run.name !== expectedWorkflowName || runPath !== expectedWorkflowPath) {
    errors.push(
      `${relativePath}: GitHub API workflow name/path must match the Beta foundation workflow`,
    );
  }
  if (run.event !== evidence.run.event) {
    errors.push(`${relativePath}: GitHub API event must match run.event`);
  }
  if (run.status !== "completed" || run.conclusion !== "success") {
    errors.push(
      `${relativePath}: GitHub API workflow run must be completed successfully`,
    );
  }

  const matchingJobs = jobs.filter((job) => job?.name === expectedJobName);
  if (matchingJobs.length !== 1) {
    errors.push(
      `${relativePath}: GitHub API must return exactly one ${expectedJobName} job`,
    );
  }
  const job = matchingJobs[0] ?? {};
  if (job.run_id !== evidence.run.runId) {
    errors.push(`${relativePath}: GitHub API job.run_id must match run.runId`);
  }
  if (
    typeof job.head_sha !== "string" ||
    job.head_sha.toLowerCase() !== context.expectedCommitSha.toLowerCase()
  ) {
    errors.push(
      `${relativePath}: GitHub API job.head_sha must match the current RC commit`,
    );
  }
  if (job.status !== "completed" || job.conclusion !== "success") {
    errors.push(
      `${relativePath}: GitHub API ${expectedJobName} job must be completed successfully`,
    );
  }
  if (
    job.workflow_name !== undefined &&
    job.workflow_name !== expectedWorkflowName
  ) {
    errors.push(
      `${relativePath}: GitHub API job.workflow_name must match ${expectedWorkflowName}`,
    );
  }
  if (!Array.isArray(job.labels) || !job.labels.includes("ubuntu-latest")) {
    errors.push(
      `${relativePath}: GitHub API job labels must include ubuntu-latest`,
    );
  }
  const jobSteps = Array.isArray(job.steps) ? job.steps : [];
  for (const stepName of requiredJobSteps) {
    const step = jobSteps.find((candidate) => candidate?.name === stepName);
    if (step?.status !== "completed" || step?.conclusion !== "success") {
      errors.push(
        `${relativePath}: GitHub API job step ${stepName} must be completed successfully`,
      );
    }
  }

  validateAttestedTimes(relativePath, evidence, run, job, context, errors);

  if (
    typeof attestation.workflowContent !== "string" ||
    sha256(attestation.workflowContent) !== context.expectedWorkflowSha256
  ) {
    errors.push(
      `${relativePath}: GitHub API workflow content at the RC commit must match the current workflow SHA-256`,
    );
  }

  return {
    source: "github-rest-api",
    repository: run.repository?.full_name ?? null,
    runId: run.id ?? null,
    jobId: job.id ?? null,
    headSha: run.head_sha ?? null,
    status: run.status ?? null,
    conclusion: run.conclusion ?? null,
    runStartedAt: run.run_started_at ?? null,
    jobCompletedAt: job.completed_at ?? null,
  };
}

function validateAttestedTimes(
  relativePath,
  evidence,
  run,
  job,
  context,
  errors,
) {
  const checkedAt = Date.parse(evidence.checkedAt);
  const now = context.now.getTime();
  const times = [
    ["run.created_at", run.created_at],
    ["run.run_started_at", run.run_started_at],
    ["job.started_at", job.started_at],
    ["job.completed_at", job.completed_at],
  ];
  const parsed = new Map();
  for (const [label, value] of times) {
    if (!isIsoDate(value)) {
      errors.push(
        `${relativePath}: GitHub API ${label} must be an ISO timestamp`,
      );
      continue;
    }
    const timestamp = Date.parse(value);
    parsed.set(label, timestamp);
    if (timestamp > now + maximumClockSkewMs) {
      errors.push(
        `${relativePath}: GitHub API ${label} must not be in the future`,
      );
    }
  }

  const startedAt = parsed.get("job.started_at");
  const completedAt = parsed.get("job.completed_at");
  if (
    Number.isFinite(startedAt) &&
    Number.isFinite(completedAt) &&
    completedAt < startedAt
  ) {
    errors.push(
      `${relativePath}: GitHub API job completion must not precede job start`,
    );
  }
  if (
    Number.isFinite(completedAt) &&
    Number.isFinite(checkedAt) &&
    checkedAt + maximumClockSkewMs < completedAt
  ) {
    errors.push(
      `${relativePath}: evidence checkedAt must be at or after the attested job completion`,
    );
  }
}

function validateVerifierSnapshot(
  relativePath,
  snapshot = {},
  context,
  errors,
) {
  if (snapshot.source !== "hosted-ci-beta-foundation-verifier-policy") {
    errors.push(
      `${relativePath}: verifierSnapshot.source must be hosted-ci-beta-foundation-verifier-policy`,
    );
  }
  const files = Array.isArray(snapshot.files) ? snapshot.files : [];
  if (files.length !== context.expectedVerifierSnapshot.length) {
    errors.push(
      `${relativePath}: verifierSnapshot.files must include the current hosted CI verifier policy files`,
    );
  }
  const expectedFiles = new Set(
    context.expectedVerifierSnapshot.map((entry) => entry.file),
  );
  const actualFiles = new Set();
  for (const entry of files) {
    if (actualFiles.has(entry?.file)) {
      errors.push(
        `${relativePath}: verifierSnapshot.files contains duplicate file ${entry?.file}`,
      );
    }
    actualFiles.add(entry?.file);
    if (!expectedFiles.has(entry?.file)) {
      errors.push(
        `${relativePath}: verifierSnapshot.files contains unexpected file ${entry?.file}`,
      );
    }
  }
  for (const expected of context.expectedVerifierSnapshot) {
    const actual = files.find((entry) => entry?.file === expected.file);
    if (!actual) {
      errors.push(
        `${relativePath}: verifierSnapshot.files missing ${expected.file}`,
      );
    } else if (actual.sha256 !== expected.sha256) {
      errors.push(
        `${relativePath}: verifierSnapshot.files ${expected.file} sha256 must match the current hosted CI verifier policy`,
      );
    }
  }
}

function validateEnvironment(relativePath, environment = {}, errors) {
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

function validateSteps(relativePath, steps = {}, errors) {
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

function validateRedaction(relativePath, redaction = {}, errors) {
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

function validateNoSecretMarkers(relativePath, raw, errors) {
  const forbiddenPatterns = [
    [
      "Authorization: Bearer ",
      /Authorization:\s*Bearer\s+[A-Za-z0-9._~+/=-]+/i,
    ],
    ["JWT", /\beyJhbGci[A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+){2}\b/],
    ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
    ["Stripe secret key", /\bsk_(?:live|test)_[A-Za-z0-9]{8,}/],
    ["Stripe publishable key", /\bpk_(?:live|test)_[A-Za-z0-9]{8,}/],
    ["Stripe webhook secret", /\bwhsec_[A-Za-z0-9]{8,}/],
    ["Stripe client secret", /\bpi_[A-Za-z0-9_]+_secret_[A-Za-z0-9_]+/],
    [
      "Stripe secret assignment",
      /\bSTRIPE_(?:SECRET_KEY|WEBHOOK_SECRET|PUBLISHABLE_KEY)\s*=/i,
    ],
    [
      "Privy secret marker",
      /\bPRIVY_(?:APP_SECRET|VERIFICATION_KEY|ACCESS_TOKEN)\b/i,
    ],
    [
      "staging admin token assignment",
      /\b(?:STAGING_ADMIN_ACCESS_TOKEN|FANPASS_STAGING_ADMIN_ACCESS_TOKEN)\s*=/i,
    ],
    [
      "testnet operator private key assignment",
      /\bTESTNET_OPERATOR_PRIVATE_KEY\s*=/i,
    ],
    ["database URL", /\bDATABASE_URL\s*=\s*(?:postgres|postgresql):\/\//i],
    [
      "deployment or cloud credential assignment",
      /\b(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)\s*=\s*(?!<)[^\s"']{8,}/i,
    ],
    [
      "deployment or cloud credential field",
      /"(?:awsAccessKeyId|awsSecretAccessKey|awsSessionToken|googleApplicationCredentialsJson|googleCredentials|gcpServiceAccountKey|vercelToken|githubToken|ghToken|netlifyAuthToken|cloudflareApiToken|cfApiToken|cloudflareApiKey|cfApiKey)"\s*:\s*"(?!<)[^"]{8,}"/i,
    ],
    [
      "deployment or cloud credential environment field",
      /"(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)"\s*:\s*"(?!<)[^"]{8,}"/,
    ],
    ["GitHub secrets context", /\bsecrets\./i],
    [
      "CI secret masking command literal",
      /(?:::add-mask::(?!<|\$\{|\*\*\*|redacted\b)[^\r\n]{8,}|::set-secret\s+name=[^:\r\n]+::(?!<|\$\{|\*\*\*|redacted\b)[^\r\n]{8,}|##vso\[task\.setvariable[^\]\r\n]*issecret=true[^\]\r\n]*\](?!<|\$\{|\*\*\*|redacted\b)[^\r\n]{8,})/i,
    ],
  ];
  for (const [label, pattern] of forbiddenPatterns) {
    if (pattern.test(raw)) {
      errors.push(
        `${relativePath}: evidence must not include secret marker ${label}`,
      );
    }
  }
}

function extractJsonObject(relativePath, raw, errors) {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    errors.push(`${relativePath}: evidence does not contain a JSON object`);
    return null;
  }
  try {
    return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
  } catch (error) {
    errors.push(
      `${relativePath}: could not parse evidence JSON: ${safeError(error)}`,
    );
    return null;
  }
}

function createGitHubAttestationProvider({
  token,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Node.js fetch is required for GitHub API attestation");
  }

  return async ({ repo, runId, commitSha }) => {
    const base = `https://api.github.com/repos/${encodeRepository(repo)}`;
    const run = await githubJson(
      `${base}/actions/runs/${runId}`,
      token,
      fetchImpl,
      "workflow run",
    );
    const jobs = [];
    let page = 1;
    let totalCount = 0;
    do {
      const response = await githubJson(
        `${base}/actions/runs/${runId}/jobs?per_page=100&page=${page}`,
        token,
        fetchImpl,
        "workflow jobs",
      );
      if (!Array.isArray(response.jobs)) {
        throw new Error("GitHub API workflow jobs response was malformed");
      }
      jobs.push(...response.jobs);
      totalCount = Number.isSafeInteger(response.total_count)
        ? response.total_count
        : jobs.length;
      page += 1;
    } while (jobs.length < totalCount && page <= 100);
    if (jobs.length < totalCount) {
      throw new Error("GitHub API workflow jobs pagination was incomplete");
    }

    const workflowContent = await githubText(
      `${base}/contents/${expectedWorkflowPath}?ref=${encodeURIComponent(commitSha)}`,
      token,
      fetchImpl,
      "workflow content",
    );
    return { run, jobs, workflowContent };
  };
}

async function githubJson(url, token, fetchImpl, resource) {
  const response = await githubRequest(url, token, fetchImpl, resource, false);
  try {
    return await response.json();
  } catch {
    throw new Error(`GitHub API ${resource} response was not valid JSON`);
  }
}

async function githubText(url, token, fetchImpl, resource) {
  const response = await githubRequest(url, token, fetchImpl, resource, true);
  return response.text();
}

async function githubRequest(url, token, fetchImpl, resource, raw) {
  const headers = {
    Accept: raw
      ? "application/vnd.github.raw+json"
      : "application/vnd.github+json",
    "User-Agent": "fanpass-hosted-ci-evidence-audit",
    "X-GitHub-Api-Version": githubApiVersion,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new Error(
      `GitHub API ${resource} request failed: ${safeError(error)}`,
    );
  }
  if (!response.ok) {
    const permissionHint = [401, 403, 404].includes(response.status)
      ? "; private repositories require a token with Actions: read and Contents: read"
      : "";
    throw new Error(
      `GitHub API ${resource} request returned HTTP ${response.status}${permissionHint}`,
    );
  }
  return response;
}

function resolveGitHubToken() {
  const environmentToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (environmentToken) {
    return environmentToken.trim();
  }
  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    }).trim();
  } catch {
    return "";
  }
}

function parseGitHubRepository(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  const scpMatch = /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(
    trimmed,
  );
  if (scpMatch) {
    return `${scpMatch[1]}/${scpMatch[2]}`;
  }
  try {
    const url = new URL(trimmed);
    if (url.hostname.toLowerCase() !== "github.com") {
      return null;
    }
    const match = /^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url.pathname);
    return match ? `${match[1]}/${match[2]}` : null;
  } catch {
    return null;
  }
}

function parseGitHubActionsRunUrl(value) {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "github.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    const match = /^\/([^/]+)\/([^/]+)\/actions\/runs\/(\d+)\/?$/.exec(
      url.pathname,
    );
    if (!match) {
      return null;
    }
    const runId = Number(match[3]);
    if (!Number.isSafeInteger(runId) || runId <= 0) {
      return null;
    }
    return { repo: `${match[1]}/${match[2]}`, runId };
  } catch {
    return null;
  }
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

function encodeRepository(repo) {
  return repo.split("/").map(encodeURIComponent).join("/");
}

function git(repositoryRoot, args) {
  try {
    return execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error(`could not run git ${args.join(" ")}`);
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

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function safeError(error) {
  if (error && typeof error.message === "string") {
    return error.message.replace(/[\r\n]+/g, " ").slice(0, 400);
  }
  return "unknown error";
}

module.exports = {
  auditEvidenceText,
  createAuditContext,
  createGitHubAttestationProvider,
  parseGitHubActionsRunUrl,
  parseGitHubRepository,
  validateGitHubAttestation,
};
