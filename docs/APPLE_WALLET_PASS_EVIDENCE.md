# Apple Wallet Signed Pass Evidence

FanPass currently treats Apple Wallet as prototype barcode metadata only. Do not mark the Wallet blocker closed until a real signed `.pkpass` flow has been validated on a physical iPhone without committing Apple certificates, private keys, bearer tokens, provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, or real personal data.

## Product And Apple Program Boundary

There are two distinct Wallet paths:

- Standard Apple Wallet pass: a signed `.pkpass` event ticket with a barcode such as QR, Aztec, PDF417, or Code128. This requires an Apple Developer Program account, a Pass Type ID, a Pass Type ID certificate, backend pass generation/signing, and physical-iPhone add-to-Wallet validation. It does not require the Apple Developer Enterprise Program. App distribution still uses normal App Store/TestFlight review if the app includes the add-to-Wallet flow, but each generated pass is not an App Store app binary.
- NFC/contactless Wallet ticket: a pass or in-app credential that can be presented by holding the iPhone near a reader, like the Ticketmaster-style "hold near reader" experience. This is a separate higher-bar path that requires Apple-issued special entitlement/access, a compatible terminal/reader protocol, and usually organization-level Apple Developer Program membership plus Apple agreements/approval. Treat this as future venue/enterprise work, not the near-term TestFlight blocker.

Do not confuse Apple Wallet passes with Apple Pay payment cards. Screenshots and social posts may say "Apple Pay" colloquially, but FanPass ticket storage should be described as Apple Wallet / PassKit unless an actual Apple Pay payment flow is involved.

Near-term FanPass scope: implement signed `.pkpass` with QR barcode first, then verify that `FanPass Ops` can scan the Wallet-displayed barcode through the existing QR redemption path. Do not promise NFC/tap-to-reader Wallet entry until Apple entitlement, organization eligibility, terminal protocol, and saved evidence are all in place.

Run future saved evidence through:

```bash
npm run security:apple-wallet:evidence -- <saved-json-output>
```

Seed a non-passing draft with the current Wallet/pass-boundary SHA-256 snapshot before collecting real `.pkpass` proof:

```bash
npm run release:evidence:draft -- apple-wallet --out outputs/apple-wallet/<draft-file>.json
```

The draft intentionally uses `ok: false` and placeholders. It cannot close this blocker until real signed `.pkpass`, manifest/signature, physical-iPhone Wallet install, and FanPass Ops scan facts replace every placeholder and the saved file passes the validator above.

The validator accepts progress-log text around the JSON object, but the saved file must not include raw certificate material, private keys, bearer tokens, Stripe secrets, Stripe publishable keys, Privy secrets, provider secrets, deployment/cloud credentials, database URLs, real ticket holder data, or payment data.

Required JSON shape:

```json
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "provider": "apple-wallet",
  "localPrototype": false,
  "usesUnsignedPrototype": false,
  "realUserDataUsed": false,
  "productionCredentialsUsed": false,
  "deploymentCredentialsAvailable": false,
  "implementationSnapshot": {
    "source": "apple-wallet-pass-boundaries",
    "files": [
      {
        "file": "apps/ios/FanPass/project.yml",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Models/FanPassModels.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
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
        "file": "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/verification/verification.controller.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/verification/verification.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "docs/PROTOTYPE_SHORTCUT_REGISTER.md",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/prototype-shortcut-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/ios-distribution-boundary-audit.js",
        "sha256": "<current sha256>"
      }
    ]
  },
  "passSigning": {
    "pkpassGenerated": true,
    "pkpassValidated": true,
    "signedWithApplePassCertificate": true,
    "certificatePrivateKeyExported": false,
    "passTypeIdentifierConfigured": true,
    "teamIdentifierConfigured": true,
    "manifestHashVerified": true,
    "signatureVerified": true,
    "barcodePayloadSignedByFanPassApi": true,
    "barcodeFormat": "PKBarcodeFormatQR"
  },
  "deviceInstall": {
    "realDeviceTested": true,
    "simulatorOnly": false,
    "buildChannel": "development",
    "addPassFlowVerified": true,
    "walletDisplaysSignedPass": true,
    "barcodeScansThroughFanPassOps": true
  },
  "passContents": {
    "containsNoRealPersonalData": true,
    "containsNoProviderSecrets": true,
    "containsNoPaymentData": true,
    "containsOnlySignedEntryPayload": true,
    "expirationMatchesQrTtlPolicy": true
  },
  "security": {
    "noPrivateKeysInRepo": true,
    "passCertificateNotCommitted": true,
    "usesEphemeralTestTicket": true,
    "revocationOrRotationPlanDocumented": true,
    "prototypeBarcodeFallbackRemovedOrDebugOnly": true
  },
  "redaction": {
    "privateKeyRedacted": true,
    "certificateSerialRedacted": true,
    "teamIdRedactedOrNonSecret": true,
    "passTypeIdRedactedOrNonSecret": true,
    "ticketIdentifiersRedacted": true,
    "bearerTokensRedacted": true,
    "providerSecretsRedacted": true,
    "stripePublishableKeysRedacted": true,
    "databaseUrlsRedacted": true,
    "deploymentCredentialsRedacted": true
  }
}
```

Release rule:

- `localPrototype` and `usesUnsignedPrototype` must remain `false`; prototype barcode metadata is not a signed Wallet pass.
- `realDeviceTested` must be `true`; simulator-only evidence does not close the Wallet blocker.
- `implementationSnapshot.source` must be `apple-wallet-pass-boundaries`, and `implementationSnapshot.files` must match the current SHA-256 snapshot for the ticket wallet barcode boundary, QR payload model, iOS API client, FanPass Ops scan compatibility, FanPass API signing/redemption boundary, prototype shortcut register, and iOS distribution audit. Regenerate Wallet evidence after any of those files changes.
- The pass must contain only the FanPass signed entry payload needed by `FanPass Ops` QR/NFC redemption. It must not contain payment data, raw provider responses, real personal data, bearer tokens, or Apple signing material.
- Apple certificate private keys must stay outside the repository and outside saved evidence. If a key or certificate is exposed, rotate it before treating any Wallet evidence as valid.
- `deploymentCredentialsAvailable` must be `false`, and `redaction.deploymentCredentialsRedacted` must be `true`; saved Wallet evidence must not contain deployment/cloud credential assignments or JSON fields such as AWS keys, Vercel tokens, GitHub tokens, Netlify tokens, or Cloudflare API credentials.
