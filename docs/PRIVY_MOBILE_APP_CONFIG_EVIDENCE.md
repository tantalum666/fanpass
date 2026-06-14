# Privy Mobile App Config Evidence

Status: evidence gate ready; real Privy mobile app configuration remains open.

This file defines the saved-evidence contract before FanPass or FanPass Ops may use real non-placeholder Privy public app IDs and app client IDs in staging, beta, or TestFlight-style builds.

## Scope

The checked-in iOS configs must stay placeholder-only:

- `FANPASS_PRIVY_APP_ID =`
- `FANPASS_PRIVY_APP_CLIENT_ID =`

Real public app IDs and app client IDs must be injected outside source control, and the evidence must prove the matching Privy dashboard apps were reviewed without exposing app secrets, verification keys, access tokens, provider secrets, deployment/cloud credentials, CI secret masking command literals, Stripe publishable keys, database URLs, or real user data.

Before local OTP testing, run `npm run security:privy-local-config` with both `FANPASS_PRIVY_APP_ID` and `FANPASS_PRIVY_APP_CLIENT_ID` supplied through the shell, or with those public values in ignored `apps/ios/FanPass/Config/LocalSecrets.xcconfig`. The preflight must show the iOS app id matches the API `PRIVY_APP_ID`, the build settings are injected outside source control, the local override file is ignored when present, and no secret values were printed.

The XcodeGen project may be regenerated safely because checked-in `Config/*.xcconfig` files include `LocalSecrets.xcconfig` with an optional include. The checked-in files must still keep direct Privy values blank.

## Required Evidence

Saved evidence must be JSON or a text file containing one JSON object and must pass:

```bash
npm run security:privy-mobile-app-config:evidence -- <saved-json-output>
```

Generate a non-passing draft with the current iOS auth/config SHA-256 snapshot before filling in real dashboard/build facts:

```bash
npm run privy:evidence:draft -- mobile --out outputs/privy-mobile-app-config/<draft-file>.json
```

The draft intentionally uses `ok: false`, `dashboardReviewed: false`, and review placeholders. It is only a capture aid until the actual Privy dashboard, build settings, and required linked evidence are reviewed and the completed file passes the validator.

The evidence must prove:

- the actual Privy dashboard was reviewed;
- the checked environment is `staging` or `beta`;
- both native apps are covered:
  - `FanPass` with bundle id `com.fanpass.app`;
  - `FanPass Ops` with bundle id `com.fanpass.ops`;
- both apps have a Privy app ID and app client ID configured;
- public app/client IDs are either redacted or clearly treated as public non-secret values;
- app secrets and verification keys are absent from mobile config evidence;
- checked-in `.xcconfig` files remain placeholder-only;
- real values are injected outside source control;
- deployment/cloud credentials and CI masking command literals were unavailable to the evidence capture and redacted from saved output;
- the evidence includes a current SHA-256 snapshot for the Privy iOS auth/config boundary files so stale dashboard evidence cannot be reused after auth UI, provider, API sync, project, Info.plist, or checked-in config changes;
- generated Info.plist keys were verified;
- `FanPassEnvironment` still rejects empty or placeholder values;
- `FanPassEnvironment` still rejects secret-like values in public Privy app/client ID slots;
- `npm run security:provider-boundaries` and `npm run security:ios-distribution-boundaries` passed;
- Privy webhooks remain optional for mobile config;
- real iOS staging/TestFlight and staff tenant evidence are still required before external testing.

## Forbidden Evidence

Evidence must not include:

- Privy app secrets, verification keys, access tokens, provider secrets, provider API keys, deployment/cloud credentials, CI secret masking command literals, or JWTs.
- Stripe secrets, publishable keys, webhook secrets, client secrets, database URLs, raw `postgres://` or `postgresql://` URLs, private keys, or bearer tokens.
- Real user identifiers, raw emails, wallet addresses, staff ids, organizer ids, or production provider dashboard data.
- Claims that mobile app config closes real Privy login, staff tenant policy, physical-device, or TestFlight blockers by itself.

## Example Shape

