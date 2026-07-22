# FanPass Alpha Runbook

Use this file for the persistent Alpha data foundation.

## Local Postgres

Alpha uses PostgreSQL through Prisma.

Default local URL:

```bash
postgresql://fanpass:fanpass@localhost:5432/fanpass
```

On this machine, `postgresql@16` has been installed with Homebrew because Docker is not available in the current shell.

Start Postgres:

```bash
brew services start postgresql@16
```

## Reviewed Schema Deployment Order

Do not run a Staging mutation command until all of the following are true: the paid API service is in Maintenance Mode and public `503` is proven; the pre-fence API and worker have drained; a PostgreSQL custom-format backup passes `pg_restore --list` (preferably including a disposable restore); `FANPASS_SIDE_EFFECT_WORKER_ENABLED=false` and limit `1` are active on the sole old revision; and the approved Staging database identity digest has been recorded without exposing it. A local or CI disposable database follows its own explicitly reviewed bootstrap path.

Only after that stop gate is satisfied, the guarded Staging command is:

```bash
npm run prisma:deploy -w apps/api
```

The command first runs a schema-independent, read-only identity check against the same `DATABASE_URL`; only a matching database name, user, and canonical target digest may enter the mutation chain. It then installs the default-paused database dispatch control, runs the uniqueness precheck and guarded Prisma schema update, and applies wallet-binding provenance, durable sponsored-crypto constraints, ticket-route enforcement, legacy route backfill, route validation, and the atomic public catalog sync. The route backfill requires the reviewed legacy adapter/address/chain settings and fails closed on ambiguous provenance. Do not reorder these steps, bypass the identity gate, add `--accept-data-loss`, or mark legacy wallet bindings as verified without authoritative Privy proof.

After migration, run the full read-only gate in `docs/STAGING_DB_RELEASE_PREFLIGHT.md`. Exit `0` proves only that the captured snapshot is drained and dispatch remains paused; it never authorizes worker enablement. Confirm the cloud service used the reviewed command instead of trusting a CLI update response. Production must eventually replace guarded schema push with immutable reviewed migrations; this is the current controlled Staging bridge, not the final migration architecture.

## Reset And Seed Alpha DB

```bash
npm run alpha:db:reset
```

This command:

- waits for local Postgres;
- runs `prisma db push`;
- clears existing Alpha tables;
- seeds deterministic demo data shared with the in-memory prototype store.

Expected seed result:

```json
{
  "ok": true,
  "users": 4,
  "events": 1,
  "tickets": 1,
  "fanTasks": 2
}
```

## Check Persistence Status

Start local services:

```bash
npm run prototype:start
```

The start script stops any existing local API/Console screens, builds the Vite/Node BFF Console, starts both services, and only exits successfully after:

- `http://localhost:4000/health` responds;
- `http://localhost:3000` renders `FanPass Console`.

If `localhost:3000` does not render the Console, run:

```bash
npm run prototype:start
```

That restarts both services from a fresh local build.

## Local Security Runtime Checks

Security Pass 2 added startup validation, API rate limits, and baseline security headers. Security Pass 3 added backend Privy access-token verification for production-like builds.

Local API configuration knobs:

```bash
FANPASS_ENV=local
QR_SIGNING_SECRET=replace-with-local-dev-secret
SESSION_SIGNING_SECRET=replace-with-local-session-secret
PRIVY_APP_ID=
PRIVY_VERIFICATION_KEY=
FANPASS_CORS_ORIGINS=http://localhost:3000,http://localhost:4000
RATE_LIMIT_GENERAL_PER_MINUTE=600
RATE_LIMIT_AUTH_PER_MINUTE=30
RATE_LIMIT_VERIFY_PER_MINUTE=120
RATE_LIMIT_PRIVY_PER_MINUTE=12
RATE_LIMIT_PRIVY_ORIGIN_PER_MINUTE=300
RATE_LIMIT_STAFF_INVITE_PER_MINUTE=6
RATE_LIMIT_STAFF_ASSIGNMENT_PER_MINUTE=30
```

