# Codex Handoff

Last updated: 2026-07-12 (Asia/Shanghai).

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

Preview fixtures may remain for Xcode previews. Active Beta/Release paths must not mutate mock orders, tickets, listings, payments, support requests, or account state and claim success.

## Current Deployments

- API: `https://fanpass-api-staging.onrender.com`
- Console: `https://fanpass-console-staging.onrender.com`
- Historical Web dashboard: `https://fanpass-dashboard.vercel.app`
- Database: Neon `fanpass-staging` (connection details are secret).

Latest code-bearing deployments:

- Code commit: `49be599f79adfb917da09f4534608e40014d369b`.
- API deploy: `dep-d99l7e647okc73e64efg`, status `live`.
- Console deploy: `dep-d99l8ics728c73ddl6c0`, status `live`.
- Both Render services follow `main` with commit-triggered auto-deploy; no service depends on a deleted branch.
- Live smoke passed API `/health`, API `/events`, and the Console root with HTTP 200.
- This line includes transparent high-demand on-sale controls plus stricter payer-only payment response redaction.

Latest documentation-only deploys for `main` commit `13b1f0554a072d14036396aed3f314b1b4ec8be9` are API `dep-d99laqe47okc73e65rkg` and Console `dep-d99laq647okc73e65reg`; both are `live`. Later documentation-only commits may use Render's skip phrase because they do not change runtime code.

## iOS Baseline

- Xcode project: `apps/ios/FanPass/FanPass.xcodeproj`.
- Active scheme/config for local validation: `FanPass`, Debug.
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

## Open Engineering Work

1. Add iOS unit/UI coverage for session restore, Stripe outcome, list/cancel QR state, remote redemption, and duplicate redemption.
2. Add one centralized 401 refresh policy and typed repository errors.
3. Replace broad shared refresh revisions with domain-scoped realtime/adaptive refresh.
4. Split oversized Market, Profile, Tickets, and shared component files after lifecycle tests protect behavior.
5. Build real account APIs for notification preferences, payouts, credits/promos, settings sync, and support before enabling their mutations.
6. Run physical-device regression for Stripe settlement, resale list/cancel, simultaneous Ops redemption, and multi-device state.
7. Add managed edge waiting room, attestation/risk, verified phone/recovery, cached fan-out, and load/failover tests before a concert-scale sale.
8. Complete release chain custody, signed Apple Wallet evidence, TestFlight, legal/compliance, and venue integration.

## Security And Tooling

- Use Node 22 LTS for dependency/security work and Hardhat contract tooling.
- `.nvmrc`, `.node-version`, root engine range, and `.npmrc` `engine-strict` are intentional.
- The CI Node 22 Beta foundation workflow is guarded by `security:ci-node22-workflow` and its self-test.
- Current root production dependency audit reports zero vulnerabilities.
- The full dev/tooling audit reports 38 advisories, including 4 high findings and no critical findings. The high findings remain indirect `lodash`, `serialize-javascript`, `tmp`, and `undici` dependencies confined to Hardhat/contract tooling.
- `form-data`, `viem`, `ethers`, and `ws` were updated within compatible ranges to close newly surfaced high findings; all 6 contract tests pass.
- Payer-only payment fields are limited to PaymentIntent creation responses. USDC, webhook, worker, and admin payment responses use the redacted mapper.
- Alpha reset deletes all current Prisma relations in one ordered transaction. Side-effect saga verification pins mock ownership so local testnet settings cannot leak into integration tests.
- Jest loads a test-only provider boundary before imports; the full API run has 19 passing suites and 117 passing tests, with 6 opt-in PostgreSQL concurrency tests skipped in the default run.
- `npm run beta:foundation:verify` passed end to end on 2026-07-12, including real local PostgreSQL reset/saga verification, API and Console typechecks, privacy/security gates, and API tests.
- Do not force dependency fixes. Re-run the production audit and fail-closed advisory gate after manifest/lock changes.
- Neon/PostgreSQL is final inventory authority. Cache or edge counters must never sell tickets.
- Redemption and high-demand purchase races must resolve in database transactions/locks, not client state.

## Documentation State

- `docs/README.md` is the current index.
- Documentation cleanup reduced non-ignored Markdown from 113 files to 58 files (11,659 lines) while preserving script-bound evidence contracts.
- Historical V4 planning, UX, design QA, review, and append-only Handoff detail remains in Git history.
- `docs/design.md` is V4 production guidance.
- The unapproved V5 design draft is preserved at `FanPass_VI_Redesign_V5/docs/FanPass_V5_Design_Draft.md`.
- School Web/hardware source is under `archive/school-project`; generated outputs and local data were removed.
- A full workspace scan on 2026-07-12 read all 4,407 `.md` files outside `.git` (about 35.6 MB) with zero read errors. Of these, 4,349 are ignored dependency/build-cache Markdown and were audited without modification.
- All 58 non-ignored project Markdown files were checked for current branch/deployment/V4-V5 wording and internal references. Broken Markdown links and missing referenced Markdown paths: zero.
- Five UTF-8 replacement characters exist only in four third-party dependency README files under `node_modules` or isolated build dependencies; no project-authored Markdown contains them.
