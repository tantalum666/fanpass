# Prototype Shortcut Register

This register documents local-demo shortcuts that are allowed for Alpha/Beta foundation work but must not be mistaken for public or real-user Beta readiness.

Every entry must include risk, owner, replacement path, release gate, and evidence. Run `npm run security:prototype-shortcuts` after adding or changing prototype/demo shortcuts.

## PS-001 - Local Demo Auth

- Status: Accepted local shortcut.
- Scope: `POST /auth/register`, `POST /auth/login`, `POST /auth/demo-session`, local iOS demo continuation, and local Console fallback sessions.
- Owner: FanPass platform.
- Risk: Email-only or seeded demo sessions are not suitable for public environments and could let a reachable API caller impersonate seeded users.
- Replacement Path: Complete Privy SDK login in FanPass, FanPass Ops, and FanPass Console; keep production-like API auth on verified Privy access tokens; keep local demo auth disabled in staging/production.
- Release Gate: External Beta cannot use demo/email auth or seeded bearer fallback in shared/public runtimes.
- Evidence: `docs/ALPHA_SECURITY_REVIEW.md` ASR-005; `apps/api/src/config/security-config.ts`; `scripts/security-runtime-staging-check.sh`.

## PS-002 - Local QR Secret Fallback

- Status: Accepted local shortcut.
- Scope: Local QR payload signing can fall back to a reproducible development secret outside production-like runtimes.
- Owner: FanPass platform.
- Risk: If a public runtime starts with a known local secret, QR payloads can be forged.
- Replacement Path: Require strong per-environment QR signing secrets from secret management, add rotation/versioning before pilot usage, and keep startup validation failing for placeholder secrets.
- Release Gate: Staging/production must fail startup without a non-placeholder `QR_SIGNING_SECRET`; any exposed secret must be rotated.
- Evidence: `docs/ALPHA_SECURITY_REVIEW.md` ASR-006; `apps/api/src/config/security-config.ts`; `apps/api/src/modules/verification/verification.service.ts`.

## PS-003 - Mock Stripe And Unsigned Local Webhooks

- Status: Accepted local shortcut.
- Scope: Local Beta/Alpha verification uses mock PaymentIntents and unsigned mock webhook payloads when Stripe secrets are intentionally absent outside production-like runtimes.
- Owner: FanPass payments.
- Risk: Mock payment authorization, capture, refund, cancellation, and reconciliation do not prove real Stripe state transitions or signed webhook replay behavior.
- Replacement Path: Validate PaymentSheet, PaymentIntent creation, signed webhook delivery, duplicate event replay, capture, cancellation, refund, and reconciliation with Stripe test-mode keys and webhook signing.
- Release Gate: Real-money or external Beta payment flows require Stripe test-mode execution with signed webhook verification and no committed Stripe secrets.
- Evidence: `docs/PROVIDER_COST_FEASIBILITY.md`; `docs/ALPHA_SECURITY_REVIEW.md` ASR-008; `scripts/beta-local-start.sh`; `scripts/alpha-prisma-verify.sh`.

## PS-004 - Mock Ownership Adapter

- Status: Accepted local shortcut.
- Scope: Local ownership issue, transfer, and redeem paths default to the mock ownership adapter and mock transaction hashes.
- Owner: FanPass platform.
- Risk: Mock receipts do not prove testnet/mainnet chain execution, key management, transaction finality, or contract ownership controls.
- Replacement Path: Keep chain calls behind ownership side-effect boundaries, validate the explicit testnet adapter with non-production keys, and move any production chain operation to a durable outbox/saga with signer security.
- Release Gate: Any real wallet or chain-backed Beta must use non-local ownership configuration, safe signer handling, and durable retry/reconciliation.
- Evidence: `apps/api/src/modules/ownership/ownership.service.ts`; `apps/api/src/modules/side-effects/settlement-side-effects.service.ts`; `apps/api/src/modules/side-effects/ticket-ownership-side-effects.service.ts`.

## PS-005 - Debug Payload Copy/Paste Helpers

