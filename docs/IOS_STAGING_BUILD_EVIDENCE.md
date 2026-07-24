# iOS Staging And TestFlight Build Evidence

FanPass has a static iOS distribution boundary audit, but real-device and TestFlight decisions also need saved evidence that signed app builds actually used the intended staging or beta configuration. Do not close iOS staging/beta API URL blockers with simulator screenshots, local Debug builds, placeholder `.invalid` URLs, unsigned archives, logs containing signing material, or evidence from builds that still expose debug payload copy/paste helpers.

Status (2026-07-24): the validator, draft generator, self-test, release UI, and this contract now use `capabilityModel: "qr-first-release-v1"`. This fixes the prior Camera/NFC contradiction but does not create signed-build evidence; real Apple signing, TestFlight/physical-device installation, real HTTPS configuration, and current-RC runtime proof remain open.

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
  "capabilityModel": "qr-first-release-v1",
  "localDryRun": false,
  "realUserDataUsed": false,
  "productionCredentialsUsed": false,
  "implementationSnapshot": {
    "source": "ios-staging-build-distribution-boundaries",
    "files": [
      {
        "file": "apps/ios/FanPass/project.yml",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/Config/Local.xcconfig",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/Config/Staging.xcconfig",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/Config/Beta.xcconfig",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/Config/Production.xcconfig",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Generated/Info.plist",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPassOps/Generated/Info.plist",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPassOps/FanPassOps.entitlements",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/App/FanPassApp.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Payments/StripePaymentSheetPresenter.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/FanPassPaymentCoordinator.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/PrivyAuthProvider.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Scanner/ScannerView.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Scanner/QRCodeScannerView.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Scanner/NFCPayloadScanner.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/ios-distribution-boundary-audit.js",
        "sha256": "<current sha256>"
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
      "bundleId": "fun.fanpass.app",
      "archiveSucceeded": true,
      "signedWithAppleTeam": true,
      "distributionChannel": "development-device",
      "installVerifiedOnPhysicalDevice": true,
      "apiBaseUrlObserved": "https://staging-api.fanpass.test",
      "debugCompilationDisabled": true,
      "debugPayloadHelpersUnavailable": true,
      "secretsInBundle": false,
      "cameraUsageDescriptionPresent": true,
      "scannerSourceIncluded": false,
      "releaseNfcEntitlementPresent": false,
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
      "cameraUsageDescriptionPresent": true,
      "qrScannerSourceIncluded": true,
      "nfcUsageDescriptionPresent": true,
      "releaseNfcEntitlementPresent": false,
      "nativeNfcDebugOnly": true,
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
- Evidence must include `capabilityModel: "qr-first-release-v1"` and `implementationSnapshot.source: "ios-staging-build-distribution-boundaries"` with SHA-256 hashes for the current iOS project, release configs, generated plist/entitlement files, environment guard, app entry, wallet/debug-helper, payment, Privy auth, API client, Ops shell, QR/NFC scanner boundary, and iOS distribution audit files so stale evidence cannot be reused after iOS build/config boundary changes.
- The evidence must cover both `FanPass` and `FanPass Ops` signed builds.
- `FanPass` must report the present Camera usage-description string separately from actual target capabilities: scanner source, release NFC entitlement, and staff controls remain absent.
- `FanPass Ops` must report Camera/QR source presence, the development-only NFC usage-description string, no release NFC entitlement, and native Core NFC confined to `#if DEBUG`; consumer wallet, marketplace, and Stripe PaymentSheet surfaces remain absent. Legacy `cameraPermissionPresent` and `nfcEntitlementPresent` fields are rejected because they collapse distinct build facts.
- Debug compilation and debug payload helpers must be unavailable in the saved build evidence.
- For `environment.name = "beta"`, each app must use a TestFlight distribution channel.
- This validator supports, but does not replace, deployed staging runtime evidence, Privy SDK login validation, Stripe test-mode validation, signed Apple Wallet `.pkpass` evidence, or current QR-first physical scanner evidence. NFC NDEF becomes a separate future evidence gate only after release capability is deliberately re-enabled.
