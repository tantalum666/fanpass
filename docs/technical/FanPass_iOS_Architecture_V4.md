# FanPass iOS Architecture V4

Status: future iOS implementation readiness plan
Date: 2026-06-05

## SwiftUI Architecture

- App shell: `FanPassApp` owns environment and app-level session state.
- Navigation: native `TabView`, each tab owns its own `NavigationStack`.
- UI: Clean V4 design system tokens and reusable components.
- State: ViewModels own loading, error, success, and simulated action states.
- Future dependency injection: service/repository protocols injected through environment or initializer.

## MVVM Structure

| Layer | Responsibility |
| --- | --- |
| Views | Render state, route user actions, avoid business logic. |
| ViewModels | Load data, call services/repositories, map errors to UI copy. |
| Services | Auth, payment, ticket, market, scanner, wallet operations. |
| Repositories | Cache + API orchestration, offline fallback, model normalization. |
| API client | Authenticated HTTP transport, retry, idempotency headers. |
| Models | Product domain entities and state enums. |

## ViewModels

Recommended production ViewModels:

- `SessionViewModel`: auth session, role, wallet link, account state.
- `HomeViewModel`: featured events, next ticket, alerts.
- `ExploreViewModel`: search/filter/load events.
- `EventDetailViewModel`: event, ticket types, Fan Access availability, market preview.
- `CheckoutViewModel`: reservation, PaymentSheet params, payment state, ticket assignment.
- `TicketsViewModel`: wallet inventory, lifecycle filters.
- `TicketDetailViewModel`: QR refresh, wallet handoff, Proof & History, transfer/resale actions.
- `MarketViewModel`: floor, cap, orderbook summary, listings, trades, websocket updates.
- `ScannerViewModel`: event assignment, QR/NFC scan state, check-in result.
- `ProfileViewModel`: account, payment methods, security, prototype controls in debug builds only.

## Service Layer

Service protocols should mirror production domains:

- `AuthService`
- `EventService`
- `TicketService`
- `PaymentService`
- `MarketService`
- `ScannerService`
- `FanAccessService`
- `WalletService`
- `ProofHistoryService`

Mock services remain available for previews and UI tests.

## Repository Layer

Repositories coordinate:

- API calls.
- Local cache reads/writes.
- Model mapping.
- Optimistic UI updates.
- Offline fallback.
- Retry/idempotency.

Examples:

- `TicketRepository`: wallet cache, ticket detail API, QR credential refresh.
- `MarketRepository`: REST snapshot + websocket updates.
- `CheckoutRepository`: reservation + PaymentSheet + status polling.

## API Client Layer

Requirements:

- Base URL per environment.
- Auth bearer token injection.
- Request IDs and idempotency keys.
- JSON decoding with explicit error mapping.
- Retry only safe idempotent requests.
- No secrets in logs.
- Redact tokens, QR payloads, wallet addresses, payment IDs, and personal data.

## Local State Management

- Use in-memory observable state for active session.
- Use persisted lightweight cache for event lists, wallet summaries, and market snapshots.
- Avoid caching full QR payloads beyond their expiry.
- Store app feature flags and prototype controls only in debug/internal builds.

## Error Handling

- Map transport/provider errors into product states from `FanPass_Error_State_Guide_V4.md`.
- Never show raw backend, Stripe, Privy, RPC, or NFC errors to users.
- Scanner errors must be short, operational, and action-oriented.
- Checkout errors must state whether a ticket/payment changed.

## Offline Fallback Concept

- Explore/event cache can remain visible with stale indicators.
- Wallet summary can remain visible, but QR generation requires online or a valid pre-fetched short-lived credential.
- Scanner can verify payload shape offline, but final redemption requires sync or a controlled offline redemption policy.
- Resale actions require online validation.

## Keychain Usage

- Store auth refresh/session tokens if provider SDK requires local storage.
- Store only minimal secure references; do not store raw payment secrets or private keys directly.
- Use access control appropriate to session sensitivity.
- Clear tokens on sign out.

## LocalAuthentication Usage

- Gate high-risk actions:
  - Show entry QR.
  - Transfer ticket.
  - List ticket for resale.
  - Change payment settings.
  - Staff scanner mode.
- Provide fallback for devices without biometrics.

## Core NFC Usage