- Status: Accepted local shortcut.
- Scope: FanPass wallet copy buttons and FanPass Ops pasteboard payload entry exist for simulator/local QA alongside QR/NFC scanner transports.
- Owner: FanPass Ops and FanPass Wallet.
- Risk: Manual payload copy/paste is useful for simulator QA but is not a venue-ready scanner experience and could confuse external testers if exposed as a normal gate path.
- Replacement Path: Validate QR camera and Core NFC on signed physical iPhone builds; keep debug-gated payload copy/paste hidden before external TestFlight unless explicitly risk-accepted.
- Release Gate: External gate-staff testing requires physical-device scanner validation and debug-gated payload copy/paste helpers hidden from non-debug builds unless explicitly risk-accepted.
- Evidence: `docs/IOS_DISTRIBUTION_PLAN.md`; `apps/ios/FanPass/FanPass/Features/Tickets/TicketWalletView.swift`; `apps/ios/FanPass/FanPass/Features/Scanner`; `apps/ios/FanPass/FanPassOps/OpsShellView.swift`.

## PS-006 - Apple Wallet Barcode Prototype

- Status: Accepted local shortcut.
- Scope: FanPass shows Apple Wallet barcode metadata but does not create or present a signed `.pkpass` package.
- Owner: FanPass mobile.
- Risk: Barcode metadata alone is not an installable Apple Wallet pass and does not prove pass signing, download authorization, pass update, or device validation.
- Replacement Path: Add backend `.pkpass` generation and signing with Apple Developer pass certificates, authenticated pass download rules, and physical-device Wallet validation.
- Release Gate: External Beta must not claim Apple Wallet support until a signed pass can be generated, installed, and validated on a real device.
- Evidence: `docs/IOS_DISTRIBUTION_PLAN.md`; `docs/ALPHA_SECURITY_REVIEW.md`; `apps/ios/FanPass/FanPass/Features/Tickets`.

## PS-007 - Manual Staff Invite Token Delivery

- Status: Accepted local shortcut.
- Scope: FanPass Console displays a one-time staff invite token after assignment or rotation so local QA can link FanPass Ops staff access without email/SMS delivery.
- Owner: FanPass Console and Ops.
- Risk: Manual copy delivery is operationally fragile and is not a production tenant or staff onboarding policy.
- Replacement Path: Choose an approved invite delivery channel, connect real Privy SDK login, define tenant/staff roster policy, and keep plain invite tokens one-time only with hash-only storage.
- Release Gate: External Beta staff onboarding requires real Privy-linked staff identity, approved invite delivery policy, and deployed runtime checks.
- Evidence: `docs/ALPHA_SECURITY_REVIEW.md` Security Passes 24-27; `apps/api/src/modules/alpha/alpha-persistence.service.ts`; `apps/dashboard/app/page.tsx`.

## PS-008 - Placeholder Mobile Environment Values

- Status: Accepted local shortcut.
- Scope: Checked-in staging, beta, and production iOS xcconfig values contain placeholder API URLs or keys until real HTTPS environments and provider test apps exist.
- Owner: FanPass mobile.
- Risk: A signed build with placeholder, local, or non-HTTPS endpoints would not be safe or useful for TestFlight/external testing.
- Replacement Path: Provision HTTPS staging/beta API and Console URLs, configure provider test keys through build settings or CI secrets, and keep non-Debug runtime validation rejecting local or placeholder hosts.
- Release Gate: TestFlight/external Beta requires concrete HTTPS API URLs, provider test configuration, signing/provisioning, and successful staging runtime checks.
- Evidence: `docs/IOS_DISTRIBUTION_PLAN.md`; `apps/ios/FanPass/Config`; `apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift`.

## PS-009 - Local Prototype Reset Endpoint

- Status: Accepted local shortcut.
- Scope: `POST /prototype/reset` resets in-memory demo state and QR nonce state for local prototype start and verification scripts.
- Owner: FanPass platform.
- Risk: A reset command can disrupt shared demos or wipe local state if it drifts back to public access or is exposed in a shared runtime without explicit operational controls.
- Replacement Path: Keep the route protected by `FanPassAuthGuard` with organizer/admin roles, keep local scripts using a seeded organizer bearer token, and remove or isolate reset controls from any real staging/production tenant data path.
- Release Gate: External Beta cannot expose prototype reset against real or shared data unless it is admin/organizer gated, audited, and explicitly risk-accepted for that environment.
- Evidence: `apps/api/src/app.controller.ts`; `scripts/prototype-start.sh`; `scripts/prototype-verify.sh`; `docs/API_RESPONSE_PRIVACY_MATRIX.md`.
