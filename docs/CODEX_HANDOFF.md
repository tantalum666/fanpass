# Codex Handoff

Last updated: 2026-07-17 (Asia/Shanghai).

## Start Protocol

For a normal new work turn:

1. Read this file first in full.
2. Enumerate and read every Markdown file in the workspace, including hidden/ignored/generated Markdown, excluding `.git`.
3. Re-read task-specific source contracts from `docs/README.md`.

After automatic context compaction or a mid-turn resume:

1. Read this file first.
2. Read only non-ignored Markdown returned by `rg --files -g '*.md'`.
3. Continue from current work; do not restart from an old summary.

At work end, update this file and any changed contract. Do not turn this file back into an append-only transcript.

## Owner Rules

- Keep implementations maintainable and consistent with existing boundaries; no spaghetti code.
- Security has highest priority and blocks release.
- Deploy backend changes to staging before asking the owner to test them.
- Do not expose secrets, tokens, private keys, database URLs, raw signed QR payloads, or real personal data.
- Keep school Web/hardware archived unless explicitly reopened.
- V4 is the active iOS design. V5 remains unfinished exploration and must not enter the app without explicit approval.
- Treat the consumer app as a real global product: active runtime paths use explicit deployed Staging/Production services; mocks are limited to Preview, isolated tests, deterministic fault injection, or clearly labelled internal demos.
- Local builds/simulators may prove compilation and focused regressions, but availability, authentication, payment, data integrity, and release claims require deployed HTTPS plus TestFlight/physical-device and real user-path evidence where applicable.
- Proactively inspect adjacent loading, empty, failure, recovery, authenticated, and cross-device states whenever a journey changes; do not wait for the owner to discover each regression.

## Git State

- `main` is the only local and remote branch and is the canonical source line.
- The historical `codex/beta-foundation-hosted-ci` and `codex/fanpass-design-v5` branches were fully merged, removed locally, and deleted from GitHub.
- There is one worktree: `/Users/tantalum/Documents/system and iot`.
- The completed school project archive and unfinished V5 exploration are committed on `main`; neither is an active product implementation.

## Product State

FanPass has three role-separated surfaces:

- `FanPass` consumer iOS app: `fun.fanpass.app`.
- `FanPass Ops` staff iOS app: `com.fanpass.ops`.
- `FanPass Console` organizer/admin Web app.

The active app entry is `FanPassV4AppShellView`. Legacy iOS feature trees are excluded from the main target. V5 contains no Swift code.

Backend authority is mandatory for:

- account identity and session;
- primary/resale orders and payments;
- ticket ownership and listing state;
- entry credential issuance;
- atomic redemption and `USED` state;
- high-demand queue admission, inventory holds, and account/payment limits.

Fan Access V1 follows the same boundary: the API owns campaign publication windows, task verification, fan score, eligibility, allocation policy, review decisions, private wallet thresholds, and risk signals. The consumer receives only the visible score and public campaign contract. Wallets are proof sources for one person, never score multipliers; numeric wallet thresholds are backend-only and are not returned by public campaign reads or rendered in consumer/Console copy.

Preview fixtures may remain for Xcode previews. Active Beta/Release paths must not mutate mock orders, tickets, listings, payments, support requests, or account state and claim success.

The current consumer release backlog is owned by `docs/MAIN_APP_PRODUCT_AUDIT.md`. Gate A trusted-product truth is closed in Staging; Gate B discovery/conversion and Gate C release reliability are next, not another broad visual redesign.

## Current Deployments

- API: `https://fanpass-api-staging.onrender.com`
- Console: `https://fanpass-console-staging.onrender.com`
- Console Auth: `https://fanpass-console-auth-staging.onrender.com`
- Historical Web dashboard: `https://fanpass-dashboard.vercel.app`
- Database: Neon `fanpass-staging` (connection details are secret).

Latest code-bearing deployments:

