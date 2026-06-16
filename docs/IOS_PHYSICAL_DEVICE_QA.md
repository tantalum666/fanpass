# FanPass iOS Physical-Device QA Checklist

Status: checklist gate ready; physical-device execution remains open.

## Scope

This checklist is the pre-external-testing runbook for signed `FanPass` and `FanPass Ops` builds on real iPhones. It does not replace saved iOS staging/TestFlight build evidence, physical QR/NFC scanner evidence, Apple Wallet signed-pass evidence, deployed staging runtime evidence, Stripe test-mode evidence, Privy dashboard evidence, or staff tenant staging evidence.

Do not use real personal data, production credentials, production Stripe or Privy secrets, Apple signing material, provisioning profiles, device identifiers, bearer tokens, raw invite tokens, QR signing secrets, raw nonces, raw signed payloads, private keys, or database URLs in saved QA notes, screenshots, logs, or JSON evidence.

## Required Environment

- Use a real iPhone, not a simulator.
- Use a signed development-device, internal TestFlight, or closed external TestFlight build.
- Use `Config/Staging.xcconfig` or `Config/Beta.xcconfig` with a real HTTPS staging or beta API URL.
- Do not use localhost, LAN HTTP, placeholder `.invalid` URLs, local demo auth, or mock production credentials.
- Use Stripe test mode only.
- Use a Privy test app or explicitly documented test tenant only.
- Keep `FanPass` and `FanPass Ops` installed as separate apps with separate bundle ids.

## FanPass Consumer Checks

- App launches to a browsable guest home.
- Auth appears only when a private action requires it.
- No staff scanner, gate, inventory, audit, admin, NFC, or Camera permission prompt appears in the consumer app.
- Wallet, marketplace, fan access, profile, and checkout actions require an authenticated session.
- Entry presentation for near-term testing is a dynamic, short-lived QR shown on the fan's phone; do not design the consumer flow around users carrying separate NFC/RFID tags.
- Dynamic QR expires after 30 seconds and should auto-refresh before expiry while the entry-code sheet is visible. If auto-refresh fails, the app should show a refresh failure state and the backend must reject expired/superseded credentials.
- Payment UI uses the Stripe iOS PaymentSheet presenter boundary only when a test publishable key and staging PaymentIntent are available.
- Wallet barcode remains a prototype unless saved Apple Wallet signed-pass evidence passes `npm run security:apple-wallet:evidence -- <saved-json-output>`.

## FanPass Ops Checks

- Gate staff can sign in with verified auth and only see assigned event/gate access.
- QR camera scanning accepts the first valid staging payload and rejects duplicate replay.
- Same-ticket race coverage is required: two scans for the same ticket, including different signed nonces when a code has been copied/refreshed, must result in exactly one accepted backend redemption and the rest rejected as duplicate/invalid. Do not rely on UI disabled states, scanner throttling, chain settlement, or client clocks as the gate authority.
- For the current TestFlight/internal release path, Ops is QR-first because App Store Connect rejected the release NDEF entitlement. Native Core NFC evidence is a separate future fixture path, not a prerequisite for initial internal QR testing.
- When NFC is explicitly re-enabled later, it must read a supported physical NDEF tag into the same backend redemption path as QR. Generic RFID cards that cannot store/read NDEF are not sufficient for that future check.
- Accepted and rejected counts update after scan results.
- Scanner identity comes from the verified auth session; client-supplied staff or scanner ids are rejected.
- Debug paste fallback and payload copy helpers are unavailable in external or evidence builds.
- FanPass Ops does not expose consumer wallet, marketplace, checkout, PaymentSheet, or organizer inventory flows.

## Shared Evidence Handoffs

Before closing external-testing readiness, save redacted evidence and run:

- `npm run security:ios-staging-build:evidence -- <saved-json-output>` for signed build, real HTTPS API URL, app separation, provider mode, and debug-helper removal proof.
- `npm run security:ops-scanner:device-evidence -- <saved-json-output>` for physical QR scan proof bound to the current scanner and API redemption/auth. NFC fixture proof remains required only when native NFC is reintroduced for release/evidence builds.
- `npm run security:apple-wallet:evidence -- <saved-json-output>` before claiming signed Apple Wallet pass readiness, with evidence bound to the current ticket wallet, QR payload/API signing, scanner compatibility, and prototype-boundary implementation snapshot.
- `npm run security:runtime:staging:evidence -- <saved-json-output>` before claiming deployed API/Console runtime readiness.
- `npm run security:staff-tenant:staging-evidence -- <saved-json-output>` before claiming production-like tenant/staff policy readiness.
- `npm run security:stripe-testmode:evidence -- <saved-json-output>` before claiming Stripe PaymentIntent, signed-webhook, capture, cancellation, refund, or reconciliation readiness.
- `npm run security:privy-plan:evidence -- <saved-json-output>` before treating Privy dashboard plan support as verified.

## Redaction Review

Saved evidence must prove that bearer tokens, Privy tokens, invite tokens, Stripe keys, Stripe client secrets, webhook secrets, QR signing secrets, raw nonces, raw signed payloads, Apple signing material, provisioning profiles, device identifiers, raw emails, wallet addresses, real ticket ids, real staff ids, real organizer ids, private keys, database URLs, production credentials, and real personal data are absent or redacted.