Local builds can keep using demo/email sessions for simulator and prototype speed. Production-like builds must use Privy bearer tokens: the API verifies the ES256 JWT signature with `PRIVY_VERIFICATION_KEY`, requires `iss=privy.io`, requires `aud=PRIVY_APP_ID`, checks expiry, and maps `sub` to `users.privy_id`.

`RATE_LIMIT_AUTH_PER_MINUTE` does not also count the dedicated Privy sync and staff-invite routes. Console Privy sync is limited per non-plaintext access-token fingerprint by `RATE_LIMIT_PRIVY_PER_MINUTE`, with `RATE_LIMIT_PRIVY_ORIGIN_PER_MINUTE` retained as a higher network flood ceiling. Do not collapse these back into one low IP-only bucket: deployed Console traffic reaches the API through a shared service egress IP, so doing so rate-limits unrelated organizers as one caller.

FanPass Console local builds can still fetch a local organizer demo token. Production-like Console builds do not fall back to demo auth and never accept a process-wide Console bearer as a substitute for the current user. They require a Privy-backed Console session in the secure HttpOnly cookie; otherwise the page renders a locked state and does not request operational data.

Console organizer sessions are event-scoped. An organizer can only read operations data and add ticket types for events owned by their linked `Organizer` profile. Admin sessions keep the global operations view.

FanPass Ops gate staff sessions are event/gate-scoped. The seeded gate user `usr_gate_demo` is assigned only to `evt_weekend_demo` gate `A1`. Attempts to redeem or view gate summaries for other gates are rejected before any check-in is recorded.

Production-like runtimes are detected when `NODE_ENV=production`, `FANPASS_ENV=production`, or `FANPASS_ENV=staging`. In those environments the API refuses to start if:

- `QR_SIGNING_SECRET` is missing, under 32 characters, or a local placeholder;
- `PRIVY_APP_ID` or `PRIVY_VERIFICATION_KEY` is missing or not a Privy PEM public key;
- `FANPASS_ENABLE_DEMO_AUTH=true`;
- `FANPASS_CORS_ORIGINS` is missing, wildcarded, invalid, or non-HTTPS;
- `FANPASS_TRUST_PROXY_HOPS` is missing or outside the 1-3 hop deployment edge/proxy range;
- numeric TTL/rate-limit values are outside the accepted range.

Deployed staging runtime evidence must pass the same trust-proxy assumption through `STAGING_API_TRUST_PROXY_HOPS` so saved `npm run security:runtime:staging` output includes `apiRuntime.trustProxyHops` and a matching checked item before header/rate-limit evidence is accepted.

Header smoke checks:

```bash
curl -i http://localhost:4000/health | sed -n '1,24p'
curl -i http://localhost:3000/ | sed -n '1,24p'
```

Expected local signals:

- API includes Helmet headers such as `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer`; production-like API runtimes must also emit `Strict-Transport-Security`.
- Console includes `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy: same-origin`, `Strict-Transport-Security`, `Permissions-Policy`, and a narrow `Content-Security-Policy`.
- Console must not include `X-Powered-By: Next.js`.
- Organizer Console snapshots show `PII redacted`; owner/scanner emails, QR nonces, fan proof text, and full user ids are hidden by default.

Then check:

```bash
TOKEN=$(curl -fsS -X POST http://localhost:4000/auth/demo-session \
  -H 'Content-Type: application/json' \
  -d '{"userId":"usr_organizer_demo"}' | node -e 'process.stdin.on("data", d => console.log(JSON.parse(d).accessToken))')

curl http://localhost:4000/alpha/persistence/status \
  -H "Authorization: Bearer $TOKEN"
```

Expected result after seed:

```json
{
  "ok": true,
  "dataSource": "prisma",
  "counts": {
    "users": 4,
    "events": 1,
    "ticketTypes": 1,
    "tickets": 1,
    "orders": 0,
    "trades": 0,
    "checkins": 0,
    "fanTasks": 2,
    "fanTaskSubmissions": 0,
    "auditLogs": 1
  }
}
```

## Inspect Operations Snapshot

FanPass Console reads the Alpha operations snapshot for ticket inventory, order lifecycle, settled trades, check-ins, fan task submissions, and audit logs:

```bash
curl http://localhost:4000/alpha/operations \
  -H "Authorization: Bearer $TOKEN"
```

