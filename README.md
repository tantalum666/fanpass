# FanPass

FanPass is a native iOS prototype for verified ticketing, controlled resale, fan access rewards, dynamic QR entry, NFC-ready scanner verification, and transparent resale market data. The current V4 prototype uses the Clean V4 visual identity and mock data only. It is intended for product validation, internal engineering review, academic project evidence, and backend integration planning.

## Problem Statement

Live event ticketing has recurring trust and fairness problems:

- Fans cannot always tell whether a resale ticket is legitimate.
- Organizers have limited control over transfer and resale rules after purchase.
- Gate staff need fast, reliable entry checks that prevent duplicate redemption.
- Market prices are often opaque, which makes fair resale hard to understand.
- Blockchain-backed ownership can help, but consumer ticketing must not feel like a crypto trading product.

FanPass addresses these problems by hiding Web3 infrastructure behind mainstream ticketing language: Verified Ticket, Secure Resale, Fan Access, Proof & History, and Transparent Prices.

## Non-Negotiable Engineering Rules

- At the start of every normal FanPass work session, read `docs/CODEX_HANDOFF.md` first, then enumerate and read every Markdown file in the workspace, including hidden/ignored/generated Markdown, while excluding `.git` (`rg --files --hidden --no-ignore -g '*.md' -g '!**/.git/**'` is the intended baseline). After automatic context compaction or mid-turn resume, read `docs/CODEX_HANDOFF.md` first and then only non-ignored Markdown with `rg --files -g '*.md'` before continuing. Update `docs/NEW_CHAT_PROMPT.md` at the end of work so new chats resume from the current state.
- Do not build "shit-mountain" or spaghetti code. Prefer maintainable, typed, focused modules that follow existing project patterns, with provider calls behind dedicated adapters/services and tests around shared lifecycle behavior.
- Security is the highest priority and is release-blocking. Never trade security for speed or visual polish, never use real personal data or production credentials in demo work, and never claim readiness without matching saved evidence that passes the documented validator.
- When work is completed, immediately update the relevant Markdown docs with what changed, what passed, known gaps, and any changed product boundaries, evidence status, release blockers, provider assumptions, or standing user instructions.

## Product Concept

FanPass is a premium iOS ticketing app for global live events. Fans can discover events, buy verified tickets, view tickets in a wallet, show a dynamic QR code for entry, use NFC-ready ticket states, list eligible tickets for controlled resale, and review proof history. Gate staff can use a staff-only scanner mode to validate QR and NFC credentials. Organizers define ticket rules, resale caps, transfer limits, refund/cancel behavior, and Fan Access programs.

The product is not positioned as a speculative crypto app. Blockchain-backed proof is treated as infrastructure that supports trust, transparency, and ownership history.

## Key Features

- Clean V4 brand system with premium concert, fintech trust, and iOS-native styling.
- Native SwiftUI app shell with splash, onboarding, login, and main tab navigation.
- Home, Explore, Event Detail, Checkout, Purchase Success, Fan Access, Tickets, Ticket Detail, Market, Orderbook, List Ticket, Scanner, QR/NFC result, and Profile screens.
- Mock user scenarios for normal fan, verified fan, purchased-ticket fan, resale fan, gate staff, and organizer/admin-lite.
- Fictional event catalog with ticket types, resale rules, market data, Fan Access tasks, and ticket lifecycle states.
- Mock services for auth, events, tickets, payments, market, scanner, fan access, and wallet behavior.
- Prototype controls in Profile for switching role, ticket state, payment result, scanner result, network condition, transferability, and resale cap behavior.
- Internal technical plans for backend API, database schema, Stripe test mode, blockchain proof, dynamic QR, NFC, and orderbook.

## Current Prototype Scope

The current V4 prototype is a high-fidelity local iOS prototype. It supports realistic product flows and state transitions using deterministic mock data. The backend and contracts now include local foundations for signed QR/NFC validation and proof-record contracts, but the V4 shell does not connect to production backend flows, live Stripe mode, real blockchain transactions, real NFC tags, real Apple Wallet passes, or real organizer dashboards.

Local hardware note as of 2026-06-15: `hardware/fanpass_turnstile/fanpass_turnstile.ino` contains an Arduino UNO R4 WiFi + EP8280 mock turnstile sketch. The bench prototype can read real QR text over the EP8280 TTL path, show LCD gate states, move one servo, and detect pass-through with an ultrasonic sensor. It is local hardware-learning work only. It does not replace FanPass Ops iOS, backend-authoritative redemption, TestFlight evidence, physical QR/NFC evidence, signed Apple Wallet evidence, or release-grade chain custody evidence.

Use the prototype to validate:

- Navigation and information architecture.
- Clean V4 visual direction.
- Ticket and market UI clarity.
- Fan Access and Proof & History wording.
- Scanner result states.
- Backend integration boundaries.

## Web Beta Fallback

FanPass may add a separate `apps/web` fallback while Apple Developer enrollment, TestFlight signing, and Apple Wallet signing are blocked. This is a backup review path only. It does not replace the native iOS product, FanPass Ops, Apple Wallet, Core NFC, or chain-custody evidence gates.

The first web milestone is a Clean V4 landing page. The design direction is long-scroll and low-density: `less is more` means one strong idea per viewport, not a short page. The homepage should explain why FanPass tickets are trustworthy, why resale stays controlled, and why prices are transparent. Do not lead with QR, scanner mechanics, NFC, Web3 terminology, or web/iOS sync as the main value proposition.

Source docs:

- `docs/technical/FanPass_Web_Beta_Fallback_Plan_V4.md`
- `docs/product/FanPass_Web_Beta_Fallback_Workplan_V4.md`
- `docs/ux/FanPass_Web_Landing_Page_Plan_V4.md`

