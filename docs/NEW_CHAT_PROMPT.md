# New Chat Resume Prompt

Paste this into a new Codex chat from the same workspace:

```text
We are continuing the FanPass Beta foundation/security hardening work from a previous Codex thread.

Workspace: /Users/tantalum/Documents/system and iot
Current date/timezone: use the current local date, Asia/Hong_Kong.

Before changing code, read these files in this order:
1. docs/CODEX_HANDOFF.md
2. docs/DEVELOPMENT_TASKS.md
3. docs/ALPHA_SECURITY_REVIEW.md
4. docs/QA_CHECKLIST.md
5. docs/BETA_ROADMAP.md
6. docs/PROVIDER_COST_FEASIBILITY.md
7. docs/DEPLOYMENT_ENVIRONMENTS.md
8. docs/STAGING_DEPLOYMENT_FREE_PATH.md
9. docs/STRIPE_TESTMODE_EVIDENCE.md
10. docs/STRIPE_DASHBOARD_EVIDENCE.md
11. docs/FANPASS_REPORT.md

Start by running `git status --short --branch` and do not revert user changes. There may be uncommitted DEBUG-only iOS helper edits in:
- apps/ios/FanPass/FanPass/App/AppState.swift
- apps/ios/FanPass/FanPass/Features/Auth/AuthView.swift

Current stage: Beta foundation/security hardening.
Current checklist: 396/397 tasks, 99.7%. Public dependency readiness is no longer the open blocker after the 2026-06-06 Console Next exit; remaining release blockers are external Apple/physical-device/release-custody evidence.

Known live staging:
- API: https://fanpass-api-staging.onrender.com
- Console: https://fanpass-console-staging.onrender.com
- GitHub repo: https://github.com/tantalum666/fanpass
- Latest Render API deployed commit verified on 2026-06-03: 07d4cb6dad9dfa4cf8f2a8ff254d20d6d72c818d; worker scheduler code was introduced in 75b4e68bc7835bc2d4532259a3cecac2ab8e99da.
- Latest Render Console deployed commit verified on 2026-06-07: 2df41595d23dd756984fa7f0e4299ab9e62bbeef; the current Vite/Node BFF Console runtime was introduced in 2fd850e35341844a953db151652b2f4c7088b8c9.

Important provider status:
- Render HTTPS staging runtime evidence for the current Render API plus Render Vite/Node Console has passed at `outputs/staging-runtime/20260606T180256Z-render-console-vite-node-admin.json`.
- Privy Dev app dashboard plan evidence has passed at `outputs/privy-plan/privy-plan-20260603.json`; it records mobile SDK, embedded-wallet, backend token verification, and custom auth UI support, with webhooks and MFA/policy controls plan-gated/optional. Production webhooks are not implemented for the current low-cost Beta foundation path; backend access-token sync is the supported boundary and `npm run security:privy-webhooks:optional` keeps webhook routes/secrets absent. Older mobile config evidence exists but is stale against current uncommitted DEBUG-only iOS helper edits.
- FanPass Console Privy React SDK login is implemented in isolated runtime `apps/console-auth`, outside root workspaces/default production audit. Evidence passed at `outputs/privy-console-sdk/privy-console-react-sdk-20260603.json`; the main `apps/dashboard` Console no longer uses Next and the root production audit is clean.
- Stripe dashboard test-mode webhook setup and native iOS PaymentSheet authorization have been exercised successfully against the Render staging API.
- Full Stripe test-mode release evidence has passed at `outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json`, covering capture, authorization cancel, refund, reconciliation, duplicate webhook replay/idempotency, and healthy residual side-effect outbox state against the Render staging API.
- Non-human SDK/payment implementation checklist items are closed: Privy SDK login is implemented across FanPass, FanPass Ops, and isolated FanPass Console auth; Privy webhook sync is resolved as intentionally absent for the current plan; and Stripe test-mode PaymentIntent/webhook/client checkout work is closed through native iOS PaymentSheet plus saved Render staging evidence.
- Console Next exit is complete for `apps/dashboard`: Vite React static UI plus `apps/dashboard/server/console-bff.ts` replaced the previous Next production runtime path. `npm run security:dependency-advisories` now reports `releaseBlocker: null` and a clean production audit.
- Dependency risk acceptance evidence remains historical closed-beta-only fallback context at `outputs/dependency-risk/20260604T120654Z-closed-beta-risk-acceptance.json`, expiring on 2026-07-04, but the root production dependency blocker is now closed by migration rather than risk acceptance.
- Alpha security blocker rollup has been refreshed: Privy SDK login, Stripe test-mode release evidence, deployed HTTPS runtime evidence, hosted CI, production tenant/staff staging evidence, and public dependency readiness are closed for current Beta foundation. Public/real-user Beta still needs signed iOS/TestFlight, signed Wallet, physical QR/NFC, and release-grade chain custody evidence.
- Production tenant/staff staging evidence passed on 2026-06-04 at `outputs/staff-tenant/20260604T135635Z-staging-evidence.json`. It proves verified staff invite acceptance, replay/superseded invite rejection, linked-staff rotation rejection, deactivation revocation, inactive-assignment rotation rejection, assigned/unassigned Ops gate scoping, QR redeem/duplicate rejection, client-supplied scanner identity rejection, scoped check-in summary, deployed demo-session rejection, deployed Console unauthenticated mutation rejection, HttpOnly/Secure/SameSite Console session cookie creation, Console proxy one-time invite create/rotate redaction, verified fan-role Console rejection, second-organizer isolation, cross-organizer Console read rejection, cross-organizer staff assignment rejection, and cross-organizer invite rotation rejection. Validation passed with `npm run security:staff-tenant:staging-evidence -- outputs/staff-tenant/20260604T135635Z-staging-evidence.json` and repository evidence redaction.
- Console origin note: deployed Console mutations accept the current Render Console origin `https://fanpass-console-staging.onrender.com`; the old `https://fanpass-dashboard.vercel.app` origin is historical and should not be assumed to be allowed. Keep Render `FANPASS_CONSOLE_ORIGINS` aligned with the auth bridge origin before collecting future Console session evidence.
- Latest supporting Alpha walkthrough capture bundle: `outputs/alpha-walkthrough/20260604T122652Z/`. It passed capture and redaction with token/email-free Console screenshot review. The owner removed the human-reviewed recording requirement from current Beta foundation blockers on 2026-06-04; recording evidence is optional unless deliberately reintroduced.
- Current hosted CI evidence for the Beta foundation PR branch has been refreshed at `outputs/ci-hosted/20260603T141752Z-github-actions-beta-foundation.json`; it covers GitHub Actions run `26873871164` at commit `bad6847617ce83fdb5b8c1a7eeb302c6ff7644fc` and passed `npm run security:ci-hosted:evidence` plus repository evidence redaction.
- Order settlement durable outbox/saga engineering tasks are closed locally; chain custody remains a separate real-world evidence blocker.
- Local smart-contract foundation is advanced as of 2026-06-05: `FanPassTicket` supports safe ticket/ticket-type/policy/metadata proof hashes, refunded state, lifecycle transfer blocking, and owner-only proof updates; `FanPassSoulbound` supports safe Access Badge proof hashes, ERC5192-style locked behavior, and revocation; `RedemptionRegistry` stores duplicate-protected event/gate/credential redemption context; `packages/contracts/scripts/deploy-local.ts` runs a local Hardhat dry-run. Verified with `scripts/with-node-22.sh npm run test -w packages/contracts` and `scripts/with-node-22.sh npm run deploy:local -w packages/contracts`. This is not Sepolia deployment or chain custody evidence.
- Sepolia dev-only deployment prep exists as of 2026-06-06: `packages/contracts/scripts/deploy-sepolia-dev.ts`, Hardhat network `sepoliaDev`, npm script `deploy:sepolia-dev`, and `docs/technical/FanPass_Sepolia_Dev_Hotkey_Runbook_V4.md`. This path may use a temporary Sepolia-only hot key for fictional contract/ABI validation, writes full local artifacts only under gitignored `.fanpass-local/chain-dev/`, and must remain `custodyEvidence: false`. It does not close chain custody, public Beta, real-user Beta, production signing, multisig/timelock, or durable outbox proof blockers.
- Backend Sepolia dev-only ownership smoke passed on 2026-06-06 after adding owner-only `FanPassTicket.syncTicketTransfer` and updating API `OwnershipService` to call `mintTicketWithProof`, hashed proof fields, `syncTicketTransfer`, and `redeem`. Redacted docs: `docs/technical/FanPass_Sepolia_Dev_Deployment_Log_V4.md`, `docs/technical/FanPass_Sepolia_Dev_Backend_Smoke_V4.md`, and `docs/technical/FanPass_Chain_Security_Review_V4.md`. This remains dev-only and `custodyEvidence: false`.
- Final self-solvable chain validation passed on 2026-06-06: contract tests, local deployment dry-run, API ownership/ticket/outbox focused tests, API typecheck, provider-boundary audit, chain operator key audit/self-test, chain custody evidence self-test, saved-evidence redaction, full `beta:foundation:verify`, `git diff --check`, and gitignore checks for `.env.local` and `.fanpass-local/chain-dev/`. The remaining chain blocker is release-grade custody/outbox evidence, not more dev-only hot-key work.
- Outbox-backed chain proof-sync prewire exists as of 2026-06-06. `FANPASS_CHAIN_PROOF_SYNC_OUTBOX=true` makes ticket issue enqueue `OWNERSHIP_ISSUE`, resale transfer use the existing `OWNERSHIP_TRANSFER`/`OWNERSHIP_SETTLEMENT_FINALIZE` saga, and scanner redemption enqueue `OWNERSHIP_REDEEM`. Prisma issue/redeem paths write local state, audit, and outbox jobs in one transaction. Default/local ownership remains mock, and production-like `OWNERSHIP_ADAPTER=testnet` is still blocked. This is not chain custody evidence.
- Dynamic QR/NFC credential lifecycle storage exists as of 2026-06-06. Prisma-backed QR issue persists an `EntryCredential`, supersedes prior active credentials for the same ticket on refresh, and consumes the accepted credential in the same transaction as ticket redemption, check-in, audit logging, and optional ownership outbox enqueue. The memory path mirrors supersession/consumption for local tests.
- Dev-only Sepolia outbox proof-sync smoke passed on 2026-06-06 through `npm run chain:sepolia-dev:outbox-smoke`, exercising `OWNERSHIP_ISSUE`, `OWNERSHIP_TRANSFER`, and `OWNERSHIP_REDEEM` via `SideEffectWorkerService`. Full artifact is gitignored under `.fanpass-local/chain-dev/`; console output is redacted and reports `custodyEvidence: false`. This does not close release-grade chain custody, public Beta, or real-user Beta blockers.
- V4 iOS API provider/service-protocol foundation was added on 2026-06-06. `FanPassV4APIDataProvider` maps existing API event/ticket/QR payload DTOs into Clean V4 models, and `ExploreViewModel`, `CheckoutViewModel`, `TicketsViewModel`, and `ScannerViewModel` now accept injectable service protocols while keeping mock services as the default prototype path. `FanPass` and `FanPassOps` Debug simulator builds pass with `CODE_SIGNING_ALLOWED=NO`.
- Render side-effect worker scheduler is enabled in env: FANPASS_SIDE_EFFECT_WORKER_ENABLED=true, FANPASS_SIDE_EFFECT_WORKER_INTERVAL_MS=15000, SIDE_EFFECT_WORKER_LIMIT=10.
- Brand/UI redesign foundation is Clean V4 only. Use `FanPass_VI_Redesign_V4/`, `docs/brand/FanPass_VI_Clean_V4_Audit.md`, `docs/brand/FanPass_UI_Guardrails.md`, `docs/brand/FanPass_Final_Design_Tokens_V4.md`, `docs/brand/fanpass-brand-tokens.json`, and SwiftUI foundations in `apps/ios/FanPass/FanPass/DesignSystem/`. Do not redesign the V4 logo or app icon. Do not reintroduce decorative lines crossing text, QR, logos, buttons, charts, prices, ticket metadata, or navigation.
- Clean V4 UX structure docs are in `docs/ux/`: information architecture, user flows, screen list, content model, and interaction principles. Future UI implementation should start from those docs and preserve the five-tab fan app plus staff-only scanner boundary.
- Clean V4 iOS foundation is implemented in `apps/ios/FanPass/FanPass/`, with `ios/FanPass` symlinked to that real Xcode source path. `FanPassApp` now launches `FanPassV4AppShellView`, which is mock-data-only and uses V4 design-system components, namespaced `FanPassV4` models, mock services, and fictional events. Do not connect backend/payment/chain/NFC from this V4 shell until explicitly scoped.

