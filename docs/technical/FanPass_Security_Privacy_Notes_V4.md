# FanPass Security Privacy Notes V4

Status: internal security and privacy planning notes
Date: 2026-06-05

## Principles

- Personal data should stay off-chain.
- PostgreSQL should be the source of truth for private operational state.
- Blockchain records should contain proof references, hashes, and public-safe lifecycle facts only.
- Consumer UI should show masked identifiers and proof fragments, not raw provider data.
- Mutating actions require authorization, idempotency, audit logs, and safe error mapping.

## Personal Data Off-Chain

Do not write names, emails, phone numbers, payment details, raw IPs, ticket holder personal data, or support notes to chain. If a proof needs to connect to private data, store a hash or safe reference and keep the private record in backend storage with access controls.

## Wallet Address Privacy

- Display masked wallet fragments only.
- Store wallet address hashes for lookup when possible.
- Avoid using wallet address as public user identity in consumer UI.
- Do not log full wallet addresses unless an operational log requires them and redaction is configured.
- Treat embedded wallet provider IDs as sensitive references.

## Ticket Proof Data

Proof & History should display:

- Issued.
- Payment confirmed.
- Transfer/listing status.
- Refund/cancel status.
- Redemption status.
- Safe proof reference or transaction fragment.

Do not display:

- Full private payloads.
- Full QR credential.
- Full wallet address.
- Payment provider secrets.
- Internal fraud/risk notes.

## Payment Data Handling

- Use Stripe test mode until production readiness is approved.
- Backend keeps secret keys only in secret manager or protected environment variables.
- iOS receives publishable key and short-lived PaymentSheet/PaymentIntent client secret only.
- Payment webhooks are authoritative for issuing tickets.
- Webhooks must verify Stripe signatures and process idempotently.
- Never store card data directly.
- Do not put personal data, QR credentials, or private wallet details in Stripe metadata.

## QR Credential Security

- QR credentials must be short-lived and signed by backend.
- Payloads should include credential ID, event ID, ticket reference, nonce, expiry, and key ID.
- Store nonce hashes, not raw nonces.
- Use Redis set-if-not-exists or equivalent for fast replay prevention.
- Use PostgreSQL uniqueness for one accepted check-in per ticket/event.
- Do not log raw QR payloads.
- Hide or refresh QR when expired.

## NFC Credential Security

- Initial NFC scope is scanner-side NDEF reading.
- NFC payloads should be revocable references or signed short-lived credentials, not long-lived secrets.
- Store NFC tag UID hashes, not raw UIDs.
- Validate NFC through backend check-in logic.
- Provide QR fallback for unreadable tags or unsupported devices.
- Physical-device QA is required before claiming real NFC support.

## Duplicate Redemption Prevention

Required controls:

- One accepted check-in per ticket/event.
- Atomic check-in transaction.
- Credential nonce uniqueness.
- Staff event/gate assignment check.
- Idempotency key for check-in retries.
- Clear duplicate state in staff UI.

## Role-Based Access Control

Roles:

- Fan: own tickets, Fan Access, resale actions.
- Gate staff: assigned scanner operations only.
- Organizer: own events, ticket policy, staff assignments, refunds/cancellations.
- Platform admin: system-wide audit, risk, support, and operations.

Every staff, organizer, and admin endpoint must check role, tenant, event assignment, and action scope.

## Audit Log Design

Audit logs should cover:

- Auth/session events.
- Role changes.
- Ticket issue, transfer, listing, sale, refund, cancellation, redemption.
- Payment webhook processing.
- QR/NFC credential generation and redemption outcomes.
- Organizer policy changes.
- Admin overrides.

Audit logs should contain request ID, actor, role, target, action, timestamp, safe before/after summaries, and redacted context.

## Future Encryption Considerations

- Hash normalized emails where possible.
- Encrypt profile details if raw email or support data must be stored.
- Encrypt sensitive provider references at rest.
- Use Keychain for local tokens on iOS.
- Use server-side secret management for Stripe, auth, signing keys, relayer keys, and webhook secrets.
- Plan signing key rotation for QR/NFC credentials.

## Future KYC Considerations

KYC may be needed for:

- Automated seller payouts.
- Stripe Connect marketplace settlement.
- High-value resale thresholds.
- Organizer onboarding.
- Refund/dispute handling.
- Regulatory requirements by market.

Do not build automatic seller payouts until legal model, marketplace responsibilities, tax handling, and seller identity requirements are defined.

## Prohibited In Prototype Work

- Real personal data.
- Production credentials.
- Live Stripe mode.
- Production chain private keys.
- Full wallet addresses in screenshots.
- Raw QR/NFC credentials in logs or docs.
- Reuse of old pasted tokens or exposed keys.

## High-Demand Sale Security - 2026-07-12

- Queue join requires a Privy-linked FanPass account.
- Unique database constraints allow one queue place per account and app-installation hash.
- Purchase limits are checked under the same ticket-type row lock used for inventory.
- Queue-managed Stripe intents are card-only and use manual capture.
- Stripe card fingerprints and iOS app-installation IDs are HMAC-hashed before storage.
- Simultaneous use of one card across accounts is serialized with an event-scoped PostgreSQL advisory lock.
- A missing card identity signal fails closed for queued settlement; the webhook transaction rolls back for retry instead of bypassing the link check.
- A rejected identity decision blocks the hold, rejects the order, skips ticket issuance, and queues authorization cancellation.
- Expired queue holds cannot be reclaimed by delayed webhooks.
- Public responses contain aggregate blocked/expired counts only. Device/card hashes, identities, and risk decisions remain private.

The Keychain app-installation ID is not proof of one human. Before a concert-scale launch, require managed edge admission, App Attest/DeviceCheck, verified phone recovery, velocity/identity graph checks, policy-versioned audit logs, and a review/appeal path. Exact risk weights must remain private. See `docs/technical/FanPass_High_Demand_Onsale_Design_V4.md`.
