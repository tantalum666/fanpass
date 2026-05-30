# Staging Deployment Free Path

Status: Neon staging database is provisioned, the Render API is live on the free HTTPS hostname, the Vercel Console is live on the free HTTPS hostname, and the deployed staging evidence bundle passes with a real staging Privy admin bearer from the iOS simulator login path.

## Targets

- Database: Neon Postgres project `fanpass-staging`.
- API: Render free web service `fanpass-api-staging`.
- Console: Vercel Next.js project rooted at `apps/dashboard`.

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

`FANPASS_CORS_ORIGINS` is set to the current Vercel Console origin and the API was redeployed after the update:

```text
https://fanpass-dashboard.vercel.app
```

Do not use `localhost`, wildcard origins, production credentials, real personal data, or live Stripe mode.

## Console on Vercel

Current service:

```text
https://fanpass-dashboard.vercel.app
```

The Vercel project is `fanpass-dashboard`, rooted at `apps/dashboard`, and the dashboard package pins Node `>=22 <23` so Vercel does not build it with Node 24.

Create the Vercel project from the same repository with root directory:

```text
apps/dashboard
```

Set:

```text
FANPASS_ENV=staging
FANPASS_API_BASE_URL=https://fanpass-api-staging.onrender.com
NEXT_PUBLIC_API_BASE_URL=https://fanpass-api-staging.onrender.com
FANPASS_CONSOLE_ORIGINS=https://fanpass-dashboard.vercel.app
```

## Validation

Run the deployed runtime check without printing tokens:

```bash
STAGING_API_URL=https://<render-api-host>/health \
STAGING_CONSOLE_URL=https://<vercel-console-host>/ \
STAGING_API_TRUST_PROXY_HOPS=1 \
npm run security:runtime:staging
```

Save the JSON output under `outputs/staging-runtime/`, then validate it:

```bash
npm run security:runtime:staging:evidence -- outputs/staging-runtime/<saved-json>.json
```

The deployed staging gate is closed for the Render/Vercel free-path runtime checks after the 2026-05-31 run with a real Privy admin bearer copied from the FanPass Ops simulator. The accepted evidence proves API/Console headers, disabled demo sessions, unauthenticated admin-health rejection, authenticated admin side-effect outbox health, unauthenticated Console locked/sign-in rendering, API trust-proxy hop configuration, and orderbook WebSocket origin checks without storing the bearer token in source control or saved evidence.
