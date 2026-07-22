const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  auditEvidenceText,
  createAuditContext,
  createGitHubAttestationProvider,
} = require("./ci-hosted-evidence-audit");

const rootDir = path.resolve(__dirname, "..");
const workflowPath = ".github/workflows/beta-foundation.yml";
const workflowContent = fs.readFileSync(path.join(rootDir, workflowPath));
const workflowSha256 = sha256(workflowContent);
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
const verifierSnapshot = verifierSnapshotFiles.map((file) => ({
  file,
  sha256: sha256(fs.readFileSync(path.join(rootDir, file))),
}));
const context = createAuditContext(rootDir, {
  workingTreeClean: true,
  now: new Date("2026-07-22T12:00:00.000Z"),
});
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-ci-hosted-evidence-"),
);
const cases = [];
const errors = [];

main().catch((error) => {
  errors.push(`self-test failed unexpectedly: ${error.message}`);
  finish();
});

async function main() {
  try {
    await expectPass(
      "accepts GitHub-API-attested evidence for the origin RC commit",
      writeEvidence("valid.txt", withProgressText(createEvidence())),
    );

    await expectGitHubProviderPass();

    await expectFail(
      "rejects local dry-run and failed run evidence",
      writeEvidence(
        "local-failed.txt",
        withProgressText(
          createEvidence({
            localDryRun: true,
            run: { conclusion: "failure", fromFork: true },
          }),
        ),
      ),
      [
        "localDryRun must be false",
        "run.conclusion must be success",
        "run.fromFork must be false",
      ],
    );

    await expectFail(
      "rejects stale workflow file proof",
      writeEvidence(
        "stale-workflow-proof.txt",
        withProgressText(
          createEvidence({
            run: {
              workflowPath: ".github/workflows/old-beta-foundation.yml",
              workflowSha256: "2".repeat(64),
            },
          }),
        ),
      ),
      [
        "run.workflowPath must be .github/workflows/beta-foundation.yml",
        "run.workflowSha256 must match the current .github/workflows/beta-foundation.yml SHA-256",
      ],
    );

    await expectFail(
      "rejects an Actions URL for an unrelated repository",
      writeEvidence(
        "unrelated-repository.txt",
        withProgressText(
          createEvidence({
            run: {
              runUrl:
                "https://github.com/attacker-controlled/fanpass/actions/runs/123456789",
            },
          }),
        ),
      ),
      ["run.runUrl repository must match remote.origin.url"],
    );

    await expectFail(
      "rejects a run URL whose id disagrees with runId",
      writeEvidence(
        "run-url-id-mismatch.txt",
        withProgressText(
          createEvidence({
            run: {
              runUrl: `https://github.com/${context.originRepo}/actions/runs/987654321`,
            },
          }),
        ),
      ),
      ["run.runUrl id must match run.runId"],
    );

    await expectFail(
      "rejects an arbitrary commit instead of the current RC commit",
      writeEvidence(
        "arbitrary-commit.txt",
        withProgressText(
          createEvidence({ run: { commitSha: "2".repeat(40) } }),
        ),
      ),
      ["run.commitSha must match the current RC commit"],
    );

    await expectFail(
      "rejects a future evidence timestamp",
      writeEvidence(
        "future-time.txt",
        withProgressText(
          createEvidence({ checkedAt: "2999-01-01T00:00:00.000Z" }),
        ),
      ),
      ["evidence checkedAt must not be in the future"],
    );

    await expectFail(
      "rejects a dirty tree that is not fully bound to the RC commit",
      writeEvidence("dirty-tree.txt", withProgressText(createEvidence())),
      ["working tree must be clean"],
      { contextOverrides: { workingTreeClean: false } },
    );

    await expectFail(
      "rejects API metadata for a different repository",
      writeEvidence("api-repository.txt", withProgressText(createEvidence())),
      ["GitHub API repository.full_name must match"],
      {
        attestationOverrides: {
          run: { repository: { full_name: "attacker-controlled/fanpass" } },
        },
      },
    );

    await expectFail(
      "rejects API run id and URL disagreement",
      writeEvidence("api-run-id.txt", withProgressText(createEvidence())),
      [
        "GitHub API run.id must match run.runId",
        "GitHub API run URL must match origin repository and runId",
      ],
      {
        attestationOverrides: {
          run: {
            id: 987654321,
            html_url: `https://github.com/${context.originRepo}/actions/runs/987654321`,
          },
        },
      },
    );

    await expectFail(
      "rejects API head SHA for an old or arbitrary commit",
      writeEvidence("api-head-sha.txt", withProgressText(createEvidence())),
      [
        "GitHub API head_sha must match the current RC commit",
        "GitHub API job.head_sha must match the current RC commit",
      ],
      {
        attestationOverrides: {
          run: { head_sha: "3".repeat(40) },
          jobs: [{ head_sha: "3".repeat(40) }],
        },
      },
    );

    await expectFail(
      "rejects API workflow, job conclusion, and future time mismatches",
      writeEvidence("api-job.txt", withProgressText(createEvidence())),
      [
        "GitHub API workflow name/path must match",
        "job must be completed successfully",
        "job.completed_at must not be in the future",
      ],
      {
        attestationOverrides: {
          run: { name: "Unrelated workflow" },
          jobs: [
            {
              status: "completed",
              conclusion: "failure",
              completed_at: "2999-01-01T00:00:00.000Z",
            },
          ],
        },
      },
    );

    await expectFail(
      "rejects missing successful critical workflow step attestation",
      writeEvidence("api-step.txt", withProgressText(createEvidence())),
      [
        "GitHub API job step Verify Beta foundation must be completed successfully",
      ],
      {
        attestationOverrides: {
          jobs: [
            {
              steps: [
                {
                  name: "Verify Beta foundation",
                  status: "completed",
                  conclusion: "failure",
                },
              ],
            },
          ],
        },
      },
    );

    await expectFail(
      "rejects a failed top-level Node setup step",
      writeEvidence("api-node-step.txt", withProgressText(createEvidence())),
      ["GitHub API job step Setup Node 22 must be completed successfully"],
      {
        attestationOverrides: {
          jobs: [
            {
              steps: [
                {
                  name: "Checkout",
                  status: "completed",
                  conclusion: "success",
                },
                {
                  name: "Setup Node 22",
                  status: "completed",
                  conclusion: "failure",
                },
                {
                  name: "Verify Beta foundation",
                  status: "completed",
                  conclusion: "success",
                },
              ],
            },
          ],
        },
      },
    );

    await expectFail(
      "rejects workflow content not attested at the RC commit",
      writeEvidence(
        "api-workflow-content.txt",
        withProgressText(createEvidence()),
      ),
      ["GitHub API workflow content at the RC commit must match"],
      { attestationOverrides: { workflowContent: "tampered workflow" } },
    );

    const unavailableProvider = createGitHubAttestationProvider({
      token: "",
      fetchImpl: async () => {
        throw new Error("simulated network unavailable");
      },
    });
    await expectFail(
      "fails closed when GitHub API attestation is unavailable",
      writeEvidence("api-unavailable.txt", withProgressText(createEvidence())),
      ["GitHub API attestation unavailable; evidence remains untrusted"],
      { attest: unavailableProvider },
    );

    await expectFail(
      "rejects non-Node-22 or non-nvmrc evidence",
      writeEvidence(
        "wrong-node.txt",
        withProgressText(
          createEvidence({
            environment: {
              nodeVersion: "26.0.0",
              nodeVersionSource: "manual",
              strictNodeRuntime: false,
            },
          }),
        ),
      ),
      [
        "environment.nodeVersion must start with 22.",
        "environment.nodeVersionSource must be .nvmrc",
        "environment.strictNodeRuntime must be true",
      ],
    );

    await expectFail(
      "rejects stale hosted CI verifier policy snapshot",
      writeEvidence(
        "stale-verifier-snapshot.txt",
        withProgressText(
          createEvidence({
            verifierSnapshot: {
              source: "old-hosted-ci-policy",
              files: [
                {
                  file: workflowPath,
                  sha256: "2".repeat(64),
                },
                { file: "unexpected-ci-policy.txt", sha256: "3".repeat(64) },
              ],
            },
          }),
        ),
      ),
      [
        "verifierSnapshot.source must be hosted-ci-beta-foundation-verifier-policy",
        "verifierSnapshot.files must include the current hosted CI verifier policy files",
        "verifierSnapshot.files contains unexpected file unexpected-ci-policy.txt",
        "verifierSnapshot.files .github/workflows/beta-foundation.yml sha256 must match the current hosted CI verifier policy",
        "verifierSnapshot.files missing .nvmrc",
      ],
    );

    await expectFail(
      "rejects a hosted snapshot missing the reviewed launcher",
      writeEvidence(
        "missing-launcher-snapshot.txt",
        withProgressText(
          createEvidence({
            verifierSnapshot: {
              files: verifierSnapshot.filter(
                ({ file }) => file !== "scripts/beta-foundation-launcher.js",
              ),
            },
          }),
        ),
      ),
      [
        "verifierSnapshot.files must include the current hosted CI verifier policy files",
        "verifierSnapshot.files missing scripts/beta-foundation-launcher.js",
      ],
    );

    await expectFail(
      "rejects a stale hosted bootstrap snapshot",
      writeEvidence(
        "stale-bootstrap-snapshot.txt",
        withProgressText(
          createEvidence({
            verifierSnapshot: {
              files: verifierSnapshot.map((entry) =>
                entry.file === "scripts/lib/beta-foundation-bootstrap.js"
                  ? { ...entry, sha256: "2".repeat(64) }
                  : entry,
              ),
            },
          }),
        ),
      ),
      [
        "verifierSnapshot.files scripts/lib/beta-foundation-bootstrap.js sha256 must match the current hosted CI verifier policy",
      ],
    );

    await expectFail(
      "rejects missing hosted CI infrastructure proof",
      writeEvidence(
        "missing-ci-infra.txt",
        withProgressText(
          createEvidence({
            environment: {
              runner: "macos-latest",
              postgresService: "none",
              postgresHealthy: false,
              npmInstallCommand: "npm install",
            },
          }),
        ),
      ),
      [
        "environment.runner must be ubuntu-latest",
        "environment.postgresService must be postgres:16-alpine",
        "environment.postgresHealthy must be true",
        "environment.npmInstallCommand must be npm ci",
      ],
    );

    await expectFail(
      "rejects missing verifier and API test proof",
      writeEvidence(
        "missing-verifier.txt",
        withProgressText(
          createEvidence({
            steps: {
              betaFoundationVerifySucceeded: false,
              dependencyAdvisoryGateRan: false,
              apiUnitTestsPassed: false,
              apiTestSuites: 10,
              apiTests: 56,
            },
          }),
        ),
      ),
      [
        "steps.betaFoundationVerifySucceeded must be true",
        "steps.dependencyAdvisoryGateRan must be true",
        "steps.apiUnitTestsPassed must be true",
        "steps.apiTestSuites must be 32",
        "steps.apiTests must be 386",
      ],
    );

    await expectFail(
      "rejects leaked provider secret markers",
      writeEvidence(
        "secret-markers.txt",
        `${withProgressText(createEvidence())}\nSTRIPE_SECRET_KEY=sk_test_123\nAuthorization: Bearer eyJhbGci\n`,
      ),
      ["Stripe secret assignment", "Authorization: Bearer "],
    );

    await expectFail(
      "rejects leaked publishable key and database URL markers",
      writeEvidence(
        "publishable-key-database-url.txt",
        `${withProgressText(createEvidence())}\nSTRIPE_PUBLISHABLE_KEY=pk_test_fixturepublishable1234\nDATABASE_URL=postgres://fixture:secret@db/fanpass\n`,
      ),
      ["Stripe publishable key", "database URL"],
    );

    await expectFail(
      "rejects leaked deployment and cloud credential markers",
      writeEvidence(
        "deployment-cloud-credentials.txt",
        [
          withProgressText(createEvidence()),
          "VERCEL_TOKEN=fixture-vercel-deploy-token",
          "AWS_SECRET_ACCESS_KEY=fixture-aws-secret-key",
          JSON.stringify({
            CLOUDFLARE_API_TOKEN: "fixture-cloudflare-token",
            githubToken: "fixture-github-token",
          }),
        ].join("\n"),
      ),
      [
        "deployment or cloud credential assignment",
        "deployment or cloud credential field",
        "deployment or cloud credential environment field",
      ],
    );

    await expectFail(
      "rejects CI secret masking command literals",
      writeEvidence(
        "ci-secret-mask-commands.txt",
        [
          withProgressText(createEvidence()),
          "::add-mask::fixture-github-mask-secret",
          "::set-secret name=FANPASS_TOKEN::fixture-github-set-secret",
          "##vso[task.setvariable variable=FANPASS_TOKEN;issecret=true]fixture-azure-pipelines-secret",
        ].join("\n"),
      ),
      ["CI secret masking command literal"],
    );

    await expectFail(
      "rejects production credential or secret availability evidence",
      writeEvidence(
        "production-secrets.txt",
        withProgressText(
          createEvidence({
            productionCredentialsUsed: true,
            environment: {
              providerSecretsAvailable: true,
              deploymentCredentialsAvailable: true,
            },
          }),
        ),
      ),
      [
        "productionCredentialsUsed must be false",
        "environment.providerSecretsAvailable must be false",
        "environment.deploymentCredentialsAvailable must be false",
      ],
    );

    await expectFail(
      "rejects missing log redaction proof",
      writeEvidence(
        "missing-redaction.txt",
        withProgressText(
          createEvidence({
            redaction: {
              databaseUrlRedacted: false,
              bearerTokensRedacted: false,
              deploymentCredentialsRedacted: false,
              ciSecretMaskingCommandsRedacted: false,
              noProductionCredentialsInLogs: false,
            },
          }),
        ),
      ),
      [
        "redaction.databaseUrlRedacted must be true",
        "redaction.bearerTokensRedacted must be true",
        "redaction.deploymentCredentialsRedacted must be true",
        "redaction.ciSecretMaskingCommandsRedacted must be true",
        "redaction.noProductionCredentialsInLogs must be true",
      ],
    );
  } finally {
    finish();
  }
}

