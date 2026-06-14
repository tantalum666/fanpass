# FanPass Developer Handoff V4

Status: internal engineering handoff
Date: 2026-06-05

## Current App Architecture

The V4 iOS prototype is a native SwiftUI app using MVVM and deterministic mock services. The first backend-backed service boundary now exists, but the product prototype still defaults to mocks unless a ViewModel is explicitly constructed with API services.

- `FanPassApp` launches the app.
- `FanPassV4AppShellView` manages splash, onboarding, login, and main stages.
- `FanPassV4MainTabView` uses native `TabView` with one `NavigationStack` per tab.
- Screen ViewModels own loading/action state and call injected service protocols where backend replacement is ready.
- Mock services simulate domain behavior and remain the default for previews, UI review, and offline prototype runs.
- `FanPassV4APIDataProvider` maps existing API event, ticket, and QR payload DTOs into Clean V4 models for future staging-backed flows.
- Clean V4 design tokens and reusable components are shared across screens.

## Important Folders

| Folder                                                    | Purpose                                                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `apps/ios/FanPass/FanPass/App`                            | App entry, shell, tab navigation, app state.                                             |
| `apps/ios/FanPass/FanPass/Assets`                         | Clean V4 source assets copied into iOS source tree.                                      |
| `apps/ios/FanPass/FanPass/DesignSystem`                   | Colors, typography, spacing, radius, gradients, shadows, icons, animation, components.   |
| `apps/ios/FanPass/FanPass/Models`                         | V4 product entities and enums.                                                           |
| `apps/ios/FanPass/FanPass/ViewModels`                     | Observable state owners for screens and simulated actions.                               |
| `apps/ios/FanPass/FanPass/Views`                          | SwiftUI screens grouped by product module.                                               |
| `apps/ios/FanPass/FanPass/Services`                       | Mock services and existing future API/payment/auth scaffolds.                            |
| `apps/ios/FanPass/FanPass/MockData`                       | Stable fixtures for users, events, tickets, market data, proof history, and scan states. |
| `docs/brand`, `docs/ux`, `docs/product`, `docs/technical` | Product and engineering documentation.                                                   |

## Important Swift Files

| File                             | Role                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `FanPassApp.swift`               | App entry point.                                                                                                                    |
| `FanPassV4AppShellView.swift`    | Stage routing for splash/onboarding/login/main.                                                                                     |
| `FanPassV4MainTabView.swift`     | Main tabs: Home, Explore, Market, Tickets, Profile.                                                                                 |
| `FanPassV4Models.swift`          | Product model namespace `FanPassV4`.                                                                                                |
| `FanPassMockData.swift`          | Deterministic mock fixtures.                                                                                                        |
| `FanPassV4MockServices.swift`    | Service protocols plus simulated domain services.                                                                                   |
| `FanPassV4APIDataProvider.swift` | API-backed V4 event, ticket, and scanner service implementations with mock fallback where the backend contract is not complete yet. |
| `FanPassV4ViewModels.swift`      | Root, Home, Explore, Event Detail, Checkout, Fan Access, Tickets, Market, Scanner, Profile ViewModels.                              |
| `FPComponents.swift`             | Shared UI building blocks.                                                                                                          |
| `FPColors.swift`                 | Clean V4 color tokens.                                                                                                              |

## Design System Usage

Use Clean V4 tokens instead of hardcoded repeated colors or spacing.

- Colors: `FPColors`.
- Typography: `FPTypography`.
- Spacing: `FPSpacing`.
- Radius: `FPRadius`.
- Gradients: `FPGradients`.
- Shadows: `FPShadows`.
- Icons: `FPIcons`.
- Animation: `FPAnimation`.
- Components: `FPPrimaryButton`, `FPSecondaryButton`, `FPTicketCard`, `FPStatusPill`, `FPVerifiedBadge`, `FPMetricCard`, `FPQRCodePlaceholder`, `FPNFCIndicator`, `FPMarketChartPlaceholder`, and state views.

Rules:

- Do not redesign the Clean V4 logo or app icon.
- Do not place decorative lines across text, QR codes, buttons, prices, charts, ticket cards, or logos.
- QR placeholders need a clear white quiet zone.
- NFC waves must be contained or very low opacity behind safe empty space.
- Market charts must not overlap price labels.

## Mock Service Structure

Current mock services:

- `MockAuthService`: demo sign-in and user scenario switching.
- `MockEventService`: featured events and network condition simulation.
- `MockTicketService`: purchase, list, cancel listing, transfer, resale validation.
- `MockPaymentService`: success, failed, and expired checkout simulation.
- `MockMarketService`: orderbook, trades, price history, resale purchase.
- `MockScannerService`: QR refresh, QR scan, NFC scan result simulation.
- `MockFanAccessService`: task completion and Access Badge earning.
- `MockWalletService`: add-to-wallet placeholder behavior.

Current replacement boundary:

