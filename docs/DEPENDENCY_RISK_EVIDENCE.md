# Dependency Risk Evidence

FanPass already has an automated dependency advisory state check for the current production audit posture. This evidence contract is separate: it validates the saved closeout or explicit closed-beta risk-acceptance packet that must exist before any external tester build proceeds with unresolved production advisories.

Run future saved evidence through:

```bash
npm run security:dependency-risk:evidence -- <saved-json-output>
```

The validator accepts progress-log text around the JSON object, but the saved file must not include bearer tokens, Stripe secrets, Stripe publishable keys, Privy secrets, provider secrets, provider API keys, deployment/cloud credentials, CI secret masking command literals, private keys, staging admin tokens, database URL assignments, raw `postgres://` or `postgresql://` URLs, production credentials, or real personal data.

Required JSON shape for the current unresolved Next/PostCSS advisory state:

```json
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "provider": "dependency-risk",
  "evidenceSource": "node22-production-audit",
  "localDryRun": false,
  "realUserDataUsed": false,
  "productionCredentialsUsed": false,
  "deploymentCredentialsAvailable": false,
  "dependencySnapshot": {
    "source": "workspace-package-manifests",
    "files": [
      {
        "file": "package.json",
        "sha256": "<current sha256>"
      },
      {
        "file": "package-lock.json",
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
        "file": "packages/contracts/package.json",
        "sha256": "<current sha256>"
      },
      {
        "file": "packages/shared/package.json",
        "sha256": "<current sha256>"
      }
    ]
  },
  "riskPolicySnapshot": {
    "source": "dependency-advisory-risk-policy",
    "files": [
      {
        "file": "scripts/dependency-advisory-check.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/dependency-advisory-check-self-test.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/dependency-risk-evidence-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/dependency-risk-evidence-audit-self-test.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/dependency-tooling-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "docs/DEPENDENCY_ADVISORY_LOG.md",
        "sha256": "<current sha256>"
      },
      {
        "file": "docs/DEPENDENCY_RISK_EVIDENCE.md",
        "sha256": "<current sha256>"
      },
      {
        "file": "docs/PROVIDER_COST_FEASIBILITY.md",
        "sha256": "<current sha256>"
      }
    ]
  },
  "nodeRuntime": {
    "nodeVersion": "22.22.3",
    "engineStrict": true,
    "withNode22HelperUsed": true,
    "commands": {
      "productionAudit": "npm run security:audit:prod",
      "advisoryGate": "npm run security:dependency-advisories"
    }
  },
  "productionAudit": {
    "clean": false,
    "total": 2,
    "moderate": 2,
    "high": 0,
    "critical": 0,
    "highestSeverity": "moderate",
    "advisories": [
      {
        "package": "next",
        "severity": "moderate",
        "isDirect": true,
        "range": "9.3.4 - 15.5.18"
      },
      {
        "package": "postcss",
        "severity": "moderate",
        "isDirect": false,
        "range": "<8.5.10",
        "advisoryId": "GHSA-qx2v-qp2m-jg93"
      }
    ]
  },
  "fixStatus": {
    "npmAuditFixForceRequired": true,
    "forcedFixDowngradesNextToUnsupportedMajor": true,
    "safeNextPostcssPatchAvailable": false,
    "latestNextChecked": true,
    "latestNextVersion": "16.2.6",
    "latestNextPostcssDependency": "8.4.31"
  },
  "mitigations": {
    "consoleAuthRequired": true,
    "consoleCspEnabled": true,
    "noUserControlledCssGeneration": true,
    "dependencyAdvisoryGateInVerifier": true,
    "node22RuntimeUsed": true,
    "externalTestingScopeClosedBetaOnly": true,
    "safeUpgradeRecheckBeforeTesterBuild": true
  },
  "riskAcceptance": {
    "acceptedByRole": "security-owner",
    "acceptedAt": "2026-05-30T00:00:00.000Z",
    "expiresAt": "2026-06-29T00:00:00.000Z",
    "scope": "closed-beta-only",
    "reviewCadenceDays": 14,
    "rollbackOrPatchPlanDocumented": true,
    "noPublicLaunchUntilCleanOrRenewed": true,
    "realUserDataAllowed": false,
    "decisionReference": "risk-register:dependency-next-postcss-closed-beta"
  },
  "redaction": {
    "providerSecretsRedacted": true,
    "databaseUrlRedacted": true,
    "bearerTokensRedacted": true,
    "privyTokensRedacted": true,
    "stripeSecretsRedacted": true,
    "stripePublishableKeysRedacted": true,
    "privateKeysRedacted": true,
    "deploymentCredentialsRedacted": true,
    "ciSecretMaskingCommandsRedacted": true,
    "realPersonalDataExcluded": true
  }
}
```

Release rule:

- A clean production audit may omit `riskAcceptance`.
- The packet must include a `dependencySnapshot` for the current root lockfile and workspace package manifests; saved evidence must be regenerated after dependency manifest or lockfile changes.
- The packet must include `riskPolicySnapshot.source: "dependency-advisory-risk-policy"` with current SHA-256 entries for the dependency advisory gate, advisory gate self-test, dependency risk evidence validator, dependency risk evidence self-test, dependency tooling audit, dependency advisory log, dependency risk evidence contract, and provider-cost feasibility policy. Saved evidence must be regenerated after any of those files changes.
- If production advisories remain, the packet must show exactly the known moderate `next` and transitive `postcss` advisories, with no high or critical findings.
- Risk acceptance is closed-beta-only, must be approved by a project or security owner role, must expire within 90 days, and must be reviewed at least every 30 days.
- The packet must prove the destructive forced-fix path is still the only npm fix, that no safe patched Next/PostCSS path is available, and that the advisory gate was rerun under Node 22.
- `deploymentCredentialsAvailable` must be `false`, `redaction.deploymentCredentialsRedacted` must be `true`, and `redaction.ciSecretMaskingCommandsRedacted` must be `true`; saved dependency-risk evidence must not contain deployment/cloud credential assignments or JSON fields such as AWS keys, Vercel tokens, GitHub tokens, Netlify tokens, Cloudflare API credentials, or CI masking commands with literal values.
- This validator does not by itself accept the current risk. It only makes a future owner decision auditable and rejectable if the evidence is stale, overbroad, or secret-bearing.
