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
Current checklist: 368/381 tasks, 96.6%.

Known live staging:
- API: https://fanpass-api-staging.onrender.com
- Console: https://fanpass-dashboard.vercel.app
- GitHub repo: https://github.com/tantalum666/fanpass
- Latest Render API deployed commit: 75b4e68bc7835bc2d4532259a3cecac2ab8e99da

Important provider status:
- Render/Vercel HTTPS staging runtime evidence has passed.
- Privy Dev app dashboard/mobile config evidence has passed; simulator OTP paths were used for staging/admin evidence.
- Stripe dashboard test-mode webhook setup and native iOS PaymentSheet authorization have been exercised successfully against the Render staging API.
- Full Stripe evidence remains open until capture, authorization cancel, refund, reconciliation, duplicate webhook replay/idempotency, and healthy residual side-effect outbox state are saved and pass `npm run security:stripe-testmode:evidence -- <saved-json-output>`.
- Render side-effect worker scheduler is enabled in env: FANPASS_SIDE_EFFECT_WORKER_ENABLED=true, FANPASS_SIDE_EFFECT_WORKER_INTERVAL_MS=15000, SIDE_EFFECT_WORKER_LIMIT=10.
- Confirm from Render logs or Neon SQL that the latest Stripe-authorized order outbox job drained before closing Stripe operations evidence.

Safety rules:
- Do not use real personal data, production credentials, live Stripe mode, production Privy secrets, or destructive git commands.
- Treat all provider tokens/keys pasted in the old chat as exposed. Do not repeat them. Recommend rotation before final evidence.
- Keep provider integrations behind narrow adapters/services.
- Do not commit `.env`, tokens, keys, screenshots with secrets, or output evidence containing secrets.

Highest-value next task:
Finish Stripe test-mode release evidence from the current staging deployment. First verify Render worker/outbox status, then collect redacted capture/cancel/refund/reconciliation/replay evidence, run the relevant validators, update docs, and report stage, completed work, checklist percentage, and remaining blockers.
```

If the new chat is only for status/reporting, ask it to summarize `docs/CODEX_HANDOFF.md` and list the open blockers from `docs/DEVELOPMENT_TASKS.md` without changing files.
