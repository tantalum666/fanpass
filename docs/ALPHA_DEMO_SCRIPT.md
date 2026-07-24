# FanPass Alpha Demo Script

Date frozen: 2026-05-29

Status: frozen historical local Alpha walkthrough preparation. This is not a public Beta script, security RC workflow, or current release evidence. Use `docs/CODEX_HANDOFF.md` for current state. It must not be used with real personal data, production credentials, Stripe secrets, Privy secrets, wallet private keys, or real event inventory.

## Purpose

This script presents the complete local FanPass Alpha baseline through the three product surfaces:

1. `FanPass` - fan event discovery, wallet, marketplace, and fan access.
2. `FanPass Ops` - gate staff event/gate selection, QR scanner, NFC prototype fallback, and entry decisions.
3. `FanPass Console` - organizer/admin inventory, market, gate staff assignment, settlement, and audit views.

The walkthrough should prove the product model and local lifecycle only. Before external testers, the Beta blockers in `docs/ALPHA_SECURITY_REVIEW.md` and `docs/DEVELOPMENT_TASKS.md` still apply.

## Preflight

Use local seeded/demo data only.

```bash
npm install
# Local diagnostic only; use the complete env-i command in README.md for release evidence.
node scripts/beta-foundation-verify.js
```

For a live local demo with persistent Prisma state, start the local Beta foundation stack:

```bash
npm run beta:local:start
npm run beta:local:verify
```

Keep these URLs ready:

```text
FanPass API: http://localhost:4000
FanPass Console: http://localhost:3000
```

Use these local-only seeded roles:

- Fan: seeded/demo fan account.
- Organizer: seeded/demo organizer account.
- Gate staff: seeded/demo gate staff assignment for the seeded event/gate.
- Admin: local-only admin account used only by verification scripts and admin health checks.

## Scene 1 - Product Boundary

Show the three-surface model before starting any transaction:

- `FanPass` is for fans and must not expose gate scanner or organizer controls.
- `FanPass Ops` is for onsite gate staff and owns scanner/NFC workflows.
- `FanPass Console` is for organizer/admin operations and audit visibility.

Acceptance line:

```text
Fan, onsite operations, and organizer/admin work are separate product surfaces.
```

## Scene 2 - Fan Discovery And Wallet

In `FanPass`:

1. Open the app as a signed-out user.
2. Show guest-browsable event discovery.
3. Open the seeded event detail.
4. Show ticket type, resale cap, transfer policy, market context, and auth-at-action behavior.
5. Open wallet and show ticket lifecycle state, event context, ownership history, and entry readiness.

Acceptance line:

```text
Fans can browse before auth, and private wallet/market actions are gated at action time.
```

## Scene 3 - Marketplace And Settlement

Use the local API/Console state created by `npm run beta:local:verify`:

1. Show the orderbook and price history in `FanPass` or `FanPass Console`.
2. Explain one-ticket matching and resale cap enforcement.
3. Show payment-aware settlement state through mock local PaymentIntent authorization.
4. Show side-effect jobs completing through ownership transfer, settlement finalization, and payment capture.

Verification command:

```bash
npm run beta:local:verify
```

Acceptance line:

```text
Local settlement completes through durable outbox jobs without real Stripe or chain credentials.
```

## Scene 4 - Fan Access

In `FanPass`:

1. Open Fan Access.
2. Show seeded tasks.
3. Submit a local demo task.
4. Show score/eligibility state.

Acceptance line:

```text
Fan access is event-scoped and contributes to a local score without exposing staff/admin tools.
```

## Scene 5 - Console Operations

In `FanPass Console`:

1. Show event inventory and ticket lifecycle state.
2. Show orderbook, recent trades, and price history.
3. Show gate check-in summary.
4. Show fan access submissions.
5. Show audit logs and side-effect job status.
6. Show organizer-scoped gate staff assignment creation/rotation without persisting invite tokens in URLs.

Acceptance line:

```text
Organizers can inspect inventory, settlement, check-ins, fan access, and audit state without using mobile staff tools.
```

## Scene 6 - FanPass Ops Entry

In `FanPass Ops`:

1. Select the seeded event and assigned gate.
2. Confirm API status is online.
3. Use QR scan if a physical camera is available, or paste the local signed QR payload in simulator QA.
4. Redeem once and show accepted state.
5. Redeem the same payload again and show duplicate/rejected state.
6. Show NFC prototype availability/fallback, noting that real NFC validation requires a signed physical iPhone build and supported NDEF tag.

Acceptance line:

```text
Gate staff can accept one valid entry and reject duplicate or invalid entry attempts.
```

## Scene 7 - Security Boundary Close

Close the walkthrough by naming what is proven and what is not:

Proven locally:

- Three product surfaces are separated.
- Local Prisma lifecycle works.
- QR redemption rejects replay.
- Role-scoped API and Console paths have automated checks.
- Side-effect workers can recover and complete local ownership/payment jobs.

Historical pre-RC closed-beta snapshot (the expired 2026-07-04 dependency acceptance must not be reused):

- Privy SDK login is implemented across FanPass, FanPass Ops, and the isolated FanPass Console auth runtime.
- Stripe test-mode PaymentIntent, signed webhook, native iOS PaymentSheet authorization, capture, refund, cancellation, reconciliation, replay, and outbox-health evidence passed against Render staging.
- Deployed HTTPS staging runtime evidence existed for the then-current API and Console; it does not attest the undeployed security RC.
- The historical Next/PostCSS dependency acceptance expired on 2026-07-04 and must not be reused. The root audit is now clean after the Console migration.
- Production tenant/staff staging evidence passed for an earlier Render/Vercel revision and must be regenerated for the current RC boundary.

Not proven for public or real-user Beta:

- Signed iOS/TestFlight staging evidence.
- Public/real-user dependency clean audit or Console migration.
- Signed Apple Wallet `.pkpass` output.
- Physical QR/NFC device validation.
- Chain custody evidence.

Final local diagnostic command (the release-evidence command is the complete
`/usr/bin/env -i` entry in `README.md`):

```bash
node scripts/beta-foundation-verify.js
```

## Recording Checklist

Owner decision on 2026-06-04: a human-reviewed walkthrough recording is no longer a current Beta foundation blocker. Use this checklist only if recording work is deliberately reintroduced.

Record only after the local stack is clean and verification passes:

- Run `node scripts/beta-foundation-verify.js` only as a local diagnostic, or use the complete `README.md` env-i command when the result will be treated as release evidence.
- Start with `npm run beta:local:start`.
- Run `npm run beta:local:verify`.
- Record the seven scenes in order.
- Stop local services with `npm run beta:local:stop`.
- Do not show shell environment variables, access tokens, private keys, dashboard secrets, or production provider credentials.