- `FanPassV4EventServicing`: featured events and event lookup.
- `FanPassV4TicketServicing`: wallet tickets, purchase/list/transfer placeholders, and future wallet mutations.
- `FanPassV4ScannerServicing`: scanner results and signed QR refresh.
- `ExploreViewModel`, `CheckoutViewModel`, `TicketsViewModel`, and `ScannerViewModel` accept protocol implementations through initializers.
- Default initializers still use mocks so the Clean V4 prototype does not depend on a live backend.

Production direction:

- Add repositories only where they remove real mapping or caching complexity; do not add a generic repository layer before the API contract needs it.
- Keep mock services for previews and UI tests.
- Prefer injecting API-backed services into composition roots instead of constructing providers inside SwiftUI views.
- Keep views unaware of API details, tokens, DTOs, and transport errors.

## Model Structure

Core models live in `FanPassV4Models.swift`:

- User and roles: `User`, `UserRole`, `DemoUserScenario`.
- Events: `Event`, `Venue`, `EventCategory`, `EventStatus`, `HeroGradient`.
- Tickets: `TicketType`, `TicketTransferRule`, `Ticket`, `TicketStatus`, `TicketEntryMode`.
- Fan Access: `FanTask`, `FanTaskStatus`, `AccessBadge`, `AccessBadgeStatus`.
- Payments: `PaymentState`, `DemoPaymentResult`.
- Market: `ResaleListing`, `OrderbookOrder`, `Trade`, `MarketSummary`, `PricePoint`.
- Verification: `CheckInResult`, `ScanResult`, `NFCScanState`.
- Proof: `ProofHistoryItem`.
- Controls: `PrototypeControlState`.

## ViewModel Structure

ViewModels should:

- Load data from mock services or future repositories.
- Own loading, error, empty, and success states.
- Map technical failures into product-safe copy.
- Expose derived strings and computed state for views.
- Keep business logic out of SwiftUI view bodies.

Current ViewModels include:

- `FanPassRootViewModel`
- `HomeViewModel`
- `ExploreViewModel`
- `EventDetailViewModel`
- `CheckoutViewModel`
- `FanAccessViewModel`
- `TicketsViewModel`
- `MarketViewModel`
- `ScannerViewModel`
- `ProfileViewModel`

## How To Add A New Screen

1. Confirm the screen exists in `docs/ux/FanPass_Screen_List_V4.md` or add it there first.
2. Create a ViewModel if the screen has loading, action, or error state.
3. Add mock data or service behavior if the screen needs new state.
4. Build the SwiftUI screen under the matching `Views` folder.
5. Use Clean V4 components and tokens.
6. Add navigation from the parent screen.
7. Add a SwiftUI preview if useful.
8. Run a simulator build and inspect the screen for overlap, contrast, safe areas, and text wrapping.

## How To Add A New Mock State

1. Add the enum/model case in `FanPassV4Models.swift`.
2. Add fixture coverage in `FanPassMockData.swift`.
3. Add mock service behavior in `FanPassV4MockServices.swift`.
4. Expose the state through the relevant ViewModel.
5. Add a Prototype Control option if the state is useful for review.
6. Update `docs/product/FanPass_State_Model_V4.md` and `docs/product/FanPass_Prototype_Control_Guide_V4.md`.

## How To Add A New Ticket Status

1. Add a case to `TicketStatus`.
2. Define `title`, `allowsEntryCode`, `allowsResale`, and any future action permissions.
3. Update `FPTicketCard` and `FPStatusPill` styling if needed.
4. Add at least one mock ticket using the new status.
5. Add wallet/detail copy and error handling.
6. Update product docs and backend schema/API status mappings.

## How To Add A New Event

1. Add a fictional venue if needed.
2. Add event fixture with category, hero gradient, date/time, ticket types, Fan Access flag, tasks, and market summary.
3. Add related price history, orderbook, trades, and optional tickets.
4. Avoid real artists, real venues requiring brand rights, copyrighted images, or real user data.
5. Validate the event appears correctly in Explore, Home, Event Detail, Market, and Ticket Wallet if applicable.

## How To Prepare Backend Integration

1. Keep the V4 UI stable and preserve service-protocol injection.
2. Use `FanPassV4APIDataProvider` for staging-backed event, wallet-ticket, and signed QR refresh trials.
3. Implement environment configuration for staging/local API base URLs through existing xcconfig keys only.
4. Add auth/session exchange and bearer token injection before any private user data is fetched.
5. Replace events and wallet data first because they are read-heavy and lower risk.
6. Add checkout only after order reservation, idempotency, PaymentIntent creation, and webhook reconciliation are ready.
7. Add dynamic QR UI refresh only against the API-owned `EntryCredential` lifecycle, with no raw QR payload logging.
8. Add resale only after listing cap validation and ticket reservation behavior are implemented.

Current build validation on 2026-06-06:

```bash
xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPassOps -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

## Code Style Notes

- Prefer small reusable components over large monolithic view bodies.
- Use product-safe copy from the microcopy guide.
- Avoid logging secrets, tokens, QR payloads, payment IDs, full wallet addresses, or personal data.
- Keep comments focused on simulated behavior or non-obvious logic.
- Keep prototype controls internal/demo-only.
- Do not introduce live providers into the prototype without environment separation and release evidence.
