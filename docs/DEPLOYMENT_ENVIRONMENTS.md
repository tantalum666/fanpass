# FanPass Deployment Environments

Date: 2026-05-29

This document defines the minimum environment separation before FanPass is exposed outside local development.

## Environment Tiers

| Tier       | Purpose                                         | Real users           | Real money                       | Demo auth |
| ---------- | ----------------------------------------------- | -------------------- | -------------------------------- | --------- |
| Local      | Developer/FYP demo loop                         | No                   | No                               | Allowed   |
| Staging    | Closed internal test of production-like runtime | No real public users | Stripe test mode only            | Forbidden |
| Production | Future pilot/MVP                                | Yes                  | Requires legal/payment readiness | Forbidden |

## Required Staging Properties

- All public origins must use HTTPS.
- `FANPASS_ENV=staging`.
- API demo sessions must be disabled with `FANPASS_ENABLE_DEMO_AUTH=false`.
- API must require Privy access-token verification.
- API must set an explicit `FANPASS_TRUST_PROXY_HOPS` value for the deployed HTTPS edge/proxy path so rate limits use the real client IP instead of trusting unbounded spoofable forwarding headers.
- Console must not auto-create local demo sessions.
- Console cookie-backed mutation routes must require an allowed Console origin through `FANPASS_CONSOLE_ORIGINS`.
- API and Console must not expose `x-powered-by`.
- API and Console must return baseline security headers.
- The Socket.IO `/orderbook` feed must accept only the configured Console/app origins and must not expose private payment, QR, scanner, Privy, or user email fields.
- Payments remain disabled for real-money use until all non-Stripe Beta blockers are closed and a deliberate release decision is made. Stripe test-mode PaymentIntents, signed webhooks, capture, refund, cancellation, reconciliation, replay/idempotency, and worker-drained outbox evidence were validated against Render staging on 2026-06-03.
- Privy webhooks remain optional until plan support is verified.

## Environment Templates

Use these files as templates only. Do not commit populated `.env` files.

- API local: `apps/api/.env.example`
- API staging: `apps/api/.env.staging.example`
- Console local: `apps/dashboard/.env.example`
- Console staging: `apps/dashboard/.env.staging.example`
- Free staging path: `docs/STAGING_DEPLOYMENT_FREE_PATH.md`

## Staging Verification

After deploying API and Console, run:

```bash
mkdir -p outputs/staging-runtime
STAGING_API_URL=https://api.staging.example/health \
STAGING_CONSOLE_URL=https://console.staging.example/ \
STAGING_API_TRUST_PROXY_HOPS=1 \
STAGING_ADMIN_ACCESS_TOKEN="$STAGING_ADMIN_ACCESS_TOKEN" \
npm run security:runtime:staging | tee "outputs/staging-runtime/$(date -u +%Y%m%dT%H%M%SZ).json"
```

`STAGING_ADMIN_ACCESS_TOKEN` must come from a real staging admin session source, such as the staging Privy/Console login path or a short-lived staging-only admin bearer issued by the approved auth process. Do not use local demo sessions, do not paste production credentials, and do not commit populated token values.

`STAGING_API_TRUST_PROXY_HOPS` must match the deployed API `FANPASS_TRUST_PROXY_HOPS` value and must be a bounded 1-3 hop count for the HTTPS edge/proxy path.

The check verifies:

- API security headers.
- Console security headers.
- `x-powered-by` is absent from both surfaces.
- API refuses `/auth/demo-session`.
- API staging evidence records the configured trust-proxy hop count used for rate-limit client IP handling.
- Admin-only `/alpha/side-effects/health` refuses unauthenticated access.
- Admin-only `/alpha/side-effects/health` returns healthy, payload-free outbox status when a staging admin bearer is supplied.
- unauthenticated Console renders a locked or sign-in state.
- `/orderbook` Socket.IO accepts the configured Console origin and sends a public snapshot.
- `/orderbook` Socket.IO rejects a disallowed origin.

The saved JSON evidence must include:

- `"ok": true`
- `"localDryRun": false`
- `"deploymentCredentialsAvailable": false`
- `"implementationSnapshot": { "source": "staging-runtime-security-boundaries", "files": [...] }`
- a real HTTPS `apiUrl` and `consoleUrl`
- `"apiRuntime": { "trustProxyHops": 1 }` or the documented 1-3 hop value used by the deployed API
- `"adminSideEffectHealth": "admin side-effect outbox health ok"`
- `"redaction": { "deploymentCredentialsRedacted": true, "ciSecretMaskingCommandsRedacted": true }`
- orderbook event/ticket type ids used for the check
- the checked header, demo-session, unauthenticated admin-health, admin-health, trust-proxy hop, and WebSocket CORS items

The current implementation snapshot files and SHA-256 hashes are:

- `apps/api/src/main.ts`: `955e81fae5436f0301a23e32d69e3c60c9741d1ca277736e43ffb7037b6efe5a`
- `apps/api/src/config/security-config.ts`: `a61e7eec663335936a94f64baf6b15c15722dd22bb6a02b3750a4ac6c954a3a2`
- `apps/api/.env.staging.example`: `fbb6955c0a223ac163174d0726fd5d3086454a7ef5b70ca7f826851360cd4f1a`
- `apps/api/src/common/fanpass-socket-io.adapter.ts`: `148f80303b5dac2b8310c58a952c42a1a5d70f03c1f76a459a46b4cd7f71a246`
- `apps/api/src/modules/alpha/alpha.controller.ts`: `79e13f9aef0ac0ca55f3a07a292fee56bc3c3df76361aa8a153a45b2c7109645`
- `apps/api/src/modules/side-effects/side-effect-health.service.ts`: `0804138b2db924583c48869ad998a70b38dfdb077d3e0ac00c33d56235a20dfe`
- `apps/dashboard/next.config.ts`: `9baf7b153279ef1de2cfc566adb0b9e9b4a03fdb6d1afd4bd7d6e51dd8735e75`
- `scripts/security-runtime-staging-check.sh`: `cb9ac39b3b6035b06ec76bc5de08bc53576434d59fc7d6a71fb5247c86855275`
- `scripts/staging-runtime-evidence-audit.js`: `32146678533c94e5f813803ce1f235274b7dca462bd660495ffae7b87d246ab7`
- `scripts/security-runtime-staging-local-dry-run.sh`: `69ee2213d6fa06596baf713d82c475e490f5ad83432723a68a9082747b1bce49`
- `scripts/security-header-policy-audit.js`: `5e4821dca0ae34efe862dfd2ebc04b217a3de2ce43e2a87b7f02b40be3e04876`

