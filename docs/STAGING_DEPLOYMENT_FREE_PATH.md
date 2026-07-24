# Staging Deployment Free Path

Status: Neon staging is provisioned, and the Render API plus Vite/Node Console are live from `main`. The old Vercel/Next Console evidence is historical after the 2026-06-06 source migration. Runtime evidence passed on 2026-06-07, and public API/Console smoke passed again on 2026-07-12 after the branch consolidation and payment-response hardening deployment. This document describes the historical free-tier functional environment; it is not the runbook for the 2026-07-20 security RC cutover. That first dispatch-fence migration requires the maintenance-gated sequence in `docs/ALPHA_RUNBOOK.md` and cannot run safely on Render Free.

The pushed security RC is branch `codex/security-rc-20260720`, immutable commit `a25185d2747520303eac0fd2681017b5c35ac62b`. It has not been merged or deployed, and this historical Free path does not attest it.

## Targets

- Database: Neon Postgres project `fanpass-staging`.
- API: Render free web service `fanpass-api-staging`.
- Console: Render free Node web service `fanpass-console-staging`.

## API on Render

Current service:

```text
https://fanpass-api-staging.onrender.com
```

Health check verified again on 2026-07-12:

```text
GET https://fanpass-api-staging.onrender.com/health -> 200
{"ok":true,"service":"fanpass-api","target":"technical-prototype"}
```

Use `render.yaml` as the reproducible configuration baseline. Keep these values secret in Render environment settings:

- `DATABASE_URL`
- `QR_SIGNING_SECRET`
- `SESSION_SIGNING_SECRET`
- `PRIVY_VERIFICATION_KEY`
- future `STRIPE_SECRET_KEY`
- future `STRIPE_WEBHOOK_SECRET`

`FANPASS_CORS_ORIGINS` must be set to the current HTTPS Console origin before collecting deployed staging evidence. Historical evidence used:

```text
https://fanpass-dashboard.vercel.app
```

Do not use `localhost`, wildcard origins, production credentials, real personal data, or live Stripe mode.

The live service historically ran the side-effect scheduler in the API process with the following settings:

```text
FANPASS_SIDE_EFFECT_WORKER_ENABLED=true
FANPASS_SIDE_EFFECT_WORKER_INTERVAL_MS=15000
SIDE_EFFECT_WORKER_LIMIT=10
```

Those values are historical state, not current deployment instructions. Before the first security RC migration, move the Staging API to a Maintenance-Mode-capable paid instance, prove public `503`, drain old requests, and change the exact live revision to:

```text
FANPASS_SIDE_EFFECT_WORKER_ENABLED=false
SIDE_EFFECT_WORKER_LIMIT=1
```

Keep the scheduler disabled throughout Phase A, the new-contract deployment, Phase B, and the exact bound probe. A manual route-aware worker may claim only the single database-bound probe after `resume --probe-limit 1`; the database must auto-pause on that claim. Do not use free-tier sleep or suspend/resume as a maintenance substitute.

## Console HTTPS Deployment

Historical service:

```text
https://fanpass-dashboard.vercel.app
```

Current Render service:

```text
https://fanpass-console-staging.onrender.com
```

The historical Vercel project was `fanpass-dashboard`, rooted at `apps/dashboard`, from the old Next runtime. After the 2026-06-06 migration, `apps/dashboard` should be deployed as a Node service that serves the Vite build through `apps/dashboard/server/console-bff.ts`. `render.yaml` now includes a `fanpass-console-staging` service definition for this path.

Expected build/start commands:

```bash
npm install
npm run build -w apps/dashboard
npm run start -w apps/dashboard
```

The deployed Render Console origin used by cookie-backed mutations is:

```text
https://fanpass-console-staging.onrender.com
```

Set:

```text
FANPASS_ENV=staging
FANPASS_API_BASE_URL=https://fanpass-api-staging.onrender.com
VITE_API_BASE_URL=https://fanpass-api-staging.onrender.com
FANPASS_CONSOLE_ORIGINS=https://fanpass-console-staging.onrender.com
FANPASS_CONSOLE_AUTH_ORIGIN=https://fanpass-console-auth-staging.onrender.com
VITE_CONSOLE_AUTH_BASE_URL=https://fanpass-console-auth-staging.onrender.com
```

`STAGING_CONSOLE_URL` must be the deployed Node BFF Console URL for the current source. `FANPASS_CONSOLE_ORIGINS` is the exact browser origin allowed to perform cookie-backed Console mutations. The two Auth values must point to the separate isolated Console Auth service; pointing them back to the Console creates a login loop. Requests from other origins remain rejected by the mutation-origin guard. For any current cutover, use `apps/dashboard/.env.staging.example` and `render.yaml` as the executable configuration sources rather than this historical Free-path note.

## Validation

Run the deployed runtime check without printing tokens:

```bash
STAGING_API_URL=https://<render-api-host>/health \
STAGING_CONSOLE_URL=https://<console-host>/ \
STAGING_API_TRUST_PROXY_HOPS=1 \
npm run security:runtime:staging
```

Save the JSON output under `outputs/staging-runtime/`, then validate it:

```bash
npm run security:runtime:staging:evidence -- outputs/staging-runtime/<saved-json>.json
```

The deployed staging gate was closed for the historical Render/Vercel free-path runtime checks after the 2026-05-31 run with a real Privy admin bearer copied from the FanPass Ops simulator. After the 2026-06-07 Render Console deployment, refreshed evidence passed at `outputs/staging-runtime/20260606T180256Z-render-console-vite-node-admin.json`, covering deployed API/Console headers, demo-auth rejection, unauthenticated Console API rejection, orderbook CORS probes, and admin side-effect outbox health for the new Render Console origin.

The latest recorded public smoke on 2026-07-17 passed API `/health`, API `/events`, DRAFT-detail rejection, the Render Console root, and the deployed runtime security checks. The current live API and Console source revision is `8f845a19e32bd072b4e6b4df6e61ce11a7548214`; the newer security RC is not deployed. Exact deploy ids and the service-level build-command drift are recorded in `docs/CODEX_HANDOFF.md` and `docs/DEPLOYMENT_ENVIRONMENTS.md`.

Stripe-specific historical staging evidence covers dashboard test-mode webhook setup, native iOS PaymentSheet authorization, capture, cancellation, refund, reconciliation, duplicate replay/idempotency, and healthy residual outbox state in the saved 2026-06-03 packet. The current security RC still requires fresh post-cutover Stripe/worker crash-boundary evidence; historical provider evidence cannot attest changed saga code.
