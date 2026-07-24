# FanPass Ops Device Scanner Evidence

FanPass Ops Release/TestFlight is QR-first. Historical physical-iPhone QR validation is complete; the remaining gate is a fresh redacted evidence record bound to the next reviewed scanner/API/auth candidate. Native Core NFC stays DEBUG-only with no release entitlement; do not claim NFC release evidence in this contract. Do not close the current-candidate refresh with simulator screenshots, paste fallback output, localhost API runs, or saved bearer tokens.

Run future saved evidence through:

```bash
npm run security:ops-scanner:device-evidence -- <saved-json-output>
```

Seed a non-passing draft with the current QR-first scanner/API SHA-256 snapshot before collecting real physical-device proof:

```bash
npm run release:evidence:draft -- ops-scanner --out outputs/ops-scanner/<draft-file>.json
```

The draft intentionally uses `ok: false` and placeholders. It cannot close this blocker until real physical iPhone, camera QR, replay rejection, and backend-authority facts replace every placeholder and the saved file passes the validator above. NFC NDEF evidence is a separate future gate after native NFC is intentionally restored to Release/TestFlight.

The validator accepts progress-log text around the JSON object, but the saved file must not include bearer tokens, QR signing secrets, private keys, Stripe secrets, Stripe publishable keys, Privy secrets, provider secrets, deployment/cloud credentials, database URLs, raw signed payloads, raw nonces, real ticket holder data, or device identifiers.

## Archived Arduino / EP8280 Bench Prototype

Status: completed school hardware prototype archived on 2026-07-11; not active release evidence.

The completed bench mock turnstile is preserved under `archive/school-project/hardware/fanpass_turnstile/fanpass_turnstile.ino`. The hardware stack was:

- Arduino UNO R4 WiFi.
- EP8280 NFC/QR scan engine connected through the 8-pin connector.
- EP8280 Pin1 `POW_IN` and Pin2 `GND` on the breadboard power rails.
- EP8280 Pin4 serial transmit path to Arduino `D0/RX1` for TTL QR content.
- EP8280 Pin7 decode-success output to Arduino `D2` for diagnostics/fallback detection.
- I2C LCD for gate status.
- HC-SR04 ultrasonic sensor for pass-through detection.
- One micro servo on Arduino `D9` for the gate arm.

Observed local behavior:

- EP8280 QR scan can emit real QR text over TTL; Arduino emits `SCAN: <payload>` for the host bridge. Per-byte `EP8280 BYTE ...` logging is now disabled by default so long signed QR payloads do not stall scanner reads.
- The archived host bridge is preserved at `archive/school-project/scripts/fanpass-turnstile-redemption-bridge.mjs`. It is no longer exposed as an active root npm command. When run explicitly with the archived hardware, it reads Arduino `SCAN: <payload>` serial lines, submits the signed QR to the backend, and writes the authoritative redemption result back to the Arduino.
- Pin7 decode-success still toggles on successful decode for diagnostics, but decode-only fallback opening is disabled. A decode signal without TTL/Wiegand payload is not ticket validation and must not open the gate.
- LCD state text covers ready, verifying pass, valid pass, gate open, 5cm object-held, no-object countdown, closing, invalid pass, and no-QR-data states.
- Servo movement and ultrasonic pass-through detection both work in the local bench setup.
- Current bench policy emits signed FanPass QR JSON payloads over USB serial and waits for backend redemption before opening the servo gate. The sketch no longer treats arbitrary scanner noise such as NUL bytes or replacement characters as valid tickets. Its small in-memory duplicate guard now keys signed FanPass scans by `ticketId` as a local second layer after backend acceptance, so refreshed dynamic QR credentials for the same already-used ticket cannot keep opening the physical gate.
- 2026-07-07 serial diagnosis showed the UNO R4 was not continuously rebooting: `HEARTBEAT ms` continued increasing across captures. The apparent restart/LCD churn was caused by EP8280-to-Serial1 noise such as `0x00`, `0x80`, and `0xC0` being treated as scan text. The sketch now ignores non-printable scanner bytes, logs throttled `SCANNER_NOISE`, and only shows `PASS READ` after printable QR payload characters arrive. After upload, a real FanPass signed QR JSON payload was read over Serial1, locally accepted, opened the servo, ran the gate close path, and returned to the ready screen. Remaining hardware checks are still required for the underlying noise: EP8280 TX/RX pinout, shared ground, scanner output mode/baud, and separate regulated 5V power for scanner/servo.
- 2026-07-07 follow-up LCD stabilization addressed a second garbled-LCD report. Serial monitoring again showed stable `HEARTBEAT ms` output rather than continuous Arduino reboot. The sketch now treats the LCD as a recoverable device: display updates overwrite fixed 16-character rows instead of clearing every write; scan start and servo open/close request LCD recovery; the recovery path restarts `Wire`, reinitializes the I2C LCD backpack, restores the backlight, and clears the controller; the main loop rewrites the current two-line display every 10 seconds; and the USB Serial Monitor command `LCD_RESET` forces the ready screen without reflashing. Verification after upload captured a signed FanPass QR scan, `ACCESS OK`, local `REDEEMED_LOCAL`, servo/gate countdown, object-detection handling, return to `FanPass Gate`, and repeated `LCD RECOVERY: rewriting current display`. EP8280 noise still appears occasionally as ignored `0x00`/`0x80` bytes, so the electrical checks above remain required.
- 2026-07-08 backend-authority repair closed the local multiple-entry bypass in the bench path. Before the repair, the Arduino considered structurally valid signed FanPass QR JSON locally authorized and keyed duplicates by refreshed `credentialId`/`nonce`, so the same ticket could open the servo again after the phone generated a new 30-second QR. The sketch now shows `VERIFYING`, waits for the bridge to return `REDEEM_RESULT ACCEPTED`, and otherwise rejects duplicate, expired, API-error, or no-backend cases without opening. The bridge was updated to write backend results back to serial and to mark local credentials as seen only after backend success. Live testing against Render staging showed an expired QR rejected with `EXPIRED`, a fresh QR redeemed with `ACCEPTED`, and the fan phone then changed to `USED`, preventing a follow-up refreshed QR scan.
- The ultrasonic hold range is now 5cm. After a QR scan opens the servo gate, the sketch waits 2 seconds before arming ultrasonic detection. The gate remains open while an object is detected within 5cm; when no object is detected continuously for 4 seconds after the sensor is armed, the LCD shows the closing countdown and the servo closes. A 10-second hard close guard forces the servo closed even if the ultrasonic sensor is stuck reporting a near object, and the ready screen reinitializes the I2C LCD controller to recover from scan/servo noise that can leave garbled characters on the display.
- Startup LCD diagnostics scan the I2C bus, print detected addresses to Serial, and show an `LCD ONLINE` self-test before the ready screen. A local serial capture confirmed the LCD backpack was detected at `0x27` and LCD write calls were issued.
- Wiegand diagnostics now count raw DATA0/DATA1 pulses and report `WIEGAND PROBE` over Serial plus `WG PULSE` on the LCD when either line toggles.
- EP8280 Pin7 decode-success fallback is diagnostic only. If the reader reports decode success but provides no TTL or Wiegand payload, the sketch does not open the servo. The previously observed Pin7 fallback was from a QR code, not NFC. User testing showed an iPhone Wallet card can trigger the reader, but the available blue tag/white card could not be read by the iPhone or EP8280 and is likely not a compatible NFC/NDEF tag. Until a supported NFC tag is available, any decode-only NFC-like trigger is treated as non-evidence; it does not prove a readable NFC UID, NDEF payload, or FanPass ticket credential.
- EP8280 manual review found NFC setting commands but no documented NDEF payload-reading mode. NFC can be enabled with `CMD_0E0501=1;`, the seek period can be set with `CMD_0E0502=<ms>;`, and duplicate-read time can be set with `CMD_0E0503=<ms>;`. Host output still depends on the communication interface: `CMD_0B0000=4;` for serial-style RS-232, or `CMD_0B0000=64;` for Wiegand. Wiegand requires both Pin4/DATA0 and Pin3/DATA1, not only Pin3/D4.
- The Arduino sketch includes a Serial Monitor command bridge for EP8280 settings. If EP8280 Pin3/RX is connected to Arduino `D1/TX1`, lines starting with `CMD_` are forwarded to EP8280 over `Serial1`, and EP8280 command responses are logged without opening the gate.

Known gaps:

- A compatible NFC tag is not currently available. EP8280/iPhone Wallet reaction proves the reader can see some NFC field/card activity, but not a FanPass NFC tag payload. The current validated ticket path is QR over TTL/Wiegand plus backend redemption through the bridge.
- The bench setup is powered from Arduino/breadboard rails and may brown out under scanner/servo load until a separate regulated 5V supply is added.
- Enclosure CAD/STL exists under `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/`, with the current preferred local print candidate being the computer-use/Blender-native V5 front-panel fit check and shell. No physical enclosure has been printed or fit-tested yet. No two-servo lane or production turnstile controller is embedded in the Arduino prototype. Backend API redemption is available only while the separate host bridge is running with the Render-configured turnstile key or a real staff/admin bearer token; the bridge defaults to Python `pyserial` mode for UNO R4 stability and expects `pyserial` to be installed in the active Python environment. The duplicate QR guard in the sketch is still local RAM only and resets when the Arduino reboots, but it is now a secondary guard after backend acceptance rather than the entry authority.