Safety rules:
- Do not use real personal data, production credentials, live Stripe mode, production Privy secrets, or destructive git commands.
- Treat all provider tokens/keys pasted in the old chat as exposed. Do not repeat them. Recommend rotation before final evidence.
- Keep provider integrations behind narrow adapters/services.
- Do not build unmaintainable one-off code. Prefer existing project patterns, small typed adapters/services, schema validation, focused tests, and documented evidence gates over scattered provider calls or broad rewrites.
- Before code or evidence changes, read the current source-of-truth docs for the task and update docs in the same change when product boundaries, evidence status, provider assumptions, release blockers, or user instructions change.
- Security is release-blocking. Never claim public, real-user, signing, provider, payment, Wallet, scanner, or chain readiness without matching saved evidence that passes the documented validator.
- Do not commit `.env`, tokens, keys, screenshots with secrets, or output evidence containing secrets.
- The user has authorized Codex to use available plugins and app tools as needed, including Product Design, Build iOS Apps, Build Web Apps, Browser, Chrome, Figma, Render, Vercel, GitHub, Data Analytics, Documents, Presentations, Spreadsheets, and related MCP/tool integrations. Choose the smallest appropriate tool set and keep all safety rules above.

Highest-value next task:
Choose the next remaining Beta foundation blocker. Good next targets are real iOS staging/TestFlight evidence, signed Wallet evidence, physical QR/NFC evidence, and release-grade chain custody evidence. For chain, do not repeat dev-only hot-key proof as release evidence; proceed only when Safe/multisig or equivalent ownership, timelock/admin delay, delegated signer/vault/KMS or accepted relayer custody, deployed outbox-routed chain writes, signer audit logs, and redacted saved evidence are in scope. Use `npm run release:evidence:draft -- ios-build|apple-wallet|ops-scanner|chain-custody --out <draft-json>` to seed non-passing, secret-free drafts with current SHA-256 snapshots before collecting real external proof. Report stage, completed work, checklist percentage, and remaining blockers.
```

If the new chat is only for status/reporting, ask it to summarize `docs/CODEX_HANDOFF.md` and list the open blockers from `docs/DEVELOPMENT_TASKS.md` without changing files.