function createEvidence(overrides = {}) {
  return deepMerge(
    {
      ok: true,
      checkedAt: "2026-07-21T00:10:00.000Z",
      provider: "github-actions-hosted-ci",
      localDryRun: false,
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      run: {
        workflowName: "FanPass Beta Foundation",
        workflowPath,
        workflowSha256,
        jobName: "Node 22 foundation gates",
        runUrl: `https://github.com/${context.originRepo}/actions/runs/123456789`,
        runId: 123456789,
        commitSha: context.expectedCommitSha,
        event: "push",
        conclusion: "success",
        fromFork: false,
      },
      environment: {
        runner: "ubuntu-latest",
        nodeVersion: "22.22.3",
        nodeVersionSource: ".nvmrc",
        strictNodeRuntime: true,
        postgresService: "postgres:16-alpine",
        postgresHealthy: true,
        npmInstallCommand: "npm ci",
        providerSecretsAvailable: false,
        deploymentCredentialsAvailable: false,
      },
      verifierSnapshot: {
        source: "hosted-ci-beta-foundation-verifier-policy",
        files: verifierSnapshot,
      },
      steps: {
        checkoutSucceeded: true,
        setupNodeFromNvmrcSucceeded: true,
        npmCiSucceeded: true,
        betaFoundationVerifySucceeded: true,
        dependencyAdvisoryGateRan: true,
        apiUnitTestsPassed: true,
        sideEffectHealthPassed: true,
        apiTestSuites: 32,
        apiTests: 386,
      },
      redaction: {
        providerSecretsRedacted: true,
        databaseUrlRedacted: true,
        bearerTokensRedacted: true,
        privyTokensRedacted: true,
        stripeSecretsRedacted: true,
        privateKeysRedacted: true,
        deploymentCredentialsRedacted: true,
        ciSecretMaskingCommandsRedacted: true,
        noProductionCredentialsInLogs: true,
      },
    },
    overrides,
  );
}

