# Apple Wallet Signed Pass Evidence

FanPass currently treats Apple Wallet as prototype barcode metadata only. Do not mark the Wallet blocker closed until a real signed `.pkpass` flow has been validated on a physical iPhone without committing Apple certificates, private keys, bearer tokens, provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, or real personal data.

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
        "sha256": "2ee6e5994765a13f8fc2bcaab1b93b18b58ca2e9309e03fa6a4d9dd8e042b408"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift",
        "sha256": "b1da1b111222d3a688e776fb4756d2daf8d4d5996927cea2cbf82d1d693c5344"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Models/FanPassModels.swift",
        "sha256": "6bc67049865974e8cf9456c8fa4bd4348931782d678c42009a03e2062145e789"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
        "sha256": "238117d66529ec7c3bc9ec62cc47ff7d7b4de9110ee980b9e6c7b3ef646b9bb1"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Scanner/ScannerView.swift",
        "sha256": "8fbdc5c99c066bfdf4e6b609e1a5ca8286643bc9d46610fb3c3060383eee20db"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Features/Scanner/QRCodeScannerView.swift",
        "sha256": "4ba431e831e6ec44440836b23b817c4a4a966af0e3a715441baa7027a77f8703"
      },
      {
        "file": "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
        "sha256": "3d7b407bca3a7f70e6e2c323a39d5ff9b7ff7e1421c245f60ef1af944eeaf319"
      },
      {
        "file": "apps/api/src/modules/verification/verification.controller.ts",
        "sha256": "f9d972f1aadbba97edab511dfe0b3f53fd271c4977a12c18b4949e145011fbb1"
      },
      {
        "file": "apps/api/src/modules/verification/verification.service.ts",
        "sha256": "0667ea136a339018dec12be1d01ca281db4bca33769f565e2a14240d772a3ad4"
      },
      {
        "file": "docs/PROTOTYPE_SHORTCUT_REGISTER.md",
        "sha256": "bfbdaed6984d28e814af88c1346717c81b5f235b3f75fd53c901c0a28365f8e2"
      },
      {
        "file": "scripts/prototype-shortcut-audit.js",
        "sha256": "03b2f836f9ebe261447adf5089672cb4f7f4b10e00d6177c42757861955d1526"
      },
      {
        "file": "scripts/ios-distribution-boundary-audit.js",
        "sha256": "c827ebd9accc12802bd42e3556061a06a814e8229b395c38c4b99b425abc905d"
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
