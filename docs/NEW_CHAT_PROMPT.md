# New Chat Resume Prompt

Work in `/Users/tantalum/Documents/system and iot`.

## Required Start

1. Read `docs/CODEX_HANDOFF.md` first and in full.
2. On a normal new turn, enumerate/read all Markdown including hidden/ignored/generated files except `.git`.
3. After automatic context compaction, read the Handoff first, then only non-ignored Markdown from `rg --files -g '*.md'`.
4. Read task-specific contracts from `docs/README.md`.

## Standing Rules

- V5 is an owner-approved staged migration on Home, Explore, and Event Detail. Unmigrated screens stay V4 until their own implementation and QA; do not globally recolor them or claim full-baseline completion.
- Do not build spaghetti code or fake transactional success.
- Security is release-blocking.
- Never expose provider secrets, bearer tokens, private keys, database URLs, raw QR payloads, or real personal data.
- Deploy backend changes to Render staging before asking the owner to test them.
- Keep school Web/hardware archived unless explicitly reopened.
- Update relevant Markdown and `docs/CODEX_HANDOFF.md` after meaningful work.

## Current State

- `main` remains the canonical deployed source line. `codex/security-rc-20260720` is the reviewed and pushed security release-candidate branch, frozen at immutable commit `a25185d2747520303eac0fd2681017b5c35ac62b`. It has not been merged or deployed and must not be Blueprint-synced before the owner-approved maintenance window.
- `codex/security-rc-20260724-qr-first` is the active follow-up candidate. QR-first commit `ec3ab855a40f22670e41a4e727025b6ec6b80e97` passed Hosted run `#93`; documentation head `7d77584e1dac520dc90562eea09edd6b01d5f793` passed `#94`; V5 code/assets/docs are committed at `2a910a0a6e83055743bb2992b15226259e9e9663`. Any following documentation reconciliation needs its own exact-HEAD run before release.
- Consumer app source is under `apps/ios/FanPass/FanPass`; the stable V4 shell mounts V5 Home/Explore/Event Detail with isolated `FPV5*` tokens/components, while remaining screens retain V4.
- Render API and Console remain live on source `8f845a19e32bd072b4e6b4df6e61ce11a7548214`; isolated Console Auth remains live on `108f4e65fc8c1ecb584aa2e6a29f8f2478bb0307`. Auth `/health`, the deployed Console asset, and the recovery handoff contract prove only those older deployed releases, not the security RC. A later `[skip render]` documentation follow-up may be the `main` head.
- School Web, Arduino/EP8280 hardware, bridge, and enclosure source are archived under `archive/school-project`.
- Every workspace Markdown file outside `.git` was read successfully before the 2026-07-25 V5 slice (4,247 files; manifest recorded in the Handoff); use `docs/README.md` instead of recreating deleted V4 planning logs.

## Latest Verification

The 2026-07-25 V5 slice makes Home search/city/account behavior real, adds event/category/city discovery continuity, and moves Event Detail ticket/auth/checkout action into the first viewport while preserving backend inventory and on-sale gates. Same-state V4/V5 comparisons were reviewed at 368x800. Beta build/run passed, Debug tests passed 6/6, and both iOS role/distribution boundary audits passed. The app icon uses the selected Round 06 source with opaque renditions and iOS-owned corner masking. Render was untouched because no backend or deployment configuration changed.

V4 event covers lost by API mapping and the five Account destinations removed by `a8ff8ed` are restored. Re-exposed pages use live orders or honest unavailable states, not mock listings or fake support/settings success.

Market now uses a compact current-market entry, a searchable full-screen event selector, and a searchable seat-category child page instead of horizontal chip rails. The active V4 screen again mounts a restrained K-line built only from public settled-sale `price` / `tradedAt` history; current staging has no settled resale trades and therefore shows the honest empty state.

A clean Debug build was installed on simulator `41D28602-FF01-4E4C-98AA-DA7F4FC93D27`. Runtime automation verified event search, seat search, selection, return-to-Market navigation, and the chart empty state.

Console is now an event-first operational workspace with persistent navigation and focused Overview, Events & inventory, Sales & market, Entry, Team, and Risk & audit pages. Searchable event selection is URL-addressable; Sales has ticket-type selection, public depth/history, and isolated live updates. Feature modules, typed data utilities, the shell, and CSS layers are separated instead of living in a monolithic component. Desktop/mobile browser automation passed event selection, VIP market selection, staff assignment, invite rotation, token clearing, and zero console errors. Refund/review/transfer/report mutations remain disabled until backend-owned contracts exist.