Evidence boundary:

- This bench prototype is useful for local hardware learning and future fixture ideas only.
- It does not satisfy current `ops-scanner` physical-device evidence because that release gate requires FanPass Ops on a real iPhone, HTTPS API configuration, camera QR scan, duplicate replay rejection, backend gate assignment enforcement, scanner identity from verified auth, and validator-passing redacted evidence. It also cannot be reused as future native NFC evidence.
- Do not use Arduino serial logs, LCD/servo behavior, or EP8280 Pin7 decode-success as substitutes for FanPass API signature verification, nonce replay rejection, TestFlight evidence, Apple Wallet evidence, or chain custody evidence.

Backend authority rule:

- FanPass API is the single source of truth for entry. FanPass Ops calls `POST /verification/redeem`; the physical turnstile bridge calls `POST /verification/turnstile/redeem`; both routes execute the same `VerificationService.redeem` path.
- A successful redemption must atomically move the ticket to `REDEEMED`. Fan-facing ticket detail must poll the exact ticket API and render the QR as used when that status is observed.
- If the same ticket is scanned by Ops and by the physical turnstile at the same time, only the request that wins the backend ticket-status claim may return `ACCEPTED`. The other request must return `DUPLICATE`, even if it carries a different currently signed nonce for the same ticket.
- Local Arduino duplicate memory, LCD text, servo state, or Ops UI scan state cannot override backend authority. They are presentation/device behavior only.

Required JSON shape:

```json
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "surface": "fanpass-ops",
  "capabilityModel": "qr-first-release-v1",
  "localSimulator": false,
  "realUserDataUsed": false,
  "productionCredentialsUsed": false,
  "implementationSnapshot": {
    "source": "ops-scanner-qr-first-device-boundaries",
    "files": [
      {
        "file": "apps/ios/FanPass/project.yml",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPassOps/FanPassOps.entitlements",
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
        "file": "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/common/fanpass-auth.guard.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/common/session.ts",
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
        "file": "docs/NFC_NDEF_TAG_FIXTURE.md",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/nfc-ndef-fixture-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/ios-distribution-boundary-audit.js",
        "sha256": "<current sha256>"
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
  "releaseCapabilities": {
    "cameraQrEnabled": true,
    "releaseNfcEntitlementPresent": false,
    "nativeNfcDebugOnly": true,
    "nfcEvidenceClaimed": false
  },
  "qrTransport": {
    "cameraScanVerified": true,
    "acceptedScanVerified": true,
    "duplicateReplayRejected": true,
    "expiredOrInvalidPayloadRejected": true
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
- `debugPasteFallbackUsed` must be `false`; external scanner validation must use camera QR, not the debug paste shortcut.
- `capabilityModel` must be `qr-first-release-v1`; the four `releaseCapabilities` facts must prove QR is enabled, the release NFC entitlement is absent, native NFC is DEBUG-only, and no NFC evidence is claimed. A legacy `nfcTransport` block is rejected rather than silently treated as current release proof.
- `implementationSnapshot.source` must be `ops-scanner-qr-first-device-boundaries`, and `implementationSnapshot.files` must match the current SHA-256 snapshot for the Ops scanner UI, QR transport, DEBUG-only NFC boundary, API redemption/auth boundaries, NFC future-fixture contract, and iOS release-boundary audits. Regenerate scanner evidence after any of those files changes.
- `runtime.deploymentCredentialsAvailable` must be `false`, and `redaction.deploymentCredentialsRedacted` must be `true`; saved scanner evidence must not contain deployment/cloud credential assignments or JSON fields such as AWS keys, Vercel tokens, GitHub tokens, Netlify tokens, or Cloudflare API credentials.
- QR needs accepted-scan, invalid/expired rejection, and duplicate-replay proof through the FanPass API. Future NFC enablement needs a new explicit capability contract and its own physical NDEF proof; it cannot be inferred from this gate.
- Backend authority must remain server-side: signature checks, nonce replay rejection, gate assignment enforcement, and scanner identity must be derived from verified auth rather than client-supplied scanner ids.

## 2026-06-16 Implementation Note

- `GET /verification/checkins/recent` was added for Ops scan history. It is role-guarded for `GATE_STAFF` and `ADMIN` and returns safe check-in summary fields only.
- FanPassOps now renders Scan history from that endpoint instead of static sample rows. The Account page keeps only Scan history and Help & support, and the login page no longer exposes the local `Continue as test gate staff` shortcut.
- This note is implementation evidence only. It does not close the device-evidence gate because current physical accepted/rejected QR captures still need to be saved and validated under the release rule above; it does not claim release NFC support.