- Current live API release is `8f845a19e32bd072b4e6b4df6e61ce11a7548214`; Console remains on compatible release `ce5b4f29d3ff319a53816ff378fb673a2938c4c9`, and Console Auth remains on `108f4e65fc8c1ecb584aa2e6a29f8f2478bb0307`. A later documentation-only `[skip render]` commit may be the `main` head.
- API deploy `dep-d9ckdqsvikkc73d29km0` is `live`. Its guarded schema step rejected implicit data loss, the atomic public catalog/Fan Access upsert passed before build completion, `/health` returned 200, `/events` returned 11/11 `PUBLISHED`, a former DRAFT detail returned 404, and published Aurora detail returned 200. The deployed runtime security suite passed API/Console headers, unauthenticated boundaries, disabled demo auth, and WebSocket Origin checks.
- The superseded `dep-d9cjs9ihil2s738ap070` failed safely because raw `prisma db push` required `--accept-data-loss` for a new uniqueness constraint. The replacement takes an advisory lock, rejects real duplicates for reviewed remediation, and never adds the destructive flag. A following deploy exposed and then fixed campaign-before-task foreign-key ordering; catalog sync is now one transaction and no longer runs as a swallowed startup side effect.
- The live Render API service still stores the older build command `npm ci --include=dev && npm run prisma:push -w apps/api && npm run build -w apps/api`. It is safe for the current Staging deploy because `prisma:push` now routes through the fail-closed schema guard and atomic catalog sync, but it does not yet match the explicit audit/migration command in `render.yaml`. A Render CLI update reported success without changing the readback value; reconcile the service/Blueprint configuration before Production instead of assuming the CLI response applied it.
- Console deploy `dep-d9cdicc2m8qs73f0r3c0` remains `live`. Console root and Console Auth health returned HTTP 200 after the earlier auth release, with no change to their compatible session boundary in the API Gate A deploy.
- The Console Auth `/health` response reports HTTP 200, `runtime: vite-node-static`, and `environment: staging`. The live Console handoff starts with `303`, redirects only to the exact Auth origin, and sets a five-minute host-only `HttpOnly; SameSite=None; Secure` state Cookie.
- The superseded pre-migration Console Auth deploy was `dep-d9b2hjp9rddc738kngl0` for commit `b3d7d8177e7f2aebab05562267c04e97db15a742`.
- All three Render services follow `main` with commit-triggered auto-deploy; no service depends on a deleted branch.
- Live smoke on `108f4e6` passed the Console/Auth roots, Auth health, the handoff redirect contract, Cookie attributes, missing-state rejection, matching-state consumption, JSON exact-Origin compatibility, and untrusted-Origin rejection. A rejected fictional token followed the bounded `refresh -> reauth -> /?auth=session` contract and never created a Console session. No token, state value, raw identity, or session Cookie was printed or saved as evidence.
- The prior `e8e47dd` staging release completed a real authenticated Chrome flow into `Overview`. On current release `ce5b4f2`, the owner completed the real Console login flow and confirmed the protected workspace opened. The live Console log at `2026-07-16 13:30:38 UTC` recorded `console_privy_session_exchange` with `outcome=accepted`, upstream HTTP `201`, and `recoveryMode=initial`; the structured event contained no access token, state value, raw identity, or session Cookie.
- The public orderbook now includes at most 120 chronological settled-sale points containing only `price` and `tradedAt`. Current staging data has no settled resale trades, so `priceHistory` is present and empty rather than simulated.

Latest documentation-only deploys for `main` commit `13b1f0554a072d14036396aed3f314b1b4ec8be9` are API `dep-d99laqe47okc73e65rkg` and Console `dep-d99laq647okc73e65reg`; both are `live`. Later documentation-only commits may use Render's skip phrase because they do not change runtime code.

## iOS Baseline

