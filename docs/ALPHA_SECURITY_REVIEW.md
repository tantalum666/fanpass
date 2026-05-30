# FanPass Alpha Completion And Security Review

Date: 2026-05-27

Update after Security Pass 1 on 2026-05-27:

- Added signed local session tokens for API access.
- Added NestJS auth/role guard and current-session plumbing.
- Protected ticket, order, fan task submission/score, QR generation, QR redemption, check-in summary, prototype reset, event write, and Alpha Console API routes.
- Changed protected actions to derive `userId`/`scannerUserId` from the verified session instead of trusting client JSON.
- Added local demo-session support for simulator/demo use; it is disabled by default in production unless explicitly enabled.
- Added CORS allowlist configuration, disabled credentialed CORS, disabled `x-powered-by`, enabled stricter validation, and added request body size limits.
- Updated FanPass iOS and FanPass Ops to attach bearer tokens for private API calls.
- Updated Console server fetches to use a server-side organizer token.
- Remaining status: Security Pass 1 materially reduces Alpha demo risk, but this is still not a public/real-user security posture until Privy/JWT verification, production Console auth, PII scoping, idempotent settlement, nonce constraints, dependency patching, and deployment hardening are finished.

Update after Security Pass 2 on 2026-05-28:

- Added centralized API environment validation for production-like runtimes.
- Production-like runtimes now fail startup when `QR_SIGNING_SECRET` is missing, too short, or set to a local placeholder. `SESSION_SIGNING_SECRET` is local-only after Security Pass 3 because production-like auth uses Privy tokens.
- Production-like runtimes now reject wildcard CORS, non-HTTPS CORS origins, and `FANPASS_ENABLE_DEMO_AUTH=true`.
- Added API security headers through Helmet, with HSTS enabled only in production-like runtimes and disabled for local HTTP.
- Added API rate limits for general requests, auth endpoints, and verification endpoints.
- Added FanPass Console security headers and disabled the Next.js powered-by header.
- Added a Prisma `accepted_nonce` unique constraint for accepted check-ins so a QR nonce can only be accepted once at the database layer.
- Remaining status: this closes the QR secret fallback finding for production-like environments and improves header/rate-limit posture. It does not replace Privy/JWT auth, event-scoped Console authorization, full PII redaction, settlement idempotency, or dependency patching.

Update after Security Pass 3 on 2026-05-28:

- Added backend Privy access-token verification for production-like runtimes.
- Production-like runtimes now require `PRIVY_APP_ID` and `PRIVY_VERIFICATION_KEY`, reject local email/demo session issuance, and accept only Privy ES256 bearer tokens at protected API boundaries.
- Privy tokens are checked for signature, `iss=privy.io`, `aud=PRIVY_APP_ID`, expiry, and linked `users.privy_id`.
- Local demo/email sessions remain available only for local prototype speed.
- Remaining status: backend token verification is in place, but product login is not finished until FanPass, FanPass Ops, and FanPass Console integrate Privy SDK flows and Console authorization is event-scoped with PII redaction.

Update after Security Pass 4 on 2026-05-28:

- FanPass Console production-like builds no longer auto-fetch local demo sessions. Without `FANPASS_CONSOLE_ACCESS_TOKEN`, the page renders a locked state and does not request operational data.
- `/alpha/operations` now receives the verified session and returns PII-redacted snapshots by default for organizer users.
- Organizer snapshots hide owner/scanner emails, QR nonces, fan proof text, audit metadata, and full user ids. Admin sessions can still receive the full operational view.
- Alpha event and ticket-type audit writes now use the authenticated Console actor instead of a hardcoded seeded organizer.
- Remaining status: Console is safer for non-local environments, but full closure still requires real Privy Console login UX and event-scoped organizer authorization.

Update after Security Pass 5 on 2026-05-28:

- Added event-scoped organizer access for Console operations.
- Organizer sessions now only see events, tickets, orders, trades, check-ins, fan access submissions, and scoped audit rows for their linked organizer profile.
- Admin sessions retain global Console visibility.
- Console event creation writes to the authenticated organizer's organization; admin-created Alpha events attach to the first organizer until a dedicated admin organization selector exists.
- Creating ticket types now rejects events outside the authenticated organizer scope.
- `alpha:verify:prisma` now seeds a second organizer/private event and fails if the default organizer can read or mutate that event.
- Remaining status: Console API scoping is in place for Alpha operations. Full closure still requires real Privy Console login UX and production tenant-management rules beyond the seeded Alpha model.

Update after Security Pass 6 on 2026-05-28:

- Added explicit gate assignment data for `FanPass Ops` redemption authority.
- Seeded `usr_gate_demo` only for `evt_weekend_demo` gate `A1`.
- Redemption now rejects unassigned gate staff before QR validation, ticket mutation, check-in recording, or audit writes.
- Public redeem requests no longer accept `scannerUserId`; scanner identity is derived only from the verified bearer session.
- Gate check-in summaries now require the gate staff user to be assigned to that event/gate. Organizer summaries are scoped to events owned by the linked organizer profile; admin keeps global visibility.
- Prisma now includes a `gate_assignments` table with a unique `(event_id, gate, staff_user_id)` assignment constraint.
- Prototype and Alpha Prisma verification now both fail if `usr_gate_demo` can redeem or view summaries for unassigned gate `A2`.
- Remaining status: scanner authority is materially stronger. Full closure still requires real Privy/Ops login UX, staff roster management in Console, and real-device Ops validation.

Update after Security Pass 7 on 2026-05-28:

- Added unique Prisma trade constraints on `buy_order_id` and `sell_order_id`, so the same buy or sell order cannot settle into multiple trades.
- Changed Prisma settlement to atomically claim both `OPEN` orders and the `LISTED_FOR_RESALE` ticket before calling the ownership adapter.
- Added a settlement failure path that marks matched orders as `REJECTED`, restores the ticket to the seller's active state, and writes a `TRADE_SETTLEMENT_FAILED` audit log if the ownership transfer fails.
- Added optional `Idempotency-Key` support for `POST /orders`; a same-user retry with the same order parameters returns the existing order/trade, while key reuse with different order parameters is rejected.
- `alpha:verify:prisma` now verifies order retry idempotency and attempts a duplicate trade insert after a real match, failing unless Prisma returns the expected unique-constraint error.
- Remaining status: order settlement is safer against duplicate settlement and client retries, but this is not production-grade until payment authorization, settlement retries, and real chain calls move into a durable outbox/saga.

Update after Security Pass 8 on 2026-05-28:

- Scoped organizer ticket inventory reads to events owned by that organizer profile.
- Scoped organizer ticket detail reads and ticket issuance to organizer-owned events in both memory and Prisma paths.
- Added API unit coverage for cross-organizer ticket inventory, ticket detail, and ticket issuance rejection.
- Extended `alpha:verify:prisma` so the default organizer cannot issue tickets for another organizer's private event.
- Re-ran dependency audit after checking non-forced remediation paths. `npm audit fix --force` still proposes breaking dependency changes; latest Next still depends on `postcss@8.4.31`, and latest Ethers still depends on `ws@8.17.1`.
- Remaining status: ticket inventory scoping is stronger, but route coverage still needs an automated controller audit and real Privy product login before public Beta.

Update after Security Pass 9 on 2026-05-28:

- Added an explicit `@PublicRoute()` marker for intentionally public API routes.
- Added automated Jest coverage that scans every controller route handler and fails unless the route is either explicitly public or protected by `FanPassAuthGuard` plus `@Roles(...)`.
- Current route coverage passed across App, Auth, Events, Orders, Tickets, Verification, Fan Access, and Alpha controllers.
- Restarted local prototype services after the previous Dashboard cache error; `http://localhost:3000/` and `http://localhost:4000/health` both return 200.
- Remaining status: controller route coverage is now guarded by tests, but public Beta still requires real Privy product login, staff roster management, payment/chain outbox work, staging header checks, and dependency advisory resolution/documentation.

Update after Security Pass 10 on 2026-05-28:

- Added `npm run security:runtime:local` for repeatable local runtime checks.
- The script verifies API and Console security headers and fails if either surface exposes `x-powered-by`.
- Current local runtime check passed against `http://localhost:4000/health` and `http://localhost:3000/`.
- Remaining status: local runtime header regression checks are automated. The deployed-staging version of the same check is still required before external Beta.

Update after Security Pass 11 on 2026-05-28:

- Reduced production dependency audit exposure by removing `ethers` from the API production dependency list.
- `TestnetOwnershipAdapter` now dynamically loads `ethers` only when `OWNERSHIP_ADAPTER=testnet` is explicitly enabled.
- Default local/Alpha ownership still uses `MockOwnershipAdapter`, so normal API runtime no longer pulls `ethers -> ws` into the production audit path.
- `npm audit --omit=dev --audit-level=low` now reports 2 moderate advisories instead of 4; the remaining advisories are `postcss <8.5.10` through Next.
- Decision: do not run `npm audit fix --force` for the remaining Next/PostCSS advisory because it proposes a breaking Next downgrade. Re-check before external testing or when Next publishes a safe patched dependency path.
- Remaining status: API ownership dependency risk is reduced. The remaining Next/PostCSS advisory is documented as an external-testing blocker unless a safe upgrade path becomes available.

Update after Security Pass 12 on 2026-05-28:

- Added a Prisma `side_effect_outbox` table for durable external side-effect intent tracking.
- Prisma order settlement now records an `OWNERSHIP_TRANSFER` side-effect job before executing the ownership adapter.
- Local Alpha/mock ownership still completes synchronously, but the side-effect job is marked `COMPLETED` with the ownership receipt, creating a durable trail for the future worker path.
- Settlement failure now marks the side-effect job `FAILED` before rejecting/restoring the matched order pair.
- Alpha operations now expose side-effect job status for Console monitoring, with payload hidden from organizer views by default.
- `alpha:verify:prisma` now fails unless the completed ownership side-effect job exists and the reset/seed flow clears old outbox rows.
- Remaining status: the durable outbox persistence boundary exists. Public Beta still needs a worker/retry loop and payment/chain reconciliation before any real Stripe capture or chain transaction is enabled.

Update after Security Pass 13 on 2026-05-28:

- Added `SideEffectWorkerService` with `workOnce(...)` processing.
- Worker behavior now includes due-job lookup, claim/lock, ownership transfer dispatch, completed marking, retry marking with exponential backoff, and terminal `DEAD` status after repeated failures.
- Added `npm run side-effects:work-once -w @fanpass/api` for operational one-shot processing.
- Added root `npm run side-effects:verify`, which resets Alpha Prisma state, creates a pending ownership transfer job, runs the worker, and fails unless the job becomes `COMPLETED` with an ownership receipt.
- Added Jest coverage for worker success and retry behavior.
- Remaining status: outbox worker mechanics exist for ownership side effects. Stripe-specific handlers, payment reconciliation, and production worker deployment are still required before real payment capture or testnet/production chain side effects.

Update after Security Pass 14 on 2026-05-28:

- Added a Stripe PaymentIntent backend boundary for Alpha/Beta foundation work.
- `POST /payments/intents` now requires fan/admin bearer auth and an `Idempotency-Key`; same-user retries return the original payment, while key reuse with different order parameters is rejected.
- PaymentIntent creation uses manual capture and persists Prisma `Payment` rows. Local development uses a mock PaymentIntent only when Stripe is not configured and the runtime is not production-like.
- `POST /payments/webhook` uses an Express raw body route and verifies Stripe signatures whenever `STRIPE_WEBHOOK_SECRET` is configured; local unsigned JSON webhook simulation is allowed only outside production-like runtimes.
- Production-like startup now fails when `FANPASS_ENABLE_PAYMENTS=true` and `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` is missing or placeholder-grade.
- Added `PAYMENT_INTENT_CREATE` handling to the side-effect worker and exposed redacted payment state in Alpha operations.
- `alpha:verify:prisma` now verifies payment preauthorization, idempotent retry behavior, webhook authorization state updates, persisted payment counts, and redacted Console payment visibility.
- Remaining status: this is not a real-money payment implementation yet. Before Beta with actual payments, FanPass still needs client-side Stripe Payment Element or Checkout, capture/refund/reconciliation flows, stronger payment-to-settlement sequencing, webhook replay/idempotency hardening, and Stripe test-mode end-to-end validation using real test keys.

Update after Provider Feasibility Check on 2026-05-28:

- Added `docs/PROVIDER_COST_FEASIBILITY.md` with current official-source findings for Stripe and Privy low-cost plan viability.
- Stripe remains a suitable low-cost test-mode payment provider for the current PaymentIntent + webhook architecture.
- Privy remains suitable for core auth/wallet evaluation, but Privy webhook access is plan-risky from public pricing wording. FanPass must not require Privy webhooks for low-cost Beta until the actual dashboard or Privy confirms support.
- Added an explicit maintainability requirement: security work and provider integrations must stay behind narrow service/adapter boundaries, with typed contracts and tests, so future Stripe, Privy, chain, NFC, or wallet changes do not require broad rewrites.

Update after Privy Sync Pass on 2026-05-28:

- Added `POST /auth/privy/sync` as the low-cost, non-webhook Privy onboarding boundary.
- The sync endpoint verifies the Privy access token signature and claims before creating or returning a FanPass user.
- First-time Privy users are created as `FAN` only. Organizer, gate staff, and admin access must be pre-linked through `privyId`; client-provided roles are never accepted.
- First-time Privy users cannot claim an existing FanPass account by submitting the same email. If the email is already used, FanPass assigns an internal `@privy.fanpass.local` placeholder email until a safer account-linking flow exists.
- Existing linked users keep their FanPass role and account email during sync; the endpoint only updates wallet address when provided.
- Added iOS API client support for calling the sync endpoint with a Privy access token, while keeping actual Privy SDK integration out of domain/business logic.
- Added backend tests for first-time Privy sync, linked role preservation, and email-claim prevention.
- Remaining status: the backend can now support Privy login without Privy webhooks. Product UI still needs Privy Swift SDK integration in FanPass/FanPass Ops and Privy React SDK integration in FanPass Console.

Update after Console Privy Session Bridge Pass on 2026-05-28:

- Added `POST /api/console/privy-session` in FanPass Console.
- The route accepts a Privy access token from a future client-side login UI, forwards it to `POST /auth/privy/sync`, requires the synced user to be `ORGANIZER` or `ADMIN`, and stores the token in a HttpOnly, same-site cookie for Server Component API requests.
- Added `DELETE /api/console/privy-session` to clear the Console cookie.
- Console server API reads now prefer a configured token, then the HttpOnly Console cookie, then local demo auth only outside production-like runtimes.
- Tested `@privy-io/react-auth` but removed it because current dependency trees materially worsen audit posture:
  - latest tested SDK raised production audit from 2 moderate to 25 moderate advisories;
  - older tested SDK still left 18 moderate advisories;
  - non-forced audit fix introduced high-severity dev/contract-tooling advisories.
- Remaining status: the Console has a safe session bridge for future Privy login, but the React SDK UI remains blocked until dependency audit risk is resolved or isolated.

Update after Security Pass 15 on 2026-05-28:

- Added payment-aware order settlement gating behind `FANPASS_REQUIRE_PAYMENT_AUTHORIZATION`.
- When the gate is enabled, Prisma order matching will not settle a buy order unless a linked payment is already `AUTHORIZED` or `CAPTURED`.
- Stripe/mock `payment_intent.amount_capturable_updated` webhooks now enqueue an idempotent `ORDER_MATCH_AFTER_PAYMENT_AUTH` side-effect job when the payment reaches `AUTHORIZED`.
- `SideEffectWorkerService` can dispatch that job back into `OrderbookService.tryMatch(...)`, so a buy/sell pair that was waiting for payment authorization can settle without manual database edits.
- Production-like startup now rejects `FANPASS_ENABLE_PAYMENTS=true` unless `FANPASS_REQUIRE_PAYMENT_AUTHORIZATION=true`.
- Alpha operations now includes scoped order-level side effects so Organizer Console can see the authorization-to-settlement job without exposing payloads.
- `alpha:verify:prisma` now runs with the payment authorization gate enabled and verifies: buy order waits, sell order waits, mock webhook authorizes payment, worker retries matching, trade settles, ownership side effect completes, and Console shows all three side-effect types.
- Remaining status: payment authorization is now linked to settlement for the Prisma path, but real-money Beta still needs client-side Stripe UI, capture/refund/cancellation/reconciliation workers, webhook replay protection, and verification with real Stripe test keys.

Update after Security Pass 16 on 2026-05-28:

- Added backend payment side-effect handlers for `PAYMENT_CAPTURE`, `PAYMENT_CANCEL_AUTHORIZATION`, `PAYMENT_REFUND`, and `PAYMENT_RECONCILE`.
- Prisma order settlement now enqueues `PAYMENT_CAPTURE` after the trade and ownership transfer complete.
- If ownership transfer fails after orders are matched, settlement now enqueues payment compensation: uncaptured authorized payments are cancelled, and already captured payments are routed to refund.
- Local/mock payment processing now moves authorized payments to `CAPTURED` through the worker rather than leaving them authorized after ticket ownership changes.
- `SideEffectWorkerService` has unit coverage for payment capture, authorization cancellation, refund, and reconciliation dispatch.
- `alpha:verify:prisma` now verifies authorization -> match retry -> trade settlement -> ownership transfer -> payment capture, and Alpha operations shows the completed `PAYMENT_CAPTURE` side effect.
- Remaining status: capture/cancel/refund/reconcile handlers exist, but real-money Beta still needs client-side Stripe UI, real Stripe test-key and signed webhook validation, webhook replay/idempotency hardening, and product/admin triggers for refund/reconciliation flows.

Update after Security Pass 17 on 2026-05-28:

- Added Prisma `payment_webhook_events` persistence with a unique `stripe_event_id`.
- `POST /payments/webhook` now atomically claims supported Stripe webhook event ids before mutating payment state or enqueueing settlement jobs.
- Duplicate webhook replay returns `duplicate: true` and does not repeat payment updates, outbox jobs, or audit writes.
- Unknown local/mock payment events are recorded as ignored when the event id is new, so replay behavior remains deterministic.
- Alpha persistence status now reports `paymentWebhookEvents`.
- `alpha:verify:prisma` now sends the same mock Stripe authorization webhook twice and fails unless the second delivery is treated as a duplicate and only one webhook event is persisted.
- Remaining status: local replay hardening exists. Real-money Beta still needs signed Stripe test-mode webhook verification for replay behavior, client-side Stripe UI, product/admin refund triggers, and deployment/runtime checks.

Update after Security Pass 18 on 2026-05-29:

- Added admin-only payment operation endpoints for authorization cancellation, refund, and reconciliation.
- Each payment operation requires `Idempotency-Key` and creates a durable side-effect outbox job instead of calling Stripe directly from the controller.
- Reusing the same operation idempotency key for the same payment returns the existing outbox job and does not duplicate audit records.
- The operation payload records payment, order, event, ticket type, requester, and reason so later worker execution remains auditable and diagnosable.
- Payment operation and webhook responses now return redacted payment summaries instead of echoing Stripe client secrets or payment request idempotency keys.
- `alpha:verify:prisma` now verifies organizer users cannot trigger payment refund operations, admin users can request payment reconciliation, and idempotent retries return the same `PAYMENT_RECONCILE` job.
- Remaining status: local admin operation triggers exist. Real-money Beta still needs signed Stripe test-mode validation for cancellation, refund, reconciliation, and webhook replay behavior, plus client-side Stripe UI.

Update after Security Pass 19 on 2026-05-29:

- Added a Socket.IO orderbook gateway under the `/orderbook` namespace for Beta realtime market updates.
- Clients subscribe with `orderbook.subscribe` using `eventId` and `ticketTypeId`; the server joins a scoped room and sends a current `orderbook.snapshot`.
- Order creation, order cancellation, and settled trades now publish `orderbook.updated` payloads with a fresh aggregated snapshot.
- Realtime payloads contain public market data only: event id, ticket type id, price levels, last trade price, floor price, volume, premium percent, reason, and optional order/trade ids. They do not include user email, owner identity, payment data, QR data, or scanner data.
- The Socket.IO adapter reuses the API CORS allowlist and disables credentialed CORS; max message size is capped at 64 KB.
- `prototype:verify` now uses a real Socket.IO client to verify subscription, initial snapshot, sell-order update, and trade-settled update.
- Remaining status: realtime orderbook updates exist for local/Beta foundation. External Beta still needs deployed staging checks, client UI integration in FanPass/Console, and production traffic limits/monitoring.

Update after Security Pass 20 on 2026-05-29:

- FanPass Console now consumes the `/orderbook` Socket.IO feed through a small client component instead of converting the whole Console page into a client-rendered app.

- The Console orderbook panel renders server-fetched market data first, then replaces the market snapshot after `orderbook.snapshot` and `orderbook.updated` events.
- Browser QA verified the visible Console state changes to `Live`, shows `Trade settled`, and reflects the updated live trade price after an API-triggered order match.
- Mobile viewport QA at 390 px confirmed the Console still renders without horizontal overflow after adding the realtime status row.
- The Console feed displays only public market data already allowed in organizer operations views; it does not expose payment secrets, QR payloads, scanner nonces, owner emails, or Privy identifiers.
- Remaining status: Console consumption exists locally. FanPass iOS does not consume the WebSocket feed yet, and deployed staging WebSocket/CORS checks are still required before external Beta.

Update after Security Pass 21 on 2026-05-29:

- Added deployment environment templates for API and Console local/staging configuration.
- Added `docs/DEPLOYMENT_ENVIRONMENTS.md` with local, staging, and production separation rules, staging requirements, verification order, and open deployment items.
- Added `npm run security:runtime:staging`, which checks deployed API/Console security headers, absent `x-powered-by`, disabled API demo sessions, and unauthenticated Console locked/sign-in state.
- Added `npm run security:runtime:staging:dry-run`, which starts local staging-like API/Console services with demo auth disabled and validates the same runtime checks against local ports.
- Corrected the API environment example to use `STRIPE_WEBHOOK_SECRET` and documented payment/Prisma/QR TTL toggles explicitly.
- Remaining status: deployment scripts and environment docs exist. This does not close deployed staging verification until real HTTPS staging URLs are provisioned and `npm run security:runtime:staging` is run against them.

Update after Security Pass 22 on 2026-05-29:

- Added a `FanPass Ops`-only Core NFC NDEF reader prototype behind `NFCPayloadScanner`.
- NFC payloads are treated as transport only: they are normalized into the same signed entry payload consumed by QR redemption, so backend signature verification, expiry, nonce replay protection, ticket lifecycle checks, and event/gate staff authorization remain centralized.
- Added the NDEF reader entitlement only to `FanPassOps`; the consumer `FanPass` target still excludes scanner source and does not declare Camera or NFC permissions.
- Scanner UI now exposes QR, NFC, and paste fallback paths, with an explicit unavailable state for simulator or unsupported devices.
- Verified both iOS targets still build and `npm run alpha:verify:ios-boundaries` passes.
- Remaining status: NFC is still a prototype. It is not real-world validated until a signed physical iPhone build reads a supported NDEF tag at a gate workflow.

Update after Security Pass 23 on 2026-05-29:

- Added organizer/admin protected Console APIs for gate staff assignment creation/reactivation and deactivation.
- Assignment writes are event-scoped to the authenticated organizer profile; cross-organizer assignment attempts are rejected.
- New staff records created through Console are constrained to `GATE_STAFF`, and emails already used by non-staff accounts are rejected.
- Organizer operations snapshots expose gate assignment state while redacting staff email and full staff ids by default.
- `alpha:verify:prisma` now verifies assignment creation, cross-organizer rejection, role creation, staff access while active, access rejection after deactivation, and redacted operations visibility.
- Remaining status: local/Alpha staff roster management exists in Console. Public Beta still requires real Privy-linked staff invitation/login, tenant policy, physical Ops validation, and deployed staging checks.

Update after Security Pass 24 on 2026-05-29:

- Added token-based staff invite acceptance through `POST /auth/privy/accept-staff-invite`.
- Gate assignment creation now generates a short-lived staff invite. The plain invite token is returned once; Prisma stores only a SHA-256 token hash.
- Invite acceptance verifies the Privy access token before linking `privyId` to the invited `GATE_STAFF` placeholder user.
- A Privy account already linked to another FanPass user cannot claim a staff invite, preventing email-only or client-role based privilege escalation.
- Deactivating a gate assignment revokes any still-pending invite for that assignment.
- Console now shows assignment linked state and latest invite status while keeping organizer PII redaction.
- Remaining status: the backend invite/linking boundary is ready for product SDK integration, but public Beta still requires real Privy SDK UI in FanPass Ops/Console, invite delivery policy, tenant management, and deployed staging checks.

Update after Security Pass 25 on 2026-05-29:

- FanPass Ops now has an internal Staff access panel for the staff invite acceptance boundary.
- `FanPassAPIClient` can call `POST /auth/privy/accept-staff-invite` with a Privy access token and invite token, then reuse the Privy token for gate-staff protected API calls.
- The panel keeps local demo staff available for simulator QA, but makes the future production path explicit: staff access must be linked by invite token plus verified Privy token, not by email.
- Verified `FanPassOps` builds and launches in the simulator with the staff access panel visible. `FanPass` also builds, and `npm run alpha:verify:ios-boundaries` still passes.
- Remaining status: this is an internal bridge, not the final login UX. Public Beta still requires the real Privy Swift SDK UI, invite delivery policy, signed physical-device Ops validation, and deployed staging checks.

Update after Security Pass 26 on 2026-05-29:

- FanPass Console now has a protected `POST /api/console/gate-assignments` route that uses the server-side organizer/admin Console session to create or reactivate a gate staff assignment.
- The Console `Assign Gate Staff` form now shows the one-time plain staff invite token immediately after a successful assignment request. The token is not stored in the URL, not persisted in the operations snapshot, and can be cleared from the page.
- This preserves the backend hash-only invite storage model while making local organizer staff onboarding usable without database inspection.
- `npm run console:verify:local` now submits a QA staff assignment in the browser and fails unless the one-time invite token panel renders without framework or console errors.
- Remaining status: local invite delivery is usable for testing, but public Beta still requires real Privy SDK UI, an approved invite delivery channel such as email/SMS/admin copy policy, tenant management, physical Ops validation, and deployed staging checks.

Update after Security Pass 27 on 2026-05-29:

- Added organizer/admin protected staff invite rotation through `POST /alpha/gate-assignments/:assignmentId/invites` and a matching protected FanPass Console route handler.
- Invite rotation is scoped to the assignment's event, rejects cross-organizer access, rejects inactive assignments, and rejects already Privy-linked staff accounts.
- Rotating an invite supersedes pending tokens before creating a replacement token. Prisma still stores only the SHA-256 token hash, and the plain token is returned once to the active Console session.
- `alpha:verify:prisma` now verifies superseded token rejection, rotated token acceptance, replay rejection, cross-organizer rejection, and linked-staff rotation rejection.
- `npm run console:verify:local` now clicks `Rotate invite` after creating a QA assignment and fails unless the rotated token panel renders without framework or console errors.
- Remaining status: local staff invite recovery/rotation is usable for testing, but public Beta still requires real Privy SDK UI, approved invite delivery policy, tenant management, physical Ops validation, and deployed staging checks.

Update after Security Pass 28 on 2026-05-29:

- Added dedicated API rate limits for high-risk auth/staff-management paths: `POST /auth/privy/sync`, `POST /auth/privy/accept-staff-invite`, `POST /alpha/gate-assignments`, `POST /alpha/gate-assignments/:assignmentId/deactivate`, and `POST /alpha/gate-assignments/:assignmentId/invites`.
- Added validated environment knobs: `RATE_LIMIT_PRIVY_PER_MINUTE`, `RATE_LIMIT_STAFF_INVITE_PER_MINUTE`, and `RATE_LIMIT_STAFF_ASSIGNMENT_PER_MINUTE`, with local defaults documented in the Alpha runbook.
- `npm run security:runtime:local` now sends a real request to `/auth/privy/sync` and fails unless the API returns `RateLimit-Policy`, proving the auth limiter is active at runtime.
- Backend tests now validate the new rate-limit configuration bounds, and the route security coverage still passes after the new staff invite route.
- Remaining status: local abuse throttling is stronger, but public Beta still requires deployed staging runtime checks, production traffic monitoring, real Privy SDK UI, and provider/dashboard validation.

Update after Security Pass 29 on 2026-05-29:

- Extended `test/route-security.spec.ts` from guard presence coverage to an explicit route role matrix.
- The test now fails if a current controller handler is added, removed, made public, or assigned different roles without updating the expected matrix.
- The matrix locks high-risk boundaries including admin-only order matching and payment operations, fan/admin payment intent creation, gate-staff/admin redemption, organizer/admin Alpha operations, public Privy token sync, and public Stripe webhook ingress.
- Remaining status: backend role drift protection is stronger, but public Beta still requires real Privy SDK login in all product surfaces, deployed staging checks, production tenant policy, and provider/dashboard validation.

Update after Security Pass 30 on 2026-05-29:

