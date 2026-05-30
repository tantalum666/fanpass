# FanPass

FanPass is a beta-target prototype for a ticketing infrastructure product with official issuance, blockchain-backed ticket state, controlled resale, fan access scoring, and venue verification.

The repo is structured as a monorepo:

- `apps/api` - NestJS backend, Prisma schema, orderbook, verification, ticket state.
- `apps/dashboard` - organizer/admin web dashboard, positioned as FanPass Console.
- `packages/contracts` - Solidity contracts for transferable tickets, soulbound access rights, and redemption state.
- `packages/shared` - shared TypeScript types and constants.
- `apps/ios/FanPass` - native SwiftUI consumer fan app source structure.
- `apps/ios/FanPass/FanPassOps` - separate staff/onsite iOS target for gate scanning and NFC workflows.
- `docs` - product roadmap, architecture, and delivery notes.

## Product Surfaces

- `FanPass` - consumer app for event discovery, buying, wallet, resale, fan access, and profile.
- `FanPass Ops` - separate staff app for gate scanning, NFC, onsite status, and entry exceptions.
- `FanPass Console` - web dashboard for organizer/admin event setup, inventory, orders, review, reporting, and risk operations.

The previous staff scanner deep link inside the consumer iOS app was a Technical Prototype bridge only. It has been removed from the fan app product path; the staff demo path is now the separate FanPass Ops target.

## Current Target

The active build target is **Beta**:

1. Technical Prototype: end-to-end issuance -> ticket wallet -> QR redemption.
2. Alpha: split FanPass Ops, testnet tickets, fan access, one-ticket orderbook, FanPass Console.
3. Beta: Stripe test mode, Privy integration, WebSocket orderbook, signed QR, FanPass Ops NFC prototype, Apple Wallet pass prototype.

## Local Development

Install dependencies:

```bash
npm install
```

Run the backend:

```bash
npm run dev:api
```

Run the dashboard:

```bash
npm run dev:dashboard
```

Run the complete local prototype:

```bash
npm run prototype:start
npm run prototype:verify
```

See `docs/PROTOTYPE_RUNBOOK.md` for the full demo flow.

The native iOS app requires a full Xcode installation. This machine has Xcode 26.5 configured and an iOS 26.5 simulator named `FanPass-iPhone-17`.
