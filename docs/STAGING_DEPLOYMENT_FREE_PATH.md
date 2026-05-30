# Staging Deployment Free Path

Status: Neon staging database is provisioned; Render API and Vercel Console still need external project creation because Render tooling is not exposed in this Codex session and this checkout has no Git remote configured.

## Targets

- Database: Neon Postgres project `fanpass-staging`.
- API: Render free web service from `render.yaml`.
- Console: Vercel Next.js project rooted at `apps/dashboard`.

## API on Render

Use `render.yaml` as the blueprint. Keep these values secret in Render environment settings:

- `DATABASE_URL`
- `QR_SIGNING_SECRET`
- `SESSION_SIGNING_SECRET`
- `PRIVY_VERIFICATION_KEY`
- future `STRIPE_SECRET_KEY`
- future `STRIPE_WEBHOOK_SECRET`

Set `FANPASS_CORS_ORIGINS` after the Vercel Console URL exists. It must be an origin only, for example:

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
