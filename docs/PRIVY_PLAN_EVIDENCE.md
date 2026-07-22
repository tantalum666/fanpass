# Privy Dashboard Evidence Contract

This contract defines the saved evidence required before FanPass can mark Privy dashboard plan validation complete. It must not contain real personal data, access tokens, private keys, `PRIVY_APP_SECRET`, `PRIVY_VERIFICATION_KEY`, bearer tokens, provider secrets, deployment/cloud credentials, CI secret masking command literals, Stripe publishable keys, database URLs, or production credentials.

Run the validator on saved evidence:

```bash
npm run security:privy-plan:evidence -- outputs/privy-plan/<evidence-file>.json
```

Generate a non-passing draft with the current SHA-256 snapshot before filling in real dashboard facts:

```bash
npm run privy:evidence:draft -- plan --out outputs/privy-plan/<draft-file>.json
```

The draft intentionally uses `ok: false` and `dashboardReviewed: false`; do not flip those fields until the actual Privy dashboard was reviewed and the completed file passes the validator.

The fixture-backed validator self-test is included in `node scripts/beta-foundation-verify.js`:

```bash
npm run security:privy-plan:evidence:self-test
```

## Required Evidence Shape

The saved JSON may be embedded in command output, but it must include one JSON object with these fields:

```json
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "provider": "privy",
  "dashboardReviewed": true,
  "selectedPlan": "Developer Free",
  "realUserDataUsed": false,
  "productionCredentialsUsed": false,
  "deploymentCredentialsAvailable": false,
  "policySnapshot": {
    "source": "privy-plan-auth-policy-boundaries",
    "files": [
      {
        "file": "apps/api/src/modules/auth/privy-token.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/auth/auth.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/auth/auth.controller.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/dashboard/server/console-bff.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/PrivyAuthProvider.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/privy-plan-evidence-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/privy-webhook-optionality-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "docs/PRIVY_PLAN_EVIDENCE.md",
        "sha256": "<current sha256>"
      },
      {
        "file": "docs/PROVIDER_COST_FEASIBILITY.md",
        "sha256": "<current sha256>"
      }
    ]
  },
  "features": {
    "mobileSdkUse": "supported",
    "embeddedWalletCreation": "supported",
    "backendAccessTokenVerification": "supported",
    "webhooks": "plan-gated",
    "customAuthUi": "supported",
    "mfaOrPolicyControls": "plan-gated"
  },
  "decisions": {
    "coreAuthUsesAccessTokenSync": true,
    "webhooksRequiredForBeta": false,
    "webhookPlanGate": "optional-until-supported",
    "sdkIntegrationUnblocked": true
  },
  "redaction": {
    "appSecretRedacted": true,
    "verificationKeyRedacted": true,
    "accessTokensRedacted": true,
    "appIdRedactedOrNonSecret": true,
    "providerSecretsRedacted": true,
    "stripePublishableKeysRedacted": true,
    "databaseUrlsRedacted": true,
    "deploymentCredentialsRedacted": true,
    "ciSecretMaskingCommandsRedacted": true,
    "userIdentifiersRedacted": true
  }
}
```

Feature values must be one of `supported`, `unsupported`, or `plan-gated`. Evidence can prove that a feature is not available on the selected plan, but it cannot mark SDK integration unblocked unless mobile SDK use, embedded wallet creation, and backend access-token verification are all supported. Webhooks must remain optional unless and until the selected plan explicitly supports them.

`policySnapshot` must include the current SHA-256 digest for each listed file. Regenerate Privy dashboard evidence after backend Privy token verification, account sync, Console session bridging, iOS Privy provider behavior, webhook optionality policy, this validator, or provider-cost documentation changes.

## Release Rule

Local assumptions do not close Privy plan feasibility blockers. Before real-user Beta, saved Privy dashboard evidence must prove the selected plan status for mobile SDK use, embedded wallets, backend token verification, webhooks, custom auth UI, and MFA/policy controls while keeping access-token sync as the core low-cost auth boundary, keeping webhooks optional when unsupported or plan-gated, proving the current Privy auth/plan policy SHA-256 snapshot, proving `deploymentCredentialsAvailable: false`, proving `redaction.deploymentCredentialsRedacted: true`, proving `redaction.ciSecretMaskingCommandsRedacted: true`, and avoiding deployment/cloud credential or CI masking command literal leakage.
