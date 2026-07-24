# FanPass Deployment Environments

Originally dated: 2026-05-29
Last updated: 2026-07-25

This document defines the minimum environment separation before FanPass is exposed outside local development.

Capacity, cost, global regional placement, paid-plan upgrades, and AWS/GCP migration decisions are governed by `docs/INFRASTRUCTURE_SCALING_PLAN.md`. The current Oregon Free services are staging-only. Production region selection must use actual organizer/event geography and latency evidence; it must not be inferred from demo city copy.

## Environment Tiers

| Tier       | Purpose                                         | Real users           | Real money                       | Demo auth |
| ---------- | ----------------------------------------------- | -------------------- | -------------------------------- | --------- |
| Local      | Developer/FYP demo loop                         | No                   | No                               | Allowed   |
| Staging    | Closed internal test of production-like runtime | No real public users | Stripe test mode only            | Forbidden |
| Production | Future pilot/MVP                                | Yes                  | Requires legal/payment readiness | Forbidden |

## Current Security RC

- Branch `codex/security-rc-20260724-qr-first`, current documentation head `7d77584e1dac520dc90562eea09edd6b01d5f793`, is pushed but not merged or deployed.
- The authoritative local gate passed 97/97; API 32 suites/386 tests; contracts 30/30; independent final review 0 P0/P1.
- Authenticated GitHub UI verification confirms exact-SHA Hosted runs `#93` for code candidate `ec3ab855a40f22670e41a4e727025b6ec6b80e97` and `#94` for documentation head `7d77584e1dac520dc90562eea09edd6b01d5f793` completed successfully. The local credential still receives 403 from private-repository Actions/Checks/Status API reads, so no validator-passing JSON attestation is claimed.
- The live Staging services remain on older revisions. Current-RC Staging, Privy, Stripe, Sepolia, signed-device, and physical-entry evidence remains open; no Staging mutation occurred during RC closeout.
- Render Auto-Deploy remains Off and every release must be triggered manually through the approved plugin or CLI. On 2026-07-25 an attempted instance-type change created deploy `dep-d9hp9vfavr4c739ikcsg` for `main` commit `b7cbc46668fa24d10afabb89fca58d023164845e`; it was canceled during checkout/cache download before the build or database command. The API was rechecked as Free with Save Changes disabled, and its last successful deploy remains `dep-d9ckdqsvikkc73d29km0` for `8f845a19e32bd072b4e6b4df6e61ce11a7548214`. The owner requires Free for now, so the maintenance-gated RC cutover must not start.

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
- Payments remain disabled for real-money use until all non-Stripe Beta blockers are closed and a deliberate release decision is made. Stripe test-mode PaymentIntents, signed webhooks, capture, refund, cancellation, reconciliation, replay/idempotency, and worker-drained outbox evidence were validated against the then-live Render revision on 2026-06-03; that historical receipt does not attest the current RC.
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

- `apps/api/src/main.ts`: `1ecf58b9fbb0e87338b19b5418300e5f24d60b9a229ee111834ceb4da70a1068`
- `apps/api/src/config/security-config.ts`: `be978ee16199269f3b19bc8cbab699845d1f2a9fdc59b804b4f3bcbd6f9728d2`
- `apps/api/.env.staging.example`: `42c50bfc9504f5398f21a749f76cbbdddb9e2877726d37fe5efa0eb57cf006c0`
- `apps/api/src/common/fanpass-socket-io.adapter.ts`: `0e06e35dd6da2c663b57f2ffaac9118a7b118109135f9029426a4a1588336d67`
- `apps/api/src/modules/alpha/alpha.controller.ts`: `79e13f9aef0ac0ca55f3a07a292fee56bc3c3df76361aa8a153a45b2c7109645`
- `apps/api/src/modules/side-effects/side-effect-health.service.ts`: `7abd0504c33e7397dd0c72ae046b4603da65cdc03f089cac4555307780a6d253`
- `apps/dashboard/server/console-bff.ts`: `ce609977c01dd0997bea354d70118fdd7cf764a57c72722ad15e88d4a7113464`
- `scripts/security-runtime-staging-check.sh`: `fc02f4f68c56d58f11a5b4b84fbb6f4bd371f443ccfbfd92643ca13e4fbf05b3`
- `scripts/staging-runtime-evidence-audit.js`: `cf68b3b97b4cc99c247fefd11ce50de4634279969163fd0ee5c90b72b46e17f9`
- `scripts/security-runtime-staging-local-dry-run.sh`: `a77c4900a9ec90e56a38c498d70b60dd36447af4d085dd6573651ec089be238e`
- `scripts/security-header-policy-audit.js`: `3148139970bbd64ea5362dc14b2fe161e186531d56c1707c6dbd9d01bab038ef`