Console staging sign-in validates the Auth URL and links to the separate email-only Privy runtime instead of looping back to itself. The Auth runtime has migrated from Next to Vite React plus a Node built-in server with fail-closed health/runtime config, exact URL and static-path boundaries, and a Privy-compatible CSP. The isolated audit is now 10 moderate and zero high/critical after removing Next/PostCSS; root production remains zero vulnerabilities.

The browser-SDK staging handoff starts on Console with a five-minute 32-byte state stored in a host-only HttpOnly Cookie, redirects only to the exact Auth origin, and returns the state with the token in a top-level POST body. Console compares the Cookie/form state in constant time and consumes it before setting its own HttpOnly session Cookie and returning `303 /`. This replaces the unreliable cross-origin cookie fetch and handles browsers that report an unavailable or opaque form Origin without weakening JSON or production Privy-cookie Origin checks. Tokens remain out of URLs, logs, React state, and app-managed browser storage.

An expired Privy browser session no longer loops through the same rejected token. Console rotates the handoff state and requests one `getAccessToken` retry after a short backoff, then Auth logs out the stale session and asks for an explicit fresh login, and a further 401 stops at `auth=session`. Upstream service failure has its own `auth=service` message. Missing/rejected tokens never create a Console session.

FanPass adds no browser token store. Render staging explicitly uses Privy's documented default browser SDK storage; real-user production must use a separate production Privy app on a stable DNS-verified owner domain with Privy HttpOnly cookie mode, exact allowed origins, administrator allowlist, MFA/passkey enforcement, residual-risk review, and live production E2E. The Console BFF cookie-mode bridge is implemented, but the saved evidence remains `staging-only` and intentionally fails `--require-production`.

The security RC's authoritative local Node 22 gate passes 97/97, including 32 API suites / 386 tests, contracts 30/30, all 16 Auth tests, API/Console/Auth/contract builds and typechecks, real disposable-PostgreSQL migration and worker/health checks, route/runtime/header/provider/privacy gates, and clean root production/full dependency audits. Independent final security and secret/scope review reported 0 remaining P0/P1. This is local pre-Staging evidence only. The isolated Console Auth dependency tree still has 10 moderate and zero high/critical advisories. Live HTTP on the older deployed `108f4e6` proved `refresh -> reauth -> stop`, state rotation, and no rejected-token session; the owner later completed that release's real staging login and opened the protected workspace. Immutable RC `a25185d2747520303eac0fd2681017b5c35ac62b` remains undeployed. Authenticated GitHub UI review on 2026-07-24 shows exact-SHA Hosted run `#92` succeeded in 5m 9s and QR-first candidate run `#93` succeeded for `ec3ab855a40f22670e41a4e727025b6ec6b80e97`; validator-passing saved JSON remains open because the current CLI credential still receives 403 from Actions/Checks/Status. Render remains on the old source revision. The minimum Maintenance-Mode-capable API upgrade is Starter at `$7/month`, and it remains unapplied pending explicit owner approval.

## Next Action

1. After any V5 follow-up commit on `codex/security-rc-20260724-qr-first`, wait for its exact-HEAD Hosted workflow and save only validator-passing redacted evidence. Runs `#92`, `#93`, and `#94` are successful UI proof for their recorded SHAs only.
2. Establish protected review/CODEOWNERS or record the verified equivalent control; the current repository has no `CODEOWNERS`, and branch-protection reads returned 403.
3. Owner standing direction is to continue beyond local proof. Render must stay Free for now with Auto-Deploy Off; every future Render release is manually triggered by approved plugin/CLI and verified. Do not start the maintenance-gated Staging RC cutover until the owner approves the paid traffic boundary.
4. Capture current-candidate Staging, Stripe/Privy/Sepolia, crash-boundary, multi-instance, App Attest, and refreshed TestFlight/physical-iPhone QR evidence. Historical TestFlight installation and physical QR testing are complete; repeat them only to bind evidence to the next reviewed `qr-first-release-v1` bytes.
5. Apple agreement and DSA are intentionally paused. Computer Use reached the final agreement action and the DSA legal-fact choices without submitting either. Provisioning profiles are also absent locally; do not claim the next signed/TestFlight candidate until these blockers are cleared.
6. After real Staging evidence, run one final `Changes / Review changes` validation against the sealed baseline. Do not start another Deep Scan unless the architecture or trust boundary changes materially.
