# FanPass

FanPass is a native iOS ticketing product for verified primary sales, controlled resale, transparent high-demand on-sales, dynamic QR entry, and auditable ownership state.

## Current Baseline

- Shipping UI baseline: **V4**.
- V5 status: unfinished brand exploration only; it is not implemented in SwiftUI and must not be shipped.
- Consumer app: `apps/ios/FanPass/FanPass` (`fun.fanpass.app`).
- Staff app: `apps/ios/FanPass/FanPassOps` (`com.fanpass.ops`).
- API: NestJS + Prisma/PostgreSQL under `apps/api`.
- Organizer Console: `apps/dashboard`.
- Completed school Web/hardware work: `archive/school-project`.

The staging API is backend-authoritative for orders, payments, ownership, resale, QR credentials, and redemption. UI previews may use fixtures, but active Beta/Release flows must not report a local-only transaction as successful.

## Engineering Rules

1. Read `docs/CODEX_HANDOFF.md` first before normal work.
2. Then read all workspace Markdown excluding `.git`. After automatic context compaction, read the Handoff first and only non-ignored Markdown with `rg --files -g '*.md'`.
3. Keep code typed, focused, and consistent with existing module boundaries. Do not build spaghetti code.
4. Security is release-blocking. Never commit or print provider secrets, bearer tokens, private keys, database URLs, raw QR payloads, or real personal data.
5. Backend changes must be deployed to the staging backend before asking the owner to test them.
6. Update the relevant Markdown and especially `docs/CODEX_HANDOFF.md` after meaningful work.

## Product Surfaces

- **FanPass:** discovery, primary/resale purchase, tickets, entry QR, listings, wallet/account.
- **FanPass Ops:** authenticated gate selection, QR validation, duplicate rejection, live check-in state.
- **FanPass Console:** event, inventory, staff, risk, audit, and support operations.

The fan app never contains staff scanner or organizer controls. QR is the universal entry path; NFC is optional and must use platform-supported hardware/workflows.

## Repository

```text
apps/api/                         NestJS API and Prisma data layer
apps/dashboard/                   FanPass Console
apps/ios/FanPass/                 FanPass and FanPass Ops Xcode project
apps/web/                         Optional consumer Web fallback
packages/contracts/               Solidity contracts and chain tooling
packages/shared/                  Shared TypeScript contracts
docs/                             Current product, security, QA, and evidence docs
FanPass_VI_Redesign_V4/           Approved V4 brand package
FanPass_VI_Redesign_V5/           Unfinished V5 exploration only
archive/school-project/           Completed coursework Web/hardware source archive
```

Use `docs/README.md` as the documentation index. Historical planning documents removed during the 2026-07-12 cleanup remain recoverable from Git history.

## Local Setup

Use Node 22:

```bash
scripts/with-node-22.sh npm install
```

Start or verify the local backend:

```bash
npm run beta:local:start
npm run beta:local:verify
npm run beta:local:stop
```

Run the full foundation gate:

```bash
scripts/with-node-22.sh npm run beta:foundation:verify
```

## iOS

Open the project:

```bash
open apps/ios/FanPass/FanPass.xcodeproj
```

Build the consumer app for Simulator:

```bash
xcodebuild \
  -project apps/ios/FanPass/FanPass.xcodeproj \
  -scheme FanPass \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  build CODE_SIGNING_ALLOWED=NO
```

Build FanPass Ops by replacing `-scheme FanPass` with `-scheme FanPassOps`.

Local provider values belong only in the ignored file:

```bash
cp apps/ios/FanPass/Config/LocalSecrets.xcconfig.example \
  apps/ios/FanPass/Config/LocalSecrets.xcconfig
```

Configure only the required local values. Never add them to `project.pbxproj` or documentation.

## Current Product Gaps

- Add iOS unit/UI coverage for session restore, Stripe outcome, list/cancel QR state, redemption sync, and duplicate redemption.
- Replace the remaining broad refresh revision with domain-scoped realtime/adaptive refresh and one centralized 401 policy.
- Split the oversized Market, Profile, and Tickets files without changing lifecycle behavior.
- Complete production notification preferences, payouts, credits/promos, and in-app support APIs before enabling those mutations.
- Complete release-grade chain custody, signed Apple Wallet passes, legal/compliance operations, and physical-device release QA.
- Put a managed edge waiting room and attestation/risk layer in front of concert-scale on-sales; Render/Neon remains the final inventory authority.