- Xcode project: `apps/ios/FanPass/FanPass.xcodeproj`.
- Active scheme/config for the latest consumer validation: `FanPass`, Beta.
- Simulator: `FanPass-iPhone-17`, id `41D28602-FF01-4E4C-98AA-DA7F4FC93D27`.
- Physical phone: `tantalum`, iPhone 16 Pro Max, CoreDevice id `0185F0DC-2EC1-5340-9999-B8EA666DC02C`.
- Both installed apps report marketing version `1.0`, build `2`; that version number does not identify a source commit.

Physical `FanPass` was installed on 2026-07-08 before the 2026-07-12 productization regression. Simulator `FanPass` was installed from the later source line. The later `a8ff8ed` change removed five Account menu destinations and discarded bundled event presentation metadata while removing active mock transactions.

Current V4 repair in this worktree:

- API event mapping restores bundled covers for the ten seeded public V4 event ids.
- Account restores all ten destinations: Profile, Privacy/security, Orders, Alerts, Credits/promos, Payment methods, Wallet, Selling/payouts, Settings, Help/support.
- Restored pages use live orders or honest unavailable states; they do not reintroduce mock listings or local-only support/account success.
- A clean XcodeBuildMCP Debug build used dedicated DerivedData at `outputs/ios-sim-build/FanPassV4Restored`, succeeded in 54.9 seconds, installed over `fun.fanpass.app`, and launched as process `30141` on the named simulator.
- Runtime UI verification confirmed real Aurora/Neon event artwork nodes and an image-backed Aurora Home hero. Account exposed all ten destinations in four groups with no clipping, including while signed out; protected destinations still route through sign-in.
- Home and Account screenshots were visually inspected at 368x800. No missing cover, overlap, or truncated Account row was observed.
- Market once again mounts its verified resale K-line in the active V4 screen. The client buckets only settled-sale history into OHLC candles and shows an explicit empty state when no verified sale exists.
- The horizontal event and seat-category chip rails were replaced by a compact current-market entry plus a full-screen searchable event list and a second searchable seat-category page.
- Runtime automation covered event search, seat-category search, selection, and return to Market. Selecting Neon Harbor Festival / VIP updated the market without leaving a stale navigation page or switching tabs.
- The final Debug source was rebuilt, installed, and launched through XcodeBuildMCP from DerivedData `outputs/ios-sim-build/FanPassMarketSelector` as process `75029` on the named simulator; the active Market selector and all four chart ranges were present in the runtime accessibility tree.
- Fan Access V1 now uses a real API campaign and score model in the active V4 app. The selected Aurora concept was implemented with its reward facts, three-task maximum, progress, ticket CTA, fairness explanation, and wallet policy; the client no longer mutates mock task completion.
- Explore availability is backend-owned and only true for an `ACTIVE` campaign inside its publication window. Simulator checks covered campaign discovery, guest sign-in gating, the selection-policy sheet, and navigation to Tickets. Visual QA evidence is under `docs/ux/concepts/fan-access/` and ends in a passing comparison review.
- Public event loading now uses a shared stale-while-revalidate repository. Idempotent GETs use bounded transient retry, the last successful catalog is stored by API origin for seven days, Home/Explore/Market preserve existing content on refresh failure, and scene activation plus a 60-second active-scene cadence triggers coalesced recovery.
- The reported long-idle simulator failure was traced to an installed local Debug build whose `FanPassAPIBaseURL` was `http://localhost:4000` after the local API had been stopped, not to account logout. Runtime QA then proved `online load -> API stopped -> immediate saved Home/Market content -> API restored -> banner removed automatically`; the final simulator install must use the staging HTTPS origin unless local API work is intentional.
- Fan Access numeric wallet thresholds remain in backend domain/persistence policy only. Public campaign responses omit both threshold fields, and consumer plus Console copy no longer states a wallet count.
- Final Gate A verification built and launched the `Beta` configuration of `fun.fanpass.app` with `FanPassAPIBaseURL=https://fanpass-api-staging.onrender.com`. Home rendered Aurora `OCT 12` and Neon `NOV 15`; Home/Event Detail/Market consistently showed `No asks` and no verified sales; Explore showed Fan Access only for open campaigns and omitted it for Skyline Jazz. Runtime logs contained no localhost, DRAFT, refresh, market-unavailable, fatal, or failed markers.
- `FanPassTests` now exists with four mapper fixtures and compiles. On the installed iOS 26.5 runtime, testmanager repeatedly exited before connecting to the XCTest host, so zero tests executed. Do not treat this as lifecycle coverage; session/payment/ticket/resale/QR/redemption/recovery UI tests and physical-device evidence remain open.
- `npm run beta:foundation:verify`, strict typechecks/builds, the production dependency audit, and the full API regression pass. The current API run has 22 passing suites and 132 passing tests, with 6 opt-in PostgreSQL concurrency tests skipped by default.

