# FanPass Ops Device Scanner Evidence

FanPass Ops QR and NFC scanner flows are implemented locally, but physical-device validation remains a Beta blocker. Do not close that blocker with simulator screenshots, paste fallback output, localhost API runs, or saved bearer tokens.

Run future saved evidence through:

```bash
npm run security:ops-scanner:device-evidence -- <saved-json-output>
```

Seed a non-passing draft with the current QR/NFC scanner/API SHA-256 snapshot before collecting real physical-device proof:

```bash
npm run release:evidence:draft -- ops-scanner --out outputs/ops-scanner/<draft-file>.json
```

The draft intentionally uses `ok: false` and placeholders. It cannot close this blocker until real physical iPhone, camera QR, NFC NDEF tag, replay rejection, and backend-authority facts replace every placeholder and the saved file passes the validator above.

The validator accepts progress-log text around the JSON object, but the saved file must not include bearer tokens, QR signing secrets, private keys, Stripe secrets, Stripe publishable keys, Privy secrets, provider secrets, deployment/cloud credentials, database URLs, raw signed payloads, raw nonces, real ticket holder data, or device identifiers.

## 2026-06-15 Arduino / EP8280 Bench Prototype

Status: local hardware prototype working for QR content; not release evidence.

A separate bench mock turnstile now exists under `hardware/fanpass_turnstile/fanpass_turnstile.ino`. The current hardware stack is:

- Arduino UNO R4 WiFi.
- EP8280 NFC/QR scan engine connected through the 8-pin connector.
- EP8280 Pin1 `POW_IN` and Pin2 `GND` on the breadboard power rails.
- EP8280 Pin4 serial transmit path to Arduino `D0/RX1` for TTL QR content.
- EP8280 Pin7 decode-success output to Arduino `D2` for diagnostics/fallback detection.
- I2C LCD for gate status.
- HC-SR04 ultrasonic sensor for pass-through detection.
- One micro servo on Arduino `D9` for the gate arm.

Observed local behavior:

- EP8280 QR scan can emit real QR text over TTL; Arduino logs `EP8280 BYTE ...` and `SCAN: <payload>`.
- Pin7 decode-success also toggles on successful decode, but the Arduino code now waits for TTL QR text first and treats Pin7-only scans as `NO QR DATA` unless the explicit testing flag is changed.
- LCD state text covers ready, verifying pass, valid pass, gate open, 5cm object-held, no-object countdown, closing, invalid pass, and no-QR-data states.
- Servo movement and ultrasonic pass-through detection both work in the local bench setup.
- Current bench policy opens the servo gate for any QR payload received over TTL or Wiegand.
- The ultrasonic hold range is now 5cm. After a QR scan opens the servo gate, the sketch waits 2 seconds before arming ultrasonic detection. The gate remains open while an object is detected within 5cm; when no object is detected continuously for 4 seconds after the sensor is armed, the LCD shows the closing countdown and the servo closes.
- Startup LCD diagnostics scan the I2C bus, print detected addresses to Serial, and show an `LCD ONLINE` self-test before the ready screen. A local serial capture confirmed the LCD backpack was detected at `0x27` and LCD write calls were issued.

Known gaps:

- EP8280 NFC card/tag behavior has not been made to work yet; the current working path is QR over TTL.
- The bench setup is powered from Arduino/breadboard rails and may brown out under scanner/servo load until a separate regulated 5V supply is added.
- No enclosure, two-servo lane, production turnstile controller, backend API redemption, HTTPS staging configuration, real signed FanPass credential, or replay rejection is connected to this Arduino prototype.

Evidence boundary:

- This bench prototype is useful for local hardware learning and future fixture ideas only.
- It does not satisfy `ops-scanner` physical-device evidence because the release gate still requires FanPass Ops on a real iPhone, HTTPS API configuration, camera QR scan, physical NFC NDEF tag read, duplicate replay rejection, backend gate assignment enforcement, scanner identity from verified auth, and validator-passing redacted evidence.
- Do not use Arduino serial logs, LCD/servo behavior, or EP8280 Pin7 decode-success as substitutes for FanPass API signature verification, nonce replay rejection, TestFlight evidence, Apple Wallet evidence, or chain custody evidence.

Required JSON shape:

```json
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "surface": "fanpass-ops",
  "localSimulator": false,
  "realUserDataUsed": false,
  "productionCredentialsUsed": false,
  "implementationSnapshot": {
    "source": "ops-scanner-physical-device-boundaries",
    "files": [
      {
        "file": "apps/ios/FanPass/project.yml",
        "sha256": "2ee6e5994765a13f8fc2bcaab1b93b18b58ca2e9309e03fa6a4d9dd8e042b408"
      },
      {
        "file": "apps/ios/FanPass/FanPassOps/FanPassOps.entitlements",
        "sha256": "1b6ac359de84fc6c32350f093b6a6208620b834e361b9c79f4e7895f52227d0c"
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
        "file": "apps/ios/FanPass/FanPass/Features/Scanner/NFCPayloadScanner.swift",
        "sha256": "f84a1f38b7fba90ea198060e09e6d9de82e2ed85a4943ee5d01e1fe3cfc05213"
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
        "file": "apps/api/src/common/fanpass-auth.guard.ts",
        "sha256": "e0ab0b329826523bc81145fe3cc549b37d71c9cf14e6fe56e457fb6ab4fa89ca"
      },
      {
        "file": "apps/api/src/common/session.ts",
        "sha256": "516503d1bd6f94f8f5a1aae341c832219251c790c2be5002861abae3eff92bd5"
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
        "file": "docs/NFC_NDEF_TAG_FIXTURE.md",
        "sha256": "ff0bb398b871926104bb498e8da7eff80f82600577d0586859e7084f4aa305dc"
      },
      {
        "file": "scripts/nfc-ndef-fixture-audit.js",
        "sha256": "82123dc282142e95fc09c2c517193fee74affe715325619fd0b4ca1efc1419dd"
      },
      {
        "file": "scripts/ios-distribution-boundary-audit.js",
        "sha256": "c827ebd9accc12802bd42e3556061a06a814e8229b395c38c4b99b425abc905d"
      }
    ]
  },
  "runtime": {
    "realDeviceTested": true,
    "buildChannel": "development",
    "apiBaseUrl": "https://api.staging.fanpass.example",
    "releaseConfigUsed": true,
    "debugPasteFallbackUsed": false,
    "deploymentCredentialsAvailable": false
  },
  "qrTransport": {
    "cameraScanVerified": true,
    "acceptedScanVerified": true,
    "duplicateReplayRejected": true,
    "expiredOrInvalidPayloadRejected": true
  },
  "nfcTransport": {
    "physicalTagReadVerified": true,
    "ndefPayloadNormalized": true,
    "acceptedScanVerified": true,
    "duplicateReplayRejected": true,
    "unsupportedDeviceFallbackVerified": true
  },
  "backendAuthority": {
    "fanPassApiSignatureVerified": true,
    "nonceReplayRejectedByApi": true,
    "gateAssignmentEnforced": true,
    "scannerIdentityDerivedFromBearer": true,
    "clientSuppliedScannerUserRejected": true,
    "checkInSummaryUpdated": true
  },
  "redaction": {
    "bearerTokensRedacted": true,
    "qrSigningSecretRedacted": true,
    "payloadNonceRedacted": true,
    "ticketIdentifiersRedacted": true,
    "staffIdentifiersRedacted": true,
    "deviceIdentifiersRedacted": true,
    "providerSecretsRedacted": true,
    "stripePublishableKeysRedacted": true,
    "databaseUrlsRedacted": true,
    "deploymentCredentialsRedacted": true
  }
}
```

Release rule:

- `realDeviceTested` must be `true`; simulator-only evidence cannot close this gate.
- `apiBaseUrl` must be HTTPS; localhost or plain HTTP evidence does not represent external Beta readiness.
- `debugPasteFallbackUsed` must be `false`; external scanner validation must use camera QR and physical NFC transport, not the debug paste shortcut.
- `implementationSnapshot.source` must be `ops-scanner-physical-device-boundaries`, and `implementationSnapshot.files` must match the current SHA-256 snapshot for the Ops scanner UI, QR/NFC transport adapters, API redemption/auth boundaries, NFC fixture contract, and iOS release-boundary audits. Regenerate scanner evidence after any of those files changes.
- `runtime.deploymentCredentialsAvailable` must be `false`, and `redaction.deploymentCredentialsRedacted` must be `true`; saved scanner evidence must not contain deployment/cloud credential assignments or JSON fields such as AWS keys, Vercel tokens, GitHub tokens, Netlify tokens, or Cloudflare API credentials.
- QR and NFC both need accepted-scan and duplicate-replay proof through the FanPass API.
- Backend authority must remain server-side: signature checks, nonce replay rejection, gate assignment enforcement, and scanner identity must be derived from verified auth rather than client-supplied scanner ids.
