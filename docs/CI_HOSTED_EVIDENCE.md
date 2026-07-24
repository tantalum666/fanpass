# CI Hosted Evidence

FanPass has a static GitHub Actions workflow audit for the Node 22 Beta foundation gates, but external Beta decisions also need saved evidence that the workflow actually ran on hosted CI. Do not close hosted CI evidence with local terminal output, screenshots that omit the run metadata, forked-run output, failed runs, or logs containing credentials.

Current RC status (2026-07-24): immutable commit `a25185d2747520303eac0fd2681017b5c35ac62b` is pushed on `codex/security-rc-20260720`. The authoritative local V4 gate passed 97/97 (API 32 suites/386 tests; contracts 30/30; independent final review 0 P0/P1), and the authenticated GitHub Actions UI shows `FanPass Beta Foundation` run `#92` completed successfully for that exact commit in 5m 9s. This browser observation proves the run exists, but it is not the validator-passing saved JSON attestation: the active CLI credential still receives 403 from Actions, Checks, and Status API reads. No PR, merge, or deploy occurred, and the post-RC QR-first working tree requires its own new commit and Hosted run before release.

Current saved evidence should live under `outputs/ci-hosted/` as a timestamped JSON file and pass `npm run security:ci-hosted:evidence -- <saved-json-output>` plus `npm run security:evidence-redaction`. The first command is an online attestation check, not an offline schema check: it derives the expected repository from `remote.origin.url`, requires a clean checkout at the exact RC commit, and verifies the run, job, critical job steps, and workflow content against the GitHub REST API. Regenerate this evidence after the RC commit, workflow, verifier, lockfile, Node/npm policy, or CI evidence contract changes.

Run future saved evidence through:

```bash
npm run security:ci-hosted:evidence -- <saved-json-output>
```

For a private repository, authenticate with `GITHUB_TOKEN`, `GH_TOKEN`, or the active `gh auth` keychain login. The credential needs read access to Actions and repository Contents. Keep the credential outside the saved evidence file; the validator never prints it. A missing credential, insufficient permission, GitHub API outage, timeout, or malformed API response fails closed and leaves the evidence untrusted. There is no offline mode that can close this release gate.

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
    "workflowSha256": "<current sha256>",
    "jobName": "Node 22 foundation gates",
    "runUrl": "https://github.com/<origin-owner>/<origin-repo>/actions/runs/123456789",
    "runId": 123456789,
    "commitSha": "<current clean RC commit SHA>",
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
        "file": "apps/api/package.json",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/dashboard/package.json",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/console-auth/package.json",
        "sha256": "<current sha256>"
      },
      {
        "file": "package-lock.json",
        "sha256": "<current sha256>"
      },
      {
        "file": "render.yaml",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/beta-foundation-launcher.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/beta-foundation-launcher-self-test.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/beta-foundation-verify.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/beta-foundation-verify-self-test.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/lib/beta-foundation-bootstrap.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/lib/beta-foundation-gate-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/ci-node22-workflow-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/render-rc-config-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/render-rc-config-audit-self-test.js",
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
    "apiTestSuites": 32,
    "apiTests": 386
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
- The working tree must be clean. `run.commitSha`, GitHub's attested workflow `head_sha`, and the attested job `head_sha` must all equal the current checkout's full RC commit SHA. This commit binding covers the verifier's transitive implementations instead of trusting a self-reported list alone.
- The run URL repository must exactly match the GitHub repository derived from `remote.origin.url`; the URL run number, saved `runId`, GitHub API run ID, API run URL, `repository.full_name`, and `head_repository.full_name` must agree. Fork and unrelated-repository runs are rejected.
- The run must be a successful, completed `FanPass Beta Foundation` GitHub Actions run. GitHub's API must return exactly one successful, completed `Node 22 foundation gates` job on `ubuntu-latest`, with successful attestations for the workflow's three real top-level steps: `Checkout`, `Setup Node 22`, and `Verify Beta foundation`. GitHub's job API does not expose the composite verifier's 97 internal commands as separate job steps; their execution is proved by the successful `Verify Beta foundation` step together with the attested workflow content and immutable commit binding.
- Before merge, push the immutable candidate on a branch matching `codex/security-rc-*` and record `event: "push"`; that reviewed branch filter creates a run whose attested `head_sha` is the exact RC commit. A pull-request run may use a generated merge SHA and is not a substitute unless GitHub's attested `head_sha` equals the clean immutable RC checkout exactly. `workflow_dispatch` remains available after this trigger exists on the default branch, but GitHub only receives manual-dispatch events for workflow definitions present on the default branch, so it is not the bootstrap path for this first RC.
- The run must prove it used `.github/workflows/beta-foundation.yml` at the current workflow SHA-256, so stale or renamed workflow evidence cannot close the hosted CI blocker after workflow changes.
- The validator downloads `.github/workflows/beta-foundation.yml` from GitHub at the attested RC commit and verifies its SHA-256 against the clean checkout; saved workflow hashes alone are not trusted.
- `checkedAt` and the GitHub run/job timestamps must be valid, non-future ISO timestamps. The saved check time cannot precede the attested job completion beyond the allowed clock skew.
- The job must use Node 22 from `.nvmrc`, `npm ci`, strict Node runtime mode, and a healthy `postgres:16-alpine` service.
- The composite verifier must generate the API Prisma Client before Jest-backed audits run, so hosted CI starts from a clean `npm ci` workspace instead of relying on a previously generated local client.
- The evidence must include `verifierSnapshot.source: "hosted-ci-beta-foundation-verifier-policy"` with current SHA-256 entries for the workflow, `.nvmrc`, `.npmrc`, all four package manifests and the root lockfile, `render.yaml`, launcher/self-test, bootstrap, parser, composite runner/self-test, CI workflow audit, Render RC configuration audit/self-test, hosted CI evidence validator/self-test, and this evidence contract document. Regenerate hosted CI evidence after any of those files changes.
- The run must execute the audited launcher-digest check, setup-node realpath, and `/usr/bin/env -i` bootstrap in `.github/workflows/beta-foundation.yml`. It starts `scripts/beta-foundation-launcher.js` only after Node preload variables are removed; that launcher captures and validates the exact runner and local PostgreSQL target-guard bytes plus all four complete package-script maps, then compiles those reviewed bytes inside the same Node CommonJS process without reopening either path. The AST parser remains a review/self-test tool and cannot choose the production execution list. The composite includes the dependency advisory gate, the hermetic PostgreSQL side-effect health gates, and the current API unit-test proof of 32 passing suites / 386 passing tests. The three database-only suites remain opt-in inside the default Jest command; the PostgreSQL health-store suite is executed separately by the composite verifier.
- Hosted CI evidence must not depend on provider secrets, deployment/cloud credentials, CI masking command captures with literal values, or production credentials.

The saved June 2026 run is historical evidence for its own commit only. The current security RC changes the workflow, launcher, verifier, lockfile, and evidence policy, so a fresh successful GitHub Actions attestation bound to immutable commit `a25185d2747520303eac0fd2681017b5c35ac62b` is still required before release; the present credential's 403 response does not close that gate.
