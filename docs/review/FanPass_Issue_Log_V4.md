# FanPass Issue Log V4

Status: internal final review issue log
Date: 2026-06-05

## Issue Summary

| ID | Severity | Area | Status | Summary |
| --- | --- | --- | --- | --- |
| FP-V4-001 | Medium | Prototype controls | Fixed | Profile controls changed only local Profile state, not root app scenario. |
| FP-V4-002 | Medium | Backend readiness | Open | Real API repository layer is not implemented yet. |
| FP-V4-003 | High | Payments | Open | Stripe checkout is simulated; production issuance/reconciliation is not implemented. |
| FP-V4-004 | High | Verification | Partial | Local backend/Ops QR signing and redeem foundations exist; durable credential lifecycle and real staging evidence remain open. |
| FP-V4-005 | Medium | NFC | Partial | Core NFC/Ops local validation plumbing exists; signed physical-device proof remains open. |
| FP-V4-006 | Medium | Resale | Open | Orderbook/listing state is mock-only and not server-enforced. |
| FP-V4-007 | Medium | Chain proof | Partial | Local contracts now support safe proof hashes and dry-run deployment; testnet custody/proof sync remains open. |
| FP-V4-008 | Low | Documentation | Fixed | Final internal review docs did not exist before this step. |

## Fixed Issues

### FP-V4-001: Prototype Controls Root-State Sync

Severity: Medium

Problem:

`FanPassV4ProfileView` owned its own `ProfileViewModel`. Applying `Prototype Controls` updated the local Profile user state but did not notify `FanPassRootViewModel`. This meant role changes such as gate staff or organizer-lite were not consistently reflected at root app level.

Fix:

- Added `user` and `onScenarioApplied` inputs to `FanPassV4ProfileView`.
- Updated `FanPassV4MainTabView` to pass root user and call `viewModel.switchScenario`.
- Updated staff-mode visibility to consider local applied role state.

Verification:

- `FanPass` simulator build passed.
- `FanPassOps` simulator build passed.

### FP-V4-008: Missing Final Review Artifacts

Severity: Low

Problem:

The prototype had brand, UX, product, and technical docs, but no final internal review bundle.

Fix:

Created:

- `docs/review/FanPass_Final_Internal_Review_V4.md`
- `docs/review/FanPass_Issue_Log_V4.md`
- `docs/review/FanPass_Implementation_Status_V4.md`
- `docs/review/FanPass_Next_Development_Plan_V4.md`

## Open Issues

### FP-V4-002: Repository/API Integration Layer Missing

Severity: Medium

Impact:

ViewModels currently call mock services directly. This is appropriate for the prototype, but backend integration should not patch live API calls into views or ad hoc mock services.

Recommended fix:

Add service protocols and repository implementations before connecting real APIs.

### FP-V4-003: Stripe Checkout Is Simulated

Severity: High

Impact:

No real PaymentIntent, PaymentSheet, Apple Pay, webhook verification, refund, or reconciliation exists in the V4 flow.

Recommended fix:

Implement Stripe test mode only, with backend-owned PaymentIntent creation and webhook-driven ticket issuance.

### FP-V4-004: Dynamic QR Security Needs Durable Credential Lifecycle

Severity: High

Impact:

V4 Ticket Detail still uses a mock QR placeholder. The backend/Ops local foundation now supports versioned signed payloads, expiry, duplicate rejection, and NFC payload routing, but production-like credential lifecycle and real staging evidence are not complete.

Recommended fix:

Add Redis/durable credential storage, connect V4 repositories to the backend QR refresh path, and collect real HTTPS staging scanner evidence before external use.

### FP-V4-005: NFC Requires Physical-Device Proof

Severity: Medium

Impact:

FanPass Ops has local Core NFC NDEF plumbing and backend validation for supported Text/URI payloads. Simulator and local paste fallback cannot prove physical Core NFC behavior.

Recommended fix:

Build signed FanPassOps test on a physical device with supported NDEF fixture.

### FP-V4-006: Resale Is Not Server-Enforced

Severity: Medium

Impact:

Organizer cap, listing reservation, ownership transfer, payout, and trade settlement are simulated.

Recommended fix:

Implement listing/trade APIs and enforce all resale rules server-side.

### FP-V4-007: Chain Proof Sync Missing

Severity: Medium

Impact:

Proof & History is mock-only; local contracts and dry-run deployment exist, but no testnet transaction is written, reconciled, or displayed from backend chain sync.

Recommended fix:

Prototype testnet deployment only after custody boundaries are ready, then add asynchronous proof sync through the durable outbox and display safe proof fragments in Proof & History.

## Non-Issues / Confirmed Safe Findings

- V4 app source uses fictional event names only.
- V4 source uses `example.test` emails and masked wallet fragments.
- Matches for `NFT`, `seed phrase`, `gas fee`, `ape`, `pump`, or `moon` are avoid-lists or documentation warnings, not consumer-facing V4 UI copy.
- Matches for Stripe/secret-looking strings are denylist checks, placeholders, or security rules, not real credentials.
- Competitor names appear in brand/product reference documentation only, not as copied UI assets or event data.
