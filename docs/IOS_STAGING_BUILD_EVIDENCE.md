# iOS Staging And TestFlight Build Evidence

FanPass has a static iOS distribution boundary audit, but real-device and TestFlight decisions also need saved evidence that signed app builds actually used the intended staging or beta configuration. Do not close iOS staging/beta API URL blockers with simulator screenshots, local Debug builds, placeholder `.invalid` URLs, unsigned archives, logs containing signing material, or evidence from builds that still expose debug payload copy/paste helpers.

Run future saved evidence through:

```bash
npm run security:ios-staging-build:evidence -- <saved-json-output>
```

Seed a non-passing draft with the current iOS distribution/config SHA-256 snapshot before collecting real signing or TestFlight proof:

```bash
npm run release:evidence:draft -- ios-build --out outputs/ios-staging-build/<draft-file>.json
```

After local Apple signing identities and profiles are installed, create caller-supplied signed archives without committing Apple or provider configuration:

```bash
npm run ios:archive:beta
```

The command is backed by `scripts/ios-beta-archive.sh` and requires environment variables for Apple team/profile values, HTTPS API URL, and public provider config. Archive logs are written under ignored `outputs/ios-archives/` and must still be redacted before any evidence file is saved.

The draft intentionally uses `ok: false` and placeholders. It cannot close this blocker until real signed-build, physical-device or TestFlight, and HTTPS staging/beta facts replace every placeholder and the saved file passes the validator above.

The validator accepts progress-log text around the JSON object, but the saved file must not include bearer tokens, Privy tokens, Stripe secrets, Stripe publishable keys, Apple certificates, private keys, provisioning profiles, device identifiers, database URLs, provider secrets, deployment/cloud credentials, CI secret masking command literals, production credentials, or real personal data.

Required JSON shape:

```json
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "provider": "ios-staging-build",
  "localDryRun": false,
  "realUserDataUsed": false,
  "productionCredentialsUsed": false,
  "implementationSnapshot": {
    "source": "ios-staging-build-distribution-boundaries",
    "files": [
      {
        "file": "apps/ios/FanPass/project.yml",
        "sha256": "2ee6e5994765a13f8fc2bcaab1b93b18b58ca2e9309e03fa6a4d9dd8e042b408"
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
        "file": "apps/ios/FanPass/FanPassOps/FanPassOps.entitlements",
        "sha256": "1b6ac359de84fc6c32350f093b6a6208620b834e361b9c79f4e7895f52227d0c"
      },
      {
        "file": "apps/ios/FanPass/FanPass/App/FanPassApp.swift",
        "sha256": "b69e1094c4e10f01115c0a1a8b59acd2e7391dc215842677e817eabcb35817ff"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
        "sha256": "ea67e6213ca8b4495139f1e28d9da70bce29c38fe5b2adb7e6863c186697dd3e"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift",
        "sha256": "b1da1b111222d3a688e776fb4756d2daf8d4d5996927cea2cbf82d1d693c5344"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Payments/StripePaymentSheetPresenter.swift",
        "sha256": "3d7e0058c2fd2176840567d28eef090b177d587e39d38ac6ebafdbb2ed394db7"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/FanPassPaymentCoordinator.swift",
        "sha256": "fd052b877eb8d60f32af43d8e5af9798dd3e93b3b2a368a64991538ee7b1ae2e"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/PrivyAuthProvider.swift",
        "sha256": "6789beded5c02e32f353f0caf8cb6c85b60ea56e7c0d488f3ccb0854bb26f416"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
        "sha256": "238117d66529ec7c3bc9ec62cc47ff7d7b4de9110ee980b9e6c7b3ef646b9bb1"
      },
      {
        "file": "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
        "sha256": "3d7b407bca3a7f70e6e2c323a39d5ff9b7ff7e1421c245f60ef1af944eeaf319"
      },
      {
        "file": "scripts/ios-distribution-boundary-audit.js",
        "sha256": "c827ebd9accc12802bd42e3556061a06a814e8229b395c38c4b99b425abc905d"
      }
    ]
  },
  "environment": {
    "name": "staging",
    "apiBaseUrl": "https://staging-api.fanpass.test",
    "configFile": "Config/Staging.xcconfig",
    "buildConfiguration": "Staging",
    "demoAuthDisabled": true,
    "stripeMode": "test",
    "privyAppType": "test",
    "deploymentCredentialsAvailable": false
  },
  "apps": [
    {
      "name": "FanPass",
      "scheme": "FanPass",
      "bundleId": "com.fanpass.app",
      "archiveSucceeded": true,
      "signedWithAppleTeam": true,
      "distributionChannel": "development-device",
      "installVerifiedOnPhysicalDevice": true,
      "apiBaseUrlObserved": "https://staging-api.fanpass.test",
      "debugCompilationDisabled": true,
      "debugPayloadHelpersUnavailable": true,
      "secretsInBundle": false,
      "cameraPermissionPresent": false,
      "nfcEntitlementPresent": false,
      "staffControlsPresent": false,
      "paymentReturnUrlSchemePresent": true
    },
    {
      "name": "FanPass Ops",
      "scheme": "FanPassOps",
      "bundleId": "com.fanpass.ops",
      "archiveSucceeded": true,
      "signedWithAppleTeam": true,
      "distributionChannel": "development-device",
      "installVerifiedOnPhysicalDevice": true,
      "apiBaseUrlObserved": "https://staging-api.fanpass.test",
      "debugCompilationDisabled": true,
      "debugPayloadHelpersUnavailable": true,
      "secretsInBundle": false,
      "cameraPermissionPresent": true,
      "nfcEntitlementPresent": true,
      "consumerWalletPresent": false,
      "marketplacePresent": false,
      "stripePaymentSheetPresent": false
    }
  ],
  "runtimeChecks": {
    "apiHealthReachable": true,
    "tlsVerified": true,
    "demoAuthRejected": true,
    "iosDistributionBoundaryAuditPassed": true,
    "stagingRuntimeEvidencePassedOrLinked": true
  },
  "redaction": {
    "bearerTokensRedacted": true,
    "privyTokensRedacted": true,
    "stripeSecretsRedacted": true,
    "providerSecretsRedacted": true,
    "stripePublishableKeysRedacted": true,
    "databaseUrlsRedacted": true,
    "deploymentCredentialsRedacted": true,
    "ciSecretMaskingCommandsRedacted": true,
    "appleSigningMaterialRedacted": true,
    "provisioningProfilesRedacted": true,
    "deviceIdentifiersRedacted": true,
    "realPersonalDataExcluded": true
  }
}
```

Release rule:

- `localDryRun` must be `false`; simulator or Debug build output cannot close this gate.
- `environment.apiBaseUrl` must be a real HTTPS staging or beta API URL, not localhost, `.invalid`, `replace-me`, or example-host evidence.
- `environment.deploymentCredentialsAvailable` must be `false`, `redaction.deploymentCredentialsRedacted` must be `true`, and `redaction.ciSecretMaskingCommandsRedacted` must be `true`; saved build evidence must not contain deployment/cloud credential assignments or JSON fields such as AWS keys, Vercel tokens, GitHub tokens, Netlify tokens, Cloudflare API credentials, or CI masking commands with literal values.
- Evidence must include `implementationSnapshot.source: "ios-staging-build-distribution-boundaries"` with SHA-256 hashes for the current iOS project, release configs, generated plist/entitlement files, environment guard, app entry, wallet/debug-helper, payment, Privy auth, API client, Ops shell, and iOS distribution audit files so stale evidence cannot be reused after iOS build/config boundary changes.
- The evidence must cover both `FanPass` and `FanPass Ops` signed builds.
- `FanPass` must remain free of Camera/NFC permissions and staff controls.
- `FanPass Ops` must own Camera/NFC capability and must not include consumer wallet, marketplace, or Stripe PaymentSheet surfaces.
- Debug compilation and debug payload helpers must be unavailable in the saved build evidence.
- For `environment.name = "beta"`, each app must use a TestFlight distribution channel.
- This validator supports, but does not replace, deployed staging runtime evidence, Privy SDK login validation, Stripe test-mode validation, signed Apple Wallet `.pkpass` evidence, or physical QR/NFC scanner evidence.
