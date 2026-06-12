# FanPass Stripe Integration Plan V4

Status: future payment integration plan
Date: 2026-06-05

## Positioning

Stripe is the primary MVP payment provider for FanPass because it supports mainstream card payments, Apple Pay through supported flows, PaymentIntent-based confirmation, mobile PaymentSheet, webhooks, refunds, and future marketplace settlement through Stripe Connect.

MoonPay or stablecoin payments are optional future extensions, not the core MVP payment rail.

## Primary Checkout

Flow:

1. iOS user selects event and ticket type.
2. Backend creates `orders` reservation with expiry and idempotency key.
3. Backend creates Stripe PaymentIntent for the order amount.
4. Backend returns PaymentSheet parameters to iOS.
5. iOS presents Stripe PaymentSheet.
6. Stripe confirms payment method and PaymentIntent.
7. Backend receives webhook and reconciles payment state.
8. Backend issues ticket and writes proof history.
9. iOS polls or receives updated order status and shows Purchase Success.

## PaymentIntent

Use PaymentIntent for:

- Amount and currency.
- Order association.
- Idempotent creation.
- Metadata with safe internal order reference.
- Capture/refund status.

Do not put private user data, raw ticket payloads, QR credentials, or secrets in metadata.

## PaymentSheet For iOS

iOS should receive only:

- `paymentIntentClientSecret`.
- `customerId` if saved payment methods are enabled.
- ephemeral key if required by the selected Stripe iOS configuration.
- publishable key.

Backend keeps Stripe secret key server-side only.

## Apple Pay Through Stripe

- Apple Pay appears as a supported payment option when device, region, merchant capability, and Stripe configuration are valid.
- Use Stripe-supported Apple Pay configuration rather than building a separate payment rail first.
- Treat Apple Pay success UI as payment authorization; backend webhook reconciliation remains authoritative.

## Webhooks

