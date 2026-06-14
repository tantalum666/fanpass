# FanPass System Architecture V4

Status: future implementation readiness plan
Date: 2026-06-05
Scope: production-like architecture planning. No presentation content.

## Overall Architecture

Text diagram:

```text
Native iOS App
  |-- Fan tabs: Home / Explore / Market / Tickets / Profile
  |-- Staff scanner mode: QR scan / NFC scan / manual lookup
  |-- Local secure state: Keychain, LocalAuthentication, cached wallet/ticket summaries
  |
  v
Backend API Gateway
  |-- Auth/session middleware
  |-- Rate limiting and abuse controls
  |-- Request validation and idempotency
  |
  +--> User/Event/Ticket Services ----> PostgreSQL
  +--> Order/Resale Services ---------> PostgreSQL + Redis
  +--> Payment Service ---------------> Stripe
  +--> Wallet/Auth Service -----------> Privy or embedded wallet provider
  +--> Verification Service ----------> Redis + PostgreSQL
  +--> Blockchain Sync Service -------> EVM RPC / indexer
  +--> Admin/Organizer Service -------> Audit logs + role policies
  |
  v
External Integrations
  |-- Stripe PaymentIntent, PaymentSheet, Apple Pay, webhooks, Connect later
  |-- Privy or embedded wallet provider
  |-- EVM-compatible testnet/mainnet RPC
  |-- Apple Wallet / PassKit later
  |-- Push notification service later
```

## iOS Client Layer

- Native SwiftUI app using Clean V4 design system.
- MVVM as the primary UI state pattern.
- Service/repository layer hides transport and persistence.
- Staff scanner mode is available only for accounts with staff permission.
- Dynamic QR display is owner-only and never appears on list cards.
- Core NFC is scanner-side proof of concept first; do not imply consumer iPhone card emulation.

## Backend Service Layer

- API gateway handles auth, rate limits, JSON schema validation, and idempotency keys.
- Domain services:
  - Auth/user service.
  - Organizer/event service.
  - Ticket inventory service.
  - Order/payment service.
  - Resale/orderbook service.
  - Fan Access service.
  - Wallet/blockchain sync service.
  - Verification/check-in service.
  - Proof history service.
- Use durable transactional writes for tickets/orders/payments/check-ins.
- Use async jobs for blockchain writes, webhook reconciliation, emails, and analytics.

## Database Layer

- PostgreSQL is the system of record.
- Strong foreign keys for user, organizer, event, ticket, order, listing, payment, and check-in relationships.
- Use append-only proof/audit records for lifecycle transitions.
- Use partial unique indexes for active listings, active QR credentials, and duplicate check-in prevention.
- Store sensitive identifiers as provider-safe references or encrypted fragments where possible.

## Cache Layer

- Redis stores short-lived QR nonce status, scanner rate limits, order reservations, event market snapshots, and websocket fan-out state.
- Do not store long-lived secrets or raw private credentials in Redis.
- QR nonce replay prevention should use atomic set-if-not-exists or compare-and-set semantics.

## Payment Layer

- Stripe is primary for MVP card and Apple Pay flows.
- Primary checkout uses PaymentIntent and Stripe iOS PaymentSheet.
- Apple Pay is surfaced through Stripe where supported.
- Webhooks are authoritative for payment state reconciliation.
- Stripe Connect is future scope for marketplace seller payouts.
- Stablecoin/MoonPay is optional future extension, not MVP primary payment.

## Wallet/Auth Layer

- Privy or another embedded wallet provider handles user auth and wallet abstraction.
- Backend stores provider user ID, wallet address fragment, auth subject, and linked account status.
- Consumer UI says `Ticket identity`, not seed phrase or raw wallet.
- Backend must never trust a client-supplied wallet address without verifying session ownership.

## Blockchain Layer

- EVM-compatible testnet first, with backend-controlled settlement and gas sponsorship.
- Contracts can represent ticket records, Access Badge credentials, transfer policies, and redemption status references.
- PostgreSQL remains source of truth for checkout, PII, payment, scanner logs, and operational state.
- On-chain records should use safe metadata references and hashes, not personal data.

## Scanner Verification Layer

- QR credentials are short-lived signed payloads with nonce, ticket ID fragment, event ID, expiry, and signature.
- Scanner verifies signature/expiry and calls backend check-in endpoint.
- Backend prevents replay and duplicate redemption transactionally.
- NFC uses NDEF payloads in staff scanner proof-of-concept; NFC validation maps into the same check-in pipeline as QR.
- Offline fallback can verify signed payload shape but must sync before final redemption when possible.

## Admin/Organizer Layer

- Organizer tools manage events, venues, ticket types, resale caps, transfer rules, Fan Access tasks, staff assignments, and refunds.
- Admin tools handle audit logs, suspicious resale patterns, payment reconciliation, and blockchain sync failures.
- Admin actions must write immutable audit records with actor, role, target, before/after summary, and safe metadata.

## External Integrations

| Integration | Role | MVP status |
| --- | --- | --- |
| Stripe PaymentIntent/PaymentSheet | Primary checkout and Apple Pay | Phase 4 |
| Stripe webhooks | Payment truth and reconciliation | Phase 4 |
| Stripe Connect | Marketplace seller payouts | Later marketplace phase |
| Privy/embedded wallet | Auth and wallet abstraction | Phase 3 |
| EVM RPC/indexer | Ticket proof and sync | Phase 6 |
| Core NFC | Scanner-side NFC credential read | Phase 8 |
| PassKit/Apple Wallet | Add-to-wallet signed pass | After ticket database and signing plan |
| Redis | QR nonce, reservations, realtime state | Backend foundation |