Validate the saved evidence before treating the staging gate as closed:

```bash
npm run security:runtime:staging:evidence -- outputs/staging-runtime/20260529T120000Z.json
```

The evidence validator rejects local dry-run output by default, requires real HTTPS API/Console URLs, requires `apiRuntime.trustProxyHops` and a matching checked item, requires healthy admin side-effect outbox status, requires the current staging runtime implementation snapshot, requires deployment/cloud credential absence and redaction proof, requires CI secret masking command redaction proof, and fails if the evidence text contains obvious token, private-key, provider-key, database URL, deployment/cloud credential, or CI masking-command markers. Use `--allow-dry-run` only when validating local dry-run output during script development. Regenerate staging runtime evidence after any API header/bootstrap, production-like config, Console header, admin-health, WebSocket CORS, staging checker, evidence validator, dry-run helper, or header-policy audit change.

For local dry-runs only:

```bash
npm run security:runtime:staging:dry-run
```

The dry-run starts a staging-like API on port `4200` and a staging-like Console on port `3200`, with local Prisma storage, demo auth disabled, explicit one-hop trust-proxy configuration, unauthenticated Console locked, a staging-like HTTPS origin header for the orderbook Socket.IO check, and an ephemeral local ES256 keypair for the Privy-like admin bearer check. The dry-run stops any local Console dev screen on port `3000` before building the Vite/Node BFF Console. Run `npm run beta:local:start` afterwards when you want the Prisma-backed local Console restored. Do not treat a local dry-run as deployed staging evidence.

## Deployment Order

1. Freeze and push one reviewed RC SHA to a non-linked review branch. Confirm API, Console, and Auth service Auto-Deploy are Off, overlapping deploys use `Wait`, and either no Blueprint manages them or Blueprint Auto Sync is No. Do not merge or push `render.yaml` to a Blueprint-linked branch, create a paid preview, or deploy from an uncommitted tree before owner approval.
2. Obtain owner approval, then change **only** the existing API service instance type to `starter` through Render service Settings or the service API. Do not use Blueprint sync for this first plan change, and do not change source revision, build command, environment, schema, or Console/Auth plans. Verify the plan-change deploy remains on the exact old live SHA and all other service configuration is unchanged; stop on any drift. Only after the paid instance is live may you enable API Maintenance Mode and prove the public origin consistently returns `503`. Blueprint/build configuration remains frozen until that `503` and request drain are proven.
3. On the exact old live API SHA, apply `FANPASS_SIDE_EFFECT_WORKER_ENABLED=false` and `SIDE_EFFECT_WORKER_LIMIT=1`. Wait until it is the sole instance and the old process has passed the documented handoff/shutdown window.
4. Export the Staging PostgreSQL custom-format backup, verify it with `pg_restore --list`, preferably restore it to a disposable database, and record the redacted outbox/provider census. Stop on any active or ambiguous provider operation.
5. Configure API environment from `apps/api/.env.staging.example`, including the reviewed legacy ownership route and the precomputed Staging database identity digest. The identity-only gate must pass before any mutation; never print the URL or digest.
6. Phase A: keep the old global ticket contract, run the guarded deployment chain, deploy the route-aware RC SHA with worker disabled, and require the full read-only preflight plus `/health` before public traffic can resume. Duplicate submissions, unknown jobs, incomplete routes, or an unpaused database stop the release; `--accept-data-loss` is forbidden.
7. Deploy the protected Sepolia contract only after Phase A is the sole API revision. Verify chain ID, owner, bytecode, ABI, and protected artifact before the first mint.
8. Phase B: deploy the same RC SHA with the new global contract while per-ticket routes preserve existing tickets. Enable exactly one bound probe at limit `1`; the database automatically pauses again after the claim. Never roll back past the route-aware boundary after the first mint.
9. Configure and deploy Console/Auth from their reviewed templates, then verify unauthenticated sign-in, Privy cookie handoff, DRAFT 404, orderbook reconnect/admission, Stripe test mode, and ownership issue/transfer/redeem over real HTTPS.
10. Save and validate the runtime evidence, then run one `Changes` security validation against the completed baseline. Do not start another Deep Scan for this release.

## Current Open Items

