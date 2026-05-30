const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(rootDir, "scripts/ci-hosted-evidence-audit.js");
const workflowPath = ".github/workflows/beta-foundation.yml";
const workflowSha256 = crypto
  .createHash("sha256")
  .update(fs.readFileSync(path.join(rootDir, workflowPath)))
  .digest("hex");
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
const verifierSnapshot = verifierSnapshotFiles.map((file) => ({
  file,
  sha256: crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(rootDir, file)))
    .digest("hex"),
}));
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "fanpass-ci-hosted-evidence-"),
);
const cases = [];
const errors = [];

try {
  expectPass(
    "accepts complete hosted GitHub Actions evidence",
    writeEvidence("valid.txt", withProgressText(createEvidence())),
  );

  expectFail(
    "rejects local dry-run and failed run evidence",
    writeEvidence(
      "local-failed.txt",
      withProgressText(
        createEvidence({
          localDryRun: true,
          run: {
            conclusion: "failure",
            fromFork: true,
          },
        }),
      ),
    ),
    [
      "localDryRun must be false",
      "run.conclusion must be success",
      "run.fromFork must be false",
    ],
  );

  expectFail(
    "rejects stale workflow file proof",
    writeEvidence(
      "stale-workflow-proof.txt",
      withProgressText(
        createEvidence({
          run: {
            workflowPath: ".github/workflows/old-beta-foundation.yml",
            workflowSha256:
              "2222222222222222222222222222222222222222222222222222222222222222",
          },
        }),
      ),
    ),
    [
      "run.workflowPath must be .github/workflows/beta-foundation.yml",
      "run.workflowSha256 must match the current .github/workflows/beta-foundation.yml SHA-256",
    ],
  );

  expectFail(
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

  expectFail(
    "rejects stale hosted CI verifier policy snapshot",
    writeEvidence(
      "stale-verifier-snapshot.txt",
      withProgressText(
        createEvidence({
          verifierSnapshot: {
            source: "old-hosted-ci-policy",
            files: [
              {
                file: ".github/workflows/beta-foundation.yml",
                sha256:
                  "2222222222222222222222222222222222222222222222222222222222222222",
              },
              {
                file: "unexpected-ci-policy.txt",
                sha256:
                  "3333333333333333333333333333333333333333333333333333333333333333",
              },
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

  expectFail(
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

  expectFail(
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
      "steps.apiTestSuites must be 11",
      "steps.apiTests must be 57",
    ],
  );

  expectFail(
    "rejects leaked provider secret markers",
    writeEvidence(
      "secret-markers.txt",
      `${withProgressText(createEvidence())}\nSTRIPE_SECRET_KEY=sk_test_123\nAuthorization: Bearer eyJhbGci\n`,
    ),
    ["Stripe secret assignment", "Authorization: Bearer "],
  );

  expectFail(
    "rejects leaked publishable key and database URL markers",
    writeEvidence(
      "publishable-key-database-url.txt",
      `${withProgressText(createEvidence())}\nSTRIPE_PUBLISHABLE_KEY=pk_test_fixturepublishable1234\nDATABASE_URL=postgres://fixture:secret@db/fanpass\n`,
    ),
    ["Stripe publishable key", "database URL"],
  );

  expectFail(
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

  expectFail(
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

  expectFail(
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

  expectFail(
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

  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, cases }, null, 2));
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

function createEvidence(overrides = {}) {
  return deepMerge(
    {
      ok: true,
      checkedAt: "2026-05-30T00:00:00.000Z",
      provider: "github-actions-hosted-ci",
      localDryRun: false,
      realUserDataUsed: false,
      productionCredentialsUsed: false,
      run: {
        workflowName: "FanPass Beta Foundation",
        workflowPath,
        workflowSha256,
        jobName: "Node 22 foundation gates",
        runUrl: "https://github.com/example/fanpass/actions/runs/123456789",
        runId: 123456789,
        commitSha: "1111111111111111111111111111111111111111",
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
        apiTestSuites: 11,
        apiTests: 57,
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

function expectPass(label, filePath) {
  const result = runAudit(filePath);
  cases.push({ label, expected: "pass", status: result.status });
  if (result.status !== 0) {
    errors.push(
      `${label}: expected pass, got ${result.status}: ${result.stderr || result.stdout}`,
    );
  }
}

function expectFail(label, filePath, requiredMessages) {
  const result = runAudit(filePath);
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

function runAudit(filePath) {
  return spawnSync(process.execPath, [auditScript, filePath], {
    cwd: rootDir,
    encoding: "utf8",
  });
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
