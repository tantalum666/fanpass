# Stripe Test-Mode Evidence Contract

This contract defines the saved evidence required before FanPass can mark real Stripe test-mode PaymentIntent, iOS PaymentSheet, signed-webhook, capture, cancellation, refund, or reconciliation work complete. It must not contain real personal data, live-mode keys, secret keys, webhook secrets, publishable keys, bearer tokens, PaymentIntent client secrets, provider secrets, deployment/cloud credentials, CI secret masking command literals, database URLs, or production credentials.

Current status on 2026-06-03: FanPass iOS simulator successfully exercised native Stripe PaymentSheet authorization with a Stripe test card against the Render staging API, signed dashboard webhook delivery updated backend payment state, and saved redacted release evidence now proves Stripe test-mode capture, authorization cancellation, refund, reconciliation, duplicate webhook replay/idempotency, and healthy residual side-effect outbox state. The saved evidence is `outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json`; it passed `npm run security:stripe-testmode:evidence -- outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json` and repository evidence redaction. Render free-tier one-off jobs still cannot be used as a fallback, but Neon staging and admin health proof confirmed the worker-drained outbox state.

Run the validator on saved evidence:

```bash
npm run security:stripe-testmode:evidence -- outputs/stripe-testmode/<evidence-file>.json
```

The fixture-backed validator self-test is included in `npm run beta:foundation:verify`:

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
        "sha256": "0329d5db190f67072eb6f11c9b4fa74bd01f103ab9801a02b83c1ebaecdf3df1"
      },
      {
        "file": "apps/api/src/modules/payments/payments.service.ts",
        "sha256": "39b56d44abfdda2403b2e5a1389bcb3ee406c11eca7409a56d4309100540b10c"
      },
      {
        "file": "apps/api/src/modules/side-effects/settlement-side-effects.service.ts",
        "sha256": "7e0ff131e13ad5fdf9f93a16f0d0b70cba08966c38bd371eefa3a1797bd9487f"
      },
      {
        "file": "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
        "sha256": "f65b7d34d36e4c89cac98116e4f5ad36a846586bb067253244377b1778d7a53e"
      },
      {
        "file": "apps/ios/FanPass/FanPass/App/FanPassApp.swift",
        "sha256": "b69e1094c4e10f01115c0a1a8b59acd2e7391dc215842677e817eabcb35817ff"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
        "sha256": "238117d66529ec7c3bc9ec62cc47ff7d7b4de9110ee980b9e6c7b3ef646b9bb1"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
        "sha256": "ea67e6213ca8b4495139f1e28d9da70bce29c38fe5b2adb7e6863c186697dd3e"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Events/EventListView.swift",
        "sha256": "47c193ba7838d01a165ed4e360c352c20d307c413978bc683a6e795ce47ae92a"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Payments/StripePaymentSheetPresenter.swift",
        "sha256": "3d7e0058c2fd2176840567d28eef090b177d587e39d38ac6ebafdbb2ed394db7"
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