Validate the saved evidence before treating the staging gate as closed:

```bash
npm run security:runtime:staging:evidence -- outputs/staging-runtime/20260529T120000Z.json
```

The evidence validator rejects local dry-run output by default, requires real HTTPS API/Console URLs, requires `apiRuntime.trustProxyHops` and a matching checked item, requires healthy admin side-effect outbox status, requires the current staging runtime implementation snapshot, requires deployment/cloud credential absence and redaction proof, requires CI secret masking command redaction proof, and fails if the evidence text contains obvious token, private-key, provider-key, database URL, deployment/cloud credential, or CI masking-command markers. Use `--allow-dry-run` only when validating local dry-run output during script development. Regenerate staging runtime evidence after any API header/bootstrap, production-like config, Console header, admin-health, WebSocket CORS, staging checker, evidence validator, dry-run helper, or header-policy audit change.

For local dry-runs only:

```bash
npm run security:runtime:staging:dry-run
```

The dry-run starts a staging-like API on port `4200` and a staging-like Console on port `3200`, with local Prisma storage, demo auth disabled, explicit one-hop trust-proxy configuration, unauthenticated Console locked, a staging-like HTTPS origin header for the orderbook Socket.IO check, and an ephemeral local ES256 keypair for the Privy-like admin bearer check. Because Next dev and Next production builds share `apps/dashboard/.next`, this dry-run stops any local Console dev screen on port `3000` before building. Run `npm run beta:local:start` afterwards when you want the Prisma-backed local Console restored. Do not treat a local dry-run as deployed staging evidence.

## Deployment Order

1. Provision managed Postgres for staging. The current Neon project is `fanpass-staging`; do not commit or print its connection string.
2. Configure API environment from `apps/api/.env.staging.example`.
3. Run Prisma schema push/migration for staging only after confirming the database is not production.
4. Deploy API and verify `/health`. Current API origin: `https://fanpass-api-staging.onrender.com`.
5. Configure Console environment from `apps/dashboard/.env.staging.example`.
6. Deploy Console and verify unauthenticated locked/sign-in state.
7. Run `npm run security:runtime:staging` with real HTTPS URLs.
8. Save the JSON command output under `outputs/staging-runtime/`, validate it with `npm run security:runtime:staging:evidence -- <file>`, and summarize the result in `docs/ALPHA_SECURITY_REVIEW.md` before treating staging checks as closed.

## Current Open Items

- Neon staging database exists and has the current Prisma schema plus local demo seed data.
- Render API service `fanpass-api-staging` is live at `https://fanpass-api-staging.onrender.com`; `/health` returned 200 on 2026-05-31 and again on 2026-06-03 after a free-plan cold start.
- Render reported the live deploy as `07d4cb6dad9dfa4cf8f2a8ff254d20d6d72c818d` (`Use Word report for FanPass handoff`) on 2026-06-03. The worker scheduler code remains from the earlier deployed `75b4e68bc7835bc2d4532259a3cecac2ab8e99da` commit.
- Vercel Console project `fanpass-dashboard` is live at `https://fanpass-dashboard.vercel.app`; the first Vercel build failed on Node 24, then passed after `apps/dashboard/package.json` pinned Node `>=22 <23`.
- Render `FANPASS_CORS_ORIGINS` is updated to `https://fanpass-dashboard.vercel.app` and the API was redeployed after the change.
- `npm run security:runtime:staging` and `npm run security:runtime:staging:evidence` passed against the real Render/Vercel HTTPS URLs with a real staging Privy admin bearer copied from the FanPass Ops simulator. The saved evidence proves the positive admin side-effect outbox health check without storing the bearer token.
- Stripe dashboard test-mode webhook setup, native iOS PaymentSheet authorization, capture, cancellation, refund, reconciliation, duplicate replay/idempotency, and healthy residual outbox state have been validated against the Render staging API. The saved evidence is `outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json` and passed `npm run security:stripe-testmode:evidence -- outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json`.
- Render side-effect worker scheduler is enabled in staging through Render environment settings: `FANPASS_SIDE_EFFECT_WORKER_ENABLED=true`, `FANPASS_SIDE_EFFECT_WORKER_INTERVAL_MS=15000`, and `SIDE_EFFECT_WORKER_LIMIT=10`. Render logs reviewed on 2026-06-03 showed the scheduler enabled at 15000 ms and a prior worker run with `processed=1 completed=1 retried=0 dead=0 recovered=0`. This log proof does not replace the final admin outbox-health API or Neon SQL proof for the latest Stripe operation sequence.
- Render one-off jobs cannot currently be used as the free-plan outbox-health fallback; the Render API rejected a one-off `side-effects:health` job on 2026-06-03 because free-tier plans are not supported for jobs.
- Privy product login works in simulator paths used for evidence collection; FanPass Console React SDK login is not integrated.
- TestFlight/App Store distribution is not planned yet.