- Added `npm run security:provider-boundaries` as an automated provider integration boundary audit.
- The audit fails if Stripe Node SDK imports leave `PaymentsService`, dynamic `ethers` loading leaves `OwnershipService`, Stripe iOS SDK imports leave the app callback or PaymentSheet presenter, Socket.IO leaves the consumer realtime client, Core NFC leaves the NFC scanner transport, or AVFoundation leaves the QR scanner view.
- The audit also checks XcodeGen target boundaries: `FanPass` must exclude scanner source, and `FanPass Ops` must not depend on Stripe or Socket.IO and must exclude the consumer realtime orderbook client.
- This protects the current narrow adapter/service shape while Privy, Stripe, chain, NFC, QR, and realtime integrations continue to evolve.
- Remaining status: provider code placement is now regression-checked locally, but public Beta still requires real provider dashboard validation, real Stripe test-key/signed-webhook runs, real Privy SDK UI, deployed staging checks, and physical-device validation.

Update after Security Pass 31 on 2026-05-29:

- Added `npm run security:api-contracts` as an automated API controller contract audit.
- The audit uses the TypeScript AST to check that API mutating controller handlers keep validated DTO request bodies unless explicitly allowlisted as bodyless commands.
- The audit also verifies that the global NestJS `ValidationPipe` keeps `whitelist`, `forbidNonWhitelisted`, and `transform` enabled.
- High-risk retry-sensitive order/payment routes are now regression-checked for an `Idempotency-Key` header boundary: order creation, PaymentIntent creation, authorization cancellation, refund, and reconciliation.
- Remaining status: DTO/idempotency drift is now caught locally, but public Beta still requires real Privy SDK login, real Stripe test-key/signed-webhook validation, deployed staging checks, dependency advisory closure or explicit risk acceptance, and real-device validation.

Update after Security Pass 32 on 2026-05-29:

- Extracted order-settlement external side-effect dispatch from `OrderbookService` into `SettlementSideEffectsService`.
- `OrderbookService` no longer imports `OwnershipService`, `PaymentsService`, or `SideEffectOutboxService`; it now delegates ownership transfer, ownership outbox marking, payment capture enqueueing, and payment compensation enqueueing through a narrow settlement side-effect boundary.
- Extended `npm run security:provider-boundaries` so the audit fails if the orderbook lifecycle service re-imports ownership, payment, or raw outbox services directly.
- Alpha Prisma verification still proves authorization-gated matching, ownership side-effect completion, payment capture, reconciliation enqueueing, QR redemption, staff assignment/invite rules, and redacted operations visibility after the refactor.
- Remaining status: order settlement provider/lifecycle separation is stronger locally. Full public Beta still requires real Stripe test-key/signed-webhook validation, real Privy SDK login, deployed staging checks, dependency advisory closure or explicit risk acceptance, and broader lifecycle/provider separation for remaining ticket issuance and redemption provider calls.

Update after Security Pass 33 on 2026-05-29:

- Added `TicketOwnershipSideEffectsService` as the narrow ownership side-effect boundary for ticket issuance and redemption.
- `TicketsService` no longer imports `OwnershipService`; ticket issuance now delegates ownership minting through the side-effect boundary before recording ticket state and audit metadata.
- `VerificationService` no longer imports `OwnershipService`; accepted redemption now delegates ownership redemption through the same boundary before marking the ticket redeemed and recording the accepted check-in.
- Extended `npm run security:provider-boundaries` so the audit fails if ticket or verification lifecycle services re-import the ownership provider adapter directly.
- Alpha Prisma verification still proves ticket issuance through the ownership boundary, QR redemption, duplicate nonce rejection, gate assignment checks, and audit persistence after the refactor.
- Remaining status: current order settlement, ticket issuance, and redemption lifecycle services no longer import the ownership adapter directly. Public Beta still requires real Stripe test-key/signed-webhook validation, real Privy SDK login, deployed staging checks, dependency advisory closure or explicit risk acceptance, and physical-device validation.

Update after Security Pass 34 on 2026-05-29:

- Added `docs/PROTOTYPE_SHORTCUT_REGISTER.md` as the required risk register for local/demo shortcuts before they can be treated as Beta foundation.
- The register currently covers local demo auth, local QR secret fallback, mock Stripe/unsigned local webhooks, mock ownership, FanPass Ops paste fallback, Apple Wallet barcode metadata, manual staff invite token delivery, and placeholder mobile environment values.
- Added `npm run security:prototype-shortcuts`, which fails unless every registered shortcut has status, scope, owner, risk, replacement path, release gate, and evidence.
- Remaining status: shortcut risk tracking is now explicit and regression-checked locally. Public Beta still requires replacing or risk-accepting these shortcuts with real Privy SDK login, real Stripe test-key/signed-webhook validation, deployed staging checks, signed Wallet pass support, and physical-device validation.

Update after Security Pass 35 on 2026-05-29:

- Added `npm run beta:foundation:verify` as a composite local gate for Beta foundation/security work.
- The command runs API contract audit, API response privacy audit, provider/lifecycle boundary audit, prototype shortcut register audit, API typecheck, Console typecheck, and API unit tests in one repeatable verifier.
- The current verifier passed with 9 API test suites and 41 tests after the latest boundary and shortcut hardening work.
- Remaining status: this consolidates local Beta foundation regression checks but does not replace deployed staging runtime checks, real Stripe test-mode signed-webhook validation, real Privy SDK login, dependency advisory closure or risk acceptance, or real-device validation.

Update after Security Pass 36 on 2026-05-29:

- Added `docs/API_RESPONSE_PRIVACY_MATRIX.md` to classify every current NestJS controller response before Beta.
- Added `npm run security:api-privacy`, which scans controller handlers with the TypeScript AST and fails if a handler is missing from the matrix, if a documented route drifts, or if public/provider/admin/local-debug classifications conflict with route decorators.
- The matrix currently covers 39 controller responses across system health, local debug reset, auth session exchange, public catalog and market data, fan-private reads/writes, staff-private verification responses, organizer-redacted operations, one-time organizer staff invite secrets, admin-only commands, and Stripe webhook ingress.
- Added the privacy audit to `npm run beta:foundation:verify` so API response exposure drift is checked with the other local Beta foundation gates.
- The updated verifier passed all four local security audits, API typecheck, and 9 API test suites / 41 tests.
- Remaining status: response privacy classification is now documented and regression-checked locally. Public Beta still requires real Privy product login, deployed staging checks, dependency advisory closure or risk acceptance, real Stripe signed-webhook validation, and continued data-minimization review as response DTOs mature.

Update after Security Pass 37 on 2026-05-29:

- Extended `npm run security:api-privacy` beyond NestJS controllers to also discover FanPass Console `apps/dashboard/app/api/**/route.ts` handlers.
- Added FanPass Console route-handler responses to `docs/API_RESPONSE_PRIVACY_MATRIX.md`, including the Privy session bridge and the gate-assignment invite creation/rotation proxies.
- Console route handlers that return one-time invite-token data are classified as `ORGANIZER_SECRET_ONCE`, and the audit now fails if those handlers are not behind the server-side `consoleAccessToken()` boundary.
- The privacy audit now covers 43 response boundaries across 9 NestJS controllers and 3 Console route files.
- The updated `npm run beta:foundation:verify` passed API contract, API privacy, provider/lifecycle boundary, and prototype shortcut audits, plus API typecheck and 9 API test suites / 41 tests.
- Remaining status: Console route-handler response privacy drift is now covered locally, including one-time staff invite token responses. Public Beta still requires real Privy SDK login, approved invite delivery policy, deployed staging checks, real Stripe signed-webhook validation, dependency advisory closure or risk acceptance, and continued response DTO minimization.

Update after Security Pass 38 on 2026-05-29:

- Added `redactConsoleGateAssignmentResponse()` as a narrow FanPass Console route response adapter for gate staff invite creation and rotation.
- `POST /api/console/gate-assignments` and `POST /api/console/gate-assignments/:assignmentId/invites` no longer directly forward raw backend assignment payloads to the browser. They now return only assignment id, event title, gate, staff name, invite status/expiry, and the one-time invite token.
- Extended `npm run security:api-privacy` so Console route handlers classified as `ORGANIZER_SECRET_ONCE` must use both `consoleAccessToken()` and `redactConsoleGateAssignmentResponse()`.
- Added FanPass Console typecheck to `npm run beta:foundation:verify` because the composite foundation gate now covers Console route-handler code, not only API code.
- The updated `npm run beta:foundation:verify` passed API contract, API privacy, provider/lifecycle boundary, and prototype shortcut audits, plus API typecheck, Console typecheck, and 9 API test suites / 41 tests.
- Remaining status: Console one-time invite-token responses have a narrower local response boundary and are regression-checked. Public Beta still requires real Privy SDK login, approved invite delivery policy, deployed staging checks, real Stripe signed-webhook validation, dependency advisory closure or risk acceptance, and real-device validation.

Update after Security Pass 39 on 2026-05-29:

- Added `npm run security:console-routes` as a focused FanPass Console route contract audit.
- The audit locks the current Console route surface to the Privy session bridge and staff assignment/invite proxy routes, failing if unexpected route handlers appear without being classified and audited.
- The Privy Console session bridge is now regression-checked for organizer/admin role gating, HttpOnly same-site cookie storage, production-like secure-cookie behavior, bounded cookie max age, session cookie deletion, and no direct token/Privy/email/wallet echo in the JSON response.
- Staff assignment and invite-rotation proxy routes are now regression-checked for `consoleAccessToken()` usage, `ConsoleAuthRequiredError` handling, required field or assignment-id validation, no-store upstream requests, bearer-token forwarding, and `redactConsoleGateAssignmentResponse()` usage instead of raw upstream payload forwarding.
- Added the Console route contract audit to `npm run beta:foundation:verify`.
- The updated `npm run beta:foundation:verify` passed API contract, API privacy, Console route contract, provider/lifecycle boundary, and prototype shortcut audits, plus API typecheck, Console typecheck, and 9 API test suites / 41 tests.
- Remaining status: Console session and one-time invite proxy contracts are now locally audited. Public Beta still requires real Privy SDK login, approved invite delivery policy, deployed staging checks, dependency advisory closure or risk acceptance, and real Stripe signed-webhook validation.

Update after Security Pass 40 on 2026-05-29:

- Extended `npm run security:console-routes` to audit the shared FanPass Console server API helper in `apps/dashboard/lib/api.ts`, not only route handlers.
- The helper audit now locks the configured access token -> HttpOnly cookie token -> production-like demo-auth block -> local demo-session fallback order, so production-like Console builds cannot silently request `/auth/demo-session`.
- The helper audit also checks bearer-token forwarding, `no-store` API proxy requests, production/staging environment detection, private `FANPASS_CONSOLE_ACCESS_TOKEN` usage, and rejects public client-exposed Console token env names.
- Console server-side `apiPost()` now explicitly uses `cache: "no-store"` like `apiGet()`.
- The updated `npm run beta:foundation:verify` passed API contract, API privacy, Console route/helper contract, provider/lifecycle boundary, and prototype shortcut audits, plus API typecheck, Console typecheck, and 9 API test suites / 41 tests.
- Remaining status: the Console shared auth/proxy helper is now locally audited. Public Beta still requires real Privy SDK login, deployed staging checks, approved invite delivery policy, dependency advisory closure or risk acceptance, and real Stripe signed-webhook validation.

Update after iOS Distribution Planning on 2026-05-29:

- Added `docs/IOS_DISTRIBUTION_PLAN.md` to keep FanPass and FanPass Ops distribution separate through App Store Connect/TestFlight.
- The plan keeps Camera and NFC capabilities limited to `FanPass Ops`; `FanPass` remains consumer-only with no scanner permissions.
- The plan explicitly blocks external TestFlight until API URLs are environment-specific HTTPS, demo auth is disabled in public runtimes, Privy/Stripe provider assumptions are validated, real-device NFC is tested, and staging runtime checks pass.
- Remaining status: distribution planning is complete, but signing, provisioning, App Store Connect setup, and physical-device/TestFlight validation require the Apple Developer account and cannot be completed locally without those credentials.

Update after iOS API Environment Configuration on 2026-05-29:

- Replaced hardcoded Swift API base URLs with `FanPassEnvironment`, which reads `FanPassAPIBaseURL` from Info.plist/build settings.
- Debug builds still fall back to local `http://localhost:4000` for simulator work.
- Non-Debug builds now reject local or non-HTTPS API URLs at runtime, reducing the chance that a TestFlight build accidentally points to local development services.
- Both iOS targets build after the change and role-boundary smoke still passes.
- Remaining status: real staging/beta/prod URL values and signing-time configuration still need to be added once HTTPS environments exist.

Update after Apple Wallet Barcode Prototype on 2026-05-29:

- Added a FanPass ticket entry sheet section for Apple Wallet barcode metadata.
- The barcode prototype reuses the already signed backend entry payload as the message and describes it as `PKBarcodeFormatQR` metadata for a future Wallet pass.
- No unsigned or fake `.pkpass` package is presented as installable. The UI labels the path as `Prototype`.
- Remaining status: real Apple Wallet support still requires Apple Developer pass certificate setup, backend `.pkpass` signing, pass download/auth rules, and physical-device Wallet validation.

Update after Dependency Advisory Logging on 2026-05-29:

- Added `docs/DEPENDENCY_ADVISORY_LOG.md`.
- Current production audit remains 2 moderate advisories: `postcss <8.5.10` through direct `next`.
- `npm audit fix --force` still proposes a destructive downgrade to `next@9.3.3`; do not run it.
- Current containment is documentation plus Console authentication, CSP, and avoiding user-controlled CSS generation.
- Remaining status: advisories are documented but not risk-accepted for public or real-user testing. Re-check before external Beta.

Update after Security Pass 41 on 2026-05-29:

- Added `npm run security:dependency-advisories` to turn the Next/PostCSS advisory re-check into a repeatable gate.
- The check runs production `npm audit`, verifies that only the documented `next`/`postcss` production advisories remain, confirms npm's reported forced fix still points at the destructive `next@9.3.3` downgrade, and queries `next@latest` for its declared PostCSS dependency.
- Added the dependency advisory state check to `npm run beta:foundation:verify`.
- Current evidence: production audit still reports exactly 2 moderate advisories, `next@latest` is `16.2.6`, and it still declares `postcss: 8.4.31`, below the patched `8.5.10` advisory threshold.
- Remaining status: the advisory state is now regression-checked locally, but the blocker is not closed. External Beta still requires either a clean production audit, a safe Next/PostCSS upgrade path, or an explicit risk acceptance with owner and mitigation.

Update after Security Pass 42 on 2026-05-29:

- Threaded durable side-effect outbox idempotency keys through the payment worker boundary for `PAYMENT_CAPTURE`, `PAYMENT_CANCEL_AUTHORIZATION`, and `PAYMENT_REFUND`.
- `PaymentsService` now uses the outbox job idempotency key for Stripe capture, cancellation, and refund provider calls, falling back to the legacy payment-scoped key only when called outside a durable worker job.
- Extended `npm run security:provider-boundaries` so it fails if payment worker dispatch stops passing `job.idempotencyKey` or if Stripe provider calls stop using that key.
- Added unit coverage proving the worker passes the exact capture/cancel/refund outbox keys into `PaymentsService`.
- Remaining status: local retry idempotency is stronger for payment side effects, but real Stripe test-mode capture, cancellation, refund, reconciliation, and signed webhook validation are still required before real-money Beta.

Update after Security Pass 43 on 2026-05-29:

- Extracted backend Privy ES256 access-token verification from `AuthService` into `PrivyTokenService`.
- `PrivyTokenService` now owns Privy JWT algorithm detection, ES256 signature verification, `PRIVY_APP_ID`/`PRIVY_VERIFICATION_KEY` reads, issuer/audience/expiry/not-before claim checks, and PEM normalization.
- `AuthService` now keeps FanPass-specific session, user-linking, role-preservation, and staff-invite logic, and delegates Privy token verification to the narrow verifier service.
- Extended `npm run security:provider-boundaries` so it fails if ES256 verifier code leaves `PrivyTokenService`, if `AuthService` starts reading Privy verification keys directly, or if the backend app stops registering the verifier service.
- Auth unit tests still cover linked Privy login, first-time fan sync without webhooks, linked role preservation, email-claim prevention, and production-like local-session rejection after the boundary extraction.
- Remaining status: backend Privy verification is better isolated and regression-checked locally, but public Beta still requires real Privy SDK UI in FanPass, FanPass Ops, and FanPass Console plus actual dashboard plan verification.

Update after Security Pass 44 on 2026-05-29:

- Added a production-like startup guard that rejects `OWNERSHIP_ADAPTER=testnet` until real chain ownership settlement runs only through the durable async saga.
- Added a matching runtime guard in `OwnershipService`, so direct service construction cannot bypass startup validation and accidentally execute testnet chain calls in staging or production-like runtimes.
- Extended `npm run security:provider-boundaries` with `testnetOwnershipProductionGuard` so future edits cannot silently remove the startup/runtime guard markers.
- Added unit coverage for both security-config validation and `OwnershipService` runtime behavior.
- Verified local mock ownership still completes through the durable side-effect worker path.
- Remaining status: this prevents accidental production-like testnet chain calls through the current synchronous settlement path, but it does not complete the real chain saga. Public/staging chain enablement remains blocked until ownership transfer execution is fully async, retry-safe, and operationally deployed.

Update after Security Pass 45 on 2026-05-29:

- Split ownership settlement worker execution into two side-effect job types: `OWNERSHIP_TRANSFER` for the provider call and `OWNERSHIP_SETTLEMENT_FINALIZE` for the Prisma order/ticket/trade finalization.
- A successful ownership provider transfer now enqueues the finalization continuation with the ownership receipt, so finalization retries do not call the provider transfer again.
- Added `OrderbookService.finalizeOwnershipTransfer(...)` as the narrow domain finalization boundary for matched order settlement, ticket owner transfer, trade creation, payment capture enqueueing, audit logging, and orderbook publication.
- Added `FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true` as a local foundation switch so Prisma order settlement can stop after enqueueing ownership transfer instead of synchronously calling the ownership provider in the request path.
- Extended `npm run security:provider-boundaries` with `ownershipAsyncSagaBoundary` and extended `npm run side-effects:verify` to prove the two-step worker path completes against Prisma.
- Remaining status: local async ownership finalization is now retry-safe with respect to provider calls, but external Beta still needs deployed worker operations, testnet validation, monitoring, and recovery runbooks before real chain side effects are enabled.

Update after Security Pass 46 on 2026-05-29:

- Switched the local Beta Prisma environment to run API and worker processes with `FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true`.
- Updated `npm run beta:local:verify` so it no longer expects the sell-order API response to include an immediate trade. It now waits for the operations snapshot to show completed `OWNERSHIP_TRANSFER`, `OWNERSHIP_SETTLEMENT_FINALIZE`, and `PAYMENT_CAPTURE` side effects.
- Verified the running local Beta stack completes the full authorization-to-match-to-async-ownership-finalization-to-capture path and returns a concrete `ownershipFinalizeSideEffectId`.
- This moves the local Beta happy path away from request-path ownership finalization and toward the worker-owned saga model required before any real chain side effects.
- Remaining status: local mock/provider-free async ownership settlement is covered. External Beta still requires deployed worker supervision, signed staging configuration, testnet validation, and operational recovery procedures before real chain settlement can be enabled.

Update after Security Pass 47 on 2026-05-29:

- Added `npm run side-effects:verify` to the composite `npm run beta:foundation:verify` gate.
- The composite Beta foundation verifier now runs side-effect worker saga integration after provider/lifecycle and prototype shortcut audits, proving the worker can complete ownership transfer and ownership settlement finalization jobs against Prisma.
- The side-effect verifier checks completed `OWNERSHIP_TRANSFER`, completed `OWNERSHIP_SETTLEMENT_FINALIZE`, a settled trade, and ticket ownership movement to the buyer before the composite gate proceeds to API/Console typecheck and API unit tests.
- Remaining status: local worker saga regressions are now part of the normal foundation gate. External Beta still needs deployed worker supervision, staging runtime evidence, real Stripe test-mode validation, and testnet chain validation before real provider side effects are enabled.

Update after Security Pass 48 on 2026-05-29:

- Added stale `PROCESSING` lock recovery to the side-effect outbox worker. Each worker pass now requeues jobs whose `lockedAt` is older than `FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS`, defaulting to 300 seconds.
- Added production-like config validation for `FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS` so unsafe or malformed lock timeouts fail startup instead of silently changing retry behavior.
- Extended `npm run security:provider-boundaries` with a `sideEffectStaleLockRecovery` marker, so future edits cannot remove worker lock recovery without tripping the provider/lifecycle audit.
- Extended `npm run side-effects:verify` to create a stale `PROCESSING` ownership job, recover it, and prove it completes on retry alongside the two-step ownership transfer/finalization saga.
- Remaining status: local outbox crash recovery is stronger, but external Beta still needs deployed worker supervision, alerting/monitoring, staging runtime evidence, real Stripe test-mode validation, and testnet chain validation before real provider side effects are enabled.

Update after Security Pass 49 on 2026-05-29:

- Added `npm run side-effects:health` as a repeatable side-effect outbox health gate.
- The health gate reads Prisma outbox state and fails on terminal `FAILED`/`DEAD` jobs, stale `PROCESSING` locks, or stale due `PENDING`/`RETRYING` jobs. It reports job id, type, aggregate, attempts, age, and last error without exposing provider payloads or secrets.
- Added the health gate to `npm run beta:foundation:verify` immediately after `npm run side-effects:verify`, so the composite foundation gate now proves the worker saga completes and leaves no unhealthy outbox residue.
- Remaining status: local outbox health regression coverage is stronger. External Beta still needs deployed worker supervision, alerting/monitoring, staging runtime evidence, real Stripe test-mode validation, and testnet chain validation before real provider side effects are enabled.

Update after Security Pass 50 on 2026-05-29:

- Moved side-effect outbox health evaluation into `SideEffectHealthService`, with the CLI health command now calling the same Nest service boundary instead of owning separate database logic.
- Added admin-only `GET /alpha/side-effects/health` so future staging monitoring can read the same redacted outbox health summary through the API, without requiring direct database access.
- Classified the new response as `ADMIN_PRIVATE` in `docs/API_RESPONSE_PRIVACY_MATRIX.md`, extended the route role matrix, and added focused unit coverage proving health summaries detect stale/terminal jobs without exposing provider payload fields.
- Remaining status: local and API-accessible outbox health checks are ready for staging integration. External Beta still needs deployed worker supervision, alerting/monitoring, staging runtime evidence, real Stripe test-mode validation, and testnet chain validation before real provider side effects are enabled.

Update after FanPass iOS PaymentIntent Prep on 2026-05-29:

- Added an iOS payment preparation boundary that creates backend PaymentIntents after a fan buy order is created.
- iOS now sends idempotency keys for event-detail buy order creation and PaymentIntent preparation.
- The SwiftUI checkout sheet shows payment authorization state, but does not collect card details or claim payment completion.
- This keeps Stripe provider work behind `FanPassPaymentCoordinator` and the existing backend `PaymentsService` instead of scattering payment logic through views.
- Remaining status: this was not a complete client-side Stripe integration at the time of the prep pass. A later pass added Stripe iOS SDK PaymentSheet wiring, but external Beta still needs real test-mode confirmation and signed webhook validation.

Update after iOS Build Configuration Pass on 2026-05-29:

- Added XcodeGen-managed `Debug`, `Staging`, `Beta`, and `Release` configurations with target xcconfig files.
- Both native apps now get API URL values from config files instead of Swift source or manual Xcode edits.
- Non-Debug runtime validation rejects localhost, non-HTTPS, and `replace-me` API hosts, reducing the chance of accidental unsafe TestFlight builds.
- Placeholder Stripe publishable-key settings exist for future Stripe SDK work; no real keys are committed.
- Remaining status: real HTTPS staging/beta/production API URLs and Apple signing credentials are still required before TestFlight or physical-device external testing.

Update after FanPass iOS Stripe PaymentSheet Wiring on 2026-05-29:

- Added Stripe iOS SDK `StripePaymentSheet` through XcodeGen/SPM, pinned in `Package.resolved` at `stripe-ios-spm` 25.16.0.
- Added a consumer-only PaymentSheet presenter under `FanPass/Features/Payments`; `FanPass Ops` does not include this source or payment SDK dependency.
- Added `FANPASS_STRIPE_PUBLISHABLE_KEY` Info.plist configuration and the payment-only return URL scheme `fanpass-payments://stripe-redirect`.
- Updated the role-boundary smoke check so the consumer app may register only the payment return scheme and still rejects staff/scanner URL schemes.
- PaymentSheet is disabled when the publishable key is absent or the backend returns a local mock client secret. The UI does not fake payment success.
- Added an API guard so `/payments/intents` returns a clear 503 in the in-memory prototype instead of surfacing an internal Prisma lookup error.
- Remaining status: real Stripe test-mode validation is still open. External Beta must verify PaymentSheet confirmation, signed webhooks, replay handling, capture, cancellation, refund, and reconciliation with actual Stripe test keys.

Update after FanPass iOS Realtime Orderbook Wiring on 2026-05-29:

- Added a consumer-only Socket.IO client boundary for FanPass iOS market data.
- The FanPass Market screen now subscribes to `/orderbook` and updates from `orderbook.snapshot` and `orderbook.updated` payloads.
- Realtime payloads remain public market data only: event id, ticket type id, price levels, last/floor price, volume, premium, and reason. They do not include owner identity, user email, Privy ids, payment data, QR payloads, scanner nonces, or gate activity.
- `FanPass Ops` excludes the realtime client and does not link the Socket.IO package.
- Simulator QA confirmed the Market screen reaches `Live` and updates after an API-created buy order.
- Remaining status: local iOS realtime consumption exists. External Beta still requires deployed staging WebSocket/CORS checks, production traffic limits, and monitoring.

Update after Beta Local Prisma Environment Pass on 2026-05-29:

- Added `npm run beta:local:start`, `npm run beta:local:stop`, and `npm run beta:local:verify`.
- The local Beta start path uses Prisma, payment-authorization-gated settlement, Console, and a detached side-effect worker loop instead of relying on the in-memory prototype for payment/settlement testing.
- By default the local Beta start script clears inherited Stripe secrets and uses mock Stripe behavior unless `FANPASS_BETA_USE_STRIPE=true` is explicitly set. This reduces the chance of accidentally using real Stripe credentials during local demos.
- `beta:local:verify` proves the live local environment can complete the authorization-to-settlement-to-capture path with idempotent order/payment requests and a completed `PAYMENT_CAPTURE` side effect.
- `npm run security:runtime:local` passed against the running Beta local services.
- Remaining status: this improves local repeatability and lowers accidental credential risk, but it does not close real Stripe test-mode validation, signed webhook validation, deployed staging checks, or real-user authentication requirements.

Update after Staging WebSocket Runtime Check Pass on 2026-05-29:

- Extended `npm run security:runtime:staging` to verify the Socket.IO `/orderbook` namespace as part of staging runtime checks.
- The check now connects with the allowed Console origin, subscribes to the seeded orderbook, verifies an `orderbook.snapshot`, and rejects payloads containing private field markers such as payment client secrets, owner/scanner emails, Privy identifiers, or QR nonces.
- The same check attempts a disallowed-origin connection and fails if the origin can connect or receive a snapshot, giving FanPass a repeatable WebSocket CORS regression test.
- `npm run security:runtime:staging:dry-run` passed locally with a staging-like HTTPS origin header.
- Remaining status: this validates the runtime check and local staging-like behavior only. The external Beta gate still requires real HTTPS staging API/Console URLs and a recorded `npm run security:runtime:staging` result against those deployed services.

Update after Security Pass 51 on 2026-05-29:

- Extended `npm run beta:local:verify` so the running local Beta API/Console/worker stack verifies admin-only `GET /alpha/side-effects/health` after async ownership finalization and payment capture complete.
- The local verifier now creates only a local demo admin user after reset, requests a local admin demo session, and fails if the health response is unhealthy, malformed, or includes private/provider markers such as payload JSON, client secrets, invite tokens, Stripe secret markers, or Privy verification-key markers.
- Extended `npm run security:runtime:staging` with optional `STAGING_ADMIN_ACCESS_TOKEN` / `FANPASS_STAGING_ADMIN_ACCESS_TOKEN` support. When supplied, the runtime check calls the same admin-only health endpoint without printing the token; when absent, the output explicitly marks this gate as skipped.
- `npm run security:runtime:staging:dry-run`, `npm run beta:local:verify`, and `npm run beta:foundation:verify` passed after the change.
- Remaining status: local API-boundary outbox health is now covered, and staging has a token-ready check. The external Beta gate still requires real HTTPS staging URLs, a real admin bearer token, deployed worker supervision/alerting, real Stripe test-mode validation, and testnet chain validation before real provider side effects are enabled.

Update after Security Pass 52 on 2026-05-29:

- Strengthened `npm run security:runtime:staging:dry-run` so it now runs the staging-like API on local Prisma, not memory, with demo auth disabled and production-like Privy bearer verification enabled.
- The dry-run resets/seeds local Prisma, upserts a local-only admin fixture, generates an ephemeral ES256 keypair, signs a short-lived Privy-like admin token, and passes it only through the current script process to `npm run security:runtime:staging`.
- The staging runtime check now always verifies unauthenticated access to `GET /alpha/side-effects/health` is rejected, and the dry-run verifies the positive admin health path returns healthy without private/provider markers.
- `npm run security:runtime:staging:dry-run` and `npm run beta:foundation:verify` passed after the change.
- Remaining status: the local dry-run now proves the admin health path with a Prisma-backed outbox and production-like bearer auth, but deployed staging still requires real HTTPS URLs, a real admin token from the chosen auth source, worker supervision/alerting, real Stripe test-mode validation, and testnet chain validation before real provider side effects are enabled.