```json
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "provider": "privy-mobile-app-config",
  "dashboardReviewed": true,
  "environment": "staging",
  "realUserDataUsed": false,
  "productionCredentialsUsed": false,
  "deploymentCredentialsAvailable": false,
  "implementationSnapshot": {
    "source": "privy-ios-auth-config-boundaries",
    "files": [
      {
        "file": "apps/ios/FanPass/FanPass/Services/PrivyAuthProvider.swift",
        "sha256": "6789beded5c02e32f353f0caf8cb6c85b60ea56e7c0d488f3ccb0854bb26f416"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
        "sha256": "ea67e6213ca8b4495139f1e28d9da70bce29c38fe5b2adb7e6863c186697dd3e"
      },
      {
        "file": "apps/ios/FanPass/FanPass/App/AppState.swift",
        "sha256": "4bd0ea7b6caf9b05dd2d265706f94d62c777f0bdc1d64ac9e7949afa82602879"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
        "sha256": "238117d66529ec7c3bc9ec62cc47ff7d7b4de9110ee980b9e6c7b3ef646b9bb1"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Auth/AuthView.swift",
        "sha256": "5d3e6ef784a6639d3f7f594956b2373b8407249e9de9e97a3d51e37cfe0d8d13"
      },
      {
        "file": "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
        "sha256": "3d7b407bca3a7f70e6e2c323a39d5ff9b7ff7e1421c245f60ef1af944eeaf319"
      },
      {
        "file": "apps/ios/FanPass/project.yml",
        "sha256": "2ee6e5994765a13f8fc2bcaab1b93b18b58ca2e9309e03fa6a4d9dd8e042b408"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Generated/Info.plist",
        "sha256": "a070208031e9c7286c5e886538661078e04b9b127dee8b3714ae3df403d137c9"
      },
      {
        "file": "apps/ios/FanPass/FanPassOps/Generated/Info.plist",
        "sha256": "56800069b1ec8daefd0654cea205a951971db620d73938c08ba2241b4b68a861"
      },
      {
        "file": "apps/ios/FanPass/Config/Local.xcconfig",
        "sha256": "aa3fbc30e54f0d5769504a5e60c1ae876c86359393e120e277295ed84d7808c8"
      },
      {
        "file": "apps/ios/FanPass/Config/Staging.xcconfig",
        "sha256": "a15b4e6a1d202074576661276d7a141de56b8cfb0b379eb3f44d29dd9e0e9efb"
      },
      {
        "file": "apps/ios/FanPass/Config/Beta.xcconfig",
        "sha256": "58f2c9165a38902a6b561512d5108c29a2eaec260d4025194e890b3d7211e251"
      },
      {
        "file": "apps/ios/FanPass/Config/Production.xcconfig",
        "sha256": "d72a3f4de2487955352265b7a5b7c7d7997345b604441d83cf4d986ca04e8ed8"
      }
    ]
  },
  "apps": [
    {
      "name": "FanPass",
      "bundleId": "com.fanpass.app",
      "appIdConfigured": true,
      "appClientIdConfigured": true,
      "appIdPublicOrRedacted": true,
      "appClientIdPublicOrRedacted": true,
      "appSecretAbsent": true,
      "verificationKeyAbsent": true
    },
    {
      "name": "FanPass Ops",
      "bundleId": "com.fanpass.ops",
      "appIdConfigured": true,
      "appClientIdConfigured": true,
      "appIdPublicOrRedacted": true,
      "appClientIdPublicOrRedacted": true,
      "appSecretAbsent": true,
      "verificationKeyAbsent": true
    }
  ],
  "configuration": {
    "checkedInXcconfigsRemainPlaceholderOnly": true,
    "buildSettingsInjectedOutsideSourceControl": true,
    "generatedInfoPlistKeysVerified": true,
    "fanPassEnvironmentRejectsEmptyOrPlaceholderValues": true,
    "fanPassEnvironmentRejectsSecretLikeValues": true,
    "privySwiftProviderBoundaryPassed": true,
    "iosDistributionBoundaryPassed": true
  },
  "linkedEvidence": {
    "privyPlanEvidencePassed": true,
    "iosStagingBuildEvidenceRequired": true,
    "staffTenantEvidenceRequired": true,
    "webhooksRequiredForMobileConfig": false,
    "privyWebhooksOptionalUntilPlanConfirmed": true
  },
  "redaction": {
    "appSecretsRedacted": true,
    "verificationKeysRedacted": true,
    "accessTokensRedacted": true,
    "providerSecretsRedacted": true,
    "stripePublishableKeysRedacted": true,
    "databaseUrlsRedacted": true,
    "deploymentCredentialsRedacted": true,
    "ciSecretMaskingCommandsRedacted": true,
    "userIdentifiersRedacted": true,
    "dashboardScreenshotsReviewedForSecrets": true
  }
}
```

## Release Rule

Do not replace checked-in iOS placeholders or mark real Privy mobile app configuration complete until this evidence passes with the current Privy iOS auth/config SHA-256 snapshot, the Privy plan evidence passes, real iOS staging/TestFlight evidence is saved, and the full Beta foundation verifier passes. Regenerate evidence after any Privy iOS auth UI, provider, API sync, project, Info.plist, or checked-in config change.