## Console Baseline

- Console is an event-first operational workspace rather than one long dashboard. A persistent rail exposes Overview, Events & inventory, Sales & market, Entry, Team, and Risk & audit.
- Event context is selected from a searchable directory, remains visible in the header, and is encoded in the URL query so links are reproducible without browser token storage.
- Sales uses a searchable ticket-type selector, public orderbook depth, settled resale history, and an isolated lazy-loaded Socket.IO connection. It never fabricates trades when staging history is empty.
- Entry, staff assignments, invite rotation/revocation, Fan Access campaign configuration/review, and audit/risk evidence are scoped to the selected event and existing role boundaries. Invite tokens remain one-time values and the automated evidence clears them before screenshot capture.
- The React source is split into typed API/format/operations modules, a reusable shell/UI layer, and page-level feature modules under `apps/dashboard/src/features`. `ConsoleApp.tsx` remains the auth/session/router orchestrator rather than a monolithic page.
- Desktop and 390x844 mobile browser checks passed event search/selection, VIP market selection, staff assignment, invite rotation, token clearing, responsive navigation, and zero browser console errors. The visual regression script passed the same event-first path.
- The staging sign-in CTA now targets the same-origin `/api/console/privy-handoff` start route rather than trusting a browser-visible Auth URL. The server validates the separately deployed Auth origin and redirects there with the state-bound login intent; this also prevents the original no-op caused by a Render environment value that pointed the CTA back to Console itself.
- The isolated Auth runtime now uses Vite React plus a Node built-in static/runtime-config server rather than Next. It keeps the retry-safe email-only login state, `same-origin-allow-popups`, exact HTTPS redirect/bridge URL validation, static path containment, a Privy-compatible CSP, explicit Render port binding, and a `/health` endpoint that fails 503 when auth configuration is invalid.
- The staging browser-SDK session handoff no longer relies on a cross-origin credentialed fetch or on a browser-supplied form Origin that may be opaque. Console creates a five-minute 32-byte state, stores it in a host-only HttpOnly Cookie, and redirects only to the exact Auth origin. Auth returns the state with the short-lived token in a top-level form body; Console compares Cookie/form state in constant time, consumes it, syncs the organizer/admin role, sets its host-only HttpOnly session Cookie as a first-party response, and returns `303 /`. JSON bridge clients and production Privy HttpOnly-cookie mode retain exact-Origin enforcement. The token never enters a URL, log, React state, or app-managed browser storage.
- Expired browser-SDK sessions use a bounded recovery state machine rather than resubmitting the same token forever. The Console rotates the handoff state and asks Auth to retry `getAccessToken` once after a short backoff; a second 401 logs out the stale Privy session and requires an explicit fresh login; a third rejection stops at `/?auth=session`. Missing tokens and every rejected step remain session-free, while upstream outages use a distinct `auth=service` result.
- Privy sync no longer shares a low IP-only rate-limit bucket across every user behind the Console Render service. The shared `/auth` limiter skips the dedicated Privy routes; Console sync uses a non-plaintext SHA-256 credential fingerprint for its 12-per-minute session limit plus a separate 300-per-minute origin flood ceiling. This preserves abuse resistance without treating the Console BFF's common outbound IP as one user. Upstream 429 responses now use `auth=rate`, and Console logs only outcome, HTTP status, failure class, and recovery stage—never tokens, emails, Privy IDs, or user IDs.
- The first Vite deploy correctly failed health with 503 because the existing Render service had not applied the new `FANPASS_ENV=staging` variable and `NODE_ENV=production` activated the real production Cookie gate. The live fix infers only `staging` or `beta` from Render's documented service name/hostname metadata when `FANPASS_ENV` is absent; unrecognized/production services remain fail-closed. Health now exposes only validated environment/runtime/release metadata for deployment proof.
- FanPass code creates no app-managed browser token store. Render staging explicitly uses Privy's default `browser-sdk` storage mode for fictional staging access; production/beta configuration fails closed unless `httponly-cookie` mode is selected. The Console BFF can consume the verified `privy-token` HttpOnly cookie without a token request body before issuing its own organizer/admin-gated HttpOnly Console session.
- Fan Access campaign editing is split into a dedicated campaign panel and review queue. Console can persist reward, supply, qualification threshold, allocation method, dates, and one to three tasks; organizer/admin review decisions require a reason and write audit evidence.
- Console and API strict typechecks, production builds, the clean production dependency audit, route/provider/privacy security gates, the focused handoff integration, the refreshed 21-file Privy isolation evidence, and the full Node 22 `beta:foundation:verify` all pass. The current full API run has 22 passing suites and 132 passing tests, with 6 opt-in PostgreSQL concurrency tests skipped by default.
- Mutating refunds, transfers, and report exports are intentionally not represented as working actions until their backend contracts, authorization, audit, and idempotency behavior exist.

