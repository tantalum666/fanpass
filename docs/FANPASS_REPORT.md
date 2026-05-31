# FanPass Report

Source: `outputs/019e6766-cfc0-7061-bc2a-ef46d7fe4c55/presentations/fanpass-ppt-optimization/output/FanPass_ITE4460_Presentation_English_Optimized.pptx`

This Markdown version preserves the report content for handoff/search purposes. Use the PowerPoint as the visual source of truth and this file as durable text context.

## 1. FanPass

Native iOS Blockchain Ticketing and Verified Resale Platform.

Team members: Yuan Yuchen, Xu Ziqian, Wang Hongyu, Li Wenhua.

## 2. Problem Context

Live event ticketing is fragmented. Demand often exceeds supply, resale prices are opaque, ticket authenticity is uncertain, and organizers have limited lifecycle control after primary sale.

Core issue: there is no trusted shared lifecycle record from sale to resale to check-in.

## 3. Project Aim

Build a native iOS prototype that lets organizers issue verified tickets, fans buy and resell under clear rules, and gate staff validate credentials at entry.

Blockchain is hidden behind normal product UI. Users should experience verified access, not wallet complexity.

Product pillars:

- Fair Access
- Verified Ownership
- Controlled Resale

## 4. Stakeholders

- Fans: discover events, buy tickets, hold verified access, and resell within allowed rules.
- Organizers: create events, issue ticket types, control resale policies, and review operational status.
- Gate Staff: scan QR/NFC credentials and redeem tickets at entry.
- Platform Admin: review users, policies, disputes, and system health.

The shared lifecycle is issue, transfer, verify, and redeem.

## 5. Functional Scope

Included:

- iOS Fan App
- iOS Scanner / FanPass Ops
- Backend API
- Orderbook Engine
- Blockchain Engine
- Payment Module

Excluded from the prototype:

- Android app
- PWA
- Production gate hardware integration
- Real mainnet payments

## 6. Native iOS Application Design

The iOS app is built around SwiftUI and MVVM. Key native integrations include:

- Core NFC
- PassKit / Apple Wallet
- LocalAuthentication
- Stripe iOS SDK
- Privy / embedded wallet auth

## 7. System Architecture

High-level flow:

```text
Native iOS App
  -> API Gateway over HTTPS REST / WebSocket
  -> NestJS services
  -> PostgreSQL / Redis
  -> External layers: Stripe, Privy, EVM testnet, PassKit
```

Sensitive operations stay server-side. Client apps receive scoped session state and redacted responses.

## 8. Blockchain Ticket Engine

Ticket lifecycle states:

- `CREATED`
- `MINTED`
- `OWNED`
- `LISTED`
- `TRANSFERRED`
- `REDEEMED`

Terminal states:

- `CANCELLED`
- `REFUNDED`
- `EXPIRED`
- `BURNED`

The design separates transferable NFT-style ticket ownership from locked SBT-style rights where needed. Personal data remains off-chain.

## 9. Controlled Resale Orderbook

The resale flow uses a DEX-style market with live bids and asks, spread, depth, and policy gates.

Example market:

- Event: Weeknd
- Category: Cat A
- Last trade: HK$1,250
- Face value: HK$980
- Resale cap: HK$1,470
- Transfer limit: 1 of 2

Matching requires:

- Ownership check
- Resale cap check
- Transfer-count check
- Ticket not redeemed

## 10. Payment and Verification Workflow

Checkout lane:

```text
Stripe PaymentIntent
  -> iOS PaymentSheet
  -> webhook success
  -> settlement
```

Entry lane:

```text
Dynamic QR
  -> Core NFC
  -> backend validation
  -> atomic redemption
```

Crypto payment remains an extension, not the initial required path.

## 11. Security, Privacy, and Reliability

Core controls:

- RBAC for fan, organizer, gate staff, and admin surfaces.
- Sensitive data stays off-chain.
- Short-lived credentials for verification flows.
- Atomic check-in to prevent duplicate redemption.
- Audit logging for critical lifecycle events.
- Offline fallback for venue constraints.

## 12. Development Plan

Timeline:

- Weeks 1-4: analysis and design.
- Weeks 5-10: core implementation.
- Weeks 11-14: integration and delivery.

Deliverables:

- iOS prototype
- Backend API
- Database schema
- Smart contracts
- Orderbook
- Scoring
- Verification demo
- Testing report

Resources:

- Mac / iPhone
- NFC tags
- Cloud deployment
- Stripe test mode
- EVM testnet
- Figma / GitHub

## 13. Team Roles

- Yuan Yuchen: project leadership, architecture, iOS, NFC, blockchain, orderbook, payment, final integration.
- Xu Ziqian: backend, PostgreSQL, Redis, API, WebSocket, deployment.
- Wang Hongyu: iOS UI, Figma, scanner usability, tests, presentation.
- Li Wenhua: stakeholder research, competitor research, admin support, schedule, budget, references, proofreading.

Final positioning: FanPass is an iOS-native ticket lifecycle prototype that improves fairness, transparency, and trust from issuance to resale and entry.
