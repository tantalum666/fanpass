# FanPass Next Development Plan V4

Status: next-phase internal plan
Date: 2026-06-05

## Recommended Phase

Start backend integration foundation. The iOS prototype is ready to stop expanding mock UI scope and begin replacing mock domains with staging-safe services.

Do not start with live payments, production chain writes, public real-user data, or production credentials.

## Development Principles

- Keep Clean V4 unchanged as the visual source of truth.
- Keep real personal data out of fixtures and screenshots.
- Keep Web3 infrastructure hidden behind user-friendly copy.
- Preserve MVVM boundaries.
- Replace mocks with repositories one domain at a time.
- Use Stripe test mode only.
- Use testnet only for chain experiments.
- Keep Prototype Controls debug/internal only.

## Phase 1: iOS Stabilization And Test Harness

Priority: P0

Tasks:

1. Add service protocols for auth, events, tickets, payments, market, scanner, fan access, wallet, and proof history.
2. Add repository interfaces that can use either mock services or API clients.
3. Add ViewModel unit tests for payment, listing, transfer, scanner, QR refresh, Fan Access, and profile controls.
4. Add UI tests using Prototype Controls to reach success, empty, and error states.
5. Add screenshot checks for core screens after large UI changes.

Exit criteria:

- FanPass and FanPassOps build.
- ViewModel tests cover key state transitions.
- Prototype Controls can drive review states without manual data edits.

## Phase 2: Backend Read APIs

Priority: P0

Tasks:

1. Implement events, venues, ticket types, tickets, and proof history tables.
2. Add read endpoints for `GET /events`, `GET /events/{eventId}`, `GET /tickets`, `GET /tickets/{ticketId}`, and `GET /tickets/{ticketId}/proof-history`.
3. Add request IDs, structured errors, and response validation.
4. Connect Explore, Event Detail, Tickets, and Ticket Detail through repositories.
5. Keep mock fallback for previews and tests.

Exit criteria:

- iOS loads staging-safe event and wallet data from backend.
- No real personal data is required.
- Error states map to product copy.

## Phase 3: Auth And Wallet Reference

Priority: P0

Tasks:

1. Define auth/session exchange.
2. Store tokens in Keychain if provider SDK requires it.
3. Add user role sync and role-gated scanner access.
4. Store wallet address hashes/fragments only.
5. Keep full wallet addresses hidden by default.

Exit criteria:

- Staging user can sign in and retrieve safe profile/wallet reference.
- Staff role can access scanner mode only when authorized.

## Phase 4: Stripe Test-Mode Checkout

Priority: P1

Tasks:

1. Add order reservation with expiry and idempotency.
2. Add Stripe PaymentIntent creation endpoint.
3. Add iOS PaymentSheet test-mode integration.
4. Add webhook signature verification.
5. Issue tickets only after `payment_intent.succeeded` is reconciled.
6. Add failed, canceled, expired, and refund states.

Exit criteria:

- Test-mode purchase creates a ticket only after backend confirmation.
- Test refund disables entry/resale and writes Proof & History.

## Phase 5: Dynamic QR And Staff Check-In

Priority: P1

Current local status:

- Versioned signed QR payload generation is implemented.
- Base64url HMAC signatures and `kid` are implemented.
- Owner hash, expiry, ticket status, gate assignment, duplicate nonce rejection, and listed-ticket blocking are tested.
- FanPass Ops NFC payload capture now sends NDEF payloads to `/verification/nfc/validate`.
- NFC NDEF Text/URI payload normalization and wrong-event rejection are tested.

Tasks:

1. Add Redis replay lock for distributed scanner deployments.
2. Add durable QR credential table for production credential lifecycle.
3. Connect FanPass V4 Ticket Detail QR refresh to backend repositories.
4. Connect FanPass V4 scanner demo states to API-backed scanner results or keep them mock-only explicitly.
5. Save real HTTPS staging QR/NFC evidence.
6. Keep raw QR/NFC payloads out of logs and evidence files.

Exit criteria:

- Valid, expired, duplicate, invalid, wrong event, cancelled, refunded, listed, and network error states are tested.
- Raw QR payloads are not logged.

## Phase 6: Controlled Resale

Priority: P1

Tasks:

1. Add resale listing API.
2. Enforce transferable status, active ticket status, resale cap, and one open listing per ticket.
3. Reserve entry eligibility while listing is open according to organizer rule.
4. Add trade/purchase flow in Stripe test mode.
5. Add market snapshots and websocket updates.

Exit criteria:

- Buyer can purchase resale ticket in test mode.
- Seller listing closes and ticket ownership changes after payment reconciliation.
- Orderbook remains readable for normal fans.

## Phase 7: Blockchain Proof Sync

Priority: P2

Current local status:

- `FanPassTicket` stores safe ticket, ticket type, policy, and metadata hashes and supports minted/redeemed/cancelled/refunded states.
- `FanPassSoulbound` stores safe Access Badge proof hashes and blocks transfer.
- `RedemptionRegistry` stores duplicate-protected redemption context hashes.
- Local Hardhat tests and local deployment dry-run pass under Node 22.
- No Sepolia deployment, vault/KMS signer, multisig/timelock control, or backend proof sync evidence exists yet.

Tasks:

1. Decide the initial testnet and contract-control scope.
2. Add a deployment runbook that assumes vault/KMS or delegated signer custody and multisig/timelock ownership.
3. Add backend relayer and transaction table.
4. Sync proof status asynchronously through the durable side-effect outbox.
5. Display safe proof fragments in Proof & History.
6. Handle chain failure without breaking wallet UX.
7. Save chain custody evidence only after real custody, contract control, and outbox proof pass the validator.

Exit criteria:

- Test ticket writes a proof record after backend source-of-truth state changes.
- Chain delay/failure produces a safe pending/failure proof state.

## Phase 8: Core NFC Physical POC

Priority: P2

Current local status:

- FanPass Ops includes Core NFC NDEF reading support.
- NDEF Text and URI payloads are normalized client-side and backend-side.
- NFC backend validation reuses signed-entry redemption rules.

Tasks:

1. Define NDEF payload fixture.
2. Build signed FanPassOps app on physical iPhone.
3. Read supported NFC tag.
4. Validate NFC payload through staging endpoint.
5. Document unreadable, invalid, expired, duplicate, and QR fallback states.

Exit criteria:

- Physical-device evidence proves at least one supported NFC flow.

## Phase 9: Organizer/Admin Foundation

Priority: P2

Tasks:

1. Create organizer tenant model and role assignment.
2. Build event/ticket type creation.
3. Add resale policy configuration.
4. Add staff assignment.
5. Add refund/cancel actions.
6. Add audit log viewer.

Exit criteria:

- Organizer can configure a staging event without direct database access.

## Phase 10: Production Hardening

Priority: P3

Tasks:

1. Environment separation and secret rotation.
2. Dependency advisory review and risk acceptance policy.
3. Rate limits and anti-bot controls.
4. Observability and incident runbooks.
5. Database backup/restore drills.
6. Privacy redaction tests.
7. Signed TestFlight build.
8. Physical QR/NFC QA.
9. Legal/compliance review.

Exit criteria:

- Public beta readiness review passes with no unresolved critical/high security issues.

## Highest-Priority Next Tasks

1. Add service protocols/repositories.
2. Add ViewModel/mock service tests.
3. Implement backend read APIs for events/tickets/proof history.
4. Connect iOS read-only flows to staging backend.
5. Start Stripe test-mode checkout only after order reservation and webhook reconciliation are ready.

## Decisions Needed

- Final auth provider/session contract.
- Whether organizer dashboard remains web-first or gets admin-lite iOS scope.
- Marketplace seller-of-record and Stripe Connect timing.
- QR expiry duration and offline scanner policy.
- NFC tag/wristband hardware assumptions.
- Initial testnet and contract scope.
- Data retention for proof submissions, check-ins, audit logs, and payment references.