## Implemented Core Flows

- Privy-backed multi-device fan sessions with Keychain persistence and restoration.
- Stripe test-mode PaymentSheet and webhook/worker settlement path.
- Sponsored USDC checkout path and live wallet balance reads where configured.
- Backend-owned ticket wallet and exact ticket status refresh.
- Real resale listing, cancellation, market floor synchronization, and friend-listing purchase.
- Atomic resale settlement compensation for simultaneous buyers.
- Dynamic signed QR credentials with backend-authoritative atomic redemption.
- Cross-device `REDEEMED` reconciliation and used-ticket QR suppression.
- FanPass Ops role-separated scanner and recent check-in state.
- Transparent high-demand on-sale snapshot, randomized prequeue/FIFO queue, bounded holds, inventory locking, and purchase limits.
- Backend-owned Fan Access campaigns, visible fan score, audited manual review, equal-draw policy disclosure, and V4 consumer/Console flows.

## Open Engineering Work

1. Execute Gate B in `docs/MAIN_APP_PRODUCT_AUDIT.md`: replace Home concept claims, build real discovery/search continuity, reorder Event Detail around conversion, make Market actions liquidity-aware, and distinguish persisted Account settings.
2. Add iOS unit/UI coverage for session restore, Stripe outcome, list/cancel QR state, remote redemption, and duplicate redemption.
3. Replace Home concept search/notifications/personalization claims and complete the real Explore/Event Detail/Market discovery-to-purchase journey.
4. Add one centralized 401 refresh policy and typed repository errors.
5. Replace broad shared refresh revisions with domain-scoped realtime/adaptive refresh.
6. Split oversized Market, Profile, Tickets, and shared component files after lifecycle tests protect behavior.
7. Build real account APIs for notification preferences, payouts, credits/promos, settings sync, and support before enabling their mutations.
8. Run physical-device regression for Stripe settlement, resale list/cancel, simultaneous Ops redemption, and multi-device state.
9. Add managed edge waiting room, attestation/risk, verified phone/recovery, cached fan-out, and load/failover tests before a concert-scale sale.
10. Complete release chain custody, signed Apple Wallet evidence, TestFlight, legal/compliance, and venue integration.
11. Complete a real Privy organizer/fan Fan Access E2E covering publication, eligibility, review, and audit visibility. The schema/API/iOS deployment and public campaign/task reads are live; the authenticated two-role journey is not yet closed.
12. Keep wallet-link mutation disabled until signed ownership proof, replay protection, cooldown, earning-wallet limits, and audit evidence ship together; keep one account/campaign claim authoritative across wallets.
13. Add backend-owned Console workflows for refunds, transfers, and report exports before enabling those mutations in the UI.
14. Before real-user Console production, create and verify the separate production Privy app/domain, enable Privy HttpOnly cookies, restrict exact origins and administrator identities, require MFA/passkeys, review the remaining isolated moderate advisories, and capture passing production-mode E2E evidence.
15. Put the production API on non-sleeping capacity with health/error/latency monitoring before real-user launch; saved catalog recovery protects returning users but cannot eliminate a first-install cold start when no local cache exists.
16. Execute `docs/INFRASTRUCTURE_SCALING_PLAN.md`: record actual provider usage, establish stable provider-independent hostnames, replace production schema push with reviewed migrations, select the first global transaction region from organizer/event demand and multi-continent latency evidence, and keep every event's inventory writes in one authoritative regional plane.
17. Continuously update `docs/vibe-coding/FANPASS_JOURNEY.md` after meaningful product/engineering work and add a consolidated summary at pivots or stage transitions. Record technical faults as problems without framing the unfinished FanPass project as a success or failure; promote only cross-project lessons into the Playbook.

