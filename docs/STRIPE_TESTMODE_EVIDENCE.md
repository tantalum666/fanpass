# Stripe Test-Mode Evidence Contract

This contract defines the saved evidence required before FanPass can mark real Stripe test-mode PaymentIntent, iOS PaymentSheet, signed-webhook, capture, cancellation, refund, or reconciliation work complete. It must not contain real personal data, live-mode keys, secret keys, webhook secrets, publishable keys, bearer tokens, PaymentIntent client secrets, provider secrets, deployment/cloud credentials, CI secret masking command literals, database URLs, or production credentials.

Current status on 2026-06-03: FanPass iOS simulator successfully exercised native Stripe PaymentSheet authorization with a Stripe test card against the Render staging API, signed dashboard webhook delivery updated backend payment state, and saved redacted release evidence now proves Stripe test-mode capture, authorization cancellation, refund, reconciliation, duplicate webhook replay/idempotency, and healthy residual side-effect outbox state. The saved evidence is `outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json`; it passed `npm run security:stripe-testmode:evidence -- outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json` and repository evidence redaction. Render free-tier one-off jobs still cannot be used as a fallback, but Neon staging and admin health proof confirmed the worker-drained outbox state.

Run the validator on saved evidence:

```bash
npm run security:stripe-testmode:evidence -- outputs/stripe-testmode/<evidence-file>.json
```

The fixture-backed validator self-test is included in `node scripts/beta-foundation-verify.js`:

```bash
npm run security:stripe-testmode:evidence:self-test
```

Stripe dashboard feasibility evidence is a separate prerequisite for closing provider plan checks:

```bash
npm run security:stripe-dashboard:evidence -- outputs/stripe-dashboard/<evidence-file>.json
```

## Required Evidence Shape

The saved JSON may be embedded in command output, but it must include one JSON object with these fields:

```json
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "provider": "stripe",
  "stripeMode": "test",
  "localMock": false,
  "usesRealMoney": false,
  "apiBaseUrl": "https://api.staging.fanpass.example",
  "deploymentCredentialsAvailable": false,
  "implementationSnapshot": {
    "source": "stripe-api-ios-payment-boundaries",
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
        "file": "apps/api/src/modules/side-effects/settlement-side-effects.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/App/FanPassApp.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Events/EventListView.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Payments/StripePaymentSheetPresenter.swift",
        "sha256": "<current sha256>"
      }
    ]
  },
  "paymentIntent": {
    "created": true,
    "id": "pi_redacted_testmode_id",
    "captureMethod": "manual",
    "clientSecretObserved": false,
    "publishableKeyType": "test"
  },
  "mobileClient": {
    "platform": "ios",
    "app": "FanPass",
    "paymentSheetPresented": true,
    "usesNativePaymentSheet": true,
    "usesBackendPaymentIntent": true,
    "clientSecretSource": "backend-payment-intent",
    "clientSecretRecorded": false,
    "publishableKeyType": "test",
    "publishableKeyRecorded": false,
    "localMockClientSecretBlocked": true,
    "returnUrlScheme": "fanpass-payments",
    "fanPassOpsCheckoutAbsent": true
  },
  "webhooks": {
    "signedDeliveryVerified": true,
    "rawBodySignatureVerified": true,
    "duplicateReplayAcknowledged": true,
    "eventIds": ["evt_redacted_authorized", "evt_redacted_capture"]
  },
  "sideEffects": {
    "captureVerified": true,
    "cancelAuthorizationVerified": true,
    "refundVerified": true,
    "reconciliationVerified": true,
    "outboxHealthAfterRetries": "healthy"
  },
  "idempotency": {
    "paymentIntentCreate": true,
    "webhookReplay": true,
    "captureRetry": true,
    "cancelRetry": true,
    "refundRetry": true,
    "adminOperationRetry": true
  },
  "redaction": {
    "secretKeyRedacted": true,
    "webhookSecretRedacted": true,
    "publishableKeyRedacted": true,
    "clientSecretRedacted": true,
    "bearerTokensRedacted": true,
    "providerSecretsRedacted": true,
    "databaseUrlsRedacted": true,
    "deploymentCredentialsRedacted": true,
    "ciSecretMaskingCommandsRedacted": true
  }
}
```

## Release Rule

Local mock Stripe evidence does not close real Stripe Beta blockers. Before real-money Beta, saved Stripe test-mode evidence must prove FanPass iOS presented native PaymentSheet with a backend-issued PaymentIntent client secret and a test publishable key, FanPass Ops did not expose checkout, signed webhook delivery, raw-body signature verification, duplicate replay idempotency, manual PaymentIntent capture, authorization cancellation, refund, reconciliation, retry idempotency, healthy residual side-effect outbox state, the current Stripe API/iOS implementation SHA-256 snapshot, `deploymentCredentialsAvailable: false`, `redaction.deploymentCredentialsRedacted: true`, `redaction.ciSecretMaskingCommandsRedacted: true`, and redacted outputs with no provider-secret, deployment/cloud credential, CI masking command literal, or database URL leakage. Regenerate evidence after changing Stripe payment API, side-effect worker, iOS API-client, environment, checkout UI, app callback, or PaymentSheet presenter files.
