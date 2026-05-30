# Staging Deployment Free Path

Status: Neon staging database is provisioned and the Render API is live on the free HTTPS hostname. Vercel Console deployment and the final deployed staging evidence bundle remain open.

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

`FANPASS_CORS_ORIGINS` is temporarily pointed at the planned Vercel staging origin. After the real Vercel Console URL exists, update Render `FANPASS_CORS_ORIGINS` to that exact origin and redeploy the API. It must be an origin only, for example:

```text
https://fanpass-console-staging.vercel.app
```

Do not use `localhost`, wildcard origins, production credentials, real personal data, or live Stripe mode.

## Console on Vercel

Create the Vercel project from the same repository with root directory:

```text
apps/dashboard
```

Set:

```text
FANPASS_ENV=staging
FANPASS_API_BASE_URL=https://<render-api-host>
NEXT_PUBLIC_API_BASE_URL=https://<render-api-host>
FANPASS_CONSOLE_ORIGINS=https://<vercel-console-host>
```

After the Console URL exists, update Render `FANPASS_CORS_ORIGINS` to the same Vercel origin and redeploy the API.

## Validation

Run the deployed runtime check without printing tokens:

```bash
STAGING_API_URL=https://<render-api-host>/health \
STAGING_CONSOLE_URL=https://<vercel-console-host>/ \
FANPASS_TRUST_PROXY_HOPS=1 \
npm run security:runtime:staging
```

Save the JSON output under `outputs/staging-runtime/`, then validate it:

```bash
npm run security:runtime:staging:evidence -- outputs/staging-runtime/<saved-json>.json
```

The deployed staging gate is not closed until that evidence passes.