## Technology Stack

- iOS: Swift, SwiftUI, Observation, MVVM.
- Project: Xcode project under `apps/ios/FanPass`.
- Design system: Clean V4 SwiftUI tokens and reusable components.
- Backend plan: API service, PostgreSQL, Redis, Stripe, Privy/embedded wallet, EVM testnet proof sync.
- Current data source: local Swift mock data and mock services only.

## Folder Structure

```text
apps/ios/FanPass/
  FanPass.xcodeproj
  project.yml
  FanPass/
    App/
    Assets/
    DesignSystem/
    Models/
    ViewModels/
    Views/
    Services/
    MockData/
    PreviewContent/
  FanPassOps/

assets/brand/
hardware/
docs/brand/
docs/ux/
docs/product/
docs/technical/
FanPass_VI_Redesign_V4/assets/
```

Important paths:

- `apps/ios/FanPass/FanPass/App/FanPassApp.swift` launches the app.
- `apps/ios/FanPass/FanPass/App/FanPassV4AppShellView.swift` owns splash, onboarding, login, and main app stage.
- `apps/ios/FanPass/FanPass/App/FanPassV4MainTabView.swift` owns the native tab structure.
- `apps/ios/FanPass/FanPass/DesignSystem/` contains Clean V4 tokens and reusable SwiftUI components.
- `apps/ios/FanPass/FanPass/Models/FanPassV4Models.swift` defines V4 product models.
- `apps/ios/FanPass/FanPass/MockData/FanPassMockData.swift` defines deterministic fixtures.
- `apps/ios/FanPass/FanPass/Services/FanPassV4MockServices.swift` defines simulated product behavior.
- `apps/ios/FanPass/FanPass/ViewModels/FanPassV4ViewModels.swift` owns screen state and transitions.

## How To Run The iOS Prototype

Prerequisites:

- Xcode installed.
- An iOS Simulator runtime available.
- XcodeGen only if regenerating from `project.yml`.

Open the Xcode project:

```bash
open apps/ios/FanPass/FanPass.xcodeproj
```

Build from terminal for simulator:

```bash
xcodebuild \
  -project apps/ios/FanPass/FanPass.xcodeproj \
  -scheme FanPass \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  build CODE_SIGNING_ALLOWED=NO
```

Build the staff/ops target:

```bash
xcodebuild \
  -project apps/ios/FanPass/FanPass.xcodeproj \
  -scheme FanPassOps \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  build CODE_SIGNING_ALLOWED=NO
```

If `project.yml` changes, regenerate the project before building:

```bash
cd apps/ios/FanPass
xcodegen generate
```

Local iOS provider values are not stored in `project.pbxproj`. Put them in the
gitignored override file instead:

```bash
cp Config/LocalSecrets.xcconfig.example Config/LocalSecrets.xcconfig
```

Then fill `FANPASS_API_BASE_URL`, `FANPASS_PRIVY_APP_ID`,
`FANPASS_PRIVY_APP_CLIENT_ID`, and `FANPASS_STRIPE_PUBLISHABLE_KEY`. The checked-in
configuration files include this override with `#include?`, so rerunning
`xcodegen generate` keeps local Privy/Stripe build settings available without
committing provider values.

## Mock Data

All V4 data is fictional. Events, users, venues, tickets, wallet fragments, proof references, market data, and scanner results are safe demo data. Do not replace them with real personal data, real artist names, real venue branding, production credentials, live Stripe data, raw QR payloads, full wallet addresses, or production chain data.

See `docs/product/FanPass_Mock_Data_Guide_V4.md` for details.

## Prototype Controls

Prototype controls live in Profile under `Prototype Controls`. They are demo-only and must not be treated as a consumer feature. They can switch:

- User role/scenario.
- Ticket state.
- Payment result.
- Scanner result.
- Network condition.
- Transferability condition.
- Resale cap condition.

See `docs/product/FanPass_Prototype_Control_Guide_V4.md`.

## Known Limitations

- Mock data only.
- No real backend API integration.
- No real Stripe or Apple Pay payment.
- No real blockchain transaction.
- No real Core NFC reading in the consumer app.
- No production Apple Wallet pass signing.
- No production organizer dashboard.
- No legal, compliance, KYC, anti-bot, or venue integration layer yet.

See `docs/technical/FanPass_Known_Limitations_V4.md`.

## Future Development Roadmap

Recommended order:

1. Stabilize iOS V4 prototype and add UI tests around prototype controls.
2. Build backend API foundation with PostgreSQL schema and auth/session boundary.
3. Integrate staging auth and embedded wallet references.
4. Add Stripe test-mode checkout with webhook reconciliation.
5. Replace wallet and ticket screens with backend repositories.
6. Implement dynamic QR credentials and staff check-in API.
7. Build resale listing/orderbook APIs and websocket updates.
8. Add blockchain proof sync on testnet.
9. Build Core NFC proof of concept on signed physical devices.
10. Add organizer/admin dashboard and production hardening.

See `docs/technical/FanPass_Next_Steps_V4.md`.

## Team Development Notes

- Do not use real personal data, production credentials, live Stripe mode, or production chain keys in local prototype work.
- Treat old pasted keys and tokens as exposed.
- Keep Clean V4 assets as the source of truth. Do not redesign the logo or app icon without an explicit brand decision.
- Keep Web3 wording out of primary consumer UI unless it appears in Proof & History or technical notes.
- Preserve MVVM boundaries: views render, ViewModels orchestrate state, services simulate or call product domains.
- Add reusable components when the same interaction appears across screens.
- Validate readability, QR quiet zones, market chart labels, and ticket card padding before considering UI work done.
