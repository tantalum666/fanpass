# Staging Deployment Free Path

Status: Neon staging database is provisioned, the Render API is live on the free HTTPS hostname, and the current Vite/Node Console is deployed as `fanpass-console-staging` on Render. The old Vercel/Next Console evidence is historical after the 2026-06-06 source migration. Fresh deployed runtime evidence for the Render API plus Render Vite/Node Console passed on 2026-06-07, including the admin side-effect outbox health check with a fresh staging admin bearer that was not stored in the evidence.

## Targets

- Database: Neon Postgres project `fanpass-staging`.
- API: Render free web service `fanpass-api-staging`.
- Console: Render free Node web service `fanpass-console-staging`.

## API on Render

Current service:

```text
https://fanpass-api-staging.onrender.com
```

Health check verified on 2026-05-31:

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

The current staging API also runs the production-like side-effect worker scheduler from the API process. These values are configured in Render environment settings, not source control:

```text
FANPASS_SIDE_EFFECT_WORKER_ENABLED=true
FANPASS_SIDE_EFFECT_WORKER_INTERVAL_MS=15000
SIDE_EFFECT_WORKER_LIMIT=10
```

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
FANPASS_CONSOLE_AUTH_ORIGIN=https://fanpass-console-staging.onrender.com
VITE_CONSOLE_AUTH_BASE_URL=https://fanpass-console-staging.onrender.com
```

`STAGING_CONSOLE_URL` must be the deployed Node BFF Console URL for the current source. The `FANPASS_CONSOLE_ORIGINS` value is the allowed browser origin for cookie-backed Console mutations from the isolated auth bridge; requests from other origins should remain rejected by the mutation-origin guard.

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

Stripe-specific staging status on 2026-05-31: dashboard test-mode webhook setup and native iOS PaymentSheet authorization were exercised against this Render API. Before closing the Stripe release gate, save and validate full test-mode evidence for capture, cancellation, refund, reconciliation, duplicate replay/idempotency, and healthy residual side-effect outbox state.