The endpoint returns `ok`, `dataSource`, and normalized arrays for:

- `tickets`
- `orders`
- `trades`
- `checkins`
- `fanTaskSubmissions`
- `auditLogs`

## Fan Order Lifecycle Endpoints

The FanPass consumer app uses the normal orderbook endpoints for one-ticket market actions:

```bash
FAN_TOKEN=$(curl -fsS -X POST http://localhost:4000/auth/demo-session \
  -H 'Content-Type: application/json' \
  -d '{"userId":"usr_fan_demo"}' | node -e 'process.stdin.on("data", d => console.log(JSON.parse(d).accessToken))')

curl http://localhost:4000/orders/users/usr_fan_demo \
  -H "Authorization: Bearer $FAN_TOKEN"
```

```bash
curl -X POST http://localhost:4000/orders/:orderId/cancel \
  -H "Authorization: Bearer $FAN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Cancellation is only allowed by the authenticated order owner while an order is `OPEN`. A cancelled order has `remainingQuantity` set to `0`; if the order listed an owned sell ticket, the ticket is released from `LISTED_FOR_RESALE` back to the owned state.

## Gate Check-In Summary

FanPass Ops reads event/gate totals from the verification service:

```bash
GATE_TOKEN=$(curl -fsS -X POST http://localhost:4000/auth/demo-session \
  -H 'Content-Type: application/json' \
  -d '{"userId":"usr_gate_demo"}' | node -e 'process.stdin.on("data", d => console.log(JSON.parse(d).accessToken))')

curl http://localhost:4000/verification/events/evt_weekend_demo/gates/A1/checkins/summary \
  -H "Authorization: Bearer $GATE_TOKEN"
