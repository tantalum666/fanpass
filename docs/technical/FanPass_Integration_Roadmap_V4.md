# FanPass Integration Roadmap V4

Status: implementation roadmap
Date: 2026-06-05

## Phase 1: iOS UI Prototype

Current status: in progress/mostly complete for V4 mock prototype.

Deliverables:

- Clean V4 design system.
- SwiftUI navigation and core screens.
- Mock data and prototype controls.
- Visual QA on simulator.

Exit criteria:

- FanPass and FanPassOps build.
- Key flows are navigable.
- No QR in list cards.
- Prototype controls support internal state review.

## Phase 2: Backend API Foundation

Deliverables:

- API service scaffold.
- PostgreSQL migrations.
- Redis connection.
- Auth middleware placeholder.
- Request validation.
- Idempotency middleware.
- Structured audit logs.

Implement first:

- Events.
- Ticket types.
- Tickets.
- Orders.
- Proof history.

## Phase 3: Authentication And Embedded Wallet

Deliverables:

- Privy or embedded wallet provider integration.
- Session exchange endpoint.
- iOS session manager.
- Wallet linking table.
- Masked ticket identity UI.

Security:

- Treat pasted/old tokens as exposed.
- Store only safe references.
- No raw wallet/private key exposure.

## Phase 4: Stripe Test Checkout

Deliverables:

- PaymentIntent creation endpoint.
- iOS PaymentSheet test mode.
- Stripe webhook receiver.
- Order/payment reconciliation.
- Payment failed/expired handling.

Exit criteria:

- Test-mode purchase creates ticket only after reconciled payment success.
- Refund test flow updates ticket and proof history.

## Phase 5: Ticket Database And Ticket Wallet

Deliverables:

- Ticket inventory tables.
- Wallet API.
- Ticket detail API.
- Lifecycle statuses.
- Proof history API.
- iOS repository/cache.

Exit criteria:

- iOS wallet loads real staging data.
- Active/listed/refunded/cancelled/redeemed states render from backend.

## Phase 6: Smart Contract Testnet Prototype

Deliverables:

- EVM testnet contracts.
- Backend relayer.
- Ticket proof sync job.
- Blockchain transaction table.
- Proof & History safe proof fragments.

Exit criteria:

- Test ticket sync writes proof record.
- Chain failure does not break ticket wallet.

## Phase 7: Dynamic QR Verification

Deliverables:

- QR credential generation endpoint.
- Signing key management.
- Redis nonce/replay prevention.
- iOS QR refresh.
- Staff scanner check-in endpoint.

Exit criteria:

- Expired, duplicate, invalid, wrong event, cancelled/refunded states verified.

## Phase 8: Core NFC Proof Of Concept

Deliverables:

- NDEF fixture format.
- Staff scanner NFC read.
- NFC validation endpoint.
- NFC failure states.
- Physical-device evidence.

Exit criteria:

- Signed device can read supported tag and map to check-in result.

## Phase 9: Controlled Resale Orderbook

Deliverables:

- Listing API.
- Resale cap validation.
- Ticket reservation during listing.
- Trade lifecycle.
- Market snapshots.
- WebSocket updates.

Exit criteria:

- Buyer can purchase resale ticket in test mode.
- Seller listing state and buyer wallet update correctly.

## Phase 10: Admin/Organizer Dashboard

Deliverables:

- Organizer tenant tools.
- Event/ticket type management.
- Staff assignments.
- Refund/cancel actions.
- Audit log viewer.
- Market risk review.

Exit criteria:

- Organizer can configure event policies without direct database access.

## Phase 11: Security Testing

Deliverables:

- Threat model.
- API authorization tests.
- QR replay tests.
- Payment webhook idempotency tests.
- Resale cap bypass tests.
- Privacy redaction tests.
- Dependency advisory review.

Exit criteria:

- Critical/high findings fixed or explicitly risk accepted for closed beta.

## Phase 12: Production Hardening

Deliverables:

- Environment separation.
- Secret rotation.
- Observability.
- Backups and restore drills.
- Incident runbooks.
- Rate limits.
- Fraud/risk monitoring.
- Signed iOS/TestFlight.
- Physical QR/NFC QA.

Exit criteria:

- Production readiness review completed.
- No live Stripe or production chain usage without release evidence.

## Recommended Build Order

1. Backend API foundation.
2. PostgreSQL schema/migrations.
3. Auth/session and wallet link.
4. Stripe test checkout.
5. Ticket wallet from backend.
6. Dynamic QR/check-in.
7. Resale orderbook.
8. Chain proof sync.
9. NFC physical POC.
10. Organizer dashboard.

## Optional Web Beta Fallback

The optional web fallback is a backup path only while Apple Developer/TestFlight/Apple Wallet work is blocked. Keep it separate from the native iOS implementation and evidence gates.

Build order for the fallback, if started:

1. Create a separate `apps/web` Vite React package.
2. Reuse Clean V4 tokens and the existing API contracts.
3. Implement the first landing page as a long-scroll, low-density premium website: trusted ticket identity, controlled resale, transparent prices, organizer/fan confidence, and fallback availability.
4. Implement event discovery, event detail, login, ticket wallet, dynamic QR display, checkout, resale, market overview, Proof & History, and Fan Access after the landing direction is stable.
5. Add QR-only staff scanner fallback with backend-authoritative redemption if needed.
6. Add dedicated web fallback docs and evidence checks.

Do not include Web NFC in the fallback. Do not use the fallback to close signed iOS/TestFlight, Apple Wallet `.pkpass`, FanPass Ops physical QR/NFC, or chain custody evidence. Do not make QR, scanner mechanics, Web3 terminology, or web/iOS sync the landing page value proposition.

## Cross-Phase Risks

- Payment/ticket issuance race conditions.
- QR replay and duplicate entry.
- Wallet privacy leakage.
- Resale cap bypass.
- Chain sync failure recovery.
- NFC physical-device limitations.
- Staff role misuse.
- Dependency/security advisories.