## Security And Tooling

- Use Node 22 LTS for dependency/security work and Hardhat contract tooling.
- `.nvmrc`, `.node-version`, root engine range, and `.npmrc` `engine-strict` are intentional.
- The CI Node 22 Beta foundation workflow is guarded by `security:ci-node22-workflow` and its self-test.
- Current root production dependency audit reports zero vulnerabilities.
- The isolated `apps/console-auth` audit reports 10 moderate and zero high/critical advisories after upgrading `@privy-io/react-auth` to `3.35.0`, pinning patched `ws@8.21.0`, and removing Next/PostCSS. Its refreshed 21-file staging-only boundary evidence passes and it remains outside the root production dependency path.
- `security:console-auth-runtime` and its fixture-backed self-test lock the Vite/Node runtime, fail-closed configuration/health behavior, URL/static-path/CSP boundaries, and production HttpOnly cookie requirement. The stricter Console SDK evidence mode must reject production until a separate production Privy app, stable DNS-verified owner domain, Privy HttpOnly cookie mode, exact allowed origins, administrator allowlist, MFA/passkey enforcement, residual advisory review, and live production E2E are proven.
- The full dev/tooling audit reports 38 advisories, including 4 high findings and no critical findings. The high findings remain indirect `lodash`, `serialize-javascript`, `tmp`, and `undici` dependencies confined to Hardhat/contract tooling.
- `form-data`, `viem`, `ethers`, and `ws` were updated within compatible ranges to close newly surfaced high findings; all 6 contract tests pass.
- Payer-only payment fields are limited to PaymentIntent creation responses. USDC, webhook, worker, and admin payment responses use the redacted mapper.
- Alpha reset deletes all current Prisma relations in one ordered transaction. Side-effect saga verification pins mock ownership so local testnet settings cannot leak into integration tests.
- Jest loads a test-only provider boundary before imports; the current full API run has 22 passing suites and 132 passing tests, with 6 opt-in PostgreSQL concurrency tests skipped in the default run.
- The focused 2026-07-15 Console session repairs passed Console/Auth typechecks and builds, all 16 current Auth tests, the permanent state/Cookie/form/JSON/blocked-origin and bounded expired-session integration regression, Console route/Auth runtime self-tests and live audits, header/provider/privacy gates, a clean root production audit, and the refreshed 21-file Privy isolation evidence validator. The full Node 22 Beta verifier finished with 19 passing API suites and 118 passing tests. Live HTTP then proved the deployed refresh/reauth/stop state machine and that rejected tokens never create a session. The follow-up `ce5b4f2` shared-egress limiter repair passed the expanded Node 22 gate with 20 API suites and 124 tests, and the owner-visible staging E2E completed successfully with a token-free accepted/201 Console exchange event.
- Do not force dependency fixes. Re-run the production audit and fail-closed advisory gate after manifest/lock changes.
- Neon/PostgreSQL is final inventory authority. Cache or edge counters must never sell tickets.
- Redemption and high-demand purchase races must resolve in database transactions/locks, not client state.