function createAttestation(overrides = {}) {
  const attestationOverrides = { ...overrides };
  const firstJobOverrides = Array.isArray(attestationOverrides.jobs)
    ? attestationOverrides.jobs[0]
    : null;
  delete attestationOverrides.jobs;
  const successfulSteps = [
    "Checkout",
    "Setup Node 22",
    "Verify Beta foundation",
  ].map((name) => ({ name, status: "completed", conclusion: "success" }));
  const attestation = deepMerge(
    {
      run: {
        id: 123456789,
        html_url: `https://github.com/${context.originRepo}/actions/runs/123456789`,
        name: "FanPass Beta Foundation",
        path: `${workflowPath}@refs/heads/codex/security-rc-20260720`,
        head_sha: context.expectedCommitSha,
        event: "push",
        status: "completed",
        conclusion: "success",
        created_at: "2026-07-21T00:00:00.000Z",
        run_started_at: "2026-07-21T00:00:10.000Z",
        updated_at: "2026-07-21T00:05:10.000Z",
        repository: { full_name: context.originRepo },
        head_repository: { full_name: context.originRepo },
      },
      jobs: [
        {
          id: 24680,
          run_id: 123456789,
          name: "Node 22 foundation gates",
          status: "completed",
          conclusion: "success",
          head_sha: context.expectedCommitSha,
          started_at: "2026-07-21T00:00:20.000Z",
          completed_at: "2026-07-21T00:05:00.000Z",
          workflow_name: "FanPass Beta Foundation",
          labels: ["ubuntu-latest"],
          steps: successfulSteps,
        },
      ],
      workflowContent: workflowContent.toString("utf8"),
    },
    attestationOverrides,
  );
  if (firstJobOverrides) {
    deepMerge(attestation.jobs[0], firstJobOverrides);
  }
  return attestation;
}

