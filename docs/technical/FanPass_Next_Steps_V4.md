# FanPass Next Steps V4

Status: internal development plan
Date: 2026-06-05

## Immediate Next Coding Tasks

1. Add unit tests for V4 ViewModels and mock services.
2. Add UI tests that use prototype controls for key states.
3. Add snapshot or screenshot review for Home, Event Detail, Checkout, Ticket Detail, Market, Scanner, and Profile.
4. Split large SwiftUI screen files if any view becomes difficult to maintain.
5. Add unit tests for service-protocol injection and API-backed V4 mapping.
6. Add visible local/staging environment labels for internal builds only.
7. Confirm FanPass and FanPassOps build after each structural change.

Current implementation note on 2026-06-06: V4 service protocols now exist for events, tickets, and scanner actions. `FanPassV4APIDataProvider` can map backend event/ticket/QR DTOs into Clean V4 models, while ViewModels still default to mock services for product review. FanPass and FanPassOps Debug simulator builds pass with code signing disabled.

## Backend Setup Plan

1. Create backend service scaffold or align with existing `apps/api`.
2. Add environment separation: local, staging, production.
3. Add PostgreSQL migrations based on `FanPass_Database_Schema_V4.md`.
4. Add Redis for QR nonce, cache, and optional orderbook/realtime support.
5. Add request validation, idempotency middleware, structured errors, and request IDs.
6. Add auth middleware placeholder before exposing private endpoints.
7. Add audit log writer for mutating actions.

## API Integration Plan

Recommended first API domains:

1. `GET /events`
2. `GET /events/{eventId}`
3. `GET /tickets`
4. `GET /tickets/{ticketId}`
5. `GET /tickets/{ticketId}/proof-history`

Then add mutating domains:

1. `POST /orders`
2. `POST /orders/{orderId}/payment-intent`
3. Stripe webhook endpoint.
4. `POST /tickets/{ticketId}/qr-credential`
5. `POST /check-ins`
6. Resale listing and trade endpoints.

iOS should move from mock services to repositories one domain at a time.

## Stripe Test Mode Plan

1. Keep all keys in test mode.
2. Create order reservation endpoint with expiry.
3. Create PaymentIntent endpoint on backend.
4. Return only safe iOS PaymentSheet parameters.
5. Add Stripe webhook signature verification.
6. Reconcile `payment_intent.succeeded`, failed, canceled, and refund events.
7. Issue ticket only after webhook-confirmed payment success.
8. Add refund test flow and ticket status transitions.
9. Collect release evidence before real-user beta.

## Dynamic QR Implementation Plan

1. Define canonical QR payload format.
2. Generate credential server-side only.
3. Sign payload with server-held signing key and key ID.
4. Store credential id, nonce, expiry, status, and consumption metadata in the API data layer.
5. Return short-lived payload to ticket owner.
6. Add iOS QR refresh countdown and retry state.
7. Add staff check-in endpoint with atomic redemption.
8. Add expired, duplicate, invalid, wrong event, refunded, cancelled, listed, and network failure tests.
9. Ensure raw QR payloads are never logged.

Current implementation note on 2026-06-06: the API now persists `EntryCredential` records for Prisma-backed dynamic QR/NFC payloads. Issuing a refreshed QR supersedes prior active credentials for the same ticket; accepted redemption consumes the credential in the same transaction as ticket redemption, check-in creation, audit logging, and optional ownership outbox enqueue. The memory path mirrors this lifecycle for local tests. Redis remains optional future infrastructure for cache/latency, not the source of truth.

## Core NFC Proof-Of-Concept Plan

1. Keep NFC as staff scanner workflow.
2. Define NDEF payload fixture with safe credential reference.
3. Build signed physical-device scanner test.
4. Validate readable, unreadable, expired, invalid, and duplicate states.
5. Add QR fallback for unsupported or unreadable cases.
6. Document physical-device evidence.
7. Do not imply consumer iPhone card emulation unless a supported implementation exists.

## Smart Contract Prototype Plan

1. Use testnet only, such as Sepolia, after local contracts compile and test.
2. Prototype ticket proof contract and non-transferable Access Badge contract.
3. Keep personal data off-chain.
4. Store only proof references, hashes, lifecycle states, or safe metadata.
5. Add backend relayer and transaction table.
6. Make chain sync asynchronous so ticket wallet does not depend on immediate confirmation.
7. Display safe proof fragments in Proof & History.

## Testing Plan

| Layer         | Tests                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Swift models  | Status permissions, formatting, short IDs.                                             |
| ViewModels    | Loading, success, error, empty states, prototype controls.                             |
| Mock services | Payment, listing, transfer, scanner, QR refresh, Fan Access transitions.               |
| iOS UI        | Navigation route, safe areas, ticket card overflow, QR quiet zone, market readability. |
| Backend API   | Auth, validation, idempotency, RBAC, error mapping.                                    |
| Payments      | Webhook idempotency, failed/expired/refund transitions.                                |
| QR/NFC        | Replay prevention, duplicate redemption, wrong event, expiry.                          |
| Security      | Secret scanning, log redaction, dependency advisory review, authorization tests.       |

## Suggested Development Order

1. Stabilize V4 docs and README.
2. Add iOS ViewModel/service tests.
3. Use the existing service protocols and add repositories only where API mapping or caching becomes complex enough to justify them.
4. Implement event and ticket read APIs.
5. Connect iOS Explore, Event Detail, Tickets, and Ticket Detail to staging APIs.
6. Implement Stripe test checkout and webhook reconciliation.
7. Implement dynamic QR and check-in API.
8. Implement staff scanner flow against staging API.
9. Implement resale listing/orderbook API and websocket updates.
10. Add chain proof sync.
11. Build Core NFC signed-device POC.
12. Build organizer/admin dashboard.
13. Run security, privacy, and production readiness review.

## Clarifications Needed Before Backend Development

- Final auth provider and session exchange contract.
- Marketplace model: platform seller of record, organizer seller of record, or Connect marketplace.
- Stripe Connect timing and seller payout policy.
- Exact organizer resale rules and listing reservation behavior.
- QR expiry window and offline scanner policy.
- NFC tag format and venue hardware assumptions.
- Initial chain and contract scope.
- Data retention rules for proof submissions, audit logs, payment references, and check-in logs.