- Scanner-side only in initial implementation.
- Use Core NFC to read NDEF payloads from supported tags.
- Validate payload shape locally, then call backend check-in.
- Handle unreadable, expired, invalid, duplicate, and unsupported-device states.

## PassKit / Apple Wallet Future Support

- Backend signs `.pkpass` files.
- iOS app presents add-to-wallet flow when backend confirms pass eligibility.
- Wallet pass should contain safe event/ticket display data only.
- Dynamic QR security should remain backend-controlled; do not embed long-lived secrets in Wallet pass.

## Testing Strategy

- Unit tests for ViewModels and services.
- Snapshot/visual checks for key screens.
- UI tests using prototype controls.
- Simulator tests for normal flows.
- Signed physical-device tests for Core NFC, camera QR, Apple Pay eligibility, and Wallet pass behavior.

## 2026-06-11 V4 Backend Wiring Snapshot

Status: simulator build verified; staging/provider evidence still open

Implemented native V4 wiring:

- `FanPassBackendContext` owns the fan app API client, current session, mapped V4 user, API connection state, Privy auth provider, and API-backed V4 service provider.
- DEBUG app launch attempts `/auth/demo-session` for `usr_fan_demo`; if unavailable, the UI explicitly falls back to local review data.
- Home loads featured events and next ticket through injected API-backed event/ticket services before falling back to local review fixtures.
- Explore loads events through the API-backed event service.
- Tickets loads wallet tickets through the API-backed ticket service.
- Ticket entry-code sheet calls `/verification/qr`, renders the returned signed payload as a QR image, tracks expiry, and refreshes before the 30-second limit. Raw payloads, nonces, signatures, and provider internals are not rendered.
- Account Security exposes Privy email-code sign-in. The Privy access token is sent to `/auth/privy/sync`, then the returned FanPass session updates the shared API client bearer token.
- Checkout creates an API order, creates a backend PaymentIntent, and presents the existing Stripe PaymentSheet presenter when a Stripe test publishable key and non-mock client secret are available.

Boundaries:

- PaymentSheet completion maps to `authorized`, not `captured`; ticket assignment still waits for backend webhook reconciliation.
- Stripe local/mock `pi_mock` client secrets are blocked from native PaymentSheet presentation.
- This pass does not add Keychain persistence, refresh-token lifecycle, production/staging credentials, signed TestFlight evidence, physical QR/NFC evidence, Apple Wallet evidence, or release-grade chain custody evidence.

Verification:

```bash
xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPassOps -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

## 2026-06-12 Fan App Guest Home And Protected Action Boundary

Status: simulator UI verified; provider/release evidence still open

The fan-facing app launch boundary is now:

- Launch `FanPass` directly to the Home tab as a signed-out guest.
- Allow guest browsing of Home, Explore, and public event detail.
- Require a fan session for checkout, ticket wallet, entry QR, resale, and ownership history.
- Keep Ops separate: staff scanner login/linking remains in `FanPassOps`, not in the fan app.

Implementation notes:

- `FanPassRootViewModel.stage` defaults to `.main`.
- `FanPassV4AppShellView` no longer wraps the whole app in a login wall when no session exists.
- `FanPassBackendContext` initializes and signs out to `FanPassMockData.guestFan`.
- Event detail uses a local `FanPassV4AuthRequiredSheet` for guest `Buy Ticket`.
- Tickets renders a guest gate with one working `Continue as test fan` action, plus static Privy guidance.
- Checkout treats local test-fan sessions as simulator-only and requires an API-online Privy session for real Stripe PaymentSheet.
- API-backed event loading now sorts events with real `ticketTypes` first so default Home/Checkout flows start from a purchasable staging ticket category.
- QR lifetime display is seconds-based.

Verification:

```bash
xcodebuild -quiet -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Beta -destination 'platform=iOS Simulator,id=41D28602-FF01-4E4C-98AA-DA7F4FC93D27' -derivedDataPath outputs/ios-sim-build/FanPassBeta build
npm --workspace apps/api run typecheck
```

## 2026-06-12 Checkout Result Sheet And Session Wallet Merge

Status: simulator verified; backend settlement evidence still open

- `FanPassBackendContext` now owns session-scoped `pendingCheckoutTickets`.
- Its `ticketService()` returns a wrapper service that merges pending checkout tickets with API wallet tickets and suppresses duplicates once the backend returns a matching event/ticket-type/owner ticket.
- `FanPassRootViewModel.openTickets()` routes directly to the Tickets tab.
- `FanPassV4TicketsView` reloads when the backend ticket refresh key changes, so checkout-created tickets appear without restarting the app.
- `FanPassV4CheckoutView` now shows a result sheet after success, failure, or cancellation. Success records the ticket and offers `View in Tickets`.
- Real Stripe success still depends on backend settlement for the final authoritative ticket/entry QR. The client-side pending wallet entry is a review/test UX bridge, not release evidence.

Verification:

```bash
xcodebuildmcp build_sim FanPass Beta
xcodebuildmcp install_app_sim
xcodebuildmcp launch_app_sim
```

UI smoke verified simulator purchase result feedback and Tickets tab sync: `Simulator purchase complete` -> `View in Tickets` -> Upcoming `5 tickets`.

Simulator evidence:

- `outputs/ios-sim-screenshots/fanpass-guest-home.png`
- `outputs/ios-sim-screenshots/fanpass-qr-seconds.jpg`
- `outputs/ios-sim-screenshots/fanpass-checkout-payment-complete.png`

Remaining boundaries:

- Simulator purchase is not real Stripe settlement.
- Seed-code additions are not proof of current Render staging database rows.
- Do not claim TestFlight, physical device, QR/NFC, Wallet, or chain-custody readiness from this pass.

## 2026-06-12 Account Routing And Role Boundary Fix

Status: simulator UI verified; real provider evidence still open

Navigation and auth state changes:

- `FanPassRootViewModel` now owns `accountSection` and `openPrivySignIn()`.
- The root view model is injected into the SwiftUI environment from `FanPassV4AppShellView`.
- `FanPassV4ProfileView` binds its selected segment to root state, allowing other screens to open Account directly on Security.
- `FanPassV4AuthRequiredSheet` and `FanPassV4TicketsView` now route `Open Privy sign-in` to Account > Security, where Privy email/code controls are immediately visible.

Checkout role/session guardrails:

- Checkout requires `FAN` or `ADMIN` role for purchase actions.
- `GATE_STAFF` accounts are blocked in the fan app purchase path with explicit copy directing staff to `FanPass Ops`.
- Stripe readiness now requires a non-empty FanPass API bearer token. A session object without `accessToken` no longer counts as a live API Stripe session.

Verification:

```bash
xcodebuild -quiet -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Beta -destination 'platform=iOS Simulator,id=41D28602-FF01-4E4C-98AA-DA7F4FC93D27' -derivedDataPath outputs/ios-sim-build/FanPassBeta build
npm --workspace apps/api run typecheck
```

Simulator UI automation verified:

- Home -> Event Detail -> Buy -> `Open Privy sign-in` opens Account with Security selected.
- Tickets guest -> `Open Privy sign-in` opens Account with Security selected.

Evidence screenshot: `outputs/ios-sim-screenshots/fanpass-privy-signin-routed.jpg`.

## 2026-06-12 Privy API Bearer Preservation

Status: build verified; live fan Stripe retry still pending

- Backend Privy sync returns FanPass user/session metadata with `accessToken: null`.
- The iOS API client must keep using the Privy access token as the bearer for protected FanPass API calls.
- `UserSession.withAccessToken(_:)` now lets the client preserve that bearer on the stored session object.
- `FanPassBackendContext.loginWithPrivyEmailCode` applies the synced session with `fanPassSession.accessToken ?? privySession.accessToken`.
- Legacy `AppState.loginWithPrivyAccessToken` applies the same rule.
- Checkout's non-empty bearer guard can now distinguish a real Privy bearer-backed fan session from a role-only/null-token session.

Verification:

```bash
xcodebuild -quiet -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Beta -destination 'platform=iOS Simulator,id=41D28602-FF01-4E4C-98AA-DA7F4FC93D27' -derivedDataPath outputs/ios-sim-build/FanPassBeta build
npm --workspace apps/api run typecheck
```

## 2026-06-13 Ticket Proof History API Wiring

Status: simulator build verified; release chain custody still blocked

- iOS now has DTOs for the backend `/tickets/:id/proof-history` response.
- `FanPassAPIClient` exposes `proofHistory(ticketId:)`.
- `FanPassV4TicketServicing` exposes `proofHistory(for:)`, with API, mock, and pending-ticket session-wrapper implementations.
- Ticket detail refreshes Proof & History from the authenticated backend service when the screen opens, while preserving local fallback behavior for pending checkout tickets, offline API state, and unauthenticated sessions.
- API proof rows are mapped to product-safe `FanPassV4.ProofHistoryItem` rows. The app still avoids raw transaction hashes, wallet addresses, QR payloads, nonces, signatures, RPC/provider data, and chain-custody claims.

Verification:

```bash
npm --workspace apps/api run test -- --runTestsByPath test/tickets.service.spec.ts test/route-security.spec.ts
xcodebuild -quiet -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Beta -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Boundary:

- This is backend proof-history consumption only.
- iOS still does not hold signer keys, RPC URLs, ABIs, or direct contract-write logic.
- Release-grade chain custody still requires Safe/multisig or equivalent ownership, delegated signer/vault/KMS, durable outbox proof, signer audit logs, and passing chain-custody evidence.

## 2026-06-13 Privy Embedded Wallet For Testnet Ownership

The fan app's Privy email-code login now ensures the authenticated Privy user has an embedded Ethereum wallet before syncing the session to the backend. `FanPassPrivyAuthProvider` first reuses `user.embeddedEthereumWallets.first`; if none exists, it calls `user.createEthereumWallet()` and passes the resulting address through `PrivyLoginResult.walletAddress`.

This wallet address is required when the backend uses `OWNERSHIP_ADAPTER=testnet`, because primary ticket issue, transfer, and redemption proofs need a real owner wallet address for the ownership adapter. The backend remains responsible for contract writes and signer custody. The iOS app still does not include signer keys, RPC URLs, contract ABIs, or direct transaction-write logic.

Ticket proof history can now display a backend-provided safe `proofReference` and optional external URL. The app still avoids raw wallet addresses, QR payloads, nonces, signatures, RPC/provider internals, and chain-custody claims.

## 2026-06-13 Social OAuth And Sepolia Ticket Status

Status: simulator verified; live provider sign-in and release evidence still open

Social sign-in implementation:

- `PrivyOAuthLoginProvider` models Google, X/Twitter, and Discord as supported fan-app OAuth providers.
- `PrivyAuthProviding` now exposes `loginWithOAuth(_:)` beside the email-code flow.
- `FanPassPrivyAuthProvider.loginWithOAuth(_:)` calls the Privy Swift SDK OAuth login with the `fanpass-payments` URL scheme, obtains the Privy access token, ensures an embedded Ethereum wallet exists, and returns the same `PrivyLoginResult` shape used by email-code login.
- `FanPassBackendContext.loginWithPrivyOAuth(_:)` reuses `/auth/privy/sync`, keeps the Privy bearer if the backend session token is null, and applies the returned FanPass session/user to the shared API client.
- The Account sign-in sheet renders provider buttons for Google, X, and Discord, with email code retained as the backup method.

Ticket chain-status implementation:

- `FanPassV4.ProofHistoryItem` carries an optional `externalURL`.
- `FanPassV4APIDataProvider` maps backend proof-history `externalUrl` values into that model.
- `FanPassV4TicketsView` shows an `On-chain status` card on Ticket Detail. When the backend returns the existing `chain-proof` row with Sepolia transaction metadata, the card displays the safe proof reference and an `Open Sepolia scan` link.

Verification:

```bash
xcodebuildmcp build_sim FanPass Beta CODE_SIGNING_ALLOWED=NO
xcodebuildmcp build_run_sim FanPass Beta CODE_SIGNING_ALLOWED=NO
scripts/with-node-22.sh npm --workspace apps/api run typecheck
OWNERSHIP_ADAPTER=mock FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES=false scripts/with-node-22.sh npm --workspace apps/api run test -- --runTestsByPath test/tickets.service.spec.ts
git diff --check
```

Boundaries:

- Live Google/X/Discord OAuth was not completed because it requires interactive provider-account login.
- X/Twitter email extraction is skipped because the local Privy Swift SDK `TwitterAccount` type does not expose an email field.
- Sepolia scan links appear only when backend proof history has testnet transaction metadata.
- This remains dev/staging integration, not TestFlight, signed Wallet, physical QR/NFC, real Stripe webhook settlement, or release-grade chain custody evidence.