Update after Security Pass 53 on 2026-05-29:

- Extended `npm run security:runtime:staging` JSON output with `checkedAt`, `localDryRun`, redacted orderbook subscription-target proof, and the admin side-effect health status so real staging runs can be saved as auditable evidence rather than copied as ambiguous console text.
- Updated `docs/DEPLOYMENT_ENVIRONMENTS.md` with the exact deployed staging evidence capture command, safe `STAGING_ADMIN_ACCESS_TOKEN` handling, expected JSON fields, and the requirement to save output under `outputs/staging-runtime/` before summarizing the result here.
- `npm run security:runtime:staging:dry-run` passed and now emits the same evidence metadata with `"localDryRun": true`.
- Remaining status: runtime evidence formatting is ready, but deployed staging still requires real HTTPS URLs, `"localDryRun": false`, a real staging admin token, worker supervision/alerting, real Stripe test-mode validation, and testnet chain validation before real provider side effects are enabled.

Update after Security Pass 54 on 2026-05-29:

- Added `npm run security:runtime:staging:evidence` to validate saved staging runtime evidence before the deployed staging gate can be marked closed.
- The validator rejects local dry-run evidence by default, requires HTTPS API/Console URLs, requires healthy admin side-effect outbox status, checks required API header/demo-auth/admin-health/WebSocket and Console header/locked-state evidence items, and fails if token, private-key, provider-key, client-secret, Privy secret, or database URL markers are present in the evidence text.
- Validation passed for local dry-run output only with `--allow-dry-run`; default mode correctly rejected that same file because `localDryRun` was true and URLs were local HTTP.
- Remaining status: deployed staging evidence now has a local validator, but closing the staging gate still requires a real saved JSON result with `"localDryRun": false`, real HTTPS URLs, and a real staging admin token.

Update after Security Pass 55 on 2026-05-29:

- Added `npm run security:runtime:staging:evidence:self-test` with synthetic evidence fixtures for the staging runtime evidence validator.
- The self-test proves the validator accepts deployed HTTPS evidence, accepts local dry-run evidence only with `--allow-dry-run`, rejects dry-run evidence by default, rejects bearer-token markers, and rejects non-HTTPS deployed orderbook origins.
- Added the self-test to `npm run beta:foundation:verify` so validator semantics are part of the normal local Beta foundation gate without using real staging credentials.
- Remaining status: validator regressions are now covered locally, but the staging gate still requires a real saved deployed JSON result with `"localDryRun": false`, real HTTPS URLs, and a real staging admin token.

Update after Security Pass 56 on 2026-05-29:

- Added root script `npm run security:route-roles` as a dedicated API route public/role matrix gate.
- Added the route-role gate to `npm run beta:foundation:verify` before the privacy/provider/lifecycle checks, so controller access-control drift is reported as a specific Beta foundation failure instead of only appearing inside the broader API unit suite.
- Closed the role-based access coverage checklist parent because event-scoped organizer reads/writes, controller route coverage, explicit public/fan/organizer/gate-staff/admin matrix coverage, and Console-managed gate staff assignment flows now all have automated checks.
- Remaining status: API role coverage is explicit locally, but real Privy product login, deployed staging checks, production tenant/staff policy validation, and physical-device Ops validation remain required before external Beta.

Update after Security Pass 57 on 2026-05-29:

- Added `docs/ALPHA_DEMO_SCRIPT.md` as the frozen local Alpha walkthrough script covering FanPass, FanPass Ops, FanPass Console, local Prisma/payment-aware settlement, fan access, scanner replay rejection, and the closing security boundary.
- Added `npm run alpha:demo-script:audit` and included it in `npm run beta:foundation:verify` so the script must keep local-only scope, three-surface product boundaries, verification commands, no-secret constraints, and unresolved Beta blockers visible before any recording.
- Split the Beta task into completed script-freeze/audit work and a remaining walkthrough recording task.
- Remaining status: the local walkthrough script is frozen and audited, but no walkthrough recording has been captured yet; external Beta still requires real Privy, Stripe, staging, dependency, Apple Wallet, and real-device validation.

Update after Security Pass 58 on 2026-05-29:

- Added bounded field-level validation to API controller request DTOs across auth, events, Alpha operations, tickets, orders, payments, fan access, and verification.
- String request fields now have length, email, ISO timestamp, UUID, enum, regex, or currency-format constraints. Numeric request fields now have integer/min/max bounds where applicable.
- Strengthened `npm run security:api-contracts` so future controller DTOs fail if request-body string or number fields keep only bare `@IsString()` or `@IsNumber()` validation.
- Remaining status: ASR-010 is materially reduced for current request bodies, but public Beta still needs continued validation discipline for new params/query DTOs and real deployed runtime checks.

Update after Security Pass 59 on 2026-05-29:

- Added `FanPassIdParamPipe` and `GateCodeParamPipe` as reusable Nest route-boundary validators for bounded resource ids and Ops gate codes.
- Applied the route param pipes across current API controllers for event, ticket type, ticket, order, user, payment, assignment, task, and gate route params.
- Strengthened `npm run security:api-contracts` so future raw `@Param(...)` usage or named `@Query(...)` usage without an explicit validation boundary fails the local security gate.
- Added focused malformed-input Jest coverage for route ids and gate codes.
- Remaining status: ASR-010 is materially reduced for current request bodies and route params. Public Beta still needs continued query DTO discipline as new surfaces are added, plus real deployed runtime checks.

Update after Security Pass 60 on 2026-05-29:

- Added `npm run security:provider-boundaries:self-test` as synthetic regression coverage for the provider/lifecycle boundary audit.
- The self-test builds temporary fixture projects and proves the audit accepts approved provider placement while rejecting Stripe SDK imports outside `PaymentsService`, lifecycle services importing provider services directly, `FanPassOps` linking Stripe, and payment worker dispatch that stops passing the outbox job idempotency key.
- Added the self-test to `npm run beta:foundation:verify` immediately before the real workspace provider/lifecycle boundary audit.
- Remaining status: provider/lifecycle audit semantics are now regression-tested locally, but public Beta still requires real provider dashboard validation, real Stripe signed-webhook runs, real Privy SDK UI, deployed staging checks, and physical-device validation.

Update after Security Pass 61 on 2026-05-29:

- Added `npm run security:api-contracts:self-test` as synthetic regression coverage for the API controller contract audit.
- The self-test builds temporary controller fixtures and proves the audit accepts bounded DTOs, route param pipes, query validation boundaries, and idempotency headers while rejecting missing global `ValidationPipe` settings, bare `@IsString()` request fields, raw `@Param(...)`, unvalidated named `@Query(...)`, missing order idempotency headers, and unallowlisted bodyless mutations.
- Added the self-test to `npm run beta:foundation:verify` before the real workspace API contract audit.
- Remaining status: API contract audit semantics are now regression-tested locally, but public Beta still requires real Privy SDK login, real Stripe test-key and signed-webhook validation, deployed staging checks, dependency advisory closure or risk acceptance, and real-device validation.

Update after Security Pass 62 on 2026-05-30:

- Added `npm run security:api-privacy:self-test` as synthetic regression coverage for the API/Console response privacy audit.
- The self-test builds temporary Nest controller and Next route-handler fixtures and proves the audit accepts documented classifications while rejecting undocumented handlers, stale matrix entries, route drift, private classifications on public routes, public classifications on protected routes or Console routes, non-ADMIN `ADMIN_PRIVATE` routes, provider ingress outside the Stripe webhook boundary, webhook classification drift, and one-time Console secret responses that bypass access-token/redaction helpers.
- Added the self-test to `npm run beta:foundation:verify` before the real workspace API response privacy audit.
- Remaining status: response privacy audit semantics are now regression-tested locally, but public Beta still requires real Privy SDK login, real Stripe test-key and signed-webhook validation, deployed staging checks, dependency advisory closure or risk acceptance, and real-device validation.

Update after Security Pass 63 on 2026-05-30:

- Added `npm run security:console-routes:self-test` as synthetic regression coverage for the FanPass Console route contract audit.
- The self-test builds temporary Console route/helper fixtures and proves the audit accepts the intended Privy session bridge, gate staff assignment proxy, invite rotation proxy, and server API helper while rejecting missing or unexpected Console routes, removed organizer/admin gating, sensitive session field leaks, weakened HttpOnly cookie handling, raw upstream assignment forwarding, missing Console access-token usage, unencoded invite assignment ids, demo-auth fallback before the production-like block, and public client-exposed Console token configuration.
- Added the self-test to `npm run beta:foundation:verify` before the real workspace Console route contract audit.
- Remaining status: Console route audit semantics are now regression-tested locally, but public Beta still requires real Privy SDK login, production tenant/staff policy validation, deployed staging checks, dependency advisory closure or risk acceptance, and real-device validation.

Update after Security Pass 64 on 2026-05-30:

- Added fixture mode to `scripts/dependency-advisory-check.js` and `npm run security:dependency-advisories:self-test`.
- The self-test proves the dependency advisory gate accepts the documented unresolved Next/PostCSS state and clean-audit closeout warning while rejecting undocumented production advisories, severity drift above the documented moderate findings, changed npm forced-fix paths, newly available safe Next/PostCSS patch paths, missing latest-Next PostCSS metadata, and advisory-log drift that removes the external-testing gate.
- Added the self-test to `npm run beta:foundation:verify` before the live advisory re-check.
- Remaining status: advisory gate semantics are now regression-tested locally without network access, but the live check still reports 2 moderate Next/PostCSS advisories and this remains an external-testing blocker until patched or explicitly risk-accepted.

Update after Security Pass 65 on 2026-05-30:

- Added fixture mode to `scripts/prototype-shortcut-audit.js` and `npm run security:prototype-shortcuts:self-test`.
- The self-test builds synthetic prototype shortcut registers and proves the audit accepts the complete `PS-001` through `PS-008` register while rejecting missing required shortcut sections, unexpected shortcut ids, missing required fields, missing release gates, and missing shortcut-specific evidence markers.
- Added the self-test to `npm run beta:foundation:verify` before the real workspace prototype shortcut register audit.
- Remaining status: prototype shortcut audit semantics are now regression-tested locally, but each accepted shortcut remains a real external-testing blocker or risk item until its release gate is closed or explicitly risk-accepted.

Update after Security Pass 66 on 2026-05-30:

- Added fixture mode to `scripts/alpha-demo-script-audit.js` and `npm run alpha:demo-script:audit:self-test`.
- The self-test builds synthetic Alpha demo script fixtures and proves the audit accepts the complete local-only script shape while rejecting missing local-only scope, product surface, verification command, scene, unresolved blocker, recording checklist, and provider-secret guardrails.
- Added the self-test to `npm run beta:foundation:verify` before the real workspace Alpha demo script audit.
- Remaining status: Alpha recording preparation guardrails are now regression-tested locally, but the walkthrough recording itself is still open and external Beta still requires real Privy, Stripe, staging, dependency, Apple Wallet, and real-device validation.

Update after Security Pass 67 on 2026-05-30:

- Added `npm run security:runtime:local:self-test` as fixture-backed coverage for the local API/Console runtime header checker.
- The self-test uses a fake `curl` boundary to prove the checker accepts required API, Console, and Privy auth headers while rejecting missing API hardening headers, API or Console `x-powered-by` disclosure, missing Privy auth `ratelimit-policy`, missing Console cross-origin opener policy, and missing Console CSP.
- Added the self-test to `npm run beta:foundation:verify` before the staging evidence validator self-test.
- Remaining status: local runtime header-check semantics are now regression-tested without live services, but deployed staging evidence with real HTTPS URLs and a real staging admin bearer remains required before external Beta.

Update after Security Pass 68 on 2026-05-30:

- Added `npm run security:runtime:staging:self-test` as fixture-backed coverage for the deployed staging runtime checker.
- The self-test uses fake `curl` and `node` boundaries to prove the checker accepts deployed-style HTTPS runtime evidence while rejecting non-HTTPS staging URLs, missing API hardening headers, API `x-powered-by`, missing Console cross-origin opener policy, missing Console CSP, demo-session issuance, unauthenticated side-effect health access, unlocked unauthenticated Console rendering, private admin-health payload markers, and orderbook origin-check failures.
- Added the self-test to `npm run beta:foundation:verify` before the staging evidence validator self-test.
- Remaining status: staging checker behavior is now regression-tested without real staging credentials, but real deployed HTTPS staging evidence remains required before external Beta.

Update after Security Pass 69 on 2026-05-30:

- Added `npm run beta:local:start:self-test` as fixture-backed coverage for the local Beta stack launcher.
- The self-test uses fake process, service, and network tools to prove `beta-local-start.sh` clears inherited Stripe secrets by default, only forwards Stripe settings when `FANPASS_BETA_USE_STRIPE=true`, keeps the local stack on mock payments with async ownership settlement and payment-authorization gating, and honors `FANPASS_BETA_SKIP_DB_RESET=true`.
- Added the self-test to `npm run beta:foundation:verify` before runtime header self-tests.
- Remaining status: local startup safety semantics are now regression-tested without real credentials or launched services, but external Beta still requires real Stripe test-mode validation, real Privy product login, deployed staging evidence, and real-device validation.

Update after Security Pass 70 on 2026-05-30:

- Expanded `npm run security:provider-boundaries:self-test` so provider/lifecycle audit semantics now cover the newer boundary checks, not only the original Stripe/lifecycle cases.
- The fixture self-test now rejects `AuthService` owning Privy verifier details, removed production-like testnet ownership guard markers, ownership finalization saga drift, and stale side-effect `PROCESSING` lock recovery drift.
- This keeps backend Privy verification isolated in `PrivyTokenService`, keeps testnet ownership blocked in production-like runtimes, and keeps ownership/payment side effects behind the durable outbox worker semantics before the real workspace audit runs.
- Remaining status: provider/lifecycle audit semantics are stronger locally, but external Beta still requires real Privy SDK login, real Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, signed Apple Wallet passes, and real-device validation.

Update after Security Pass 71 on 2026-05-30:

- Added `npm run security:route-roles:self-test` as fixture-backed coverage for the API route role matrix audit semantics.
- The self-test builds synthetic Nest route metadata fixtures and proves the route-role gate accepts public routes and guarded role routes while rejecting uncovered handlers, role metadata without `FanPassAuthGuard`, role matrix drift, public/private drift, unexpected new handlers, and missing expected handlers.
- Added the self-test to `npm run beta:foundation:verify` immediately before the real workspace `npm run security:route-roles` controller matrix test.
- Remaining status: route role matrix semantics are now regression-tested locally, but public Beta still requires real Privy SDK login, real Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, signed Apple Wallet passes, and real-device validation.

Update after Security Pass 72 on 2026-05-30:

- Added `npm run beta:local:verify:self-test` as fixture-backed coverage for the live local Beta verification script.
- The self-test runs `scripts/beta-local-verify.sh` against fake `curl`, `npm`, `sleep`, and `node` boundaries, and the fake Node boundary rejects verifier drift that removes async ownership finalization, payment capture, admin-only side-effect outbox health, or health-response redaction checks.
- The self-test also proves `FANPASS_BETA_VERIFY_SKIP_DB_RESET=true` suppresses the local Prisma reset while the default verifier still runs `alpha:db:reset`.
- Added the self-test to `npm run beta:foundation:verify` after the Beta local start safety self-test.
- Remaining status: local Beta verification semantics are now regression-tested without live services or credentials, but public Beta still requires real Privy SDK login, real Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, signed Apple Wallet passes, and real-device validation.

Update after Security Pass 73 on 2026-05-30:

- Added root `npm run side-effects:health:self-test` as a focused preflight for the side-effect outbox health gate.
- Expanded `SideEffectHealthService` fixture coverage so unhealthy outbox checks now prove stale `RETRYING` jobs and terminal `FAILED` jobs are caught in addition to stale `PROCESSING`, stale `PENDING`, and terminal `DEAD` jobs.
- Added the self-test to `npm run beta:foundation:verify` immediately before the live `npm run side-effects:health` command, so health semantics are proven before the verifier trusts current local database state.
- Remaining status: side-effect outbox health semantics are stronger locally, but public Beta still requires deployed worker supervision, deployed staging evidence with a real admin bearer, real Stripe signed-webhook validation, real Privy product login, and real-device validation.

Update after Security Pass 74 on 2026-05-30:

- Added `npm run side-effects:verify:self-test` as fixture-backed coverage for the side-effect worker saga verifier.
- The self-test runs `scripts/side-effects-worker-verify.sh` with fake `npm` and `node` boundaries and rejects drift that removes the stale `PROCESSING` recovery fixture, the second worker pass, ownership finalization lookup, ticket transfer checks, or order settlement checks.
- Added the self-test to `npm run beta:foundation:verify` immediately before the live `npm run side-effects:verify` Prisma worker verifier.
- Remaining status: worker verifier semantics are stronger locally, but public Beta still requires deployed worker supervision, deployed staging evidence with a real admin bearer, real Stripe signed-webhook validation, real Privy product login, and real-device validation.

Update after Security Pass 75 on 2026-05-30:

- Added `npm run security:engineering-gates` as a meta-audit for the completed Engineering Quality Gates.
- The audit verifies the composite Beta verifier runs provider-boundary self-tests before the real provider/lifecycle audit, then runs the Engineering Quality Gate self-test and real audit.
- The audit also verifies the provider/lifecycle boundary audit keeps required Stripe, Privy, chain, realtime, NFC, scanner, and iOS Stripe provider markers; keeps `OrderbookService`, `TicketsService`, and `VerificationService` separated from provider SDK/service imports; and keeps maintainability guidance in the QA and provider feasibility docs.
- Added `npm run security:engineering-gates:self-test` with synthetic fixtures that reject missing composite verifier wiring, missing provider SDK markers, missing lifecycle boundary markers, and missing maintainability docs.
- Added both commands to `npm run beta:foundation:verify` after the provider/lifecycle boundary audit.
- Remaining status: provider adapter isolation and lifecycle/provider separation are now locally enforced Engineering Quality Gates, but public Beta still requires real provider dashboard validation, real Stripe signed-webhook runs, real Privy SDK UI, deployed staging checks, dependency advisory closure or risk acceptance, and physical-device validation.

Update after Security Pass 76 on 2026-05-30:

- Added `npm run security:privy-webhooks:optional` as a plan-risk guard for Privy webhooks.
- The audit fails if application code adds a Privy webhook route/handler or starts requiring `PRIVY_*WEBHOOK*` secrets before actual Privy plan support is verified.
- The audit also verifies the current low-cost access-token path stays present: backend `/auth/privy/sync`, staff invite acceptance, Console Privy session bridge, and iOS API client token-sync boundaries.
- Added `npm run security:privy-webhooks:optional:self-test` with synthetic fixtures that reject webhook routes, webhook secret requirements, missing access-token sync, missing optionality docs, and missing composite verifier wiring.
- Added both commands to `npm run beta:foundation:verify` after the dependency advisory gate, and marked the Beta task "Keep Privy webhooks optional until plan support is verified" complete.
- Remaining status: Privy webhooks are now locally enforced as optional, but public Beta still requires actual Privy dashboard plan validation, real Privy SDK login UI, deployed staging checks, dependency advisory closure or risk acceptance, and real-device validation.

Update after Security Pass 77 on 2026-05-30:

- Added `npm run security:settlement-retry-idempotency` as a local gate for durable settlement retry semantics.
- The audit verifies the side-effect outbox uses idempotency-key upserts, keeps `RETRYING` jobs runnable, increments attempts on claim, and schedules retry/dead transitions predictably.
- The audit verifies ownership settlement uses deterministic `ownership-transfer:{buyOrderId}:{sellOrderId}` and `ownership-finalize:{buyOrderId}:{sellOrderId}` keys, with provider transfer and settlement finalization kept as separate worker steps.
- The audit verifies payment capture, authorization cancellation, refund, and admin payment operation side effects use deterministic durable keys and pass the outbox job idempotency key into provider calls.
- Added `npm run security:settlement-retry-idempotency:self-test` with synthetic fixtures that reject non-upsert outbox writes, missing ownership finalization keys, missing payment job idempotency-key forwarding, missing provider idempotency keys, missing worker test coverage, and missing composite verifier wiring.
- Added both commands to `npm run beta:foundation:verify` before the live side-effect worker saga verifier, and marked the local Beta task "Add settlement retry idempotency around payment capture, refund, and ownership retries" complete.
- Remaining status: local settlement retry idempotency is now enforced, but public/real-money Beta still requires real Stripe test-mode capture/refund/cancellation/reconciliation validation with signed webhooks, deployed worker supervision, and deployed staging evidence.

## Executive Summary

Alpha feature scope is complete for the local demo baseline. The three product surfaces are separated, the end-to-end ticket lifecycle works, persistence is verified through Prisma, and the local demo can show order matching, ticket ownership updates, QR redemption, duplicate rejection, gate summaries, Console operations, and audit logs.

Security status is different: Alpha is not safe for public internet exposure. It is acceptable as a local prototype and FYP/technical demo only. Before any closed Beta with real users, real personal data, real payments, real wallet keys, or public endpoints, the critical and high findings below must be fixed.

Security priority statement:

FanPass must treat user personal data, wallet/ticket ownership, payment state, scanner authority, organizer inventory, and FanPass platform integrity as first-class protected assets. The founder's personal information and FanPass's operational security have the same priority as product functionality. No demo convenience, speed, or UI polish should override privacy, authentication, authorization, secret handling, or ticket integrity.

## Alpha Completion Status

| Area                 | Status             | Evidence                                                                                                                                                                                         |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FanPass consumer app | Complete for Alpha | Guest browsing, event detail, wallet, marketplace, fan access, profile, and action-time auth gates are implemented. Product smoke confirms no scanner/admin controls in the consumer navigation. |
| FanPass Ops          | Complete for Alpha | Separate iOS target with event selection, gate selection, scanner entry, accepted/rejected counters, QR camera path, paste fallback, and duplicate/failure states.                               |
| FanPass Console      | Complete for Alpha | Web Console can create Alpha inventory and inspect events, ticket inventory, orderbook, trades, check-ins, fan access submissions, and audit logs.                                               |
| API data foundation  | Complete for Alpha | Memory and Prisma paths exist for events, tickets, fan access, orders, verification, audit, and ownership adapter flows.                                                                         |
| Ownership adapter    | Complete for Alpha | Mock adapter is default; testnet adapter is available behind explicit configuration.                                                                                                             |
| Contracts            | Complete for Alpha | Ticket, soulbound, and redemption registry contracts exist with basic tests.                                                                                                                     |
| Demo verification    | Complete           | Close-out passed workspace typecheck/build, API tests, contract tests, prototype verification, Prisma verification, iOS boundary smoke, and both iOS schemes.                                    |

## Current Improvements Found

1. Fixed during this review: removed Camera and NFC usage descriptions from the consumer `FanPass` target. These permissions belong to `FanPass Ops`, not the C-side app. This reduces privacy surface and keeps role separation honest.
2. Keep Alpha marked as complete, but label it as a local demo baseline, not a security-ready public build.
3. Before Beta, make security implementation a workstream, not a polish task.

## Positive Security Controls Already Present

