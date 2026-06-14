# FanPass Known Limitations V4

Status: internal limitations register
Date: 2026-06-05

## Summary

The current FanPass V4 app is a high-fidelity local prototype. It is useful for product review, UI/UX validation, development planning, and handoff. It is not production software and should not be used with real users, real tickets, real payments, or real venue operations.

## Mock Data Only

All data is local, deterministic, and fictional:

- Users.
- Events.
- Venues.
- Ticket IDs.
- Wallet fragments.
- Proof references.
- Market and orderbook data.
- Scanner outcomes.

No real personal data or production provider data should be added to mock fixtures.

## No Real Backend Yet

The iOS prototype does not currently call a live backend for V4 flows. Existing API client scaffolding is not the active source for V4 mock screens. Production work still needs API routes, database migrations, auth/session exchange, repositories, error mapping, observability, and security tests.

## No Real Stripe Payment Yet

Checkout is simulated. There is no live PaymentIntent, no PaymentSheet integration in the V4 prototype path, no webhook reconciliation, no real refund, no saved payment methods, and no Connect payout. Use Stripe test mode only when integration begins.

## No Real Blockchain Transaction Yet

Proof & History is simulated. There is no production or testnet contract write from the V4 prototype. Smart contract modules, relayer, transaction table, chain sync job, and proof status reconciliation remain future work.

## No Real Core NFC Reading Yet

NFC is represented as scanner-side concept and mock state. Real Core NFC reading requires:

- Signed iOS build.
- Physical device.
- Supported tag or fixture.
- NDEF payload design.
- Backend validation endpoint.
- Physical-device evidence.

Do not claim production NFC support from simulator-only behavior.

## No Production Apple Wallet Integration Yet

Add to Apple Wallet is a placeholder. Production support requires backend-generated, signed `.pkpass` files, Apple Developer configuration, pass type identifier, certificates, safe pass contents, and revocation/update strategy.

## No Real Organizer Dashboard Yet

The organizer/admin-lite role is represented in the iOS prototype but real event management, ticket policy configuration, staff assignment, refunds, audit viewing, and risk operations are not implemented as production dashboard flows.

## No Legal Compliance Layer Yet

The project does not yet include:

- Terms and purchase policy.
- Refund/cancellation legal flows.
- Marketplace seller terms.
- Consumer protection requirements by market.
- Tax handling.
- Dispute handling.
- KYC/AML requirements for payouts.

## No Production Anti-Bot System Yet

The prototype does not implement:

- Bot detection.
- Rate limiting by identity/device/IP.
- Queueing.
- Inventory hold abuse prevention.
- Account risk scoring.
- Payment risk review.

## No Real-World Venue Integration Yet

The prototype does not integrate with venue access control hardware, scanner fleet management, offline gate policies, supervisor override, support lookup, or post-event reconciliation tools.

## Current Risk Posture

The V4 prototype is safe for internal and academic review because it uses fictional data and mock integrations. It is not ready for public real-user beta until backend, payment, verification, security, privacy, and operational controls are implemented and validated.
