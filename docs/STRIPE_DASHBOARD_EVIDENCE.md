# Stripe Dashboard Feasibility Evidence Contract

This contract defines the saved evidence required before FanPass can mark Stripe dashboard feasibility complete for test-mode PaymentIntents and webhook endpoint setup. It must not contain real personal data, live-mode keys, secret keys, webhook secrets, publishable keys, PaymentIntent client secrets, provider secrets, deployment/cloud credentials, CI secret masking command literals, database URLs, or production credentials.

Historical status on 2026-05-31: the actual Stripe dashboard test-mode webhook endpoint was created for the then-live Render staging API and used for iOS PaymentSheet authorization testing. That feasibility receipt does not attest security RC `a25185d2747520303eac0fd2681017b5c35ac62b`, whose payment execution and outbox boundaries changed and remain undeployed. Keep future saved evidence redacted and bind fresh provider proof to the immutable RC after the approved Staging cutover; this dashboard feasibility gate remains separate from the full Stripe test-mode evidence gate.

Run the validator on saved evidence:

```bash
npm run security:stripe-dashboard:evidence -- outputs/stripe-dashboard/<evidence-file>.json
```

The fixture-backed validator self-test is included in `node scripts/beta-foundation-verify.js`:

```bash
npm run security:stripe-dashboard:evidence:self-test
```

## Required Evidence Shape

The saved JSON may be embedded in command output, but it must include one JSON object with these fields:

```json
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "provider": "stripe",
  "evidenceSource": "stripe-dashboard-review",
  "dashboardReviewed": true,
  "stripeMode": "test",
  "realUserDataUsed": false,
  "productionCredentialsUsed": false,
  "deploymentCredentialsAvailable": false,
  "policySnapshot": {
    "source": "stripe-dashboard-payment-webhook-policy",
    "files": [
      {
        "file": "apps/api/src/modules/payments/payments.controller.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/payments/payments.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/config/security-config.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/.env.staging.example",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/stripe-dashboard-evidence-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/stripe-testmode-evidence-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "docs/STRIPE_DASHBOARD_EVIDENCE.md",
        "sha256": "<current sha256>"
      },
      {
        "file": "docs/STRIPE_TESTMODE_EVIDENCE.md",
        "sha256": "<current sha256>"
      },
      {
        "file": "docs/PROVIDER_COST_FEASIBILITY.md",
        "sha256": "<current sha256>"
      }
    ]
  },
  "dashboard": {
    "accountMode": "test",
    "testModeToggleVisible": true,
    "paymentsEnabled": true,
    "liveModeUsed": false
  },
  "paymentIntents": {
    "testModeCreationAvailable": true,
    "manualCaptureAvailable": true,
    "fanPassRoute": "POST /payments/intents",
    "idempotencyKeyRequired": true,
    "clientSecretRedacted": true
  },
  "webhookEndpoint": {
    "dashboardEndpointCreated": true,
    "url": "https://api.staging.fanpass.example/payments/webhook",
    "fanPassRoute": "POST /payments/webhook",
    "signingSecretAvailable": true,
    "signingSecretRecorded": false,
    "rawBodySignatureRequired": true,
    "enabledEvents": [
      "payment_intent.amount_capturable_updated",
      "payment_intent.succeeded",
      "payment_intent.payment_failed"
    ]
  },
  "decisions": {
    "useStripeTestModeForBeta": true,
    "noRealMoneyBeforeEvidence": true,
    "requiresSignedWebhooksBeforeBeta": true,
    "connectRequiredForClosedBeta": false
  },
  "redaction": {
    "secretKeyRedacted": true,
    "webhookSecretRedacted": true,
    "publishableKeyRedacted": true,
    "clientSecretRedacted": true,
    "providerSecretsRedacted": true,
    "databaseUrlsRedacted": true,
    "deploymentCredentialsRedacted": true,
    "ciSecretMaskingCommandsRedacted": true,
    "userIdentifiersRedacted": true
  }
}
```

`policySnapshot` must include the current SHA-256 digest for each listed file. Regenerate Stripe dashboard evidence after payment route, payment provider, production-like payment config, Stripe evidence validator, dashboard evidence validator, or provider-cost documentation changes.

## Release Rule

Local assumptions do not close Stripe dashboard feasibility blockers. Before real-user Beta, saved Stripe dashboard evidence must prove test-mode dashboard review, test-mode PaymentIntent availability, manual-capture support for `POST /payments/intents`, an HTTPS `POST /payments/webhook` endpoint with signed raw-body verification, the required PaymentIntent events, the current Stripe payment/webhook policy SHA-256 snapshot, `deploymentCredentialsAvailable: false`, `redaction.deploymentCredentialsRedacted: true`, `redaction.ciSecretMaskingCommandsRedacted: true`, and no provider-secret, deployment/cloud credential, CI masking command literal, publishable-key, client-secret, webhook-secret, database URL, production credential, or real-user data leakage.