## Documentation State

- `docs/README.md` is the current index.
- `docs/vibe-coding/` now preserves the continuously updated FanPass build journey, the reusable commercial-project Playbook, and copyable operating templates. The initial backfill covers the archived project origin, all 138 commits from 2026-05-30 through 2026-07-16, current contracts, and recorded runtime/user evidence through 2026-07-17; future meaningful work must extend it while FanPass remains in progress.
- Documentation cleanup reduced non-ignored Markdown from 113 files to 58 files (11,659 lines) while preserving script-bound evidence contracts.
- Historical V4 planning, UX, design QA, review, and append-only Handoff detail remains in Git history.
- `docs/design.md` is V4 production guidance.
- The unapproved V5 design draft is preserved at `FanPass_VI_Redesign_V5/docs/FanPass_V5_Design_Draft.md`.
- School Web/hardware source is under `archive/school-project`; generated outputs and local data were removed.
- A full workspace scan on 2026-07-12 read all 4,407 `.md` files outside `.git` (about 35.6 MB) with zero read errors. Of these, 4,349 are ignored dependency/build-cache Markdown and were audited without modification.
- All 58 non-ignored project Markdown files were checked for current branch/deployment/V4-V5 wording and internal references. Broken Markdown links and missing referenced Markdown paths: zero.
- Five UTF-8 replacement characters exist only in four third-party dependency README files under `node_modules` or isolated build dependencies; no project-authored Markdown contains them.
- The 2026-07-14 Market pass again read every workspace Markdown file outside `.git`; after context compaction it re-read the Handoff and current non-ignored V4/Market contracts before resuming implementation.
- The 2026-07-14 Console pass read all 4,446 workspace Markdown files outside `.git` with zero read errors (aggregate SHA-256 `1bb1c21ce72dba16f246c7f42c7010c73b16ea6b9b529daf58f655eaad9afb1c`). After context compaction it re-read this Handoff and the focused Console contracts before resuming deployment verification.
- The 2026-07-15 Console recovery pass read all 4,535 workspace Markdown files outside `.git` with zero read errors (aggregate SHA-256 `e615c085e8aa2dce337d8a9ba085d5bb87ebddeee221f2f462a6371e927c8d80`). After context compaction it re-read all 58 non-ignored Markdown files (11,775 lines; aggregate SHA-256 `78e43c2ad7c677e162c548c220718f4ba056e5123d39a2f292193e5fdfb90e87`) before deployment work resumed.
- The 2026-07-16 Console rate-limit diagnosis resumed after compaction by re-reading all 58 non-ignored Markdown files (1,013,791 bytes, 11,782 lines; aggregate SHA-256 `364a9cbcf0094a8e6bf66ebee713c5034a8255c4c6aea362cf83a1c488501c07`) before changing code.
- The 2026-07-16 Fan Access pass started from the full Markdown review and, after compaction, re-read this Handoff plus the focused roadmap, task, privacy, index, and Fan Access contracts before completing implementation and verification.
- After the next context compaction, the handoff resumed by re-reading all 58 non-ignored Markdown files (1,018,504 bytes, 11,798 lines; aggregate SHA-256 `184acbca5b7d4d80ed7ddf3a09d5ebf065c9b18922ce11407062939b7669bcd1`) before documenting owner E2E and starting the Explore audit.