- Product surface separation exists: fan, gate staff, and organizer/admin workflows are split across `FanPass`, `FanPass Ops`, and `FanPass Console`.
- The consumer `FanPass` target excludes scanner source through XcodeGen.
- QR payloads are signed with HMAC and verified with `timingSafeEqual`.
- QR payloads have expiration and nonce replay protection in both memory and Prisma paths.
- Production-like startup now rejects missing/placeholder QR signing config and missing Privy verification config.
- Production-like API auth now verifies Privy ES256 access tokens and disables local email/demo session issuance.
- Production-like Console builds lock instead of using demo auth, and organizer operations snapshots are PII-redacted by default.
- Console organizer operations are scoped to events owned by that organizer profile.
- Organizer ticket inventory, ticket detail, and ticket issuance are scoped to organizer-owned events.
- Gate staff redemption and gate summary access are scoped to explicit event/gate assignments.
- API and Console responses now include baseline security headers.
- API routes now have first-pass rate limiting, with stricter limits on auth and verification paths.
- Prisma is used for persistent database access; no raw SQL string construction was found in application code.
- IDs are UUID-style strings, not public incremental IDs.
- Audit logs are written for important lifecycle actions.
- `.gitignore` excludes `.env` and `.env.*`; no live production secrets were found in the repo scan.
- React/Next UI uses normal JSX rendering; no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function` usage was found in app code.

## Critical Findings

### ASR-001 - Production authentication UX and route coverage are incomplete

Severity: Critical

Status after Security Pass 29: Partially mitigated. Local signed sessions and role guards protect the main state-changing Alpha routes, production-like API auth now verifies Privy access tokens, controller route coverage is tested automatically, and an explicit route role matrix prevents silent role drift. This is not fully closed until the apps and Console use real Privy login flows and remaining seeded/demo auth assumptions are removed from non-local product flows.

Locations:

- `apps/api/src/modules/orders/orders.controller.ts:46`
- `apps/api/src/modules/tickets/tickets.controller.ts:34`
- `apps/api/src/modules/verification/verification.controller.ts:43`
- `apps/api/src/modules/alpha/alpha.controller.ts:58`
- `apps/api/src/common/session.ts:11`

Evidence:

- Core protected routes now use `FanPassAuthGuard` and role decorators, and QR redemption derives scanner identity from the verified session.
- Every controller route must now be explicitly marked public or guarded with `FanPassAuthGuard` plus `@Roles(...)`; `test/route-security.spec.ts` fails if a route is missed or if the assigned public/role matrix drifts.
- Local demo sessions still exist for prototype speed, and product surfaces have not yet integrated real Privy SDK login flows.
- Some Alpha/demo workflows still carry user identifiers in request paths or request bodies for local compatibility, though protected handlers now derive sensitive actors from the verified session where implemented.

Impact:

Anyone who can reach the API can impersonate another user, list or cancel another user's orders, issue tickets, generate entry payloads for active tickets, redeem tickets as seeded gate staff, and read or mutate organizer/admin state.

Fix:

- Add real auth before public Beta: Privy/OIDC/JWT or secure server sessions.
- Add NestJS auth and role guards to every state-changing endpoint.
- Derive `userId` and `role` from the verified session token, never from client-provided JSON.
- Add route-level capability checks for fan, organizer, gate staff, and admin.

### ASR-002 - FanPass Console and Alpha admin endpoints are unauthenticated

Severity: Critical

Status after Security Pass 28: Partially mitigated. `/alpha/*` endpoints require organizer/admin bearer auth, production-like Console builds do not use demo-session fallback, organizer operations snapshots are PII-redacted by default, organizer reads/writes are scoped to events owned by their organizer profile, organizer ticket inventory/issuance is event-scoped, Console supports organizer-scoped gate staff assignment/revocation/rotation locally, staff invites can be accepted only after Privy token verification, and high-risk Privy/staff management routes now have dedicated rate limits. This remains open for public Beta until Console has real Privy organizer/admin login UX, approved invite delivery policy, production tenant-management rules, deployed runtime checks, and traffic monitoring.

Locations:

- `apps/api/src/modules/alpha/alpha.controller.ts:58`
- `apps/api/src/modules/alpha/alpha.controller.ts:63`
- `apps/api/src/modules/alpha/alpha.controller.ts:68`
- `apps/dashboard/app/page.tsx:118`
- `apps/dashboard/app/page.tsx:141`

Evidence:

Console and Alpha APIs now require organizer/admin bearer auth and event ownership checks in local/backend code. Console can create, revoke, and rotate gate staff assignments without database seed edits. Staff invite acceptance requires a verified Privy access token and a one-time invite token hash match. Dedicated rate limits cover Privy sync, staff invite acceptance, and staff assignment management. The remaining evidence is product-level: Console still relies on server-provided bearer tokens rather than a complete Privy organizer/admin login UX, and staff administration still needs approved invite delivery policy.

Impact:

An attacker could view operational data, owner emails, check-in activity, audit events, and create/modify event inventory if the API/Console is exposed.

Fix:

- Complete Privy organizer/admin login in Console.
- Add production tenant and staff-roster administration rules.
- Re-run route coverage to confirm all Console and organizer/admin paths enforce role and event ownership checks.

### ASR-003 - QR generation and redemption authority is not bound to authenticated roles

Severity: Critical

Status after Security Pass 28: Partially mitigated. QR generation requires `FAN`/`ADMIN` and checks fan ticket ownership; redemption requires `GATE_STAFF`/`ADMIN`, uses the authenticated scanner user, and gate staff must be assigned to the scanned event/gate. Console can manage and rotate local gate assignments, invited staff can link Privy identity through token-based invite acceptance, and invite acceptance now has a dedicated rate limit. This remains open until real Privy/Ops login UX, approved invite delivery policy, physical-device Ops validation, and deployed runtime checks are implemented.

Locations:

- `apps/api/src/modules/verification/verification.controller.ts:43`
- `apps/api/src/modules/verification/verification.controller.ts:48`
- `apps/api/src/modules/verification/verification.service.ts:220`
- `apps/api/src/modules/verification/verification.service.ts:239`

Evidence:

The QR generation endpoint accepts a `ticketId` and now requires a fan/admin session with ownership checks. The redemption endpoint accepts the signed payload plus `gate`, derives scanner identity from the bearer session, and checks explicit event/gate assignment. Console now manages local assignment creation and revocation, and staff invite acceptance binds a verified Privy subject to the invited `GATE_STAFF` user. The finding remains partially open because product login still uses seeded/demo sessions locally and production invite delivery/rotation is not complete.

Impact:

If exposed, attackers could generate valid entry codes for tickets they do not own or redeem valid tickets as a gate user.

Fix:

- QR generation must require a fan/admin session and verify ticket ownership.
- Redemption must require `GATE_STAFF` or `ADMIN`; `scannerUserId` must come from the authenticated session.
- Gate assignment should be checked against allowed event/gate permissions.

## High Findings

### ASR-004 - CORS is open while credentials are enabled

Severity: High

Status after Security Pass 1: Mitigated for Alpha demo. CORS now uses `FANPASS_CORS_ORIGINS` and credentials are disabled. Re-verify runtime CORS in staging before public Beta.

Location:

- `apps/api/src/main.ts:9`

Evidence:

`app.enableCors({ origin: true, credentials: true })` reflects arbitrary origins and allows credentialed cross-origin requests.

Impact:

If cookie/session auth is added without tightening CORS, a malicious origin could interact with the API using a victim's browser session.

Fix:

- Replace with an explicit origin allowlist per environment.
- Keep credentials disabled unless cookie/session auth actually requires it.

### ASR-005 - Demo auth is email-only and should never ship

Severity: High

Status after Security Pass 3: Partially mitigated. Login/register still exist for local prototypes, but they are disabled in production-like builds. Protected API routes in production-like builds now require Privy ES256 access tokens linked to FanPass users. This remains open until all product surfaces integrate Privy login and remove local email auth from non-local deployments.

Locations:

- `apps/api/src/modules/auth/auth.controller.ts:28`
- `apps/api/src/modules/auth/auth.controller.ts:57`
- `apps/ios/FanPass/FanPass/App/AppState.swift:22`

Evidence:

Registration and login require only name/email or email. iOS also has `continueAsDemoFan()`.

Impact:

Anyone can log in as a seeded user by knowing the email address, and demo sessions are not cryptographically protected.

Fix:

- Replace with Privy or another real identity provider.
- Remove or hard-disable demo auth in any non-local environment.
- Store only minimal session state on-device; use Keychain for durable tokens when real auth is added.

### ASR-006 - QR signing secret has a hardcoded local fallback

Severity: High

Status after Security Pass 2: Mitigated for production-like environments. Local development can still use the fallback for reproducible demos, but `NODE_ENV=production`, `FANPASS_ENV=production`, or `FANPASS_ENV=staging` now fails startup unless a non-placeholder `QR_SIGNING_SECRET` is configured.

Location:

- `apps/api/src/modules/verification/verification.service.ts:196`

Evidence:

If `QR_SIGNING_SECRET` is missing, the API uses `"fanpass-local-dev-secret"`.

Impact:

If a public environment accidentally starts without a real secret, QR signatures are forgeable by anyone who knows or reads the code.

Fix:

- Fail fast outside local development when `QR_SIGNING_SECRET` is missing.
- Use a strong random secret from a secret manager.
- Add key rotation support and signed payload versioning before pilot usage.

### ASR-007 - Personal and operational data is overexposed

Severity: High

Status after Security Pass 36: Partially mitigated. Ticket/order/fan score reads are session protected and fan-owned where applicable; Console operations are organizer/admin protected, event-scoped, and redacted by default; and every current controller response is now classified in `docs/API_RESPONSE_PRIVACY_MATRIX.md` with a drift audit. This remains open until real Privy product login, deployed staging checks, and continued response DTO minimization are complete before real-user Beta.

Locations:

- `apps/api/src/modules/tickets/tickets.controller.ts:24`
- `apps/api/src/modules/tickets/tickets.controller.ts:29`
- `apps/api/src/modules/alpha/alpha.controller.ts:58`
- `apps/dashboard/app/page.tsx:58`

Evidence:

Public API routes can list all tickets or any owner's tickets. Console operations include `ownerEmail`, scanner email, audit metadata, and fan task proofs.

Impact:

Personal data, ticket ownership, check-in history, and operational audit state could leak if endpoints are reachable outside local development.

Fix:

- Add data minimization and role-scoped reads.
- Redact email/PII by default; show full values only to authorized admin roles.
- Keep `docs/API_RESPONSE_PRIVACY_MATRIX.md` current and run `npm run security:api-privacy` whenever controller handlers or response exposure change.

### ASR-008 - Order settlement and redemption need stronger concurrency/idempotency controls

Severity: High

Status after Security Pass 17: Partially mitigated. Prisma has unique accepted QR nonces, order creation accepts idempotency keys for client retries, order settlement has unique trade constraints plus atomic OPEN-order/ticket claiming before ownership transfer, payment-authorized matching can be retried through outbox, backend capture/cancel/refund/reconcile handlers exist, and Stripe webhook replay is blocked by persisted event ids. Real Stripe test-key validation, product/admin refund triggers, and production chain/payment saga deployment remain open.

Locations:

- `apps/api/src/modules/orders/orderbook.service.ts:472`
- `apps/api/src/modules/orders/orderbook.service.ts:496`
- `apps/api/src/modules/verification/verification.service.ts:252`
- `apps/api/prisma/schema.prisma:245`

Evidence:

The Prisma order settlement path now claims still-open orders and the listed ticket before ownership transfer, duplicate trades are blocked by database constraints, order creation retries can use `Idempotency-Key`, and the payment authorization gate blocks settlement until the buy order has an authorized/captured payment. Webhook authorization writes an idempotent order-match side-effect job that the worker can process, and duplicate webhook event ids are ignored. Settled trades enqueue payment capture, and failed ownership settlement enqueues cancel/refund compensation. The remaining gap is real Stripe test-mode validation, product/admin refund flows, and production deployment of durable chain/payment workers.

Impact:

Under concurrent requests or retries, the system can double-settle, create inconsistent chain/API state, or accept replay edge cases under race conditions.

Fix:

- Keep idempotency keys for order placement and extend them to payment authorization, settlement, and redemption retry paths.
- Keep accepted nonce uniqueness and one-trade-per-order constraints in the database.
- Add retry-safe payment/ownership settlement records with clear pending, confirmed, failed, and retry states.
- Move irreversible chain calls into an outbox/saga before using real wallet or payment infrastructure.

### ASR-009 - Dependency audit has unresolved advisories

Severity: High for dev supply chain; Medium for current runtime

Evidence:

`npm audit --omit=dev --audit-level=low` still reports 2 moderate production dependency vulnerabilities after Security Pass 15:

- `postcss <8.5.10` through Next

The previous `ethers -> ws` production advisory was removed by taking `ethers` out of the API production dependency path. `npm audit fix --force` still proposes a breaking Next downgrade and should not be run casually.

Impact:

Runtime risk is currently moderate for the local demo, but public deployment and CI/CD supply-chain risk must be addressed before Beta.

Fix:

- Upgrade Next/PostCSS and ethers/ws once compatible patched versions are available.
- Plan a Hardhat toolchain upgrade separately because `npm audit fix --force` proposes breaking changes.
- Add dependency audit to the release checklist.
- Current checked state: latest Next still depends on `postcss@8.4.31`; latest Ethers still depends on `ws@8.17.1`; npm non-forced audit fix has no safe remediation.

## Medium Findings

### ASR-010 - Input validation is present but too shallow for public use

Severity: Medium

Status after Security Pass 59: Partially mitigated. Current request-body DTO fields now have bounded field-level validators, current controller route params use bounded Nest pipes, and `npm run security:api-contracts` fails on bare string/number request-body validation plus raw `@Param(...)` or unvalidated named `@Query(...)` route boundaries. Continue adding focused query DTOs and malformed-input tests as public-facing surfaces expand.

Locations:

- `apps/api/src/main.ts:13`
- `apps/api/src/modules/events/events.controller.ts:5`
- `apps/api/src/modules/orders/orders.controller.ts:5`
- `apps/api/src/modules/verification/verification.controller.ts:5`

Evidence:

The API uses `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`, and Express body limits are configured. Most DTO fields are still only `@IsString()`, so public-facing validation remains too broad for IDs, enum values, lengths, prices, and pagination inputs.

Impact:

Malformed payloads, very large payloads, unexpected extra properties, and invalid identifiers can reach business logic.

Fix:

- Keep `forbidNonWhitelisted` and body limits enabled in every environment.
- Add `@Length`, `@Matches`, `@Max`, `@Min`, and enum validations where appropriate.
- Add field-level validation tests for malformed ids, oversized strings, impossible prices, and invalid lifecycle enums.

### ASR-011 - Security headers and public deployment hardening are not configured

Severity: Medium

Status after Security Pass 81, updated after Security Pass 165: Partially mitigated for local/staging-gate readiness. The API uses Helmet with frameguard, referrer policy, production-like HSTS, and explicit production-like trust-proxy hop configuration before rate limits, disables `x-powered-by`, caps request bodies, and rate-limits general/auth/verification/staff routes. FanPass Console config disables Next powered-by and sets baseline `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`, and CSP headers. `npm run security:headers-policy` now statically verifies that code-level headers, local runtime checks, staging runtime checks, staging evidence validation, and docs remain connected, including saved staging proof of the configured API trust-proxy hop count. This remains open until the same checks are run and documented against real deployed HTTPS staging.

Locations:

- `apps/api/src/main.ts:8`
- `apps/dashboard/app/layout.tsx:9`

Evidence:

Earlier review found no Helmet/security header setup in the API and no Next.js `headers()` config or CSP for Console. Current evidence is the opposite locally: `apps/api/src/main.ts` configures Helmet, production-like HSTS, explicit production-like trust-proxy hops, and powered-by removal, `apps/dashboard/next.config.ts` configures Console response headers including strict transport security and disables powered-by, runtime checker self-tests verify header assertions including staging trust-proxy hop evidence, and `security:headers-policy` keeps those pieces tied to the composite Beta gate.

Impact:

If self-hosted publicly, the apps lack defense-in-depth for clickjacking, MIME sniffing, CSP, referrer policy, and common browser protections.

Fix:

- Add Helmet or equivalent to the API.
- Add Console security headers/CSP in Next config or edge hosting.
- Verify headers at runtime before Beta.
- Keep `npm run security:headers-policy` and `npm run security:headers-policy:self-test` passing in `npm run beta:foundation:verify`.
- Re-run `npm run security:runtime:staging` against real HTTPS staging and validate saved evidence before closing this finding for external Beta.

### ASR-012 - Prototype reset endpoint is public

Severity: Medium

Status after Security Pass 80: Mitigated for current Beta foundation. `POST /prototype/reset` is now guarded by `FanPassAuthGuard`, limited to organizer/admin roles, classified as `LOCAL_DEBUG`, registered as prototype shortcut `PS-009`, and checked by `npm run security:prototype-reset-policy` plus fixture-backed self-test coverage. This remains a local-debug shortcut and must not be exposed against real/shared tenant data without explicit risk acceptance.

Location:

- `apps/api/src/app.controller.ts:21`

Evidence:

`POST /prototype/reset` resets the demo store and QR nonce state. It now requires a seeded organizer/admin bearer in local scripts and is locked by the prototype reset policy audit.

Impact:

If exposed, anyone can wipe local demo state or disrupt a demo.

Fix:

- Keep this route disabled or organizer/admin gated outside local development.
- Keep `npm run security:prototype-reset-policy` and `npm run security:prototype-reset-policy:self-test` passing before external testing decisions.

### ASR-013 - Mobile networking needs real staging configuration

Severity: Medium

Locations:

- `apps/ios/FanPass/FanPass/Shared/FanPassEnvironment.swift`
- `apps/ios/FanPass/project.yml`

Evidence:

Both iOS targets now read `FanPassAPIBaseURL` from Info.plist/build settings through `FanPassEnvironment`. Debug builds can still fall back to `http://localhost:4000`; non-Debug builds reject local or non-HTTPS URLs at runtime.

Impact:

This is safer than hardcoded source URLs, but real-device Beta still needs actual staging/prod build settings and signing-time configuration.

Fix:

- Add concrete dev/staging/prod `.xcconfig` or CI build setting wiring.
- Use HTTPS for real device and TestFlight builds.
- Keep local HTTP only in debug/simulator builds.

### ASR-014 - Chain operator key model is centralized

Severity: Medium

Locations:

- `apps/api/src/modules/ownership/ownership.service.ts:173`
- `packages/contracts/contracts/FanPassTicket.sol:50`

Evidence:

The testnet adapter signs all contract calls with one operator private key. The ticket contract allows only the owner to mint, redeem, and cancel.

Impact:

The operator key becomes a high-value hot key. If compromised, an attacker can mint/redeem/cancel according to contract owner authority.

Fix:

- Use a vault/KMS or delegated signer for backend chain calls.
- Use multisig/timelock/admin separation for contract ownership before pilot.
- Add key rotation and incident runbooks.

Status after Security Pass 82 on 2026-05-30:

- Locally partially mitigated and regression-checked by `npm run security:chain-operator-key`, which verifies production-like `OWNERSHIP_ADAPTER=testnet` blocking, `OwnershipService`-only dynamic `ethers` loading, placeholder-only operator private key examples, local Beta mock ownership startup, and ASR-014 blocker documentation.
- Future real-chain custody evidence is now guarded by `npm run security:chain-custody:evidence`, which requires saved proof of vault/KMS or delegated signer custody, no raw app private-key access, multisig/timelock contract control, durable outbox-only chain calls, healthy residual outbox state, rotation and incident runbooks, monitoring, and secret redaction before ASR-014 can be closed.
- Still open for real staging/pilot: replace the centralized hot key with a vault/KMS or delegated signer, put contract ownership behind multisig/timelock/admin separation, and document key rotation plus incident response before enabling real chain ownership side effects.

## Low Findings And Notes

- The consumer app no longer declares Camera/NFC permissions after this review; Ops still declares them because scanner/NFC belongs there.
- iOS QR payload copy/paste is useful for simulator QA and is now debug-gated by the iOS distribution audit; external testing should rely on QR/NFC transports unless explicit risk acceptance changes that gate.
- Current Console displays raw IDs and proof strings; this is useful for debugging but should become admin-only with redaction before Beta.
- Hardhat warned under the previous Node 25 shell, and the globally linked Homebrew Node is now Node 26. Use `scripts/with-node-22.sh` and Node 22 LTS for repeatable contract/security tooling.

## Security Gates Before Beta

Update after Security Pass 78 on 2026-05-30:

- Added `npm run security:ios-distribution-boundaries` as a local iOS/TestFlight boundary gate.
- The audit verifies that the FanPass target has no Camera/NFC permissions, scanner sources, Ops entitlements, or Ops URL scheme, while FanPass Ops owns Camera/NFC capability and the NDEF entitlement.
- The audit verifies that staging/beta/production iOS API configs are HTTPS-only and free of server-side secret markers, while local debug remains the only localhost HTTP config.
- The audit verifies that Apple Wallet remains prototype barcode metadata and no fake unsigned `.pkpass` or `PKAddPassesViewController` flow appears before a real pass signing service and Apple certificate exist.
- Added `npm run security:ios-distribution-boundaries:self-test` with fixtures rejecting FanPass camera/NFC drift, missing Ops NFC entitlement, release-config local HTTP, iOS secret markers, Ops Stripe leakage, fake Wallet pass flows, and missing composite verifier wiring.
- Added both commands to `npm run beta:foundation:verify`.
- Remaining status: this lowers local distribution/product-boundary drift risk but does not close real-device or TestFlight blockers; real HTTPS staging/beta URLs, signing/provisioning, signed `.pkpass`, and physical NFC validation are still required before external Beta.

Update after Security Pass 79 on 2026-05-30:

- Hardened `AuthService.acceptStaffInvite` so staff invite acceptance rechecks invite status inside a Prisma transaction, requires the gate assignment to still be active, revokes pending acceptance if the assignment is inactive, and atomically claims a pending/unaccepted invite before linking the target staff user.
- Added `npm run security:staff-invite-policy` as a local gate for production staff invitation/linking policy.
- The audit verifies that one-time staff invite acceptance requires a verified Privy token, Prisma storage, target `GATE_STAFF` account, no conflicting linked Privy account, pending-only atomic invite claim, active gate assignment, and accepted Privy id recording.
- The audit also verifies organizer/admin staff assignment routes, staff invite acceptance rate limits, Console redacting proxy boundaries, and FanPass Ops API-client linking boundaries stay in place.
- Added `npm run security:staff-invite-policy:self-test` with fixtures rejecting non-transactional invite acceptance, missing active assignment checks, non-atomic pending invite claims, missing staff role gates, invite rotation for already linked staff, raw Console forwarding, missing rate limits, and missing composite verifier wiring.
- Added both commands to `npm run beta:foundation:verify`.
- Remaining status: this strengthens the local staff-linking policy before real Privy SDK login, but public Beta still needs actual Privy product UI, dashboard plan validation, and production tenant/staff policy validation against real staging accounts.

Update after Security Pass 80 on 2026-05-30:

- Added `npm run security:prototype-reset-policy` as a local gate for the prototype reset endpoint.
- The audit verifies that `POST /prototype/reset` stays protected by `FanPassAuthGuard`, limited to organizer/admin roles, classified as `LOCAL_DEBUG`, registered as `PS-009` in the prototype shortcut register, and called by local start/verify scripts only with a seeded organizer bearer.
- Added `npm run security:prototype-reset-policy:self-test` with fixtures rejecting public reset access, missing guards, fan-role exposure, missing privacy classification, missing shortcut registration, unauthenticated local reset scripts, and missing composite verifier wiring.
- Added both commands to `npm run beta:foundation:verify`.
- Remaining status: this closes the stale public-reset finding for the current local Beta foundation, but `/prototype/reset` remains a local-debug shortcut and cannot be exposed against real/shared tenant data without explicit risk acceptance.

Update after Security Pass 83 on 2026-05-30:

- Debug-gated local QR payload copy/paste helpers before external TestFlight decisions.
- FanPass Wallet now exposes `Copy entry payload` and `Copy barcode JSON` only inside `#if DEBUG`.
- FanPass Ops scanner now exposes the paste payload text field/button and paste fallback hint only inside `#if DEBUG`; non-debug scanner copy waits only for QR or NFC.
- FanPass Ops shell now shows the `Fallback: Paste` metric only inside `#if DEBUG`.
- Extended `npm run security:ios-distribution-boundaries` and its self-test fixtures to reject wallet payload copy, Ops paste entry, and Ops paste fallback metrics outside debug builds and to require the debug-gated payload copy/paste documentation marker.
- Remaining status: local simulator QA remains possible in debug builds, but external TestFlight still requires real signing/provisioning, real HTTPS API URLs, physical QR/NFC validation, and a release decision if manual payload copy/paste is ever intentionally exposed.

Update after Security Pass 84 on 2026-05-30:

- Added `docs/ALPHA_WALKTHROUGH_EVIDENCE.md` as the required evidence contract before the frozen Alpha walkthrough recording task can be closed.
- Added `npm run alpha:walkthrough:evidence:audit` and its fixture self-test, both wired into `npm run beta:foundation:verify`.
- The audit verifies local-only recording scope, seven-scene coverage, required verification commands, `outputs/alpha-walkthrough/` artifact-path requirements, explicit remaining Beta blockers, and no-secret constraints.
- The self-test rejects missing local-only evidence scope, missing seven-scene coverage, premature recording task closeout, embedded provider secret markers, and missing composite verifier wiring.
- Remaining status: recording preparation is now harder to overstate, but the actual walkthrough recording remains open until a local-only artifact set is captured. External Beta still requires real Privy, Stripe, staging, dependency, Apple Wallet, and real-device validation.

Update after Security Pass 85 on 2026-05-30:

- Added `npm run alpha:walkthrough:capture` to create a repeatable local evidence bundle for the frozen Alpha walkthrough without using real provider credentials.
- The capture command runs the script audit, walkthrough evidence audit, Beta foundation verifier, local Beta start/verify flow, Console visual check, and local stop command, then writes logs, a screenshot, and a manifest under `outputs/alpha-walkthrough/<timestamp>/`.
- Added no-secret scanning for generated logs and manifests, rejecting obvious Stripe secret prefixes, Privy verification-key assignments, private-key blocks, and bearer-token strings.
- Added `npm run alpha:walkthrough:capture:self-test` with a fake npm boundary that verifies command order, output files, screenshot path handling, no-secret scans, and manifest language that keeps the human-reviewed recording task open.
- Extended the walkthrough evidence audit and composite Beta verifier so capture automation cannot drift after being marked complete.
- Remaining status: local capture automation exists, but the actual Alpha walkthrough recording remains open until a human-reviewed recording artifact is produced under `outputs/alpha-walkthrough/`. External Beta still requires real Privy, Stripe, staging, dependency, Apple Wallet, and real-device validation.

Update after Security Pass 86 on 2026-05-30:

- Ran `npm run alpha:walkthrough:capture` and produced the reviewed local bundle at `outputs/alpha-walkthrough/20260529T182908Z/`.
- The bundle includes `manifest.md`, command logs for the demo script audit, walkthrough evidence audit, Beta foundation verifier, local Beta start/verify/stop flow, Console visual check, and a FanPass Console screenshot at `fanpass-console.png`.
- The capture completed with `npm run beta:foundation:verify`, `npm run beta:local:verify`, and `npm run console:verify:local` passing; `npm run beta:local:stop` also completed.
- The capture command's forbidden-marker scan found no obvious Stripe, Privy, private-key, or bearer-token markers in the generated bundle.
- Remaining status: this is local-only evidence and does not close the human-reviewed recording task. External Beta still requires real Privy SDK login/dashboard validation, real Stripe test-key and signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, signed Apple Wallet `.pkpass`, real-device NFC/TestFlight validation, and chain operator key hardening.

Update after Security Pass 87 on 2026-05-30:

- Added `.nvmrc` and `.node-version`, both pinned to Node 22.
- Tightened root `engines.node` and the lockfile root package engine to `>=22 <23`.
- Added `npm run security:node-runtime-policy` and fixture-backed `npm run security:node-runtime-policy:self-test`, then wired both into `npm run beta:foundation:verify` before dependency advisory checks.
- The audit verifies Node 22 LTS pins, package engine drift, lockfile engine drift, Beta verifier wiring, and Hardhat/tooling documentation markers. It reports a warning under the current Node 25.2.1 shell unless strict runtime mode is enabled.
- Remaining status: local policy drift is now guarded, but release-quality contract/security/dependency evidence should be generated under Node 22 LTS before external Beta decisions. The unresolved Next/PostCSS production advisories and Hardhat/dev-toolchain advisories remain external-testing blockers unless closed or explicitly risk-accepted.

Update after Security Pass 88 on 2026-05-30:

- Installed Homebrew `node@22` and added `scripts/with-node-22.sh` to run commands against the keg-only Node 22 runtime without changing the global Node symlink.
- Added `tooling:node22` and `tooling:node22:verify` package scripts as the local Node 22 command boundary.
- Reran the Node runtime policy audit, Hardhat contract tests, dependency advisory gate, and full Beta foundation verifier through `scripts/with-node-22.sh`.
- Evidence passed under Node `22.22.3`: the runtime policy audit reported no warning, `npm run test -w packages/contracts` passed, the dependency advisory gate still saw only the known Next/PostCSS production advisories, and `npm run beta:foundation:verify` passed.
- Remaining status: Node 22 release-evidence generation now exists locally, but the global Homebrew `node` remains Node `26.0.0`; continue using the helper for contract/security/dependency evidence until the developer shell or CI is explicitly pinned to Node 22.

Update after Security Pass 89 on 2026-05-30:

- Added `.github/workflows/beta-foundation.yml` as the CI Node 22 Beta foundation workflow.
- The workflow uses `actions/setup-node@v4` with `node-version-file: .nvmrc`, installs with `npm ci`, runs against a local `postgres:16-alpine` service, enables strict Node runtime enforcement, skips local Docker Compose Postgres startup, and executes `npm run beta:foundation:verify`.
- Added `npm run security:ci-node22-workflow` and fixture-backed `npm run security:ci-node22-workflow:self-test`, then wired both into the composite verifier after the Node runtime policy audit.
- The audit rejects workflow drift away from `.nvmrc`, missing composite verifier execution, missing local Postgres, provider secret usage, missing CI Docker-skip handling, package-script drift, and documentation drift.
- Remaining status: CI Node 22 evidence is now statically guarded, but the workflow still needs to run in GitHub Actions for actual hosted-run evidence. Public/TestFlight Beta remains blocked by real Privy SDK login/dashboard validation, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, Apple signing/provisioning, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and chain operator key hardening.

Update after Security Pass 90 on 2026-05-30:

- Added `.npmrc` with `engine-strict=true` so developer-shell npm install/ci flows reject unsupported Node majors instead of relying only on package `engines` warnings.
- Extended `npm run security:node-runtime-policy` and its fixture-backed self-test to verify `.npmrc` `engine-strict`, `.nvmrc`, `.node-version`, package engine ranges, the Node 22 helper, documentation markers, and composite verifier wiring.
- Remaining status: local developer install policy and CI are now guarded for Node 22, but hosted CI still needs to run after push for external evidence. Public/TestFlight Beta remains blocked by real Privy SDK login/dashboard validation, real Stripe test-key and signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, Apple signing/provisioning, signed `.pkpass`, physical QR/NFC validation, and chain operator key hardening.

Update after Security Pass 91 on 2026-05-30:

- Added `docs/STRIPE_TESTMODE_EVIDENCE.md` as the saved-evidence contract for real Stripe test-mode validation.
- Added `npm run security:stripe-testmode:evidence` and fixture-backed `npm run security:stripe-testmode:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the Privy webhook optionality audit.
- The validator rejects local mock evidence, leaked Stripe secret/webhook/client-secret markers, missing signed raw-body webhook verification, missing duplicate replay idempotency, missing capture/cancellation/refund/reconciliation proof, missing retry idempotency, and unhealthy residual side-effect outbox state.
- Remaining status: this makes the real Stripe acceptance gate explicit, but it does not replace running real Stripe test-mode keys and signed webhooks. Public/TestFlight Beta remains blocked by saved Stripe test-mode evidence, real Privy SDK login/dashboard validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, Apple signing/provisioning, signed `.pkpass`, physical QR/NFC validation, and chain operator key hardening.

Update after Security Pass 92 on 2026-05-30:

- Added `docs/PRIVY_PLAN_EVIDENCE.md` as the saved-evidence contract for actual Privy dashboard plan validation.
- Added `npm run security:privy-plan:evidence` and fixture-backed `npm run security:privy-plan:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the Privy webhook optionality audit.
- The validator rejects unreviewed dashboard evidence, leaked Privy app secrets, verification keys, access tokens, private keys, unknown feature support status, webhooks as a required Beta dependency, SDK-unblock drift, and missing redaction proof.
- Remaining status: this makes the Privy dashboard acceptance gate explicit, but it does not replace checking the actual Privy app dashboard. Public/TestFlight Beta remains blocked by saved Privy dashboard evidence, real Privy SDK login, saved Stripe test-mode evidence, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, Apple signing/provisioning, signed `.pkpass`, physical QR/NFC validation, and chain operator key hardening.

Update after Security Pass 93 on 2026-05-30:

- Added `docs/APPLE_WALLET_PASS_EVIDENCE.md` as the saved-evidence contract for real signed Apple Wallet `.pkpass` validation.
- Added `npm run security:apple-wallet:evidence` and fixture-backed `npm run security:apple-wallet:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the Stripe test-mode evidence self-test.
- The validator rejects local unsigned barcode prototype evidence, leaked Apple private-key/certificate markers, exported certificate private keys, simulator-only proof, invalid barcode formats, real personal/payment data in pass contents, and missing redaction proof.
- Remaining status: this makes the signed Wallet acceptance gate explicit, but it does not replace Apple signing/provisioning, physical-device add-to-Wallet validation, or a real pass-signing service. Public/TestFlight Beta remains blocked by saved Apple Wallet signed-pass evidence, saved Privy dashboard evidence, real Privy SDK login, saved Stripe test-mode evidence, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, physical QR/NFC validation, and chain operator key hardening.

Update after Security Pass 94 on 2026-05-30:

- Added `docs/OPS_SCANNER_DEVICE_EVIDENCE.md` as the saved-evidence contract for real FanPass Ops physical QR/NFC scanner validation.
- Added `npm run security:ops-scanner:device-evidence` and fixture-backed `npm run security:ops-scanner:device-evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the Apple Wallet evidence self-test.
- The validator rejects simulator-only proof, localhost or non-HTTPS API evidence, debug paste fallback use, leaked bearer/private-key markers, missing physical NFC tag proof, missing QR replay and invalid-payload proof, missing backend authority proof, real-user or production credential evidence, and missing redaction proof.
- Remaining status: this makes physical scanner acceptance explicit, but it does not replace signing/provisioning a real iPhone build, using real HTTPS staging/beta URLs, reading a physical NFC NDEF tag, or validating at a real gate workflow. Public/TestFlight Beta remains blocked by saved physical scanner evidence, saved Apple Wallet signed-pass evidence, saved Privy dashboard evidence, real Privy SDK login, saved Stripe test-mode evidence, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, and chain operator key hardening.

Update after Security Pass 95 on 2026-05-30:

- Added `docs/CHAIN_CUSTODY_EVIDENCE.md` as the saved-evidence contract for real chain custody, contract-control, and durable outbox validation.
- Added `npm run security:chain-custody:evidence` and fixture-backed `npm run security:chain-custody:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the chain operator key boundary audit.
- The validator rejects local mock-only proof, production credential or real-user evidence, raw private-key/token/seed markers, copyable `0x` 64-hex values, secret-bearing JSON fields, missing vault/KMS or delegated signer custody proof, hot-key contract ownership, direct request-path chain calls, unhealthy outbox state, missing rotation/incident/monitoring runbooks, and missing redaction proof.
- Remaining status: this makes ASR-014 closure evidence explicit, but it does not replace provisioning a real vault/KMS or delegated signer, moving contract ownership to multisig with timelock/admin delay, running testnet ownership transfer/finalization through deployed workers, or configuring operational monitoring. Public/TestFlight Beta remains blocked by saved chain custody evidence, saved physical scanner evidence, saved Apple Wallet signed-pass evidence, saved Privy dashboard evidence, real Privy SDK login, saved Stripe test-mode evidence, deployed HTTPS staging evidence with a real admin bearer, and dependency advisory closure or risk acceptance.

Update after Security Pass 96 on 2026-05-30:

- Added `docs/STAFF_TENANT_STAGING_EVIDENCE.md` as the saved-evidence contract for production-like staging tenant and staff policy validation.
- Added `npm run security:staff-tenant:staging-evidence` and fixture-backed `npm run security:staff-tenant:staging-evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the staff invite policy audit.
- The validator rejects local dry-run proof, demo auth, localhost or non-HTTPS URLs, raw bearer/Privy/invite tokens, raw emails or identity fields, missing organizer isolation proof, missing verified Privy auth proof, missing one-time invite/revocation proof, missing Ops gate-assignment proof, real-user or production credential evidence, and missing redaction proof.
- Remaining status: this makes production tenant/staff policy closure evidence explicit, but it does not replace deploying staging, creating real staging test tenants, integrating real Privy product login, or performing the actual Console/Ops staging walkthrough. Public/TestFlight Beta remains blocked by saved staff tenant staging evidence, saved Privy dashboard evidence, real Privy SDK login, saved Stripe test-mode evidence, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and saved chain custody evidence.

Update after Security Pass 97 on 2026-05-30:

- Added `docs/CI_HOSTED_EVIDENCE.md` as the saved-evidence contract for hosted GitHub Actions Beta foundation runs.
- Added `npm run security:ci-hosted:evidence` and fixture-backed `npm run security:ci-hosted:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the static CI Node 22 workflow audit.
- The validator rejects local dry-run proof, failed or forked runs, non-GitHub Actions URLs, non-Node-22 runtime evidence, missing `.nvmrc` setup, missing `npm ci`, missing `postgres:16-alpine` health proof, missing full Beta foundation verifier proof, missing dependency advisory/side-effect health/API test proof, provider secret availability, production credential evidence, and missing log-redaction proof.
- Remaining status: this makes hosted CI run acceptance explicit, but it does not replace pushing/running the workflow in GitHub Actions and saving a successful run evidence file. Public/TestFlight Beta remains blocked by saved hosted CI evidence, saved staff tenant staging evidence, saved Privy dashboard evidence, real Privy SDK login, saved Stripe test-mode evidence, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and saved chain custody evidence.

Update after Security Pass 98 on 2026-05-30:

- Added `docs/DEPENDENCY_RISK_EVIDENCE.md` as the saved-evidence contract for dependency advisory closeout or explicit closed-beta risk acceptance.
- Added `npm run security:dependency-risk:evidence` and fixture-backed `npm run security:dependency-risk:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the live dependency advisory state check.
- The validator accepts a clean production audit closeout or a bounded unresolved-advisory packet that proves Node 22 audit commands, exactly the known moderate Next/PostCSS findings, no high/critical advisories, no safe patched Next/PostCSS path, closed-beta-only project/security owner approval, expiry within 90 days, review cadence no longer than 30 days, mitigation coverage, and redaction.
- The validator rejects undocumented packages, severity drift, newly available safe patch paths, missing/overbroad risk acceptance, stale expiry, missing mitigations, provider secret markers, database URLs, bearer tokens, private keys, and real personal data markers.
- Remaining status: this makes dependency risk acceptance auditable, but it does not accept the current advisory risk or close the blocker. Public/TestFlight Beta remains blocked by a clean production audit, a safe patched Next/PostCSS path, or a saved risk-acceptance packet that passes `npm run security:dependency-risk:evidence`, plus real Privy SDK login/dashboard validation, saved Stripe test-mode evidence, deployed HTTPS staging evidence with a real admin bearer, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, physical QR/NFC validation, saved staff tenant staging evidence, saved hosted CI evidence, and saved chain custody evidence.

Update after Security Pass 99 on 2026-05-30:

- Added `docs/IOS_STAGING_BUILD_EVIDENCE.md` as the saved-evidence contract for signed iOS staging/TestFlight builds.
- Added `npm run security:ios-staging-build:evidence` and fixture-backed `npm run security:ios-staging-build:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the static iOS distribution boundary audit.
- The validator accepts signed staging or beta evidence only when both `FanPass` and `FanPass Ops` are covered, the observed API base URL is a real non-placeholder HTTPS staging/beta URL, demo auth is disabled, test provider modes are used, debug compilation and payload helpers are unavailable, app capabilities remain role-separated, and runtime/deployed-staging evidence is linked.
- The validator rejects local dry-run proof, placeholder `.invalid` or localhost URLs, missing app evidence, debug build/paste fallback exposure, FanPass camera/NFC/staff-control drift, FanPass Ops consumer/payment surface drift, missing deployed runtime proof, Apple signing material, provisioning profile markers, device identifiers, provider secrets, bearer tokens, real personal data, and missing redaction proof.
- Remaining status: this makes real iOS staging/beta API URL closure evidence explicit, but it does not replace provisioning Apple signing, replacing placeholder endpoints, installing on physical devices or TestFlight, integrating real Privy product login, validating Stripe test-mode flows, or saving physical QR/NFC evidence. Public/TestFlight Beta remains blocked by saved iOS staging/TestFlight build evidence, real Privy SDK login/dashboard validation, saved Stripe test-mode evidence, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, signed Apple Wallet `.pkpass`, physical QR/NFC validation, saved staff tenant staging evidence, saved hosted CI evidence, and saved chain custody evidence.

Update after Security Pass 100 on 2026-05-30:

- Added `docs/NFC_NDEF_TAG_FIXTURE.md` as the supported NFC NDEF fixture contract for `FanPass Ops` physical tag QA.
- Added `npm run security:nfc-ndef-fixture` and fixture-backed `npm run security:nfc-ndef-fixture:self-test`, then wired both into `npm run beta:foundation:verify` after the FanPass Ops physical scanner evidence validator self-test.
- The audit keeps NFC fixtures scoped to `FanPass Ops`, requires QR-equivalent backend authority, limits supported committed fixture formats to NDEF Text/URI records with placeholders, requires debug-only paste fallback language, and requires physical-device evidence handoff to `npm run security:ops-scanner:device-evidence`.
- The self-test rejects missing Ops scope, backend-authority drift, raw payload/nonce/bearer leakage, missing physical-device evidence requirements, missing debug-only paste fallback requirements, unchecked task documentation, missing package scripts, and missing composite verifier wiring.
- Remaining status: this clarifies NFC test-tag payload rules, but it does not replace provisioning/signing a real iPhone build, reading a physical NDEF tag, using real HTTPS staging/beta URLs, or saving real-device scanner evidence. Public/TestFlight Beta remains blocked by saved physical scanner evidence, saved iOS staging/TestFlight build evidence, saved Privy dashboard evidence, real Privy SDK login, saved Stripe test-mode evidence, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, signed Apple Wallet `.pkpass`, saved staff tenant staging evidence, saved hosted CI evidence, and saved chain custody evidence.

Update after Security Pass 101 on 2026-05-30:

- Added `docs/IOS_PHYSICAL_DEVICE_QA.md` as the signed real-device QA checklist for `FanPass` and `FanPass Ops`.
- Added `npm run security:ios-physical-device-qa` and fixture-backed `npm run security:ios-physical-device-qa:self-test`, then wired both into `npm run beta:foundation:verify` after the iOS staging/TestFlight build evidence validator self-test.
- The audit keeps physical-device QA scoped to real iPhones, signed development-device/TestFlight builds, real HTTPS staging/beta API URLs, Stripe test mode, Privy test apps, separate app installs, FanPass/FanPass Ops role separation, no debug fallback proof, no secrets or real personal data, and explicit handoffs to the existing saved-evidence validators.
- The self-test rejects simulator-only scope, role-separation drift, missing Ops scanner/auth checks, token/nonce/signing leakage, missing saved-evidence handoffs, unchecked task documentation, missing package scripts, and missing composite verifier wiring.
- Remaining status: this creates a repeatable QA runbook gate, but it does not replace Apple signing/provisioning, installing real builds, running on physical iPhones, or saving accepted iOS build and physical scanner evidence. Public/TestFlight Beta remains blocked by saved iOS staging/TestFlight build evidence, saved physical scanner evidence, saved Privy dashboard evidence, real Privy SDK login, saved Stripe test-mode evidence, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, signed Apple Wallet `.pkpass`, saved staff tenant staging evidence, saved hosted CI evidence, and saved chain custody evidence.

Update after Security Pass 102 on 2026-05-30:

- Added placeholder Apple signing settings to `apps/ios/FanPass/project.yml` for both `FanPass` and `FanPass Ops`.
- The placeholders use build-setting variables for the Apple team id and provisioning profile specifiers; no real team IDs, profile names, certificates, provisioning profiles, or private keys were added.
- Extended `npm run security:ios-distribution-boundaries` and its fixture self-test to require those placeholder settings and reject raw Apple signing material in source.
- Remaining status: this reduces accidental signing-material leakage and makes future signing setup explicit, but it does not replace Apple Developer account configuration, real provisioning/certificate setup, Xcode archive/export evidence, TestFlight upload evidence, or physical-device validation. Public/TestFlight Beta remains blocked by saved iOS staging/TestFlight build evidence, saved physical scanner evidence, saved Privy dashboard evidence, real Privy SDK login, saved Stripe test-mode evidence, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, signed Apple Wallet `.pkpass`, saved staff tenant staging evidence, saved hosted CI evidence, and saved chain custody evidence.

Update after Security Pass 103 on 2026-05-30:

- Added the Privy Swift SDK dependency through XcodeGen/SPM for both `FanPass` and `FanPass Ops`, pinned to `privy-ios` 2.12.0.
- Added empty public build-setting placeholders for `FANPASS_PRIVY_APP_ID` and `FANPASS_PRIVY_APP_CLIENT_ID`; no Privy secrets, verification keys, access tokens, or production credentials were added.
- Added `FanPassPrivyAuthProvider` as the only Swift file allowed to import `PrivySDK`. It handles email OTP send/verify, gets a Privy access token, and returns it to the existing backend sync and staff-invite boundaries.
- Wired FanPass and FanPass Ops auth UI to that provider while preserving local demo/internal fallback flows for simulator QA.
- Extended provider boundary audit coverage so misplaced `PrivySDK` imports and missing iOS target package dependencies fail before Beta foundation work is trusted.
- Remaining status: local iOS Privy SDK wiring exists, but external Beta still requires real Privy dashboard evidence, real public app/client IDs, FanPass Console Privy React login, production tenant/staff staging evidence, saved iOS staging/TestFlight evidence, deployed staging runtime evidence, Stripe test-mode signed-webhook evidence, dependency advisory closure or risk acceptance, signed Wallet evidence, physical QR/NFC evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 104 on 2026-05-30:

- Added `docs/PRIVY_CONSOLE_REACT_SDK_ISOLATION.md` as the evidence contract for future `@privy-io/react-auth` integration in FanPass Console.
- Added `npm run security:privy-console-react-sdk:isolation` and fixture-backed `npm run security:privy-console-react-sdk:isolation:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the Privy plan evidence self-test.
- The validator accepts either a direct Console dependency path that does not increase production audit findings or an isolated auth workspace/runtime boundary. It requires Node 22 audit evidence, reviewed SDK package metadata, the existing `/api/console/privy-session` HttpOnly cookie bridge, no browser-storage token persistence, Console route/provider-boundary checks, and redaction of tokens, secrets, and user identifiers.
- Latest checked `@privy-io/react-auth` is 3.28.0 and still has a broad wallet/provider dependency surface, so the SDK remains gated rather than installed.
- Remaining status: this makes the Console SDK unblock criteria auditable, but it does not implement the Console login UI. External Beta still requires actual Privy dashboard evidence, Console React SDK login, production tenant/staff staging evidence, saved iOS staging/TestFlight evidence, deployed staging runtime evidence, Stripe test-mode signed-webhook evidence, dependency advisory closure or risk acceptance, signed Wallet evidence, physical QR/NFC evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 105 on 2026-05-30:

- Added `docs/PRIVY_MOBILE_APP_CONFIG_EVIDENCE.md` as the saved-evidence contract for real FanPass and FanPass Ops Privy mobile app configuration.
- Added `npm run security:privy-mobile-app-config:evidence` and fixture-backed `npm run security:privy-mobile-app-config:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the Privy plan evidence self-test.
- The validator requires dashboard-reviewed staging/beta mobile app config for both native bundle ids, public app ID and app client ID setup, placeholder-only checked-in iOS configs, outside-source-control value injection, generated Info.plist key verification, `FanPassEnvironment` placeholder rejection, provider/iOS boundary checks, optional webhooks, linked Privy plan/iOS/staff evidence, and redaction of secrets, tokens, and user identifiers.
- Remaining status: this makes real mobile app ID/client ID evidence auditable, but it does not replace actual Privy dashboard review, real injected staging/beta values, real iOS staging/TestFlight evidence, production tenant/staff staging evidence, or Console React SDK login.

Update after Security Pass 106 on 2026-05-30:

- Added `assertConsoleMutationOrigin(request)` to the FanPass Console server auth helper as the narrow origin/CSRF boundary for cookie-backed Console mutations.
- `POST`/`DELETE /api/console/privy-session`, `POST /api/console/gate-assignments`, and `POST /api/console/gate-assignments/:assignmentId/invites` now reject disallowed origins before setting, deleting, or using the HttpOnly Console session cookie.
- Production-like Console mutations require an allowed origin from `FANPASS_CONSOLE_ORIGINS`/related Console origin env, while local missing-origin requests remain allowed for developer tooling.
- Extended `npm run security:console-routes` and its fixture self-test so missing mutation origin guards or missing helper origin policy markers fail the Beta foundation verifier.
- Remaining status: this reduces cross-origin mutation risk for the existing Console cookie session bridge and staff invite proxy routes, but external Beta still requires real Privy Console login, deployed HTTPS staging evidence, tenant/staff staging evidence, dependency advisory closure or risk acceptance, and real provider evidence.

Update after Security Pass 107 on 2026-05-30:

- Added `npm run security:evidence-redaction` as a repository-level saved-evidence scan for generated artifacts under `outputs/`.
- Added fixture-backed `npm run security:evidence-redaction:self-test` and wired both commands into `npm run beta:foundation:verify` after the hosted CI evidence validator self-test.
- The audit rejects Stripe secret keys, webhook secrets, PaymentIntent client secrets, bearer tokens, JWTs, private-key blocks, database URLs, Privy verification-key assignments, Privy app-secret markers, and staging/admin access-token assignments in generated evidence files.
- The live scan currently passes across the existing `outputs/` artifacts, including the reviewed Alpha walkthrough capture bundle and local visual evidence.
- Remaining status: this lowers saved-artifact leakage risk before future staging, CI, provider, iOS, scanner, Wallet, and chain evidence work, but it does not replace each evidence validator's domain-specific review or close any external evidence blocker.

Update after Security Pass 108 on 2026-05-30:

- Added a no-storage FanPass Console login bridge form for the production-like locked Console screen.
- The form receives a Privy access token from a future SDK/manual staging flow, posts it only to `POST /api/console/privy-session`, clears component state before sending, avoids browser storage and token logging, and reloads only after the HttpOnly Console session cookie is set.
- Extended `npm run security:console-routes` and its fixture self-test so the Console login bridge must keep the session route, POST JSON body, no-store fetch, state clearing, and reload contract while rejecting browser token storage, direct cookie writes, direct `@privy-io/react-auth` imports, and logging.
- Verified the locked Console screen locally in staging mode with Playwright on a 390px mobile viewport; the Privy access-token form rendered without horizontal overflow.
- Remaining status: this advances the Console session UX behind the existing narrow server adapter, but it is not full Privy React SDK login. External Beta still requires real Console SDK dependency isolation or advisory acceptance, actual Privy dashboard configuration evidence, deployed HTTPS staging evidence, tenant/staff staging evidence, Stripe test-mode signed-webhook evidence, hosted CI evidence, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 109 on 2026-05-30:

- Extended `npm run security:provider-boundaries` with a global blocked-provider guard for `@privy-io/react-auth` across API, Dashboard, iOS, and shared source roots.
- The guard rejects any in-workspace Privy React SDK import until `npm run security:privy-console-react-sdk:isolation -- <saved-json-output>` proves a clean direct dependency path or isolated auth runtime boundary.
- Added fixture-backed provider-boundary self-test coverage for a Dashboard file importing `@privy-io/react-auth`, and extended the engineering quality gate so this blocked-provider rule cannot be removed silently.
- Remaining status: this prevents accidental Console React SDK reintroduction while dependency risk remains unresolved, but it does not install or validate the actual SDK login. External Beta still requires real Console SDK isolation/acceptance evidence, actual Privy dashboard configuration evidence, deployed HTTPS staging evidence, tenant/staff staging evidence, Stripe test-mode signed-webhook evidence, hosted CI evidence, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 110 on 2026-05-30:

- Extended `npm run security:provider-boundaries` to scan workspace dependency manifests and lockfiles in addition to source files.
- The audit now rejects `@privy-io/react-auth` entries in `package.json` or `package-lock.json` until Console SDK isolation evidence passes and the blocked-provider policy is intentionally updated.
- Added fixture-backed provider-boundary self-test coverage for a Dashboard package manifest that adds `@privy-io/react-auth`, and extended the engineering quality gate so manifest scanning cannot be removed silently.
- Remaining status: this prevents accidental SDK installation drift while dependency risk remains unresolved, but it does not install or validate the actual SDK login. External Beta still requires real Console SDK isolation/acceptance evidence, actual Privy dashboard configuration evidence, deployed HTTPS staging evidence, tenant/staff staging evidence, Stripe test-mode signed-webhook evidence, hosted CI evidence, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 111 on 2026-05-30:

- Extended `npm run security:provider-boundaries` to lock JavaScript Socket.IO server imports to the API realtime adapter/gateway/service and Socket.IO browser-client imports to the Console live orderbook panel.
- Added package placement checks for provider-facing workspace `package.json` files: `stripe` must stay in the API runtime package, `socket.io-client` must stay in the Console runtime package or API verifier dev tooling, and direct `socket.io` declarations must stay API-only.
- Added fixture-backed provider-boundary self-test coverage for misplaced Socket.IO client source, misplaced Stripe package declarations, and misplaced Socket.IO client package declarations, then extended the engineering quality gate so these source and manifest placement checks cannot be removed silently.
- Verified the full local Beta foundation gate with Node 22 after the audit and documentation updates.
- Remaining status: this reduces accidental realtime/payment provider drift while Beta foundation work continues, but it does not replace real Stripe test-mode validation, deployed staging WebSocket/CORS evidence, Privy Console SDK integration, or any external provider/dashboard evidence.

Update after Security Pass 112 on 2026-05-30:

- Extended `npm run security:provider-boundaries` to validate provider package placement inside `package-lock.json` workspace package records as well as `package.json` manifests.
- The lockfile guard checks direct workspace records such as `apps/api`, `apps/dashboard`, and shared/contract packages while ignoring legitimate transitive `node_modules` entries.
- Added fixture-backed provider-boundary self-test coverage for a package-lock drift case where `stripe` is added to the Dashboard workspace lockfile record, then extended the engineering quality gate so lockfile validation and checked lockfile package output cannot be removed silently.
- Verified the full local Beta foundation gate with Node 22 after the audit and documentation updates.
- Remaining status: this closes a local package drift gap for payment/realtime provider dependencies, but external Beta still requires real Stripe test-mode evidence, deployed staging evidence, Privy Console SDK integration, dependency advisory closure or risk acceptance, and the other saved real-world evidence gates.

Update after Security Pass 113 on 2026-05-30:

- Added `npm run security:dependency-tooling` as a full dev/tooling audit gate under Node 22.
- The gate currently allows only the known high-severity `lodash`, `serialize-javascript`, `tmp`, and `undici` findings while they remain transitive to the Hardhat/contract-toolchain graph, are not direct workspace dependencies, and are not part of app runtime dependencies.
- Added fixture-backed `npm run security:dependency-tooling:self-test` coverage for critical advisory drift, unexpected high packages, direct high workspace dependencies, high findings outside the contract-tooling boundary, missing package scripts, missing composite verifier wiring, and missing advisory-log containment markers.
- Wired both dependency tooling commands into `npm run beta:foundation:verify` after the dependency risk evidence self-test.
- Remaining status: this contains the known full-audit dev/tooling risk and prevents silent drift, but it does not patch, close, or risk-accept those advisories. External Beta still requires dependency advisory closure or explicit owner-approved risk acceptance, plus real Privy dashboard/app evidence, Console Privy SDK login, Stripe test-mode signed-webhook evidence, deployed staging evidence, hosted CI evidence, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 114 on 2026-05-30:

- Extended `npm run security:stripe-testmode:evidence` so saved real Stripe evidence must include FanPass iOS native PaymentSheet proof, not only backend PaymentIntent/webhook/side-effect proof.
- The validator now requires iOS PaymentSheet presentation through the FanPass app, a backend-issued PaymentIntent client secret source, a test publishable-key classification without recording the key, local mock client-secret blocking, the `fanpass-payments` return URL scheme, and proof that FanPass Ops did not expose checkout.
- Extended fixture-backed `npm run security:stripe-testmode:evidence:self-test` coverage to reject leaked Stripe publishable keys, missing mobile-client evidence, and weak PaymentSheet proof that bypasses the backend client-secret boundary.
- Remaining status: this strengthens the Stripe acceptance contract, but it does not run real Stripe test keys or close the PaymentSheet/webhook blocker. External Beta still requires saved real Stripe test-mode evidence, real Privy dashboard/app evidence, Console Privy SDK login, deployed staging evidence, hosted CI evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 115 on 2026-05-30:

- Tightened `FanPassEnvironment.stripePublishableKey` so the current Beta PaymentSheet path only accepts externally supplied `pk_test_` publishable keys; live, secret, placeholder, empty, or malformed values leave PaymentSheet unavailable.
- Extended `npm run security:ios-distribution-boundaries` and its fixture self-test to reject checked-in Stripe publishable keys in iOS xcconfig files and to require the test publishable-key runtime guard in `FanPassEnvironment`.
- Added the distribution-plan, task, QA, roadmap, and provider-feasibility markers for the test publishable-key runtime guard.
- Remaining status: this prevents accidental live-key or committed-key drift for the native PaymentSheet path, but it does not replace real Stripe test-mode PaymentSheet/webhook validation. External Beta still requires saved real Stripe test-mode evidence, real Privy dashboard/app evidence, Console Privy SDK login, deployed staging evidence, hosted CI evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 116 on 2026-05-30:

- Tightened `FanPassEnvironment.publicConfigValue` so FanPass and FanPass Ops Privy public app/client ID slots reject secret-like values, including bearer tokens, JWTs, private-key blocks, Privy app secrets, Privy verification keys, Stripe keys, webhook secrets, client secrets, and database URL markers.
- Extended `npm run security:ios-distribution-boundaries` and its fixture self-test to require the Privy public-config secret guard and to reject checked-in Privy app-secret markers in iOS config files.
- Extended `npm run security:privy-mobile-app-config:evidence` so future saved native app config evidence must prove `FanPassEnvironment` rejects secret-like values, not only empty or placeholder values.
- Added the distribution-plan, task, QA, roadmap, and provider-feasibility markers for the Privy public-config secret guard.
- Remaining status: this prevents secret-like value drift in native Privy public config, but it does not replace real Privy dashboard evidence, real injected staging/beta app/client IDs, or Console Privy React SDK login. External Beta still requires saved real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, hosted CI evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 117 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so the repository-level `outputs/` scan rejects Stripe publishable keys (`pk_test_` and `pk_live_`) in addition to Stripe secret keys, webhook secrets, PaymentIntent client secrets, bearer tokens, JWTs, private keys, database URLs, Privy secret markers, and staging/admin token assignments.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a Stripe publishable key.
- Added the task, QA, roadmap, walkthrough-evidence, and handoff markers for Stripe publishable-key redaction coverage.
- Remaining status: this closes a saved-artifact redaction gap for future Stripe/iOS evidence bundles, but it does not create real Stripe test-mode evidence or close any external provider blocker. External Beta still requires saved real Stripe test-mode evidence, real Privy dashboard/app evidence, Console Privy SDK login, deployed staging evidence, hosted CI evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 118 on 2026-05-30:

- Extended `npm run security:runtime:staging:evidence` so saved deployed staging runtime evidence rejects provider-key and database URL leakage, including Stripe secret/publishable keys, webhook secrets, PaymentIntent client secrets, Privy secret markers, bearer tokens, JWTs, private keys, and staging admin token assignments.
- Added fixture-backed `npm run security:runtime:staging:evidence:self-test` coverage for staging runtime evidence containing a Stripe publishable key and raw `DATABASE_URL`.
- Added the task, QA, roadmap, and handoff markers for staging runtime provider-key/database URL redaction coverage.
- Remaining status: this strengthens the deployed-staging evidence contract before real HTTPS staging is trusted, but it does not create deployed staging evidence. External Beta still requires real HTTPS API/Console URLs, a real staging admin bearer source, hosted CI evidence, real Stripe test-mode evidence, real Privy dashboard/app evidence, Console Privy SDK login, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 119 on 2026-05-30:

- Extended `npm run security:ci-hosted:evidence` so saved hosted GitHub Actions evidence rejects Stripe publishable keys, PaymentIntent client secrets, broader `postgres://` and `postgresql://` database URL assignments, Privy access-token markers, bearer tokens, JWTs, private keys, staging admin token assignments, and the GitHub `secrets.*` context.
- Added fixture-backed `npm run security:ci-hosted:evidence:self-test` coverage for hosted CI evidence containing a Stripe publishable key and raw `DATABASE_URL`.
- Added the task, QA, roadmap, and handoff markers for hosted CI publishable-key/database URL redaction coverage.
- Remaining status: this strengthens the hosted CI evidence contract before a GitHub Actions run is trusted, but it does not create hosted CI evidence. External Beta still requires a real successful hosted Node 22 Beta foundation run plus real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 120 on 2026-05-30:

- Extended `npm run security:ios-staging-build:evidence` so saved iOS staging/TestFlight build evidence rejects raw Stripe test publishable keys and `STRIPE_PUBLISHABLE_KEY=` assignments, not only Stripe secrets or live publishable keys.
- Added fixture-backed `npm run security:ios-staging-build:evidence:self-test` coverage for iOS build evidence containing a Stripe publishable key.
- Added the task, QA, roadmap, iOS build evidence, and handoff markers for iOS staging/TestFlight publishable-key redaction coverage.
- Remaining status: this strengthens the saved iOS build evidence contract before signed staging/TestFlight artifacts are trusted, but it does not create iOS/TestFlight evidence. External Beta still requires Apple signing/provisioning, real HTTPS staging/beta endpoints, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 121 on 2026-05-30:

- Extended `npm run security:dependency-risk:evidence` so saved dependency advisory closeout or risk-acceptance evidence rejects raw Stripe test publishable keys and `STRIPE_PUBLISHABLE_KEY=` assignments, not only Stripe secrets or live publishable keys.
- Added fixture-backed `npm run security:dependency-risk:evidence:self-test` coverage for dependency risk evidence containing a Stripe publishable key, and required `redaction.stripePublishableKeysRedacted`.
- Added the task, QA, roadmap, dependency risk evidence, and handoff markers for dependency-risk publishable-key redaction coverage.
- Remaining status: this strengthens the saved dependency-risk evidence contract before any unresolved advisory risk is accepted for closed external testing, but it does not accept the current dependency risk or close the blocker. External Beta still requires a clean production audit, a safe patched Next/PostCSS path, or owner-approved risk evidence that passes `npm run security:dependency-risk:evidence`, plus real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 122 on 2026-05-30:

- Extended `npm run security:privy-mobile-app-config:evidence` so future saved native app config evidence rejects raw Stripe test publishable keys and `STRIPE_PUBLISHABLE_KEY=` assignments, not only Stripe secrets or live publishable keys.
- Added fixture-backed `npm run security:privy-mobile-app-config:evidence:self-test` coverage for Privy mobile app config evidence containing a Stripe publishable key, and required `redaction.stripePublishableKeysRedacted`.
- Added the task, QA, roadmap, provider-cost, mobile app config evidence, and handoff markers for Privy mobile app config publishable-key redaction coverage.
- Remaining status: this strengthens the saved Privy mobile app config evidence contract before real iOS Privy app/client IDs are trusted, but it does not provide real Privy dashboard evidence or injected app/client IDs. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 123 on 2026-05-30:

- Extended `npm run security:staff-tenant:staging-evidence` so future saved production-like tenant/staff evidence rejects raw Stripe test publishable keys, `STRIPE_PUBLISHABLE_KEY=` assignments, database URL assignments, and `postgres://`/`postgresql://` URLs.
- Added fixture-backed `npm run security:staff-tenant:staging-evidence:self-test` coverage for staff tenant evidence containing a Stripe publishable key and raw database URL, and required redaction proof for provider secrets, Stripe publishable keys, and database URLs.
- Added the task, QA, roadmap, provider-cost, staff tenant evidence, and handoff markers for staff tenant provider-key/database URL redaction coverage.
- Remaining status: this strengthens the saved production-like tenant/staff evidence contract before tenant/staff blockers are closed, but it does not create staging tenant evidence. External Beta still requires deployed staging with verified Privy sessions, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 124 on 2026-05-30:

- Extended `npm run security:privy-plan:evidence` so future saved Privy dashboard plan evidence rejects raw Stripe test publishable keys, `STRIPE_PUBLISHABLE_KEY=` assignments, Stripe webhook/client-secret markers, database URL assignments, and `postgres://`/`postgresql://` URLs.
- Added fixture-backed `npm run security:privy-plan:evidence:self-test` coverage for Privy plan evidence containing a Stripe publishable key and raw database URL, and required redaction proof for provider secrets, Stripe publishable keys, and database URLs.
- Added the task, QA, roadmap, provider-cost, Privy plan evidence, and handoff markers for Privy plan provider-key/database URL redaction coverage.
- Remaining status: this strengthens the saved Privy dashboard plan evidence contract before plan assumptions are trusted, but it does not create actual Privy dashboard evidence. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 125 on 2026-05-30:

- Extended `npm run security:stripe-testmode:evidence` so future saved real Stripe test-mode evidence rejects provider-secret assignments, raw Stripe publishable-key assignments, database URL assignments, and `postgres://`/`postgresql://` URLs in addition to Stripe secrets, webhook secrets, client secrets, bearer tokens, and private-key markers.
- Added fixture-backed `npm run security:stripe-testmode:evidence:self-test` coverage for Stripe evidence containing a raw database URL, and required redaction proof for provider secrets and database URLs.
- Added the task, QA, roadmap, provider-cost, Stripe evidence, and handoff markers for Stripe test-mode provider-secret/database URL redaction coverage.
- Remaining status: this strengthens the saved Stripe test-mode acceptance contract before real Stripe evidence is trusted, but it does not run real Stripe test keys or close the PaymentSheet/webhook blocker. External Beta still requires saved real Stripe test-mode evidence, real Privy dashboard/app evidence, Console Privy SDK login, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 126 on 2026-05-30:

- Extended `npm run security:ops-scanner:device-evidence` so future saved physical FanPass Ops QR/NFC evidence rejects raw Stripe publishable-key assignments, database URL assignments, and `postgres://`/`postgresql://` URLs in addition to bearer tokens, private-key markers, QR signing secrets, and provider secret markers.
- Added fixture-backed `npm run security:ops-scanner:device-evidence:self-test` coverage for scanner evidence containing a raw Stripe publishable key and database URL, and required redaction proof for provider secrets, Stripe publishable keys, and database URLs.
- Added the task, QA, roadmap, provider-cost, Ops scanner evidence, and handoff markers for physical scanner provider-key/database URL redaction coverage.
- Remaining status: this strengthens the saved physical scanner evidence contract before real QR/NFC device evidence is trusted, but it does not create signed iOS builds or real-device QR/NFC evidence. External Beta still requires saved physical scanner evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 127 on 2026-05-30:

- Extended `npm run security:apple-wallet:evidence` so future saved signed Apple Wallet `.pkpass` evidence rejects raw Stripe publishable-key assignments, database URL assignments, and `postgres://`/`postgresql://` URLs in addition to Apple signing material, bearer tokens, private-key markers, Stripe secrets, and Privy secret markers.
- Added fixture-backed `npm run security:apple-wallet:evidence:self-test` coverage for Wallet evidence containing a raw Stripe publishable key and database URL, and required redaction proof for provider secrets, Stripe publishable keys, and database URLs.
- Added the task, QA, roadmap, provider-cost, Apple Wallet evidence, and handoff markers for signed Wallet provider-key/database URL redaction coverage.
- Remaining status: this strengthens the saved signed Wallet evidence contract before `.pkpass` evidence is trusted, but it does not create Apple signing/provisioning or physical-device Wallet evidence. External Beta still requires saved signed Wallet evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 128 on 2026-05-30:

- Extended `npm run security:chain-custody:evidence` so future saved real-chain custody evidence rejects raw Stripe publishable-key assignments, database URL assignments, `postgres://`/`postgresql://` URLs, provider RPC URL assignments, and common chain-provider API-key markers in addition to private-key, bearer-token, and seed-phrase markers.
- Added fixture-backed `npm run security:chain-custody:evidence:self-test` coverage for chain custody evidence containing a raw Stripe publishable key, database URL, and provider RPC URL, and required redaction proof for provider secrets, Stripe publishable keys, database URLs, and RPC URLs.
- Added the task, QA, roadmap, provider-cost, chain custody evidence, and handoff markers for chain custody provider-key/RPC URL/database URL redaction coverage.
- Remaining status: this strengthens the saved chain custody acceptance contract before vault/KMS or delegated-signer evidence is trusted, but it does not create real chain custody evidence or close ASR-014. External Beta still requires saved chain custody evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and hosted CI evidence.

Update after Security Pass 129 on 2026-05-30:

- Extended `npm run security:privy-console-react-sdk:isolation` so future saved Console React SDK isolation evidence rejects raw Stripe publishable-key assignments, raw `pk_test_` keys, database URL assignments, and `postgres://`/`postgresql://` URLs in addition to Privy secret, access-token, Stripe secret, webhook, client-secret, bearer-token, and private-key markers.
- Added fixture-backed `npm run security:privy-console-react-sdk:isolation:self-test` coverage for Console SDK isolation evidence containing a raw Stripe publishable key and database URL, and required redaction proof for provider secrets, Stripe publishable keys, and database URLs.
- Added the task, QA, roadmap, provider-cost, Console React SDK isolation evidence, and handoff markers for Console SDK isolation provider-key/database URL redaction coverage.
- Remaining status: this strengthens the saved Console React SDK isolation acceptance contract before `@privy-io/react-auth` can be integrated, but it does not install the SDK or close the Console login blocker. External Beta still requires real Console SDK isolation/acceptance evidence, real Privy dashboard/app evidence, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 130 on 2026-05-30:

- Extended `npm run security:ios-staging-build:evidence` so future saved signed iOS staging/TestFlight build evidence rejects database URL assignments and `postgres://`/`postgresql://` URLs in addition to Stripe publishable-key, signing material, token, provider-secret, and device-marker leakage.
- Added fixture-backed `npm run security:ios-staging-build:evidence:self-test` coverage for iOS build evidence containing a raw database URL, and required redaction proof for provider secrets, Stripe publishable keys, and database URLs.
- Added the task, QA, roadmap, iOS staging build evidence, and handoff markers for iOS staging/TestFlight provider-key/database URL redaction coverage.
- Remaining status: this strengthens the saved iOS build evidence acceptance contract before signed staging/TestFlight artifacts are trusted, but it does not create iOS/TestFlight evidence or close the real iOS staging/beta API URL blocker. External Beta still requires Apple signing/provisioning, real HTTPS staging/beta endpoints, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 131 on 2026-05-30:

- Extended `npm run security:privy-mobile-app-config:evidence` so future saved native Privy app/client ID evidence rejects provider-secret markers, database URL assignments, and `postgres://`/`postgresql://` URLs in addition to Privy secret, access-token, Stripe publishable-key, bearer-token, and private-key markers.
- Added fixture-backed `npm run security:privy-mobile-app-config:evidence:self-test` coverage for mobile app config evidence containing a provider secret and database URL, and required redaction proof for provider secrets and database URLs.
- Added the task, QA, roadmap, provider-cost, mobile app config evidence, and handoff markers for Privy mobile app config provider-key/database URL redaction coverage.
- Remaining status: this strengthens the saved native Privy app config acceptance contract before real iOS app/client IDs are trusted, but it does not provide real Privy dashboard evidence or injected app/client IDs. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 132 on 2026-05-30:

- Extended `npm run security:dependency-risk:evidence` so future saved clean-audit closeout or unresolved-advisory risk acceptance evidence rejects provider-secret markers and `postgres://`/`postgresql://` URLs in addition to Stripe publishable-key, bearer-token, private-key, Privy secret, staging admin token, and database assignment markers.
- Added fixture-backed `npm run security:dependency-risk:evidence:self-test` coverage for dependency risk evidence containing a provider secret and raw database URL.
- Added the task, QA, roadmap, provider-cost, dependency risk evidence, advisory log, and handoff markers for dependency risk provider-key/database URL redaction coverage.
- Remaining status: this strengthens the saved dependency-risk acceptance contract before unresolved advisories can be accepted for closed external testing, but it does not accept the current dependency risk or close the blocker. External Beta still requires a clean production audit, a safe patched Next/PostCSS path, or owner-approved risk evidence that passes `npm run security:dependency-risk:evidence`, plus real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 81 on 2026-05-30:

- Added `npm run security:headers-policy` as a static ASR-011 guard for security headers and deployment hardening.
- The audit verifies that API Helmet and powered-by removal, production-like API HSTS, production-like API trust-proxy hop validation, API request body limits, route rate limits, Console strict transport security, Console cross-origin opener policy, Console CSP/security headers and powered-by removal, local runtime header checks, staging runtime HTTPS/header/admin-health checks, staging evidence validation, and documentation markers stay wired together.
- Added `npm run security:headers-policy:self-test` with fixtures rejecting missing Helmet, missing production-like HSTS, missing production-like trust-proxy validation, powered-by drift, missing Console strict transport security, missing Console cross-origin opener policy, missing Console CSP, missing local runtime header assertions, missing staging HTTPS enforcement, missing staging evidence dry-run validation, missing composite verifier wiring, and missing documentation markers.
- Added both commands to `npm run beta:foundation:verify` after the local/staging runtime checker self-tests.
- Remaining status: ASR-011 is locally mitigated and regression-checked, but the deployed-staging portion remains open until real HTTPS API/Console URLs are provisioned and saved runtime evidence passes validation.

Update after Security Pass 133 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject provider-secret/API-key assignments and raw `postgres://`/`postgresql://` database URLs in addition to Stripe keys, webhook secrets, PaymentIntent client secrets, bearer tokens, JWTs, private-key blocks, Privy secret markers, and staging/admin token assignments.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a provider secret and raw database URL, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, walkthrough evidence, and handoff markers for repository-wide saved-evidence provider-key/database URL redaction coverage.
- Remaining status: this strengthens the repository-level generated-artifact scan before future staging, CI, provider, iOS, scanner, Wallet, or chain evidence bundles are trusted, but it does not create or close any external evidence blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 134 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject provider RPC URL assignments, raw Alchemy/Infura/QuickNode-style RPC URLs, and common chain provider API-key assignments in addition to the existing Stripe, Privy, bearer-token, JWT, database URL, private-key, provider-secret, and staging/admin token markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a provider RPC URL and chain provider API key, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence RPC/API-key redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future chain/staging/CI/provider evidence is trusted, but it does not create real chain custody evidence or close external evidence blockers. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 135 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject Apple certificate blocks, Apple signing material assignments, provisioning profile markers, and explicit device identifier assignments in addition to existing provider, payment, token, database URL, private-key, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing Apple signing material and a device identifier, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence Apple signing/device redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future iOS/TestFlight, Wallet, scanner, staging, or CI evidence is trusted, but it does not create real Apple signing, TestFlight, Wallet, or physical-device evidence. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 136 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw email addresses and raw EVM-style wallet addresses in addition to existing provider, payment, token, database URL, private-key/certificate, Apple signing, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a raw staff email and wallet address, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence identity redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future staff tenant, Privy, Stripe, iOS, scanner, Wallet, staging, CI, or chain evidence is trusted, but it does not create production tenant/staff evidence or close any real-user identity blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 137 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject QR signing secret assignments, raw staff invite token fields, raw QR nonce fields, and raw signed payload fields in addition to existing provider, payment, token, database URL, identity, private-key/certificate, Apple signing, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a QR signing secret, staff invite token, raw nonce, and signed payload, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence scanner/staff secret redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future physical scanner, staff tenant, iOS/TestFlight, Wallet, staging, or CI evidence is trusted, but it does not create physical-device scanner evidence or close staff invite delivery blockers. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 138 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw FanPass identity fields and raw ticket/event identifier fields in addition to existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing raw staff, organizer, ticket, and event identifiers, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence FanPass identifier redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future staff tenant, scanner, staging, iOS/TestFlight, Wallet, CI, or provider evidence is trusted, but it does not create real production tenant/staff evidence or close any real-user identity blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 139 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject app session/client/webhook-style secret assignments in addition to existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing `SESSION_SIGNING_SECRET`, generic client-secret, and webhook-secret assignments, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence app secret assignment redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future staging runtime, CI, provider, iOS/TestFlight, scanner, Wallet, or chain evidence is trusted, but it does not create deployed staging evidence or close any real provider blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 140 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject app session/client/webhook-style secret JSON fields in addition to shell-style secret assignments and existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing `sessionSecret`, `clientSecret`, and `webhookSecret` fields, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence app secret field redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future staging runtime, CI, provider, iOS/TestFlight, scanner, Wallet, or chain evidence is trusted, but it does not create deployed staging evidence or close any real provider blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 141 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject secret-bearing URL query parameters for access tokens, ID tokens, client secrets, API keys, signatures, auth/session tokens, and invite tokens in addition to existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing callback/provider URLs with token and client-secret query parameters, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence URL query secret redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future staging runtime, CI, provider, iOS/TestFlight, scanner, Wallet, or chain evidence is trusted, but it does not create deployed staging evidence or close any real provider blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 142 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject provider API-key JSON fields such as `apiKey`, `providerApiKey`, `chainApiKey`, `rpcApiKey`, and common Alchemy/Infura/QuickNode/explorer API-key field names in addition to existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing generic and Alchemy API-key JSON fields, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence provider API-key field redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future staging runtime, CI, provider, iOS/TestFlight, scanner, Wallet, or chain evidence is trusted, but it does not create deployed staging evidence or close any real provider blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 143 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject generic credentialed service URLs such as `scheme://user:password@host`, covering non-Postgres service URLs in addition to existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a credentialed Redis-style URL, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence credentialed service URL redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future staging runtime, CI, provider, iOS/TestFlight, scanner, Wallet, or chain evidence is trusted, but it does not create deployed staging evidence or close any real provider blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 144 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw Basic authorization headers and sensitive Cookie/Set-Cookie headers carrying session, JWT, token, auth, or CSRF values in addition to existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, service URL, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a Basic auth header, a Console session cookie, and a CSRF cookie, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence auth header and cookie redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future deployed runtime, browser, CI, provider, iOS/TestFlight, scanner, Wallet, or chain evidence is trusted, but it does not create deployed staging evidence or close any real provider blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 145 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw secret-bearing HTTP headers such as `X-API-Key`, auth/access/session/CSRF token headers, Privy token headers, and Stripe webhook signature headers in addition to existing provider, payment, token, cookie, database URL, identity, scanner secret, private-key/certificate, Apple signing, service URL, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing an API-key header, CSRF token header, and Stripe signature header, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence secret-bearing HTTP header redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future deployed runtime, browser/network, CI, provider, iOS/TestFlight, scanner, Wallet, or chain evidence is trusted, but it does not create deployed staging evidence or close any real provider blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 146 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw deployment and cloud credential assignments such as AWS access/session keys, Google service-account key JSON markers, Vercel tokens, GitHub tokens, Netlify tokens, and Cloudflare API tokens in addition to existing provider, payment, token, cookie, HTTP header, database URL, identity, scanner secret, private-key/certificate, Apple signing, service URL, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing Vercel, AWS, and Cloudflare credential assignments, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence deployment/cloud credential redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future deployed staging, hosted CI, provider, iOS/TestFlight, scanner, Wallet, or chain evidence is trusted, but it does not create hosted CI or deployed staging evidence or close any real provider blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 147 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw deployment and cloud credential JSON fields such as AWS access/session key fields, Google credential fields, Vercel tokens, GitHub tokens, Netlify tokens, and Cloudflare API token/key fields in addition to existing provider, payment, token, cookie, HTTP header, deployment assignment, database URL, identity, scanner secret, private-key/certificate, Apple signing, service URL, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing Vercel, AWS, and Cloudflare credential fields, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence deployment/cloud credential field redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future deployed staging, hosted CI, provider, iOS/TestFlight, scanner, Wallet, or chain evidence is trusted, but it does not create hosted CI or deployed staging evidence or close any real provider blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 148 on 2026-05-30:

- Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw deployment and cloud credential JSON environment-map fields such as `"AWS_SECRET_ACCESS_KEY"`, `"VERCEL_TOKEN"`, and `"CLOUDFLARE_API_TOKEN"` in addition to existing provider, payment, token, cookie, HTTP header, deployment assignment, deployment camel-case field, database URL, identity, scanner secret, private-key/certificate, Apple signing, service URL, and staging/admin markers.
- Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing Vercel, AWS, and Cloudflare credential environment-map fields, and verified the live `outputs/` scan still passes.
- Added the task, QA, roadmap, provider-cost, walkthrough evidence, and handoff markers for repository-wide saved-evidence deployment/cloud credential environment-field redaction coverage.
- Remaining status: this strengthens generated-artifact scanning before future deployed staging, hosted CI, provider, iOS/TestFlight, scanner, Wallet, or chain evidence is trusted, but it does not create hosted CI or deployed staging evidence or close any real provider blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 149 on 2026-05-30:

- Added `npm run security:payment-response-redaction` so payment response boundaries are checked directly: payer checkout intent responses may expose Stripe client secrets, but admin payment operation responses, webhook responses, side-effect worker payloads, and Alpha operations payment snapshots must remain redacted.
- Added fixture-backed `npm run security:payment-response-redaction:self-test` coverage for admin route leakage, webhook leakage, redacted mapper leakage, side-effect payload leakage, Alpha operations snapshot leakage, and missing `npm run beta:foundation:verify` wiring.
- Wired both payment response redaction checks into `npm run beta:foundation:verify` and updated the task, QA, roadmap, provider-cost, and handoff docs.
- Remaining status: this locally hardens ASR-008 payment response privacy and client-secret boundaries, but it does not validate real Stripe test-mode keys or signed webhooks. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 150 on 2026-05-30:

- Extended `npm run security:ci-hosted:evidence` so saved hosted GitHub Actions evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS access/session keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
- Required hosted CI evidence to prove `environment.deploymentCredentialsAvailable` is `false` and `redaction.deploymentCredentialsRedacted` is `true`, keeping deployment credentials out of CI logs and saved evidence before hosted CI blockers are closed.
- Added fixture-backed `npm run security:ci-hosted:evidence:self-test` coverage for hosted CI evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
- Remaining status: this strengthens the saved hosted CI evidence contract before real CI evidence is trusted, but it does not run GitHub Actions or close the hosted CI blocker. External Beta still requires saved hosted CI evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 151 on 2026-05-30:

- Extended `npm run security:runtime:staging:evidence` so saved deployed staging runtime evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS access/session keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
- Required staging runtime evidence to prove `deploymentCredentialsAvailable` is `false` and `redaction.deploymentCredentialsRedacted` is `true`, keeping deployment/cloud credentials out of saved staging header/config evidence.
- Added fixture-backed `npm run security:runtime:staging:evidence:self-test` coverage for staging evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
- Remaining status: this strengthens the saved deployed-staging evidence contract before real staging runtime checks are trusted, but it does not create deployed staging evidence or close ASR-011. External Beta still requires deployed staging evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 152 on 2026-05-30:

- Extended `npm run security:ios-staging-build:evidence` so saved signed iOS staging/TestFlight build evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS access/session keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
- Required iOS build evidence to prove `environment.deploymentCredentialsAvailable` is `false` and `redaction.deploymentCredentialsRedacted` is `true`, keeping deployment/cloud credentials out of saved build logs and evidence before iOS staging/beta API URL blockers are closed.
- Added fixture-backed `npm run security:ios-staging-build:evidence:self-test` coverage for iOS build evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
- Remaining status: this strengthens the saved iOS staging/TestFlight evidence contract before signed build artifacts are trusted, but it does not create iOS/TestFlight evidence or close the real iOS staging/beta API URL blocker. External Beta still requires saved iOS staging/TestFlight evidence, deployed staging evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 153 on 2026-05-30:

- Extended `npm run security:staff-tenant:staging-evidence` so future saved production-like tenant/staff evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS access/session keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
- Required staff tenant staging evidence to prove `runtime.deploymentCredentialsAvailable` is `false` and `redaction.deploymentCredentialsRedacted` is `true`, keeping deployment/cloud credentials out of saved organizer-isolation, invite, and Ops gate-scoping evidence.
- Added fixture-backed `npm run security:staff-tenant:staging-evidence:self-test` coverage for staff tenant evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
- Remaining status: this strengthens the saved production tenant/staff evidence contract before staging tenant policy proof is trusted, but it does not create staging tenant/staff evidence or close the production tenant/staff blocker. External Beta still requires saved staff tenant staging evidence, saved iOS staging/TestFlight evidence, deployed staging evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 154 on 2026-05-30:

- Extended `npm run security:stripe-testmode:evidence` so future saved real Stripe test-mode evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS access/session keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
- Required Stripe test-mode evidence to prove `deploymentCredentialsAvailable` is `false` and `redaction.deploymentCredentialsRedacted` is `true`, keeping deployment/cloud credentials out of saved PaymentIntent, PaymentSheet, webhook, capture, cancellation, refund, and reconciliation evidence.
- Added fixture-backed `npm run security:stripe-testmode:evidence:self-test` coverage for Stripe evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
- Remaining status: this strengthens the saved Stripe test-mode evidence contract before real payment proof is trusted, but it does not create real Stripe test-mode evidence or close the Stripe blocker. External Beta still requires real Stripe test-mode evidence, saved staff tenant staging evidence, saved iOS staging/TestFlight evidence, deployed staging evidence, real Privy dashboard/app evidence, Console Privy SDK login, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 155 on 2026-05-30:

- Extended `npm run security:privy-plan:evidence` so future saved Privy dashboard/plan evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS access/session keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
- Required Privy plan evidence to prove `deploymentCredentialsAvailable` is `false` and `redaction.deploymentCredentialsRedacted` is `true`, keeping deployment/cloud credentials out of saved plan-support and dashboard-review evidence.
- Added fixture-backed `npm run security:privy-plan:evidence:self-test` coverage for Privy plan evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
- Remaining status: this strengthens the saved Privy dashboard evidence contract before plan assumptions are trusted, but it does not create actual Privy dashboard evidence or close the Privy blocker. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, saved staff tenant staging evidence, saved iOS staging/TestFlight evidence, deployed staging evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 156 on 2026-05-30:

- Extended `npm run security:privy-mobile-app-config:evidence` so future saved native Privy app/client ID evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS access/session keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
- Required Privy mobile app config evidence to prove `deploymentCredentialsAvailable` is `false` and `redaction.deploymentCredentialsRedacted` is `true`, keeping deployment/cloud credentials out of saved iOS public app/client ID configuration evidence.
- Added fixture-backed `npm run security:privy-mobile-app-config:evidence:self-test` coverage for mobile app config evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
- Remaining status: this strengthens the saved native Privy app config evidence contract before real iOS app/client IDs are trusted, but it does not provide actual Privy dashboard evidence, inject real app/client IDs, or close real iOS Privy configuration blockers. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, saved staff tenant staging evidence, saved iOS staging/TestFlight evidence, deployed staging evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 157 on 2026-05-30:

- Extended `npm run security:privy-console-react-sdk:isolation` so future saved Console React SDK isolation evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS access/session keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
- Required Console SDK isolation evidence to prove `deploymentCredentialsAvailable` is `false` and `redaction.deploymentCredentialsRedacted` is `true`, keeping deployment/cloud credentials out of dependency-audit and isolated-runtime evidence before `@privy-io/react-auth` can be integrated.
- Added fixture-backed `npm run security:privy-console-react-sdk:isolation:self-test` coverage for Console SDK isolation evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
- Remaining status: this strengthens the saved Console SDK isolation evidence contract before the React SDK blocker is closed, but it does not install `@privy-io/react-auth` or implement the actual Console SDK login. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, saved staff tenant staging evidence, saved iOS staging/TestFlight evidence, deployed staging evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 158 on 2026-05-30:

- Extended `npm run security:chain-custody:evidence` so future saved real-chain custody evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS access/session keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
- Required chain custody evidence to prove `deploymentCredentialsAvailable` is `false` and `redaction.deploymentCredentialsRedacted` is `true`, keeping deployment/cloud credentials out of vault/KMS or delegated-signer, multisig/timelock, durable outbox, and operational runbook evidence before ASR-014 or pilot chain blockers are closed.
- Added fixture-backed `npm run security:chain-custody:evidence:self-test` coverage for chain custody evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
- Remaining status: this strengthens the saved real-chain custody evidence contract before chain blockers are closed, but it does not create vault/KMS or delegated-signer evidence, multisig/timelock ownership evidence, or real testnet chain execution evidence. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, saved staff tenant staging evidence, saved iOS staging/TestFlight evidence, deployed staging evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 159 on 2026-05-30:

- Extended `npm run security:ops-scanner:device-evidence` so future saved physical FanPass Ops QR/NFC scanner evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS access/session keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
- Required scanner evidence to prove `runtime.deploymentCredentialsAvailable` is `false` and `redaction.deploymentCredentialsRedacted` is `true`, keeping deployment/cloud credentials out of saved physical QR, NFC, gate-assignment, and backend-authority evidence before real-device scanner blockers are closed.
- Added fixture-backed `npm run security:ops-scanner:device-evidence:self-test` coverage for scanner evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
- Remaining status: this strengthens the saved physical scanner evidence contract before QR/NFC blockers are closed, but it does not create real-device scanner evidence or replace signing/provisioning a real iPhone build against HTTPS staging/beta APIs. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, saved staff tenant staging evidence, saved iOS staging/TestFlight evidence, deployed staging evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 160 on 2026-05-30:

- Extended `npm run security:apple-wallet:evidence` so future saved signed Apple Wallet `.pkpass` evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS access/session keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
- Required Wallet evidence to prove `deploymentCredentialsAvailable` is `false` and `redaction.deploymentCredentialsRedacted` is `true`, keeping deployment/cloud credentials out of saved pass-signing, manifest/signature, device-install, and FanPass Ops scan-compatibility evidence before signed `.pkpass` blockers are closed.
- Added fixture-backed `npm run security:apple-wallet:evidence:self-test` coverage for Wallet evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
- Remaining status: this strengthens the saved signed Wallet evidence contract before `.pkpass` blockers are closed, but it does not create Apple signing/provisioning evidence, generate a signed pass, or validate add-to-Wallet on a physical iPhone. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, saved staff tenant staging evidence, saved iOS staging/TestFlight evidence, deployed staging evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 161 on 2026-05-30:

- Extended `npm run security:dependency-risk:evidence` so future saved clean-audit closeout or unresolved-advisory closed-beta risk acceptance evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS access/session keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
- Required dependency-risk evidence to prove `deploymentCredentialsAvailable` is `false` and `redaction.deploymentCredentialsRedacted` is `true`, keeping deployment/cloud credentials out of saved dependency closeout or owner-approved risk acceptance packets.
- Added fixture-backed `npm run security:dependency-risk:evidence:self-test` coverage for dependency-risk evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
- Remaining status: this strengthens the saved dependency risk evidence contract, but it does not close or accept the current Next/PostCSS advisory risk. External Beta still requires production audit cleanup or owner-approved risk acceptance, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, saved staff tenant staging evidence, saved iOS staging/TestFlight evidence, deployed staging evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 162 on 2026-05-30:

- Added `Cross-Origin-Opener-Policy: same-origin` to FanPass Console static headers and made the local runtime checker, staging runtime checker, staging runtime evidence validator, and static header-policy audit require Console cross-origin opener policy evidence.
- Added fixture-backed self-test coverage for missing Console cross-origin opener policy in local runtime checks, staging runtime checks, staging evidence validation, and static header-policy configuration.
- Remaining status: this strengthens ASR-011 local and future staging header evidence, but it does not close the deployed-staging blocker. External Beta still requires real deployed HTTPS API/Console evidence with a real staging admin bearer, plus real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 163 on 2026-05-30:

- Enabled API Helmet HSTS in production-like runtimes while keeping local HTTP HSTS disabled.
- Added FanPass Console strict transport security and made the staging runtime checker, staging runtime evidence validator, and static header-policy audit require API and Console `strict-transport-security` evidence.
- Added fixture-backed self-test coverage for missing production-like API HSTS markers, missing Console strict transport security config, missing staging runtime HSTS checks, and missing staging evidence HSTS proof.
- Remaining status: this strengthens ASR-011 local and future staging header evidence, but it does not close the deployed-staging blocker. External Beta still requires real deployed HTTPS API/Console evidence with a real staging admin bearer, plus real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 164 on 2026-05-30:

- Added explicit API `trust proxy` wiring for production-like runtimes before `express-rate-limit` middleware is registered.
- Required and bounded `FANPASS_TRUST_PROXY_HOPS` in production-like API configuration, added the value to the staging template and local staging dry-run, and documented the deployed edge/proxy assumption.
- Extended `npm run security:headers-policy` and fixture-backed self-tests to reject missing trust-proxy runtime wiring, missing production-like trust-proxy validation, missing staging template coverage, and missing trust-proxy docs markers.
- Remaining status: this strengthens ASR-011 local and future staging deployment hardening, but it does not close the deployed-staging blocker. External Beta still requires real deployed HTTPS API/Console evidence with a real staging admin bearer, plus real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 165 on 2026-05-30:

- Required deployed `npm run security:runtime:staging` runs to provide `STAGING_API_TRUST_PROXY_HOPS` / `FANPASS_STAGING_API_TRUST_PROXY_HOPS` with a bounded 1-3 hop value matching the deployed API edge/proxy path.
- Extended staging runtime JSON output with `apiRuntime.trustProxyHops`, deployment credential absence/redaction metadata, and a matching `trust proxy hops configured: <n>` checked API item.
- Extended `npm run security:runtime:staging:evidence` and fixture-backed self-tests so saved deployed evidence is rejected if the trust-proxy hop proof is missing, invalid, or not reflected in the checked API evidence list.
- Extended `npm run security:headers-policy` markers so staging runtime trust-proxy evidence proof remains connected to ASR-011.
- Remaining status: this strengthens future deployed-staging rate-limit/header evidence, but it does not create real deployed staging evidence or close ASR-011. External Beta still requires real deployed HTTPS API/Console evidence with a real staging admin bearer, plus real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 166 on 2026-05-30:

- Updated `npm run security:ci-hosted:evidence` so future saved hosted GitHub Actions evidence must prove the current API unit-test output: 11 suites / 57 tests.
- Updated fixture-backed `npm run security:ci-hosted:evidence:self-test` coverage to reject stale API test-count evidence while still requiring the full Beta foundation verifier, dependency advisory gate, side-effect health gate, Node 22, `npm ci`, hosted GitHub Actions metadata, and secret-free logs.
- Updated `docs/CI_HOSTED_EVIDENCE.md`, task, QA, roadmap, provider-cost, and handoff docs so the hosted CI evidence contract matches the current verifier output.
- Remaining status: this keeps hosted CI evidence acceptance aligned with the current local suite, but it does not create real hosted CI evidence. External Beta still requires a successful hosted GitHub Actions run saved as evidence, plus real deployed HTTPS staging evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 167 on 2026-05-30:

- Updated `npm run security:ci-hosted:evidence` so future saved hosted GitHub Actions evidence must include `.github/workflows/beta-foundation.yml` and a SHA-256 digest matching the current checked-in workflow file.
- Updated fixture-backed `npm run security:ci-hosted:evidence:self-test` coverage to reject stale workflow-path or workflow-hash proof before hosted CI evidence can be trusted.
- Updated `docs/CI_HOSTED_EVIDENCE.md`, task, QA, roadmap, provider-cost, and handoff docs so the hosted CI evidence contract is tied to the current workflow file as well as the current verifier output.
- Remaining status: this prevents stale or renamed workflow evidence from closing the hosted CI blocker, but it does not create real hosted CI evidence. External Beta still requires a successful hosted GitHub Actions run saved as evidence, plus real deployed HTTPS staging evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 168 on 2026-05-30:

- Updated `npm run security:dependency-risk:evidence` so future clean-audit closeout or owner-approved unresolved-advisory risk acceptance evidence must include SHA-256 proof for the current root lockfile and workspace package manifests.
- Updated fixture-backed `npm run security:dependency-risk:evidence:self-test` coverage to reject stale dependency snapshot source, missing manifest/lockfile entries, unexpected files, and mismatched SHA-256 proof before dependency closeout or risk evidence can be trusted.
- Updated `docs/DEPENDENCY_RISK_EVIDENCE.md`, dependency advisory log, task, QA, roadmap, provider-cost, and handoff docs so dependency risk evidence must be regenerated after package manifest or lockfile changes.
- Remaining status: this prevents stale dependency evidence from closing or accepting the current Next/PostCSS advisory state after dependency drift, but it does not close or risk-accept the advisories. External Beta still requires production audit cleanup or owner-approved risk acceptance, plus real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 169 on 2026-05-30:

- Updated `npm run security:stripe-testmode:evidence` so future real Stripe test-mode evidence must include SHA-256 proof for the current Stripe API, side-effect worker, iOS API-client, environment, app callback, checkout UI, and PaymentSheet presenter files.
- Updated fixture-backed `npm run security:stripe-testmode:evidence:self-test` coverage to reject stale Stripe implementation snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before real Stripe evidence can be trusted.
- Updated `docs/STRIPE_TESTMODE_EVIDENCE.md`, task, QA, roadmap, provider-cost, and handoff docs so Stripe test-mode evidence must be regenerated after payment implementation changes.
- Remaining status: this prevents stale Stripe implementation evidence from closing PaymentIntent, PaymentSheet, signed-webhook, capture, cancellation, refund, or reconciliation blockers after payment code changes, but it does not create real Stripe test-mode evidence. External Beta still requires real Stripe test-mode evidence, real Privy dashboard/app evidence, Console Privy SDK login, deployed staging evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 170 on 2026-05-30:

- Updated `npm run security:privy-mobile-app-config:evidence` so future real Privy mobile app configuration evidence must include SHA-256 proof for the current iOS Privy provider, environment guard, app state, API sync, FanPass/FanPass Ops auth UI, XcodeGen project, generated Info.plists, and checked-in xcconfig placeholders.
- Updated fixture-backed `npm run security:privy-mobile-app-config:evidence:self-test` coverage to reject stale Privy iOS implementation snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before real mobile app config evidence can be trusted.
- Updated `docs/PRIVY_MOBILE_APP_CONFIG_EVIDENCE.md`, task, QA, roadmap, provider-cost, and handoff docs so Privy mobile app config evidence must be regenerated after iOS auth/config boundary changes.
- Remaining status: this prevents stale Privy mobile app configuration evidence from closing real iOS app/client ID blockers after auth/config code changes, but it does not create real Privy dashboard evidence, inject real app/client IDs, or validate TestFlight/staging builds. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 171 on 2026-05-30:

- Updated `npm run security:privy-console-react-sdk:isolation` so future Console React SDK isolation evidence must include SHA-256 proof for the current Console Privy session route, locked SDK-free login form, server API helper, Dashboard/root dependency manifests, Console route contract audit, and provider-boundary audit.
- Updated fixture-backed `npm run security:privy-console-react-sdk:isolation:self-test` coverage to reject stale Console SDK isolation snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before direct or isolated SDK evidence can be trusted.
- Updated `docs/PRIVY_CONSOLE_REACT_SDK_ISOLATION.md`, task, QA, roadmap, provider-cost, and handoff docs so Console SDK isolation evidence must be regenerated after session bridge, login UI, server helper, dependency manifest, or boundary-audit policy changes.
- Remaining status: this prevents stale Console SDK isolation evidence from closing the `@privy-io/react-auth` blocker after Console/session/dependency boundary drift, but it does not install the SDK or implement actual Console SDK login. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 172 on 2026-05-30:

- Updated `npm run security:staff-tenant:staging-evidence` so future production-like tenant/staff staging evidence must include SHA-256 proof for the current API staff invite acceptance, assignment lifecycle, gate enforcement, Console staff assignment proxy/redactor, FanPass Ops linking UI, iOS API client, staff invite policy audit, and Console route contract audit files.
- Updated fixture-backed `npm run security:staff-tenant:staging-evidence:self-test` coverage to reject stale staff tenant staging implementation snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before organizer isolation, one-time invite, or Ops gate-scoping evidence can be trusted.
- Updated `docs/STAFF_TENANT_STAGING_EVIDENCE.md`, task, QA, roadmap, provider-cost, and handoff docs so tenant/staff evidence must be regenerated after staff invite, Console proxy/redaction, Ops linking, gate-enforcement, or staff-policy audit changes.
- Remaining status: this prevents stale tenant/staff staging evidence from closing production staff policy blockers after staff invite, Console, Ops, or gate-enforcement drift, but it does not create real staging tenant/staff evidence. External Beta still requires saved staff tenant staging evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 173 on 2026-05-30:

- Updated `npm run security:ios-staging-build:evidence` so future signed real-device or TestFlight build evidence must include SHA-256 proof for the current iOS project, local/staging/beta/production configs, generated Info.plists, Ops entitlements, app entry, environment guard, wallet/debug-helper boundary, Stripe PaymentSheet presenter/coordinator, Privy auth provider, API client, FanPass Ops shell, and iOS distribution audit files.
- Updated fixture-backed `npm run security:ios-staging-build:evidence:self-test` coverage to reject stale iOS distribution/config implementation snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before signed build, real HTTPS API URL, role-separation, or debug-helper removal evidence can be trusted.
- Updated `docs/IOS_STAGING_BUILD_EVIDENCE.md`, iOS distribution plan, task, QA, roadmap, provider-cost, and handoff docs so iOS build evidence must be regenerated after project, config, app boundary, provider, or distribution-audit changes.
- Remaining status: this prevents stale iOS staging/TestFlight evidence from closing signed-build or real HTTPS API URL blockers after iOS project/config/app-boundary drift, but it does not create signed iOS/TestFlight evidence. External Beta still requires saved iOS staging/TestFlight evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff staging evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 174 on 2026-05-30:

- Updated `npm run security:ops-scanner:device-evidence` so future physical FanPass Ops QR/NFC evidence must include SHA-256 proof for the current iOS project, Ops NFC entitlement, scanner UI, QR camera adapter, Core NFC adapter, iOS API client, FanPass Ops shell, API auth/session boundary, verification controller/service, NFC fixture contract, and iOS/NFC release-boundary audit files.
- Updated fixture-backed `npm run security:ops-scanner:device-evidence:self-test` coverage to reject stale scanner implementation snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before real-device QR, NFC, backend authority, or replay-rejection evidence can be trusted.
- Updated `docs/OPS_SCANNER_DEVICE_EVIDENCE.md`, physical-device QA, task, QA, roadmap, provider-cost, and handoff docs so scanner evidence must be regenerated after scanner UI, QR/NFC transport, API redemption/auth, NFC fixture, or release-boundary audit changes.
- Remaining status: this prevents stale physical scanner evidence from closing real-device QR/NFC blockers after scanner, backend verification, auth, or NFC fixture drift, but it does not create real-device scanner evidence. External Beta still requires physical scanner evidence, saved iOS staging/TestFlight evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff staging evidence, dependency advisory closure or risk acceptance, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 175 on 2026-05-30:

- Updated `npm run security:apple-wallet:evidence` so future signed Apple Wallet `.pkpass` evidence must include SHA-256 proof for the current iOS project, ticket wallet barcode boundary, QR payload model, iOS API client, FanPass Ops scanner compatibility, API signing/redemption boundary, prototype shortcut register, prototype shortcut audit, and iOS distribution audit files.
- Updated fixture-backed `npm run security:apple-wallet:evidence:self-test` coverage to reject stale Wallet implementation snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before signed pass, manifest/signature, physical-device add-to-Wallet, or Ops scan compatibility evidence can be trusted.
- Updated `docs/APPLE_WALLET_PASS_EVIDENCE.md`, physical-device QA, task, QA, roadmap, provider-cost, and handoff docs so Wallet evidence must be regenerated after ticket wallet, QR payload, API signing/redemption, scanner compatibility, or prototype-boundary changes.
- Remaining status: this prevents stale signed-pass evidence from closing the Wallet blocker after wallet, QR payload, API signing, scanner compatibility, or prototype-boundary drift, but it does not create signed `.pkpass` evidence or validate Apple pass signing on a physical iPhone. External Beta still requires signed Wallet evidence, physical scanner evidence, saved iOS staging/TestFlight evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff staging evidence, dependency advisory closure or risk acceptance, hosted CI evidence, and chain custody evidence.

Update after Security Pass 176 on 2026-05-30:

- Updated `npm run security:chain-custody:evidence` so future real-chain custody and contract-control evidence must include SHA-256 proof for the current ownership adapter, production-like testnet guard, durable side-effect outbox, worker, health gate, Prisma outbox schema, chain operator audit, provider boundary audit, settlement idempotency audit, and side-effect verifier files.
- Updated fixture-backed `npm run security:chain-custody:evidence:self-test` coverage to reject stale chain custody implementation snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before vault/KMS or delegated signer, multisig/timelock, durable outbox, or runbook evidence can be trusted.
- Updated `docs/CHAIN_CUSTODY_EVIDENCE.md`, task, QA, roadmap, provider-cost, and handoff docs so chain custody evidence must be regenerated after ownership, outbox, health, production-like guard, or boundary-audit changes.
- Remaining status: this prevents stale chain custody evidence from closing ASR-014 after ownership adapter, outbox, worker, health, schema, or boundary-audit drift, but it does not create real vault/KMS or delegated signer evidence, configure multisig/timelock ownership, or validate a real chain pilot. External Beta still requires saved chain custody evidence, signed Wallet evidence, physical scanner evidence, saved iOS staging/TestFlight evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff staging evidence, dependency advisory closure or risk acceptance, and hosted CI evidence.

Update after Security Pass 177 on 2026-05-30:

- Updated `npm run security:runtime:staging:evidence` so future deployed staging runtime evidence must include SHA-256 proof for the current API bootstrap/header/trust-proxy config, staging environment template, Socket.IO CORS adapter, admin side-effect health API boundary, Console header config, staging runtime checker, staging evidence validator, local dry-run helper, and static header-policy audit files.
- Updated fixture-backed `npm run security:runtime:staging:evidence:self-test` coverage to reject stale staging runtime implementation snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before deployed HTTPS header, trust-proxy, admin-health, or WebSocket evidence can be trusted.
- Updated `docs/DEPLOYMENT_ENVIRONMENTS.md`, task, QA, roadmap, provider-cost, and handoff docs so staging runtime evidence must be regenerated after API/Console headers, production-like config, admin health, WebSocket CORS, staging checker, evidence validator, dry-run helper, or header-policy audit changes.
- Remaining status: this prevents stale deployed staging evidence from closing ASR-011 after runtime/header/config/checker drift, but it does not create real deployed HTTPS API/Console evidence or a real staging admin bearer. External Beta still requires deployed staging evidence, saved chain custody evidence, signed Wallet evidence, physical scanner evidence, saved iOS staging/TestFlight evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, production tenant/staff staging evidence, dependency advisory closure or risk acceptance, and hosted CI evidence.

Update after Security Pass 178 on 2026-05-30:

- Updated `npm run security:privy-plan:evidence` so future Privy dashboard plan evidence must include SHA-256 proof for the current backend Privy token verifier, account sync boundary, Console session bridge, iOS Privy provider, Privy plan evidence validator, webhook optionality audit, and provider-cost/plan evidence policy docs.
- Updated fixture-backed `npm run security:privy-plan:evidence:self-test` coverage to reject stale Privy auth policy snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before mobile SDK, embedded wallet, backend token verification, webhook, custom UI, or MFA/policy plan claims can be trusted.
- Updated `docs/PRIVY_PLAN_EVIDENCE.md`, task, QA, roadmap, provider-cost, and handoff docs so Privy dashboard evidence must be regenerated after auth verification, account sync, Console session, iOS provider, webhook optionality, validator, or plan-policy documentation changes.
- Remaining status: this prevents stale Privy dashboard evidence from closing plan-support blockers after auth or plan-policy drift, but it does not create real Privy dashboard evidence or integrate Console React SDK login. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff staging evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 179 on 2026-05-30:

- Added `npm run security:stripe-dashboard:evidence` so future Stripe dashboard feasibility evidence must prove test-mode dashboard review, test-mode PaymentIntent availability, manual-capture support for `POST /payments/intents`, an HTTPS `POST /payments/webhook` endpoint with signed raw-body verification, required PaymentIntent events, and the current Stripe payment/webhook policy SHA-256 snapshot.
- Added fixture-backed `npm run security:stripe-dashboard:evidence:self-test` coverage that rejects unreviewed dashboard claims, live-mode proof, stale payment/webhook policy snapshot source, missing files, unexpected files, mismatched SHA-256 proof, leaked Stripe/database/deployment credential markers, missing deployment credential redaction proof, incomplete PaymentIntent route proof, incomplete webhook endpoint proof, and missing redaction proof.
- Added `docs/STRIPE_DASHBOARD_EVIDENCE.md` and updated task, QA, roadmap, provider-cost, Stripe test-mode, and handoff docs so Stripe dashboard evidence must be regenerated after payment route, provider, production-like payment config, evidence validator, or provider-cost policy changes.
- Remaining status: this prevents ad hoc or stale dashboard screenshots from closing Stripe provider plan feasibility, but it does not create real Stripe dashboard evidence or validate real test keys, PaymentSheet, signed webhooks, capture, cancellation, refund, or reconciliation. External Beta still requires real Stripe test-mode evidence, real Privy dashboard/app evidence, Console Privy SDK login, deployed staging evidence, production tenant/staff staging evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 180 on 2026-05-30:

- Updated `npm run security:ci-hosted:evidence` so future saved hosted GitHub Actions evidence must include a current hosted CI verifier policy SHA-256 snapshot for the workflow, `.nvmrc`, `.npmrc`, root package manifest and lockfile, composite Beta verifier, CI workflow audit, hosted CI evidence validator/self-test, and CI evidence contract document.
- Updated fixture-backed `npm run security:ci-hosted:evidence:self-test` coverage to reject stale hosted CI verifier policy snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before hosted CI evidence can be trusted.
- Updated `docs/CI_HOSTED_EVIDENCE.md`, task, QA, roadmap, provider-cost, and handoff docs so hosted CI evidence must be regenerated after workflow, Node/npm policy, package lockfile, composite verifier, CI workflow audit, hosted evidence validator, self-test, or evidence-contract changes.
- Remaining status: this prevents stale hosted CI run evidence from closing the hosted CI blocker after verifier or package-policy drift, but it does not create real hosted GitHub Actions evidence. External Beta still requires a successful hosted Node 22 Beta foundation run saved as evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff staging evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 181 on 2026-05-30:

- Updated `npm run security:dependency-risk:evidence` so future clean-audit closeout or owner-approved unresolved-advisory risk acceptance evidence must include SHA-256 proof for the current dependency advisory gate, advisory gate self-test, dependency risk evidence validator/self-test, dependency tooling audit, dependency advisory log, dependency risk evidence contract, and provider-cost feasibility policy.
- Updated fixture-backed `npm run security:dependency-risk:evidence:self-test` coverage to reject stale dependency risk policy snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before clean closeout or owner-approved risk evidence can be trusted.
- Updated `docs/DEPENDENCY_RISK_EVIDENCE.md`, dependency advisory log, task, QA, roadmap, provider-cost, and handoff docs so dependency risk evidence must be regenerated after advisory gate, risk validator, tooling audit, or dependency policy documentation changes.
- Remaining status: this prevents stale dependency risk packets from closing or accepting the Next/PostCSS advisory state after dependency policy drift, but it does not close or risk-accept the current advisories. External Beta still requires production audit cleanup or owner-approved risk acceptance, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 182 on 2026-05-30:

- Added `docs/ALPHA_WALKTHROUGH_RECORDING_EVIDENCE.md` as the saved-evidence contract for closing the human-reviewed Alpha walkthrough recording task.
- Added `npm run alpha:walkthrough:recording:evidence` and fixture-backed `npm run alpha:walkthrough:recording:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the walkthrough evidence audit.
- The validator rejects missing recording artifacts, capture-bundle substitution, stale Alpha walkthrough recording policy snapshot proof, incomplete scene or verification coverage, external-Beta overclaims, provider secret leakage, raw identity and QR payload leakage, production credential use, and weak redaction.
- Remaining status: this makes the recording closeout evidence auditable, but it does not create the actual human-reviewed recording artifact. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 183 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject generic token/cookie JSON fields such as access tokens, refresh tokens, ID tokens, session tokens, bearer tokens, authorization values, cookies, set-cookie values, and CSRF tokens.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject those JSON fields before walkthrough, staging, CI, provider, iOS, scanner, Wallet, or chain evidence bundles are trusted.
- Updated task, QA, roadmap, provider-cost, and handoff docs so saved-evidence redaction coverage includes generic token/cookie JSON fields, not just HTTP header or environment assignment forms.
- Remaining status: this reduces evidence-bundle credential leakage risk but does not create real provider/deployment evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 184 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject serialized secret-bearing HTTP header JSON fields such as `Authorization`, `Set-Cookie`, `X-API-Key`, `Stripe-Signature`, and `Privy-Access-Token`.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject those JSON/header-map fields while still accepting redacted placeholder values such as `Bearer <accessToken>`.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes secret-bearing HTTP header JSON fields, not only raw header lines or camel-case token/cookie fields.
- Remaining status: this reduces evidence-bundle credential leakage risk for serialized provider/staging/CI header captures but does not create real provider/deployment evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 185 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject secret-bearing URL fragment parameters such as `#access_token=...`, `#id_token=...`, and related OAuth-style token fragments that can appear in browser redirect captures.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject real-looking URL fragment token values while still accepting redacted fragment placeholders such as `#access_token=<redacted>`.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes URL fragment parameters as well as query parameters.
- Remaining status: this reduces evidence-bundle credential leakage risk for browser redirect screenshots/logs, but it does not create real provider/deployment evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 186 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject secret-bearing snake_case JSON fields such as `access_token`, `refresh_token`, `id_token`, `client_secret`, `api_key`, `provider_api_key`, `webhook_secret`, and `signing_secret`.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject real-looking snake_case provider/OAuth token fields while still accepting redacted placeholder values such as `<redacted>`.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes snake_case JSON fields as well as camel-case token fields and URL/header forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for provider dashboard exports, OAuth captures, and staging/CI JSON evidence, but it does not create real provider/deployment evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 187 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject generic token and API-key assignment lines such as `ACCESS_TOKEN=...`, `REFRESH_TOKEN=...`, `ID_TOKEN=...`, `SESSION_TOKEN=...`, `AUTH_TOKEN=...`, `BEARER_TOKEN=...`, `CSRF_TOKEN=...`, and `API_KEY=...`.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject those assignment forms while still accepting redacted placeholders such as `ACCESS_TOKEN=<redacted>`.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes generic token/API-key assignments as well as JSON, header, URL, and provider-specific forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for CLI exports, copied environment snippets, provider setup logs, and CI/staging captures, but it does not create real provider/deployment evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 188 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject secret-bearing YAML/plain colon fields such as `access_token: ...`, `refresh_token: ...`, `id_token: ...`, `client_secret: ...`, `api_key: ...`, `provider_api_key: ...`, `webhook_secret: ...`, and `signing_secret: ...`.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject those YAML/colon forms while still accepting redacted placeholders such as `access_token: <redacted>` and `refresh_token: "<redacted>"`.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes secret-bearing YAML/colon fields as well as assignments, JSON, header, URL, and provider-specific forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for provider dashboard exports, copied YAML snippets, CI artifacts, and staging/provider config captures, but it does not create real provider/deployment evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 189 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject environment-style YAML/plain colon fields such as `ACCESS_TOKEN: ...`, `API_KEY: ...`, `PRIVY_ACCESS_TOKEN: ...`, `PROVIDER_API_KEY: ...`, `AWS_SECRET_ACCESS_KEY: ...`, `VERCEL_TOKEN: ...`, and `CLOUDFLARE_API_TOKEN: ...`.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject those env-style YAML/colon forms while still accepting redacted placeholders such as `ACCESS_TOKEN: <redacted>` and `API_KEY: "<redacted>"`.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes environment-style secret YAML/colon fields as well as snake_case colon fields, assignments, JSON, header, URL, and provider-specific forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for copied provider exports, CI env maps, deployment setup snippets, and staging/admin token captures, but it does not create real provider/deployment evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 190 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject split environment YAML fields where a secret-bearing `name:` or `key:` such as `ACCESS_TOKEN`, `api_key`, `VERCEL_TOKEN`, or `AWS_SECRET_ACCESS_KEY` is followed by a real-looking `value: ...` on a nearby line.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject copied provider, CI, Kubernetes-style, and deployment environment lists while still accepting redacted placeholders such as `value: <redacted>` and `value: "<redacted>"`.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes environment name/value YAML secret fields as well as env-style colon fields, snake_case colon fields, assignments, JSON, header, URL, and provider-specific forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for Kubernetes-style env lists, CI env arrays, and provider/deployment setup exports, but it does not create real provider/deployment evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 191 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject JSON environment arrays/objects where a secret-bearing `name` or `key` such as `ACCESS_TOKEN`, `api_key`, `VERCEL_TOKEN`, or `AWS_SECRET_ACCESS_KEY` is paired with a real-looking `value`.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject copied provider, CI, Kubernetes-style, and deployment environment JSON exports while still accepting redacted placeholders such as `{ "name": "ACCESS_TOKEN", "value": "<redacted>" }`.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes environment name/value JSON secret fields as well as name/value YAML fields, env-style colon fields, snake_case colon fields, assignments, JSON, header, URL, and provider-specific forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for serialized CI/deployment env arrays and provider setup JSON, but it does not create real provider/deployment evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 192 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject quoted `.env`/shell-style secret assignments such as `ACCESS_TOKEN="..."`, `API_KEY='...'`, `PROVIDER_API_KEY="..."`, `AWS_SECRET_ACCESS_KEY='...'`, `VERCEL_TOKEN="..."`, and `SESSION_SIGNING_SECRET="..."`.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject quoted provider, CI, deployment, OAuth, and app-session secret exports while still accepting redacted placeholders such as `ACCESS_TOKEN="<redacted>"` and `API_KEY='<redacted>'`.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes quoted secret assignments as well as unquoted assignments, environment name/value fields, JSON, YAML, header, URL, and provider-specific forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for copied `.env`, shell export, CI, and deployment snippets, but it does not create real provider/deployment evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 193 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject quoted prefixed app/session/client/webhook secret assignments such as `FANPASS_SESSION_SIGNING_SECRET="..."`, `FANPASS_CONSOLE_CLIENT_SECRET='...'`, `NEXTAUTH_SECRET="..."`, `FANPASS_COOKIE_SECRET='...'`, `FANPASS_ENCRYPTION_KEY="..."`, and `APPLE_PASS_SIGNING_SECRET='...'`.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject quoted prefixed app-secret exports while still accepting redacted placeholders such as `FANPASS_SESSION_SECRET="<redacted>"` and `NEXTAUTH_SECRET='<redacted>'`.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes quoted prefixed app secret assignments as well as quoted exact-name assignments, unquoted assignments, environment name/value fields, JSON, YAML, header, URL, and provider-specific forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for copied auth, app-session, cookie, encryption, signing, and provider-adjacent secret snippets, but it does not create real provider/deployment evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 194 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject snake_case `.env`/shell-style secret assignments such as `access_token=...`, `refresh_token="..."`, `id_token='...'`, `chain_api_key=...`, `rpc_api_key="..."`, `client_secret=...`, `webhook_secret=...`, and `signing_secret='...'`.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject copied snake_case provider, OAuth, chain-provider, webhook, and signing secret exports while still accepting redacted placeholders such as `access_token=<redacted>`, `refresh_token="<redacted>"`, `chain_api_key='<redacted>'`, and `rpc_api_key=<redacted>`.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes snake_case secret assignments as well as quoted exact-name and prefixed assignments, environment name/value fields, JSON, YAML, header, URL, and provider-specific forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for copied provider/OAuth `.env` exports and chain-provider setup snippets, but it does not create real provider/deployment evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 195 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject package-manager registry auth-token snippets such as `NPM_TOKEN=...`, `NODE_AUTH_TOKEN="..."`, `YARN_NPM_AUTH_TOKEN='...'`, `.npmrc` `//registry.npmjs.org/:_authToken=...`, bare `_authToken=...`, Yarn `npmAuthToken: ...`, and JSON `npmAuthToken` fields.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject copied CI/package-registry auth snippets while still accepting redacted placeholders such as `NPM_TOKEN=<redacted>`, `NODE_AUTH_TOKEN="<redacted>"`, `//registry.npmjs.org/:_authToken=<redacted>`, and `npmAuthToken: <redacted>`.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes npm registry auth tokens as well as provider, deployment, Stripe, Privy, app-secret, assignment, JSON, YAML, header, URL, and identity forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for hosted CI, dependency, and package-manager setup evidence, but it does not create real hosted CI evidence or close dependency/provider/deployment blockers. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 196 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw source-control access token literals such as GitHub classic tokens (`ghp_...`, `ghs_...`), GitHub fine-grained tokens (`github_pat_...`), and GitLab personal access tokens (`glpat-...`) even when copied into CI/deployment evidence without assignment syntax.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject copied GitHub and GitLab token literals while still accepting redacted source-control token placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes source-control access token literals as well as npm registry auth tokens, provider, deployment, Stripe, Privy, app-secret, assignment, JSON, YAML, header, URL, and identity forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for hosted CI, dependency, deployment, and source-control setup evidence, but it does not create real hosted CI evidence or close dependency/provider/deployment blockers. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 197 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject copied Slack, Discord, and Microsoft Teams webhook URLs even when they appear as raw CI/deployment notification targets rather than named token assignments.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject chat/notification webhook URLs while still accepting redacted webhook placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes chat/notification webhook URLs as well as source-control token literals, npm registry auth tokens, provider, deployment, Stripe, Privy, app-secret, assignment, JSON, YAML, header, URL, and identity forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for hosted CI, deployment alerting, and provider notification setup evidence, but it does not create real hosted CI, provider, or deployed staging evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 198 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject copied observability credentials such as Sentry auth tokens, Datadog API keys, Honeycomb API keys, New Relic license/API keys, Logtail source tokens, and Axiom tokens when they appear in CI/deployment evidence exports.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject observability service credential assignments while still accepting redacted monitoring-token placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes observability service credential assignments as well as chat/notification webhook URLs, source-control token literals, npm registry auth tokens, provider, deployment, Stripe, Privy, app-secret, assignment, JSON, YAML, header, URL, and identity forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for hosted CI, deployed staging, and monitoring setup evidence, but it does not create real hosted CI, provider, or deployed staging evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 199 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject copied Apple/App Store automation credentials such as App Store Connect API keys, App Store Connect private-key exports, ASC API keys, Fastlane sessions, Match passwords, Match Git basic auth, and P8 private-key assignments when they appear in iOS/TestFlight evidence exports.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject Apple/App Store automation credential assignments while still accepting redacted signing/distribution automation placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes Apple/App Store automation credential assignments as well as observability credentials, chat/notification webhook URLs, source-control token literals, npm registry auth tokens, provider, deployment, Stripe, Privy, app-secret, assignment, JSON, YAML, header, URL, and identity forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for signed iOS, TestFlight, and App Store Connect automation evidence, but it does not create real iOS/TestFlight, Apple signing, provider, or deployed staging evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 200 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject copied raw cloud credential literals such as AWS access key IDs and Google API keys even when CI, deployment, or provider evidence does not include assignment syntax.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject raw cloud credential literals while still accepting redacted cloud credential placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes raw cloud credential literals as well as deployment/cloud credential assignments, fields, and JSON environment-map forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for CI, deployment, provider dashboard, and staging captures, but it does not create real hosted CI, deployed staging, provider, or cloud evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 201 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject copied Azure Storage connection strings and shared access signature fragments when they appear in CI, deployment, or provider evidence exports.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject Azure storage credential literals while still accepting redacted Azure storage placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes Docker/OCI registry credential literals, encoded Docker/OCI registry credential literals, Azure storage credential literals, and raw AWS and Google cloud credential literals.
- Remaining status: this reduces evidence-bundle credential leakage risk for cloud deployment, object-storage, hosted CI, and provider setup captures, but it does not create real hosted CI, deployed staging, provider, or cloud evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 202 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject copied Docker/OCI registry credentials, including `DOCKER_AUTH_CONFIG` auth maps and `docker login --password` or `--password-stdin` command captures.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject Docker/OCI registry credential literals while still accepting redacted registry-auth placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes Docker/OCI registry credential literals as well as Azure storage and raw cloud credential literals.
- Remaining status: this reduces evidence-bundle credential leakage risk for hosted CI, container registry, deployment, and provider setup captures, but it does not create real hosted CI, deployed staging, provider, container registry, or cloud evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 203 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject encoded Docker/OCI registry credentials, including Kubernetes `.dockerconfigjson` secret data and base64 registry auth config assignments.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject encoded Docker/OCI registry credential literals while still accepting redacted encoded-registry placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes encoded Docker/OCI registry credential literals as well as visible Docker/OCI registry credential literals, Azure storage credential literals, and raw cloud credential literals.
- Remaining status: this reduces evidence-bundle credential leakage risk for Kubernetes, hosted CI, container registry, deployment, and provider setup captures, but it does not create real hosted CI, deployed staging, provider, container registry, Kubernetes, or cloud evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 204 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject cloud storage and CDN signed URL credential parameters for AWS S3, Google Cloud Storage, and CloudFront evidence exports.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject copied `X-Amz-*`, `X-Goog-*`, and CloudFront policy/key-pair signed URL snippets while still accepting redacted signed URL placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes cloud storage signed URL credential parameters as well as encoded Docker/OCI registry credential literals, visible Docker/OCI registry credential literals, Azure storage credential literals, and raw cloud credential literals.
- Remaining status: this reduces evidence-bundle credential leakage risk for object storage/CDN artifact captures, but it does not create real hosted CI, deployed staging, provider, storage, CDN, or cloud evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 205 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject encoded deployment private key and service-account key material such as base64 SSH deploy keys, deployment private keys, TLS/signing keys, and Google service-account JSON/key exports.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject copied `SSH_PRIVATE_KEY_BASE64`, `DEPLOY_PRIVATE_KEY_BASE64`, `GCP_SERVICE_ACCOUNT_KEY_BASE64`, and `serviceAccountJsonBase64` snippets while still accepting redacted encoded-key placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes encoded deployment private key credential literals as well as cloud storage signed URL credential parameters, encoded Docker/OCI registry credential literals, visible Docker/OCI registry credential literals, Azure storage credential literals, and raw cloud credential literals.
- Remaining status: this reduces evidence-bundle credential leakage risk for deployment, service-account, CI, and cloud setup captures, but it does not create real hosted CI, deployed staging, provider, cloud, or KMS/custody evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 206 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject Kubernetes kubeconfig credential exports such as base64 kubeconfig environment values, `client-key-data`, `client-certificate-data`, and JSON kubeconfig fields.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject copied `KUBECONFIG_BASE64`, `KUBE_CONFIG_DATA`, `client-key-data`, `client-certificate-data`, and `kubernetesConfigBase64` snippets while still accepting redacted kubeconfig placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes Kubernetes kubeconfig credential literals as well as encoded deployment private key credential literals, cloud storage signed URL credential parameters, encoded Docker/OCI registry credential literals, visible Docker/OCI registry credential literals, Azure storage credential literals, and raw cloud credential literals.
- Remaining status: this reduces evidence-bundle credential leakage risk for Kubernetes, deployment, hosted CI, and cloud setup captures, but it does not create real hosted CI, deployed staging, provider, Kubernetes, cloud, or KMS/custody evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 207 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject lowercase deployment and cloud credential assignments common in `.aws/credentials`, Terraform variables, YAML, and CLI output, including `aws_secret_access_key`, `aws_session_token`, `cloudflare_api_token`, `netlify_auth_token`, and `vercel_token`.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject copied lowercase AWS, Cloudflare, Netlify, and Vercel credential snippets while still accepting redacted lowercase deployment/cloud credential placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes lowercase deployment/cloud credential assignments alongside uppercase assignment, JSON field, environment-map, raw cloud credential, cloud storage signed URL, encoded private-key, Kubernetes kubeconfig, and Docker/OCI credential forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for deployment, hosted CI, provider, Terraform/IaC, and cloud setup captures, but it does not create real hosted CI, deployed staging, provider dashboard, cloud, Kubernetes, or KMS/custody evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 208 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject Terraform/Pulumi-style sensitive output values when copied from state, plan, or CLI JSON evidence with `sensitive`, `secret`, or `secure` flags.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject plaintext Terraform and Pulumi sensitive output values while still accepting redacted IaC sensitive output placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes IaC sensitive output values alongside deployment/cloud credential assignments, raw cloud credentials, signed URLs, encoded private keys, Kubernetes kubeconfig material, and Docker/OCI credentials.
- Remaining status: this reduces evidence-bundle credential leakage risk for deployment, hosted CI, provider, Terraform/IaC, and cloud setup captures, but it does not create real hosted CI, deployed staging, provider dashboard, cloud, Kubernetes, or KMS/custody evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 209 on 2026-05-30:

- Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
- Updated fixture-backed `npm run security:evidence-redaction:self-test` coverage to reject copied GitHub/Azure masking command values while still accepting redacted CI masking placeholders.
- Updated task, QA, roadmap, provider-cost, walkthrough evidence, and handoff docs so saved-evidence redaction coverage includes CI secret masking command literals alongside source-control tokens, chat webhooks, observability credentials, deployment credentials, IaC sensitive outputs, and other generated evidence leak forms.
- Remaining status: this reduces evidence-bundle credential leakage risk for hosted CI, deployment, provider, and cloud setup captures, but it does not create real hosted CI, deployed staging, provider dashboard, cloud, Kubernetes, or KMS/custody evidence. External Beta still requires the walkthrough recording, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight evidence, physical scanner evidence, signed Wallet evidence, hosted CI evidence, and chain custody evidence.

Update after Security Pass 210 on 2026-05-30:

- Updated `npm run security:ci-hosted:evidence` so saved hosted GitHub Actions evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
- Required hosted CI evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before a future hosted run can close the CI blocker.
- Updated fixture-backed `npm run security:ci-hosted:evidence:self-test` coverage to reject copied GitHub/Azure masking command values and missing masking-command redaction proof.
- Updated CI evidence, task, QA, roadmap, provider-cost, and handoff docs so hosted CI evidence coverage includes CI secret masking command literals alongside provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, bearer tokens, and private keys.
- Remaining status: this strengthens the saved hosted CI evidence contract before real CI evidence is trusted, but it does not run GitHub Actions or close the hosted CI blocker. External Beta still requires saved hosted CI evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 211 on 2026-05-30:

- Updated `npm run security:dependency-risk:evidence` so saved dependency clean-closeout or unresolved-advisory risk-acceptance packets reject CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
- Required dependency-risk evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before a future owner risk packet can be trusted.
- Updated fixture-backed `npm run security:dependency-risk:evidence:self-test` coverage to reject copied GitHub/Azure masking command values and missing masking-command redaction proof.
- Updated dependency risk evidence, task, QA, roadmap, provider-cost, and handoff docs so dependency-risk evidence coverage includes CI secret masking command literals alongside provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, bearer tokens, and private keys.
- Remaining status: this strengthens the saved dependency-risk evidence contract before any unresolved advisory risk can be accepted, but it does not close or risk-accept the current Next/PostCSS advisories. External Beta still requires dependency advisory closure or owner-approved risk acceptance, plus saved hosted CI evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, deployed staging evidence, production tenant/staff evidence, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 212 on 2026-05-30:

- Updated `npm run security:runtime:staging:evidence` so saved deployed staging runtime evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
- Required staging runtime evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future deployed HTTPS header/config evidence can be trusted.
- Updated fixture-backed `npm run security:runtime:staging:evidence:self-test` coverage to reject copied GitHub/Azure masking command values and missing masking-command redaction proof.
- Updated staging runtime evidence, deployment, task, QA, roadmap, provider-cost, and handoff docs so deployed staging evidence coverage includes CI secret masking command literals alongside provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, bearer tokens, and private keys.
- Remaining status: this strengthens the saved deployed staging evidence contract before real staging header/config checks are trusted, but it does not provision or verify deployed staging. External Beta still requires deployed staging evidence, saved hosted CI evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, iOS/TestFlight evidence, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 213 on 2026-05-30:

- Updated `npm run security:ios-staging-build:evidence` so saved signed iOS staging/TestFlight build evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
- Required iOS staging/TestFlight build evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future signed build evidence can be trusted.
- Updated fixture-backed `npm run security:ios-staging-build:evidence:self-test` coverage to reject copied GitHub/Azure masking command values and missing masking-command redaction proof.
- Updated iOS staging build evidence, task, QA, roadmap, provider-cost, distribution, and handoff docs so signed build evidence coverage includes CI secret masking command literals alongside provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, bearer tokens, signing material, and device identifiers.
- Remaining status: this strengthens the saved iOS staging/TestFlight evidence contract before real signed build evidence is trusted, but it does not create signed device/TestFlight evidence or close the iOS staging API URL blocker. External Beta still requires iOS/TestFlight evidence, deployed staging evidence, saved hosted CI evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, production tenant/staff evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 214 on 2026-05-30:

- Updated `npm run security:staff-tenant:staging-evidence` so saved production-like tenant/staff staging evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
- Required staff tenant staging evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future organizer-isolation, one-time invite, or Ops gate-scoping evidence can be trusted.
- Updated fixture-backed `npm run security:staff-tenant:staging-evidence:self-test` coverage to reject copied CI masking command values and missing masking-command redaction proof.
- Updated staff tenant evidence, task, QA, roadmap, provider-cost, and handoff docs so production tenant/staff evidence coverage includes CI secret masking command literals alongside provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, bearer tokens, Privy tokens, invite tokens, and identity fields.
- Remaining status: this strengthens the saved production tenant/staff evidence contract before real staging tenant proof is trusted, but it does not create that staging evidence or close the production tenant/staff blocker. External Beta still requires saved staff tenant staging evidence, iOS/TestFlight evidence, deployed staging evidence, saved hosted CI evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 215 on 2026-05-30:

- Updated `npm run security:stripe-testmode:evidence` so saved real Stripe test-mode evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
- Required Stripe test-mode evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future PaymentIntent, PaymentSheet, signed-webhook, capture, cancellation, refund, or reconciliation evidence can be trusted.
- Updated fixture-backed `npm run security:stripe-testmode:evidence:self-test` coverage to reject copied CI masking command values and missing masking-command redaction proof.
- Updated Stripe test-mode evidence, task, QA, roadmap, provider-cost, and handoff docs so real Stripe evidence coverage includes CI secret masking command literals alongside Stripe secrets, publishable keys, client secrets, provider secrets, deployment/cloud credentials, database URLs, bearer tokens, and real personal data.
- Remaining status: this strengthens the saved real Stripe test-mode evidence contract before payment evidence is trusted, but it does not run real Stripe test keys or close the Stripe blocker. External Beta still requires real Stripe test-mode evidence, saved staff tenant staging evidence, iOS/TestFlight evidence, deployed staging evidence, saved hosted CI evidence, real Privy dashboard/app evidence, Console Privy SDK login, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 216 on 2026-05-30:

- Updated `npm run security:stripe-dashboard:evidence` so saved Stripe dashboard feasibility evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
- Required Stripe dashboard evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future dashboard PaymentIntent and webhook setup evidence can be trusted.
- Updated fixture-backed `npm run security:stripe-dashboard:evidence:self-test` coverage to reject copied CI masking command values and missing masking-command redaction proof.
- Updated Stripe dashboard evidence, task, QA, roadmap, provider-cost, and handoff docs so dashboard feasibility evidence coverage includes CI secret masking command literals alongside Stripe secrets, publishable keys, client secrets, provider secrets, deployment/cloud credentials, database URLs, production credentials, and real personal data.
- Remaining status: this strengthens the saved Stripe dashboard feasibility evidence contract before provider plan evidence is trusted, but it does not create real Stripe dashboard evidence or validate real test keys, PaymentSheet, signed webhooks, capture, cancellation, refund, or reconciliation. External Beta still requires real Stripe test-mode evidence, saved staff tenant staging evidence, iOS/TestFlight evidence, deployed staging evidence, saved hosted CI evidence, real Privy dashboard/app evidence, Console Privy SDK login, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 217 on 2026-05-30:

- Updated `npm run security:privy-plan:evidence` so saved Privy dashboard plan evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
- Required Privy plan evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future dashboard plan-support evidence can be trusted.
- Updated fixture-backed `npm run security:privy-plan:evidence:self-test` coverage to reject copied CI masking command values and missing masking-command redaction proof.
- Updated Privy plan evidence, task, QA, roadmap, provider-cost, and handoff docs so dashboard plan evidence coverage includes CI secret masking command literals alongside Privy secrets, access tokens, provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, production credentials, and real personal data.
- Remaining status: this strengthens the saved Privy dashboard evidence contract before provider plan evidence is trusted, but it does not create real Privy dashboard evidence or close mobile SDK, embedded wallet, backend token verification, webhook, custom UI, MFA/policy, or Console React SDK blockers. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, saved staff tenant staging evidence, iOS/TestFlight evidence, deployed staging evidence, saved hosted CI evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 218 on 2026-05-30:

- Updated `npm run security:privy-mobile-app-config:evidence` so saved native Privy app/client ID evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
- Required Privy mobile app config evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future real iOS app/client ID evidence can be trusted.
- Updated fixture-backed `npm run security:privy-mobile-app-config:evidence:self-test` coverage to reject copied CI masking command values and missing masking-command redaction proof.
- Updated Privy mobile app config evidence, task, QA, roadmap, provider-cost, iOS distribution, and handoff docs so real native Privy app config evidence coverage includes CI secret masking command literals alongside Privy secrets, access tokens, provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, production credentials, and real personal data.
- Remaining status: this strengthens the saved Privy mobile app config evidence contract before real iOS app/client IDs are trusted, but it does not create real Privy dashboard/app evidence, inject non-placeholder app/client IDs, validate TestFlight/staging builds, or close Console React SDK blockers. External Beta still requires real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, saved staff tenant staging evidence, iOS/TestFlight evidence, deployed staging evidence, saved hosted CI evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, and chain custody evidence.

Update after Security Pass 219 on 2026-05-30:

- Updated `npm run security:chain-custody:evidence` so saved real-chain custody and contract-control evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
- Required chain custody evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future vault/KMS or delegated signer custody evidence can be trusted.
- Updated fixture-backed `npm run security:chain-custody:evidence:self-test` coverage to reject copied CI masking command values and missing masking-command redaction proof.
- Updated chain custody evidence, task, QA, roadmap, provider-cost, and handoff docs so real-chain custody evidence coverage includes CI secret masking command literals alongside private keys, seed phrases, provider secrets, provider RPC URLs, deployment/cloud credentials, database URLs, Stripe publishable keys, and real user data.
- Remaining status: this strengthens the saved chain custody evidence contract before real testnet/pilot chain evidence is trusted, but it does not provision vault/KMS or delegated signer custody, transfer contract ownership to multisig/timelock, run real chain side effects, or close ASR-014. External Beta still requires chain custody evidence, real Privy dashboard/app evidence, Console Privy SDK login, real Stripe test-mode evidence, saved staff tenant staging evidence, iOS/TestFlight evidence, deployed staging evidence, saved hosted CI evidence, dependency advisory closure or risk acceptance, physical scanner evidence, signed Wallet evidence, and the human-reviewed walkthrough recording.

Update after Stripe Backend Test-Mode Verification on 2026-05-30:

- Verified the backend Stripe test-mode path with Stripe CLI and signed webhook forwarding to the local FanPass API.
- Exercised manual PaymentIntent authorization, payment-authorized order matching, worker capture, admin refund, admin authorization cancellation, reconciliation, and side-effect outbox health using local-only demo records.
- Fixed the Stripe SDK import path used by the current NestJS/ts-node runtime so real Stripe provider construction works outside the mock adapter path.
- The verification did not include real personal data, production credentials, live-mode Stripe calls, or checked-in secret material.
- Remaining status: backend capture/refund/cancellation/reconciliation risk is reduced, but the Stripe release blocker remains open until native FanPass iOS PaymentSheet evidence and HTTPS Stripe Dashboard webhook endpoint evidence are saved without secrets and pass the dedicated validators. Rotate the exposed test secret before collecting clean release evidence.

Update after Privy Local Config Check Gate on 2026-05-30:

- Added a secret-safe local Privy configuration check for the real developer machine setup.
- The check verifies that the local API env file is ignored by source control, the Privy app id is configured, the Privy verification key is a parseable PEM public key, the iOS app client id is injected outside source control, checked-in iOS configs keep blank public placeholders, and both native bundle ids remain covered by the XcodeGen project.
- Added fixture-backed self-test coverage for accepted local config, non-PEM key rejection, checked-in iOS client id rejection, and missing local client id injection rejection.
- Wired only the fixture self-test into the composite Beta foundation verifier so CI/local full verification does not require or read real Privy key material.
- Ran the real local check against the current local configuration without printing secrets.
- Tightened the verification-service production-like QR signing test so inherited local `QR_SIGNING_SECRET` values cannot mask the missing-secret fail-fast assertion.
- Re-ran the full `npm run beta:foundation:verify` gate successfully after the Privy local config check and test isolation fix.
- Remaining status: this reduces local configuration drift before real Privy login testing, but it does not close Privy dashboard plan evidence, saved mobile app config evidence, real iOS OTP login evidence, Console React SDK login, or staging tenant/staff policy evidence.

Update after Privy Local iOS Build Setting Injection Gate on 2026-05-30:

- Tightened the secret-safe local Privy configuration check so local iOS OTP readiness requires both `FANPASS_PRIVY_APP_ID` and `FANPASS_PRIVY_APP_CLIENT_ID` to be injected through the shell instead of checked-in xcconfig files.
- The check now proves the iOS app id matches the API `PRIVY_APP_ID`, keeps checked-in placeholders blank, and reports only redacted booleans/build-setting names.
- Added fixture-backed self-test coverage for mismatched iOS app id injection and missing local iOS app id injection.
- Ran the real local check against the current local configuration without printing verification keys, access tokens, or provider secrets.
- Remaining status: this reduces local signed-build/OTP configuration drift, but it does not create real Privy dashboard evidence, validate native OTP login on device, approve Console React SDK integration, or close staging tenant/staff evidence.

Update after Privy Evidence Draft Helper on 2026-05-30:

- Added a secret-free Privy evidence draft helper that emits current SHA-256 snapshots for the Privy plan, mobile app config, and Console React SDK isolation evidence contracts.
- Added fixture-backed self-test coverage proving the helper keeps drafts non-passing, includes the expected snapshot sources and file counts, and does not print obvious token, key, Stripe, or database markers.
- Wired the helper self-test into `npm run beta:foundation:verify` so stale or malformed draft generation cannot silently drift before real Dashboard evidence is collected.
- Updated Privy evidence, task, QA, roadmap, and handoff docs so drafts are treated only as capture aids; completed evidence still requires real dashboard/build/dependency facts and the matching validator.
- Remaining status: this reduces evidence preparation errors, but it does not create real Privy dashboard evidence, validate native OTP login, approve Console React SDK integration, or close staging tenant/staff policy evidence.

Update after Privy Ops SDK-First Staff Linking Gate on 2026-05-30:

- Tightened FanPass Ops staff invite linking so the normal app path now depends on the Privy Swift SDK email OTP result before enabling invite linking.
- Kept the manual Privy access-token field as a local debug helper only by guarding it with `#if DEBUG`.
- Updated `npm run security:staff-invite-policy` and fixture-backed self-test coverage so the audit requires the Ops SDK OTP token path and rejects manual Privy token entry outside debug builds.
- Verification passed for `npm run security:staff-invite-policy:self-test`, `npm run security:staff-invite-policy`, `npm run security:provider-boundaries`, `npm run security:ios-distribution-boundaries:self-test`, `npm run security:ios-distribution-boundaries`, and `npm run security:privy-mobile-app-config:evidence:self-test`.
- Remaining status: this reduces the FanPass Ops real-login gap, but it does not create real Privy dashboard evidence, prove signed/staging-device OTP login, approve Console React SDK integration, or close production tenant/staff staging evidence.

Update after Privy Dev App Dashboard Evidence Capture on 2026-05-30:

- Saved redacted Privy Dev app dashboard evidence at `outputs/privy-plan/privy-plan-20260530.json` and mobile client configuration evidence at `outputs/privy-mobile-app-config/privy-mobile-20260530.json`.
- The plan evidence records dashboard review of the current Development app state, mobile SDK support, embedded-wallet support, backend access-token verification support, custom auth UI support, and keeps webhooks plus MFA/policy controls `plan-gated` instead of making them hard Beta dependencies.
- The mobile evidence records the native client configuration for `FanPass` (`com.fanpass.app`) and `FanPass Ops` (`com.fanpass.ops`), public app/client ID setup, placeholder-only checked-in xcconfigs, outside-source-control injection, and redaction of app secrets, verification keys, access tokens, provider secrets, deployment/cloud credentials, CI masking command literals, Stripe publishable keys, database URLs, and user identifiers.
- Verification passed for `npm run security:privy-plan:evidence -- outputs/privy-plan/privy-plan-20260530.json`, `npm run security:privy-mobile-app-config:evidence -- outputs/privy-mobile-app-config/privy-mobile-20260530.json`, and `npm run security:evidence-redaction -- outputs/privy-plan outputs/privy-mobile-app-config`.
- Remaining status: this closes the saved Dev app dashboard/mobile config evidence gap for the current local Beta foundation, but public/TestFlight Beta still needs real FanPass/FanPass Ops OTP execution on signed/staging-style builds, Console React SDK login or accepted isolation integration, production tenant/staff staging evidence, deployed HTTPS staging evidence, and the remaining Stripe/iOS/Wallet/scanner/chain/CI/dependency blockers.

Update after Free Render/Vercel HTTPS Staging Runtime Check on 2026-05-31:

- Render API is live at `https://fanpass-api-staging.onrender.com`, Vercel Console is live at `https://fanpass-dashboard.vercel.app`, and Render CORS is allowlisted to the Vercel Console origin.
- Fixed the Vercel dashboard package Node engine pin so the Vercel build uses Node 22 instead of Node 24.
- Fixed the staging runtime checker JSON output so it emits the implementation snapshot and CI secret-masking redaction proof expected by the evidence validator.
- `npm run security:runtime:staging` passed against the real HTTPS API and Console URLs with `STAGING_API_TRUST_PROXY_HOPS=1`, covering security headers, absent powered-by headers, disabled demo session issuance, unauthenticated admin health rejection, locked/sign-in Console rendering, and orderbook WebSocket allowed/disallowed-origin behavior.
- Saved deployed runtime output at `outputs/staging-runtime/20260530T180132Z-render-vercel.json`; this file is ignored by git.
- Follow-up on 2026-05-31: FanPass Ops ran in the iOS simulator with the staging API and Privy app/client configuration, completed Privy email OTP login, and copied the resulting access token through the simulator pasteboard without printing it. The corresponding synthetic staging user was promoted to `ADMIN` in Neon, then `npm run security:runtime:staging` and `npm run security:runtime:staging:evidence -- outputs/staging-runtime/20260530T185440Z-render-vercel-admin.json` passed against the real Render/Vercel HTTPS deployment with redacted orderbook subscription-target evidence. The deployed staging evidence gate is closed for ASR-011 free-path runtime hardening.

Beta cannot be considered security-ready until all of these are complete:

1. Real product authentication UX and session validation are implemented across all surfaces.
2. Role-based authorization guards protect every API endpoint.
3. Client-provided `userId`, `scannerUserId`, and role values are replaced by server-verified session claims.
4. Console is protected by organizer/admin auth.
5. CORS is allowlisted.
6. QR signing secret is mandatory outside local development.
7. Data responses are privacy-scoped and redacted by default.
8. Order settlement and redemption are idempotent and concurrency-safe.
9. Payment authorization, capture, refund, and webhook reconciliation are idempotent and verified with Stripe test mode before real money is used; backend CLI verification exists, but native PaymentSheet and HTTPS dashboard evidence are still required before public Beta.
10. Provider plan assumptions are verified in the actual Stripe/Privy dashboards before features become Beta blockers.
11. Production dependencies are patched or explicitly risk-accepted.
12. Security headers are configured and verified at runtime.
13. Prototype/debug endpoints are disabled outside local development.
14. Real-device iOS builds use HTTPS and environment-specific config.

## Recommended Next Work Order

1. Integrate Privy SDK login flows in FanPass, FanPass Ops, and FanPass Console.
2. Verify Privy dashboard plan support for mobile SDK, embedded wallets, token verification, custom UI, MFA/policy controls, and webhooks. Keep webhooks optional until confirmed.
3. Add client-side Stripe test-mode payment UI and then implement capture/refund/reconciliation sequencing.
4. Harden order settlement with payment-aware idempotency and transaction constraints.
5. Add production-grade staff invitation/linking policy for Console and FanPass Ops.
6. Re-review route coverage for role guards, ownership checks, event-scoped organizer access, and gate assignment access.
7. Patch dependency advisories and pin Node 22 LTS.
8. Verify security headers, config validation, CORS, and rate limits in a deployed staging environment.
9. Run a second security review before external Beta testing.
