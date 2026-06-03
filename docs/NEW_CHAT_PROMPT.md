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
Current checklist: 377/382 tasks, 98.7%.

Known live staging:
- API: https://fanpass-api-staging.onrender.com
- Console: https://fanpass-dashboard.vercel.app
- GitHub repo: https://github.com/tantalum666/fanpass
- Latest Render API deployed commit verified on 2026-06-03: 07d4cb6dad9dfa4cf8f2a8ff254d20d6d72c818d; worker scheduler code was introduced in 75b4e68bc7835bc2d4532259a3cecac2ab8e99da.

Important provider status:
- Render/Vercel HTTPS staging runtime evidence has passed.
- Privy Dev app dashboard plan evidence has passed at `outputs/privy-plan/privy-plan-20260603.json`; it records mobile SDK, embedded-wallet, backend token verification, and custom auth UI support, with webhooks and MFA/policy controls plan-gated/optional. Older mobile config evidence exists but is stale against current uncommitted DEBUG-only iOS helper edits.
- FanPass Console Privy React SDK login is implemented in isolated runtime `apps/console-auth`, outside root workspaces/default production audit. Evidence passed at `outputs/privy-console-sdk/privy-console-react-sdk-20260603.json`; root production audit remains limited to the known 2 moderate Next/PostCSS advisories while the isolated SDK runtime records 25 moderate advisories.
- Stripe dashboard test-mode webhook setup and native iOS PaymentSheet authorization have been exercised successfully against the Render staging API.
- Full Stripe test-mode release evidence has passed at `outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json`, covering capture, authorization cancel, refund, reconciliation, duplicate webhook replay/idempotency, and healthy residual side-effect outbox state against the Render staging API.
- Non-human SDK/payment implementation checklist items are closed: Privy SDK login is implemented across FanPass, FanPass Ops, and isolated FanPass Console auth, and Stripe test-mode PaymentIntent/webhook/client checkout work is closed through native iOS PaymentSheet plus saved Render staging evidence.
- Current hosted CI evidence for the Beta foundation PR branch has been refreshed at `outputs/ci-hosted/20260603T141752Z-github-actions-beta-foundation.json`; it covers GitHub Actions run `26873871164` at commit `bad6847617ce83fdb5b8c1a7eeb302c6ff7644fc` and passed `npm run security:ci-hosted:evidence` plus repository evidence redaction.
- Order settlement durable outbox/saga engineering tasks are closed locally; chain custody remains a separate real-world evidence blocker.
- Render side-effect worker scheduler is enabled in env: FANPASS_SIDE_EFFECT_WORKER_ENABLED=true, FANPASS_SIDE_EFFECT_WORKER_INTERVAL_MS=15000, SIDE_EFFECT_WORKER_LIMIT=10.

Safety rules:
- Do not use real personal data, production credentials, live Stripe mode, production Privy secrets, or destructive git commands.
- Treat all provider tokens/keys pasted in the old chat as exposed. Do not repeat them. Recommend rotation before final evidence.
- Keep provider integrations behind narrow adapters/services.
- Do not commit `.env`, tokens, keys, screenshots with secrets, or output evidence containing secrets.
- The user has authorized Codex to use available plugins and app tools as needed, including Product Design, Build iOS Apps, Build Web Apps, Browser, Chrome, Figma, Render, Vercel, GitHub, Data Analytics, Documents, Presentations, Spreadsheets, and related MCP/tool integrations. Choose the smallest appropriate tool set and keep all safety rules above.

Highest-value next task:
Choose the next remaining Beta foundation blocker, likely production tenant/staff staging evidence, dependency advisory closure or risk acceptance, real iOS staging/TestFlight evidence, signed Wallet evidence, physical QR/NFC evidence, or chain custody evidence. Report stage, completed work, checklist percentage, and remaining blockers.
```

If the new chat is only for status/reporting, ask it to summarize `docs/CODEX_HANDOFF.md` and list the open blockers from `docs/DEVELOPMENT_TASKS.md` without changing files.