- Neon staging database exists with the schema and catalog used by the current old live revision. The security RC's dispatch-fence, wallet-provenance, sponsored-payment, and per-ticket-routing schema changes have not been installed; apply them only through the maintenance-gated, identity-bound Phase A release chain.
- Render API service `fanpass-api-staging` is live at `https://fanpass-api-staging.onrender.com` from `main`. Deploy `dep-d9ckdqsvikkc73d29km0` for commit `8f845a19e32bd072b4e6b4df6e61ce11a7548214` is live; the guarded schema step and atomic public catalog/Fan Access upsert passed, `/health` returned 200, `/events` returned 11/11 `PUBLISHED`, a former DRAFT detail returned 404, and the deployed runtime security check passed on 2026-07-17.
- The live service-level API build command still uses `npm run prisma:push -w apps/api` and differs from the desired explicit audit/build/migration order in `render.yaml`. The old live revision completed its historical guarded deploy, but this is not a safe first-cutover mechanism for the new dispatch fence: Render would mutate the database while the pre-fence API remains publicly reachable and able to call Stripe/Privy directly. Reconcile the drift only inside a verified maintenance window after traffic drain and backup; do not treat the earlier CLI success response as applied configuration.
- Historical Vercel Console project `fanpass-dashboard` is live at `https://fanpass-dashboard.vercel.app`, but that evidence belongs to the old Next runtime.
- Current Vite/Node Console service `fanpass-console-staging` is live at `https://fanpass-console-staging.onrender.com` from `main`. Deploy `dep-d99l8ics728c73ddl6c0` for the same commit is live and the root returned HTTP 200 on 2026-07-12.
- Cookie-backed Console mutations in staging currently allow the Render Console origin `https://fanpass-console-staging.onrender.com` through `FANPASS_CONSOLE_ORIGINS`; the old dashboard origin itself should not be assumed to be an allowed mutation origin.
- A 2026-06-07 deployed runtime check against the Render Console saved passing output at `outputs/staging-runtime/20260606T180256Z-render-console-vite-node-admin.json`. It proves deployed API/Console headers, disabled demo auth, unauthenticated Console API rejection, orderbook CORS for the new Console origin, and admin side-effect outbox health with a fresh staging admin bearer that was not stored in evidence.
- Render `FANPASS_CORS_ORIGINS` is updated to include `https://fanpass-console-staging.onrender.com` for the current Vite/Node Console, and the API was redeployed after the change.
- `npm run security:runtime:staging` and `npm run security:runtime:staging:evidence` passed against the real Render/Vercel HTTPS URLs with a real staging Privy admin bearer copied from the FanPass Ops simulator. The saved evidence proves the positive admin side-effect outbox health check without storing the bearer token.
- Stripe dashboard test-mode webhook setup, native iOS PaymentSheet authorization, capture, cancellation, refund, reconciliation, duplicate replay/idempotency, and healthy residual outbox state have been validated against the Render staging API. The saved evidence is `outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json` and passed `npm run security:stripe-testmode:evidence -- outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json`.
- The historical Render side-effect worker scheduler settings were `FANPASS_SIDE_EFFECT_WORKER_ENABLED=true`, `FANPASS_SIDE_EFFECT_WORKER_INTERVAL_MS=15000`, and `SIDE_EFFECT_WORKER_LIMIT=10`; logs reviewed on 2026-06-03 showed one prior completed run. Those values must be changed to the reviewed RC posture (`FANPASS_SIDE_EFFECT_WORKER_ENABLED=false`, limit `1`) while public traffic is blocked and before the first fence migration. Historical log proof does not authorize dispatch or replace the final census/preflight.
- Render one-off jobs cannot currently be used as the free-plan outbox-health fallback; the Render API rejected a one-off `side-effects:health` job on 2026-06-03 because free-tier plans are not supported for jobs.
- FanPass Console React SDK login is integrated through the isolated Auth runtime. Staging browser-SDK login hands the token to the exact Console bridge through a top-level POST so the Console host sets its HttpOnly session cookie as a first-party response; production still requires the separate verified-domain Privy HttpOnly-cookie configuration and evidence.
- TestFlight/App Store distribution is not planned yet.

## High-Demand On-Sale Runtime - 2026-07-12

- Render must define a production-grade `FANPASS_ONSALE_QUEUE_SECRET`; production-like validation fails when it is absent or weak.
- The guarded Render deploy step applies the Staging schema and atomically upserts the Aurora on-sale policy/allocation ledger before the build can pass; application startup is read/runtime initialization only.
- Neon remains the final inventory authority; no edge/cache counter may sell a ticket.
- Current Render/Neon staging is for functional and moderate concurrency testing. Do not expose it directly to concert-scale polling.
- Before a major sale, place a managed edge waiting room in front of the API and admit bounded cohorts with short-lived signed tokens.
- Cache public aggregate snapshots and fan them out; exact private queue status must remain authenticated.
- Queue/card/install linkage secrets and hashes must never appear in deployment evidence or logs.
