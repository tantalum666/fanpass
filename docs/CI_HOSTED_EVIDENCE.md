# CI Hosted Evidence

FanPass has a static GitHub Actions workflow audit for the Node 22 Beta foundation gates, but external Beta decisions also need saved evidence that the workflow actually ran on hosted CI. Do not close hosted CI evidence with local terminal output, screenshots that omit the run metadata, forked-run output, failed runs, or logs containing credentials.

Run future saved evidence through:

```bash
npm run security:ci-hosted:evidence -- <saved-json-output>
```

The validator accepts progress-log text around the JSON object, but the saved file must not include bearer tokens, Stripe secrets, Privy secrets, private keys, staging admin tokens, database URLs, provider secrets, deployment/cloud credentials, CI secret masking command literals, or production credentials.

Required JSON shape:

```json
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "provider": "github-actions-hosted-ci",
  "localDryRun": false,
  "realUserDataUsed": false,
  "productionCredentialsUsed": false,
  "run": {
    "workflowName": "FanPass Beta Foundation",
    "workflowPath": ".github/workflows/beta-foundation.yml",
    "workflowSha256": "26a201f6fe18ce2a3dcba873ec52a09ad90a85255164fb9a639a67f23615ce1a",
    "jobName": "Node 22 foundation gates",
    "runUrl": "https://github.com/example/fanpass/actions/runs/123456789",
    "runId": 123456789,
    "commitSha": "1111111111111111111111111111111111111111",
    "event": "push",
    "conclusion": "success",
    "fromFork": false
  },
  "environment": {
    "runner": "ubuntu-latest",
    "nodeVersion": "22.22.3",
    "nodeVersionSource": ".nvmrc",
    "strictNodeRuntime": true,
    "postgresService": "postgres:16-alpine",
    "postgresHealthy": true,
    "npmInstallCommand": "npm ci",
    "providerSecretsAvailable": false,
    "deploymentCredentialsAvailable": false
  },
  "verifierSnapshot": {
    "source": "hosted-ci-beta-foundation-verifier-policy",
    "files": [
      {
        "file": ".github/workflows/beta-foundation.yml",
        "sha256": "<current sha256>"
      },
      {
        "file": ".nvmrc",
        "sha256": "<current sha256>"
      },
      {
        "file": ".npmrc",
        "sha256": "<current sha256>"
      },
      {
        "file": "package.json",
        "sha256": "<current sha256>"
      },
      {
        "file": "package-lock.json",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/beta-foundation-verify.sh",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/ci-node22-workflow-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/ci-hosted-evidence-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/ci-hosted-evidence-audit-self-test.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "docs/CI_HOSTED_EVIDENCE.md",
        "sha256": "<current sha256>"
      }
    ]
  },
  "steps": {
    "checkoutSucceeded": true,
    "setupNodeFromNvmrcSucceeded": true,
    "npmCiSucceeded": true,
    "betaFoundationVerifySucceeded": true,
    "dependencyAdvisoryGateRan": true,
    "apiUnitTestsPassed": true,
    "sideEffectHealthPassed": true,
    "apiTestSuites": 12,
    "apiTests": 59
  },
  "redaction": {
    "providerSecretsRedacted": true,
    "databaseUrlRedacted": true,
    "bearerTokensRedacted": true,
    "privyTokensRedacted": true,
    "stripeSecretsRedacted": true,
    "privateKeysRedacted": true,
    "deploymentCredentialsRedacted": true,
    "ciSecretMaskingCommandsRedacted": true,
    "noProductionCredentialsInLogs": true
  }
}
```

Release rule:

- `localDryRun` must be `false`; local Node 22 output cannot close hosted CI evidence.
- The run must be a successful `FanPass Beta Foundation` GitHub Actions run on `ubuntu-latest`, linked by an HTTPS `github.com/.../actions/runs/...` URL.
- The run must prove it used `.github/workflows/beta-foundation.yml` at the current workflow SHA-256, so stale or renamed workflow evidence cannot close the hosted CI blocker after workflow changes.
- The job must use Node 22 from `.nvmrc`, `npm ci`, strict Node runtime mode, and a healthy `postgres:16-alpine` service.
- The evidence must include `verifierSnapshot.source: "hosted-ci-beta-foundation-verifier-policy"` with current SHA-256 entries for the workflow, `.nvmrc`, `.npmrc`, root package manifest and lockfile, composite Beta verifier, CI workflow audit, hosted CI evidence validator/self-test, and this evidence contract document. Regenerate hosted CI evidence after any of those files changes.
- The run must execute `npm run beta:foundation:verify`, including the dependency advisory gate, side-effect health gate, and the current API unit-test proof of 12 suites / 59 tests.
- Hosted CI evidence must not depend on provider secrets, deployment/cloud credentials, CI masking command captures with literal values, or production credentials.