```

The seeded gate staff user `usr_gate_demo` is assigned only to `evt_weekend_demo` gate `A1`. Requests for unassigned gates such as `A2` should return `403`; the API derives the scanner user from the bearer session and does not accept `scannerUserId` in the redeem request body.

Expected shape:

```json
{
  "eventId": "evt_weekend_demo",
  "gate": "A1",
  "total": 2,
  "accepted": 1,
  "rejected": 1,
  "results": {
    "ACCEPTED": 1,
    "DUPLICATE": 1
  },
  "lastCheckedInAt": "2026-05-27T15:22:11.429Z"
}
```

Rejected scans expose a stable `result` enum in the API error body, such as `DUPLICATE`, `EXPIRED`, `INVALID_SIGNATURE`, `OWNER_MISMATCH`, `NOT_ACTIVE`, or `CANCELLED`, so Ops can show specific failure copy.

## iOS Product Boundary Smoke

Run this after iOS target or navigation changes:

```bash
npm run alpha:verify:ios-boundaries
```

This checks that the consumer `FanPass` target excludes scanner source, the fan app shell does not expose scanner/staff copy, the consumer app does not register staff scanner URL schemes, and `FanPass Ops` owns the scanner workflow.

## Ownership Adapter

Alpha routes ticket ownership side effects through `OwnershipService`.

Default local mode:

```bash
OWNERSHIP_ADAPTER=mock
```

Mock mode is allowed only when it is explicitly selected outside production-like runtimes. An unset or unknown adapter now fails closed; staging and production must never fall back to confirmed mock receipts.

Staging uses the Privy-sponsored adapter with durable proof-sync:

```bash
OWNERSHIP_ADAPTER=privy
FANPASS_CHAIN_PROOF_SYNC_OUTBOX=true
```

It also requires the HTTPS RPC URL, deployed contract address, Privy app secret, sponsor wallet ID/address, and chain CAIP-2 identifier. Missing or malformed values stop the API at startup.

Testnet mode is available behind explicit configuration:

```bash
OWNERSHIP_ADAPTER=testnet
TESTNET_RPC_URL=https://...
TESTNET_OPERATOR_PRIVATE_KEY=replace-with-non-production-testnet-operator-private-key
FANPASS_TICKET_CONTRACT_ADDRESS=0x...
```

Use only non-production funded testnet keys here; never commit, log, or paste a real private key into the repository, issue tracker, chat, shell history, or saved run output.

Testnet mode uses the `FanPassTicket` contract ABI for:

- `mintTicketWithProof(...)` during ticket issuance;
- owner-only `syncTicketTransfer(...)` during resale settlement;
- `redeem(...)` during accepted gate redemption.

Direct ERC-721 holder transfers are intentionally disabled so on-chain ownership cannot bypass FanPass settlement, resale policy, or payment state.

## Security Remediation Staging Verification

Deploy the schema, reviewed `FanPassTicket` contract/address, API, Console, and Console Auth from one recorded source revision. Do not ask the owner to test until health checks and the following positive/negative paths pass against deployed HTTPS:

Staging rollout is two-phase. Freeze one RC revision; verify Render service Auto-Deploy is Off and overlapping deploys use Wait; keep the worker disabled; prove a restorable backup. Separately prove that these services are not Blueprint-managed or that the Blueprint's Auto Sync is No before pushing or merging `render.yaml` to its linked branch. Service Auto-Deploy Off does not suppress Blueprint sync: a linked-branch Blueprint change can still apply the `starter` plan and redeploy affected resources. Owner approval is necessary but is not permission to use Blueprint sync for the first plan change. Upgrade **only** the existing API instance type through Render service Settings or the service API, preserving the exact old live SHA, build command, environment, schema, and Console/Auth plans; verify the plan-change deploy has no other drift. Do not sync the Blueprint, merge the RC to its linked branch, update build/environment configuration, or create a paid preview at this stage. Only after the paid instance is live may you enable Maintenance Mode, prove the public origin consistently returns `503`, wait for old API requests to drain, and confirm the provider/outbox census is clean. Blueprint/build configuration remains frozen until that traffic boundary is proven. While maintenance remains enabled, save `FANPASS_SIDE_EFFECT_WORKER_ENABLED=false` and `SIDE_EFFECT_WORKER_LIMIT=1`, deploy the exact currently live SHA once to apply those values, then wait until Render reports only that worker-disabled instance and the old instance has passed the documented 60-second handoff plus shutdown-delay window. A normal Render zero-downtime deploy is insufficient because the pre-fence API remains publicly reachable during its build and its direct Stripe/Privy paths do not know the new revision gate. Install the paused database dispatch fence only inside that maintenance window. Phase A then deploys the route-aware RC while retaining the old global contract and completes enforcement, backfill, validation, and the identity-bound read-only database preflight. Restore public traffic only after the route-aware revision is the sole API instance and health/preflight evidence passes. Only then may the reviewed Sepolia contract be deployed. Phase B deploys the same RC with the new global contract. Dispatch may then be enabled for exactly one bound probe with `--probe-limit 1`; it auto-pauses and requires another preflight after settlement. Do not enable unlimited dispatch until every provider, route, outbox, and runtime check below passes. Render Free has no Maintenance Mode, and suspended services cannot safely deploy an exact target SHA before resume under a documented atomic contract; do not substitute free-tier idle spin-down or suspend/resume for this gate.

Once the new contract has its first mint, never roll back to an API revision that lacks immutable per-ticket contract routing. Use a route-aware rollback or keep dispatch paused and forward-fix.

1. Restore an existing verified Privy wallet without changing its tuple; concurrent identical syncs are idempotent, while conflicting wallet or staff links return a stable conflict and never replace custody.
2. Confirm a DRAFT event is absent from public reads and rejects order placement, on-sale allocation, resale settlement, sponsored send, and delayed Stripe capture. Confirm the equivalent PUBLISHED flow still works.
3. Run the read-only `docs/STAGING_ORDERBOOK_RECONNECT_HARNESS.md` workflow against 16 real public rooms. Disconnect/reconnect budgets must persist, duplicate subscriptions must not consume capacity, the 17th attempt must be rejected in the same window, unsubscribe-during-load must not rejoin, and reconnect snapshots must not regress behind an observed revision.
4. In Stripe test mode, prove capture occurs only after the exact tokenized ticket/trade facts exist. Close the event before the worker capture and prove the authorization is cancelled or refunded without provider capture.
5. In Privy/Sepolia staging, prove pending, confirmed, definitive failure, and ambiguous sponsored-USDC outcomes. Only `crypto_confirmed` plus `CAPTURED` is success; ambiguous/provider-accepted submissions must never be resent automatically.
6. Inject an ownership-worker stop immediately before and immediately after the durable submission fence. Before-fence definitive failures may compensate; after-fence crashes or ambiguous sends must stop in reconciliation and must not rebroadcast or auto-compensate.

Monitor and alert on `AMBIGUOUS`, `COMPENSATION_REQUIRED`, ownership `DEAD`, stale leases, capture timeouts, wallet-binding conflicts, and WebSocket admission rejections. Preserve correlation IDs and redacted provider identifiers; never save access tokens, authorization signatures, private keys, raw session cookies, or database URLs as evidence.

Current in-memory WebSocket admission and revision state is safe only for one API process. Before horizontal scaling, move admission leases, room revision state, and fan-out to Redis/Valkey plus shared pub/sub and repeat the reconnect/load tests across instances.

## High-Demand Queue Release Gate

Production-like queue joins fail closed until the native client and API complete Apple App Attest registration, one-time challenge, assertion, replay, counter, and app-identity validation. The existing client installation ID is retained only as an explicitly untrusted local risk signal; it is not described or logged as an attested installation binding. Direct non-queue sales retain database inventory locking, per-account limits, payment-identity limits, and authorization checks.

Do not enable a major public waiting room by signing a client UUID or DeviceCheck token locally. A release-ready queue must use a server-verified platform assertion and physical TestFlight/App Store device evidence.

The API remains the source of product state, user identity, risk decisions, and audit logs. The adapter receipt is written into audit metadata as `ownershipAdapter`, `ownershipRef`, and `transactionHash`.

## Manage Alpha Inventory From Console

FanPass Console writes organizer inventory to the Alpha Prisma data layer through dedicated Alpha endpoints:

```bash
curl -X POST http://localhost:4000/alpha/events \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Alpha Console Persisted Event",
    "venueName": "AsiaWorld-Arena",
    "city": "Hong Kong",
    "startTime": "2026-11-21T12:00:00.000Z",
    "endTime": "2026-11-21T15:00:00.000Z"
  }'
