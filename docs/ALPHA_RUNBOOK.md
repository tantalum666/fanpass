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

FanPass Console local builds can still fetch a local organizer demo token. Production-like Console builds do not fall back to demo auth. They require `FANPASS_CONSOLE_ACCESS_TOKEN` until the Privy Console login flow is implemented; otherwise the page renders a locked state and does not request operational data.

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

Mock mode is the default when `OWNERSHIP_ADAPTER` is unset. It returns confirmed local ownership receipts with `mock_*` transaction hashes, so local demo, tests, and Prisma verification do not depend on a network.

Testnet mode is available behind explicit configuration:

```bash
OWNERSHIP_ADAPTER=testnet
TESTNET_RPC_URL=https://...
TESTNET_OPERATOR_PRIVATE_KEY=replace-with-non-production-testnet-operator-private-key
FANPASS_TICKET_CONTRACT_ADDRESS=0x...
```

Use only non-production funded testnet keys here; never commit, log, or paste a real private key into the repository, issue tracker, chat, shell history, or saved run output.

Testnet mode uses the `FanPassTicket` contract ABI for:

- `mintTicket(...)` during ticket issuance;
- `transferFrom(...)` during resale settlement;
- `redeem(...)` during accepted gate redemption.

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