Required webhook events:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.refunded`
- `refund.created`
- `refund.updated`
- Connect events later for connected-account settlement.

Webhook rules:

- Verify Stripe signature.
- Use idempotent event processing.
- Store webhook event ID and processing result.
- Never trust only client-side completion.

## Payment Status Transitions

| FanPass order state | Stripe-related trigger                              |
| ------------------- | --------------------------------------------------- |
| `reserved`          | Order created before PaymentIntent.                 |
| `payment_pending`   | PaymentIntent created.                              |
| `authorized`        | Client confirms or PaymentIntent processing begins. |
| `paid`              | `payment_intent.succeeded` reconciled.              |
| `ticket_issued`     | Ticket rows created after paid state.               |
| `failed`            | `payment_intent.payment_failed`.                    |
| `expired`           | Reservation expired or PaymentIntent canceled.      |
| `refunded`          | Refund webhook reconciled.                          |

## Refund Flow

1. Organizer/admin triggers eligible refund.
2. Backend validates event/ticket/payment state.
3. Backend creates Stripe refund.
4. Ticket status moves to pending refund or refunded after webhook.
5. Proof history records safe refund state.
6. Wallet disables QR, transfer, and resale.

## Marketplace Settlement Concept

Primary resale MVP can keep settlement off-chain and off-Connect initially:

- Buyer pays platform order.
- Ticket ownership transfers only after payment success.
- Seller payout can remain manual/mock until Connect is ready.

Future Stripe Connect:

- Onboard sellers or organizers as connected accounts.
- Use platform-controlled marketplace flow.
- Apply application fees.
- Manage disputes/refunds with clear merchant-of-record decision.

## Stripe Connect Future Use

Connect is appropriate when FanPass pays organizers or verified fan sellers automatically. It introduces onboarding, KYC, account status, payout timing, dispute, tax, and negative-balance responsibilities.

Do not ship automatic seller payouts until:

- Legal/marketplace model is decided.
- Seller identity requirements are complete.
- Refund/dispute policy is documented.
- Risk monitoring is implemented.

## Stablecoin Payment Extension

Stablecoin payment can be considered later for specific markets or organizer settlement, but should not replace Stripe for consumer MVP. It complicates refunds, chargebacks, compliance, support, and mainstream UX.

## Why Stripe Primary And MoonPay Optional

Stripe:

- Mainstream card/wallet checkout.
- Strong mobile SDK support.
- Webhooks and reconciliation.
- Refund/dispute tooling.
- Future Connect marketplace path.

MoonPay:

- Useful for crypto on-ramp/off-ramp.
- Not a replacement for everyday ticket checkout.
- Adds compliance and refund complexity.

## Mock-Only For Now

- Live charges.
- Live Apple Pay merchant configuration.
- Stripe Connect payouts.
- Saved payment method storage.
- Refund execution.
- Dispute handling.
- Stablecoin/MoonPay flow.

## 2026-06-11 Native V4 Checkout Wiring

Status: client wiring compiled; real provider evidence remains open

The V4 iOS Checkout screen now uses the existing backend and native Stripe SDK boundary:

1. Create an API order with an iOS-generated idempotency key.
2. Create a backend PaymentIntent with a second iOS-generated idempotency key.
3. Reject empty or mock `pi_mock` client secrets before presenting Stripe UI.
4. Present the existing `FanPassStripePaymentSheetPresenter` with `FanPassEnvironment.stripeReturnURL`.
5. Map PaymentSheet completion to `Payment authorized`, not `Payment complete`.

Required before calling this payment-ready:

- `FANPASS_STRIPE_PUBLISHABLE_KEY` must be a Stripe test publishable key in the iOS build settings.
- The backend must run with Stripe test secret/webhook configuration and return a real test-mode PaymentIntent client secret.
- Webhook reconciliation must issue/update the ticket before UI can show a purchase as captured/complete.
- Saved evidence must be collected against the real HTTPS staging API and pass the relevant validators.

## 2026-06-12 Native V4 Checkout Testability Update

Status: simulator purchase path verified; real Stripe evidence still open

Client changes:

- Checkout actions now render immediately after the price breakdown so `Complete simulator purchase` and `Pay with Stripe` are visible and tappable above the iOS Tab Bar.
- The fan app prioritizes API events with real `ticketTypes`; current simulator QA opened `FanPass Demo Concert` / `CAT 2` / `HK$1,288` / `100 left`.
- Guest users can browse events, but checkout is gated. `Buy Ticket` opens a local auth sheet until a fan session exists.
- Local `Continue as test fan` sessions can complete only simulator purchase. They are explicitly blocked from real Stripe PaymentSheet because the local review token is not a staging API bearer token.
- Real Stripe remains available only after Account Privy sign-in produces an API-online FanPass session and the backend returns a non-mock Stripe test PaymentIntent client secret.

Simulator verification:

```bash
xcodebuild -quiet -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Beta -destination 'platform=iOS Simulator,id=41D28602-FF01-4E4C-98AA-DA7F4FC93D27' -derivedDataPath outputs/ios-sim-build/FanPassBeta build
npm --workspace apps/api run typecheck
```

XcodeBuildMCP UI automation verified guest `Buy Ticket` auth gating, test-fan Checkout rendering, and `Complete simulator purchase` reaching `Payment complete`. Evidence screenshot: `outputs/ios-sim-screenshots/fanpass-checkout-payment-complete.png`.

Backend seed note:

- `apps/api/src/common/demo-seed.ts` now contains additional priced demo events for future staging/demo seed runs.
- This does not prove current Render staging database insertion. Do not claim real Stripe end-to-end readiness until HTTPS staging has a Privy-authenticated order, non-mock PaymentIntent, and webhook settlement evidence.

## 2026-06-12 Privy Routing And Buyer Role Update

Status: client routing fixed; real Stripe evidence still open

Important checkout identity boundary:

- `FanPass Ops` staff login is not a consumer checkout session.
- Backend order creation is guarded by `@Roles("FAN", "ADMIN")`; `GATE_STAFF` cannot create buy orders.
- To test Stripe in the fan app, sign into the fan app with a Privy account that syncs to a `FAN` session and returns a non-empty FanPass API bearer token.

Client fixes:

- The auth sheet `Open Privy sign-in` action now routes directly to Account > Security instead of only closing the sheet.
- Tickets guest state uses the same direct Account > Security route.
- Checkout now rejects missing/empty `session.accessToken` before Stripe readiness or PaymentIntent creation. This prevents the misleading state where UI said order creation was ready but the API returned `Authentication is required`.
- Checkout explicitly blocks staff-role purchase attempts and explains that staff access belongs in `FanPass Ops`.

Verification:

```bash
xcodebuild -quiet -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Beta -destination 'platform=iOS Simulator,id=41D28602-FF01-4E4C-98AA-DA7F4FC93D27' -derivedDataPath outputs/ios-sim-build/FanPassBeta build
npm --workspace apps/api run typecheck
```

XcodeBuildMCP UI automation verified the buy auth sheet and Tickets guest state both route to Account > Security with the Privy sign-in controls visible. Screenshot: `outputs/ios-sim-screenshots/fanpass-privy-signin-routed.jpg`.

## 2026-06-12 Privy Bearer Preservation Fix

Status: client bearer handling fixed; real Stripe evidence still open

Backend behavior:

- Privy sync returns `accessToken: null` by design.
- Subsequent protected API calls should use the Privy access token as `Authorization: Bearer ...`.

Client issue:

- V4 iOS stored the synced FanPass session with `accessToken == nil`.
- Checkout then correctly refused Stripe because the session had no FanPass API bearer token, even though the mapped user role could show `FAN`.

Fix:

- `UserSession.withAccessToken(_:)` now creates a session copy with an explicit bearer.
- `FanPassBackendContext.loginWithPrivyEmailCode` stores `fanPassSession.accessToken ?? privySession.accessToken`.
- Legacy `AppState.loginWithPrivyAccessToken` stores `fanPassSession.accessToken ?? accessToken`.

Verification:

```bash
xcodebuild -quiet -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Beta -destination 'platform=iOS Simulator,id=41D28602-FF01-4E4C-98AA-DA7F4FC93D27' -derivedDataPath outputs/ios-sim-build/FanPassBeta build
npm --workspace apps/api run typecheck
```

Next real Stripe check:

- Rebuild/reinstall the fan app.
- Sign in from the fan app Account > Security using a Privy account that syncs as `FAN`.
- Retry `Pay with Stripe`; if the backend Stripe config is valid, the app should now have a bearer token for `/orders` and `/payments/intents`.
- Do not claim TestFlight, physical device, QR/NFC, Wallet, or chain-custody readiness from this pass.

## 2026-06-12 Checkout Result Feedback And Wallet Sync

Status: simulator UX fixed; backend settlement evidence still open

Owner-reported issue:

- Stripe test-card payment could complete, but the app showed no clear success/failure result.
- After payment success, the Tickets tab still showed no newly purchased ticket.

Client fix:

- `FanPassV4CheckoutView` now presents a result sheet for successful, failed, and cancelled checkout.
- Successful simulator or Stripe checkout records a session-scoped ticket and offers `View in Tickets`.
- `FanPassBackendContext` now stores `pendingCheckoutTickets` and wraps API ticket loading so checkout-created tickets appear in the wallet until the backend returns a matching final ticket.
- `FanPassRootViewModel.openTickets()` routes directly to the Tickets tab.

Boundary:

- For real Stripe, the immediate wallet entry is a client-visible checkout ticket-sync state.
- Entry QR still depends on a backend-recognized final ticket record.
- This pass does not close webhook settlement, payment capture, TestFlight, physical QR/NFC, Wallet, or chain-custody evidence.

Verification:

```bash
xcodebuildmcp build_sim FanPass Beta
xcodebuildmcp install_app_sim
xcodebuildmcp launch_app_sim
```

XcodeBuildMCP UI smoke verified guest Home -> Event Detail -> Buy -> Continue as test fan -> Buy -> Complete simulator purchase -> `Simulator purchase complete` -> `View in Tickets` -> Tickets tab with Upcoming `5 tickets`. Installed executable hash matched build product hash `dfaee9f1cce606f4417762c3420811f4b085dc9c6011bffcc6cd4f2154a86508`.

## 2026-06-12 Backend Primary Ticket Settlement After Stripe Authorization

Status: backend path implemented; staging evidence still required

Previous gap:

- `ORDER_MATCH_AFTER_PAYMENT_AUTH` only retried orderbook matching.
- A primary BUY order with an authorized payment and no resale SELL ask could stay without an authoritative backend `Ticket`.

Backend fix:

- `OrderbookService.settleAfterPaymentAuthorization(orderId)` tries resale settlement first, preserving existing SELL ask matching and trade settlement behavior.
- If no resale ask exists, the method requires an authorized payment, issues a primary backend ticket to the buyer, marks the BUY order `SETTLED`, attaches `ticketId`, and writes `ORDER_PRIMARY_TICKET_ISSUED`.
- Primary issuance queues payment capture with a primary-ticket idempotency key and `tradeId: null`.
- Primary ticket issue failure marks the order `REJECTED`, cancels any already-issued ACTIVE primary ticket if final settlement persistence fails, and queues payment cancel/refund compensation with reason `primary_ticket_issue_failed`.
- `SideEffectWorkerService` now calls `settleAfterPaymentAuthorization` for `ORDER_MATCH_AFTER_PAYMENT_AUTH` and returns `ticketId`, `tradeId`, `fulfillmentType`, `matched`, and `issued`.
- Orderbook realtime reason now includes `primary_ticket_issued`.

Verification:

```bash
npm run test -w apps/api -- --runTestsByPath test/orderbook.service.spec.ts test/side-effect-worker.service.spec.ts
npm run typecheck -w apps/api
git diff --check
```

Remaining evidence:

- Deploy the API to Render staging.
- Perform a real Stripe test checkout through webhook authorization.
- Confirm the worker creates a backend `Ticket`, the payment capture job completes, and the fan app wallet replaces any pending client ticket with the backend ticket.
- Save redacted evidence before treating this as release-grade settlement proof.