```

```bash
curl -X POST http://localhost:4000/alpha/events/:eventId/ticket-types \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "CAT 1",
    "faceValue": 1888,
    "currency": "HKD",
    "supply": 200,
    "transferable": true,
    "resaleCap": 2265,
    "maxTransferCount": 2
  }'
```

The dashboard fetch helper uses `cache: "no-store"` because Console is an operational surface and should not show stale lifecycle state.

## Local Alpha Auth

Security Pass 1 added signed local bearer sessions.

Local demo session endpoint:

```bash
curl -X POST http://localhost:4000/auth/demo-session \
  -H 'Content-Type: application/json' \
  -d '{"userId":"usr_fan_demo"}'
```

Seeded local users:

- `usr_fan_demo` - fan and original ticket owner.
- `usr_buyer_demo` - fan buyer.
- `usr_gate_demo` - gate staff.
- `usr_organizer_demo` - organizer/Console user.

Protected routes now expect:

```bash
Authorization: Bearer <accessToken>
```

Local demo auth is enabled by default outside production for simulator and runbook use. Do not enable `FANPASS_ENABLE_DEMO_AUTH=true` in public environments.

## Verify Prisma API Paths

```bash
npm run alpha:verify:prisma
```

This command:

- resets and seeds the Alpha DB;
- builds the API;
- starts a temporary API on `http://localhost:4100` with `FANPASS_DATA_SOURCE=prisma`;
- verifies Prisma-backed event, owned ticket, ownership-adapter ticket issuance, Alpha inventory creation, fan access submission, fan score, user order listing, order cancellation, ticket release, orderbook match, ownership-adapter resale settlement, QR redemption, ownership-adapter redemption, duplicate rejection result enum, gate check-in summary, trade, price history, check-in, and audit log paths.

The default prototype API on port `4000` remains memory-backed unless `FANPASS_DATA_SOURCE=prisma` is set.

## Beta Local Prisma Environment

Use the Beta local scripts when testing payment-aware settlement, Console operations, iOS checkout preparation, or any flow that needs the Prisma data layer to keep running after verification:

```bash
npm run beta:local:start
npm run beta:local:verify
```

This command path:

- resets and seeds the Alpha Prisma DB unless `FANPASS_BETA_SKIP_DB_RESET=true`;
- starts the API on `http://localhost:4000` with `FANPASS_DATA_SOURCE=prisma`;
- enables `FANPASS_REQUIRE_PAYMENT_AUTHORIZATION=true`;
- enables `FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true` for both API and worker so ownership transfer and settlement finalization run through separate side-effect jobs;
- starts FanPass Console on `http://localhost:3000`;
- starts a detached side-effect worker loop so ownership and payment outbox jobs are processed;
- clears inherited Stripe secrets by default so local demos use mock Stripe behavior unless `FANPASS_BETA_USE_STRIPE=true` is explicitly set.

Inspect detached sessions:

```bash
screen -r fanpass-beta-api
screen -r fanpass-beta-console
screen -r fanpass-beta-worker
```

Stop the Beta local environment:

```bash
npm run beta:local:stop
```

`npm run beta:local:verify` resets/reseeds the local Prisma DB by default, then checks the running environment by creating a buyer order, creating a local mock PaymentIntent, simulating an authorization webhook, listing the seeded ticket for resale, and waiting for the worker to complete `OWNERSHIP_TRANSFER`, `OWNERSHIP_SETTLEMENT_FINALIZE`, and `PAYMENT_CAPTURE`. Set `FANPASS_BETA_VERIFY_SKIP_DB_RESET=true` only when deliberately inspecting a mutated local state.

## Console Gate Staff Assignment

FanPass Console now manages local gate staff assignments for organizer-scoped events. In the local Beta service, open:

```bash
http://localhost:3000/#gate
```

Use `Assign Gate Staff` to create or reactivate a `GATE_STAFF` placeholder user for the selected event/gate. Use `Revoke` in `Gate Staff Assignments` to deactivate access. Organizer views redact staff email and full user ids by default; admin views can inspect the full operational record.

Creating an assignment also creates a short-lived staff invite. The API returns the plain invite token once and stores only a SHA-256 token hash in Prisma. Future FanPass Ops login should call `POST /auth/privy/accept-staff-invite` with:

- `Authorization: Bearer <Privy access token>`
- `inviteToken`
- optional `walletAddress`

The backend verifies the Privy token before linking `privyId` to the invited `GATE_STAFF` user. Do not build a production invite flow that links by email alone.

FanPass Ops includes an internal Staff access panel for this boundary. Local simulator QA can continue using the demo gate staff session; the invite fields are for testing the future Privy SDK handoff without putting provider code into the scanner.

Verification coverage:

```bash
npm run alpha:verify:prisma
npm run console:verify:local
```

The Prisma verification script checks assignment creation, invite creation, cross-organizer rejection, Privy-token invite acceptance, incorrect invite reuse rejection, active staff gate-summary access, deactivation, post-deactivation access rejection, and redacted Console operations output. The Console visual check opens the local web app, verifies the staff assignment panels render without a framework error overlay, and captures `outputs/playwright/fanpass-console-beta-gate-staff-full.png`.

Current Ops screenshot:

- `outputs/ios/fanpass-ops-beta-staff-access.jpg`

## Prototype Compatibility

The Technical Prototype still runs on the in-memory store by default. Keep verifying it while Alpha persistence is introduced:

```bash
npm run prototype:verify
```

## Demo Screenshot References

Current Alpha screenshots are engineering QA artifacts under:

- `output/playwright/fanpass-console-alpha-market-full.png`
- `output/ios/fanpass-alpha2-home.jpg`
- `output/ios/fanpass-alpha2-event-detail.jpg`
- `output/ios/fanpass-alpha2-market-actions.jpg`
- `output/ios/fanpass-alpha2-market-cancelled.jpg`
- `output/ios/fanpass-alpha3-ops-home.jpg`
- `output/ios/fanpass-alpha3-scanner-accepted.jpg`
- `output/ios/fanpass-alpha3-scanner-duplicate.jpg`
- `output/ios/fanpass-alpha3-ops-summary-formatted.jpg`
- `output/ios/fanpass-alpha-closeout-fan-home.jpg`
- `output/ios/fanpass-alpha-closeout-ops.jpg`