async function runAudit(filePath, options = {}) {
  const raw = fs.readFileSync(filePath, "utf8");
  const auditContext = { ...context, ...(options.contextOverrides ?? {}) };
  const attest =
    options.attest ??
    (async () => createAttestation(options.attestationOverrides ?? {}));
  const result = await auditEvidenceText({
    raw,
    relativePath: path.relative(rootDir, filePath),
    context: auditContext,
    attest,
  });
  return {
    status: result.errors.length === 0 ? 0 : 1,
    stderr: result.errors.join("\n"),
    stdout: JSON.stringify(result.summary),
  };
}

async function expectGitHubProviderPass() {
  const fixture = createAttestation();
  const requestedUrls = [];
  const provider = createGitHubAttestationProvider({
    token: "",
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      if (/\/actions\/runs\/123456789$/.test(url)) {
        return jsonResponse(fixture.run);
      }
      if (/\/actions\/runs\/123456789\/jobs\?/.test(url)) {
        return jsonResponse({ total_count: 1, jobs: fixture.jobs });
      }
      if (
        /\/contents\/\.github\/workflows\/beta-foundation\.yml\?ref=/.test(url)
      ) {
        return new Response(fixture.workflowContent, { status: 200 });
      }
      return new Response("not found", { status: 404 });
    },
  });
  let status = 0;
  try {
    const attestation = await provider({
      repo: context.originRepo,
      runId: 123456789,
      commitSha: context.expectedCommitSha,
    });
    if (
      attestation.run.id !== 123456789 ||
      attestation.jobs.length !== 1 ||
      attestation.workflowContent !== fixture.workflowContent ||
      requestedUrls.length !== 3
    ) {
      throw new Error(
        "GitHub provider did not return the expected attestation",
      );
    }
  } catch (error) {
    status = 1;
    errors.push(
      `fetches run, jobs, and workflow content through the GitHub API provider: ${error.message}`,
    );
  }
  cases.push({
    label:
      "fetches run, jobs, and workflow content through the GitHub API provider",
    expected: "pass",
    status,
  });
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function expectPass(label, filePath, options) {
  const result = await runAudit(filePath, options);
  cases.push({ label, expected: "pass", status: result.status });
  if (result.status !== 0) {
    errors.push(
      `${label}: expected pass, got ${result.status}: ${result.stderr || result.stdout}`,
    );
  }
}

async function expectFail(label, filePath, requiredMessages, options) {
  const result = await runAudit(filePath, options);
  cases.push({ label, expected: "fail", status: result.status });
  if (result.status === 0) {
    errors.push(`${label}: expected failure, got success`);
    return;
  }
  const output = `${result.stderr}\n${result.stdout}`;
  for (const message of requiredMessages) {
    if (!output.includes(message)) {
      errors.push(`${label}: failure output did not include ${message}`);
    }
  }
}

function withProgressText(evidence) {
  return [
    "Checking FanPass hosted CI evidence...",
    JSON.stringify(evidence, null, 2),
  ].join("\n");
}

function writeEvidence(fileName, contents) {
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function finish() {
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ ok: true, cases }, null, 2));
}
