# Codex Handoff

This file is the durable project memory for FanPass. Use it to continue work after context compaction or in a new conversation.

## Current Active State

This section is the highest-priority durable work cursor after explicit system/developer instructions and the user's newest live message. In long-running `/goal` work, use this section to decide the next step after context compaction or resume.

Long-term `/goal`:

- Finish the FanPass web frontend and backend to usable review quality, while continuing to move the web app toward the supplied premium ticket marketplace/orderbook concept.

Current work cursor:

- New live implementation redirect on 2026-06-10: the owner asked to put all generated concept flows into the native iOS side first. The current implementation pass has moved the fan-facing `Home`, `Explore`, `Market`, `Tickets`, and `Account` concepts plus the staff `FanPassOps` concept workflow into SwiftUI prototype screens. Treat this as concept-UI implementation, not signed/TestFlight, physical QR/NFC, Apple Wallet, or chain-custody evidence.
- New live priority from the user on 2026-06-10: stop management concept generation for now and push iOS TestFlight plus physical QR/NFC validation. The user has obtained Apple Developer account access. Treat native iOS distribution and FanPass Ops real-device scanner evidence as the active workstream until redirected.
- Immediate iOS facts from the 2026-06-10 pass:
  - `FanPass` and `FanPassOps` schemes exist in `apps/ios/FanPass/FanPass.xcodeproj`.
  - Xcode 26.5 is selected.
  - After the user connected Xcode to the Apple Developer account and registered the iPhone, `security find-identity -v -p codesigning` now finds one valid Apple Development identity locally.
  - `xcrun devicectl list devices` now sees the physical iPhone as connected, and `xcodebuild -showdestinations` lists it as an eligible iOS destination for both `FanPass` and `FanPassOps`.
  - Real-device Debug builds passed for both `FanPass` and `FanPassOps` on the connected iPhone. `FanPassOps` signing output confirmed the NFC NDEF entitlement is present in the signed development build.
  - Xcode UI signing changes modified `apps/ios/FanPass/FanPass.xcodeproj/project.pbxproj` and wrote real local Team/signing values into the generated project. This is useful for local device testing but should not be committed as the durable signing solution; keep real Apple identifiers/profiles outside source control and prefer the existing `project.yml` plus environment-variable archive helper flow.
  - A local QR/NFC capture-test payload was generated under `outputs/ops-scanner/`: `20260610T-debug-qr-capture.png`, `20260610T-debug-qr-capture-payload.json`, and `20260610T-debug-nfc-uri.txt`. It is intentionally signed with an invalid placeholder signature and contains no real ticket/user/key/secret data. Use it only to test camera/NFC capture and rejected/invalid-signature UI states; it cannot close QR/NFC evidence or prove successful redemption.
  - Product entry boundary clarified on 2026-06-10: fans must not be expected to carry a separate NFC/RFID tag. Near-term admission should be phone-to-phone dynamic QR, with the fan iPhone displaying a short-lived signed entry payload and the `FanPass Ops` iPhone scanning it. NFC/RFID remains an internal fixture/prototype path unless a future Apple-entitlement/terminal-protocol workstream is explicitly approved.
  - RFID compatibility boundary: only NFC-compatible tags that can be read/written as NDEF Text or URI records can test the current `FanPass Ops` NFC path. LF 125 kHz RFID, UHF RFID, proprietary access cards, and cards that iPhone/NFC Tools cannot write as NDEF cannot be used for this fixture.
  - Apple Wallet boundary clarified on 2026-06-10: standard signed `.pkpass` tickets with QR/barcode are a near-term FanPass Wallet path and require a Pass Type ID, Pass Type ID certificate, backend signing, and physical-iPhone install evidence. This does not require the Apple Developer Enterprise Program. NFC/contactless Wallet ticket presentation, like a tap-near-reader Ticketmaster experience, is a separate future path requiring Apple-issued special entitlement/access, compatible reader protocol, and likely organization-level Apple Developer Program status plus Apple agreements/approval.
  - Backend admission safety was hardened on 2026-06-10 for the two-people/same-ticket-at-the-gate risk. FanPass API now treats API state as the source of truth for live admission: dynamic entry credentials are persisted/superseded/consumed, memory/demo redemption uses an in-flight ticket+nonce claim, Prisma redemption atomically claims the ticket with `ACTIVE|TRANSFERRED -> REDEEMED`, accepted check-ins carry unique accepted nonce plus unique accepted ticket id, unique-constraint races map to `DUPLICATE`, and QR/NFC entry transports share the same signed-payload redemption path. Chain writes remain asynchronous proof/outbox work and must not be used as the synchronous gate decision.
  - Dynamic QR refresh was tightened on 2026-06-10. `QR_TTL_SECONDS` is now fixed at a 30-second maximum in backend config and payload generation. The fan iOS entry-code sheet auto-refreshes before expiry, and the web Ticket Detail safe entry preview schedules refresh from `expiresAt - 5s` with a 25-second maximum wait. Stale/superseded QR credentials remain rejected by the backend; client auto-refresh is convenience, not authority.
  - FanPass Ops concept boards were completed on 2026-06-10 after the required startup Markdown pass. The durable index is `docs/ux/FanPass_Ops_Concept_Boards_V4.md`, with archived image assets under `docs/ux/concepts/fanpass-ops/`. The five boards cover shift start/gate assignment, live scanner, exception/recovery states, review/audit/account, and the admission state machine/trust boundaries. Use these as the product reference for `FanPassOps` iOS implementation, while keeping generated text as placeholder and respecting the staff-only/no-sensitive-payload boundaries.
  - Native iOS concept implementation pass completed on 2026-06-10. The fan app now has concept-level SwiftUI surfaces for Home long-scroll plus search/notification/location/guest/empty windows, Explore overview/events/venues/artists/collections/saved and filter/venue-detail states, Market overview/event market/buy/sell/recovery states, Tickets overview/detail/entry-code/rules/proof/support/resale states, and Account overview/profile/orders/alerts/security/payments/support states. `FanPassOps` now has shift assignment, live scanner launch, exception recovery, audit/review, account/device-health, and admission-state-machine concept surfaces. Shared typed concept UI primitives live in `apps/ios/FanPass/FanPass/DesignSystem/FPComponents.swift`.
  - Verification for the native concept pass: `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` and `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPassOps -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` both passed. Xcode emitted only the non-blocking AppIntents metadata-extraction warning because there is no AppIntents framework dependency. XcodeBuildMCP simulator smoke also passed for both schemes on `FanPass-iPhone-17`; `FanPass` rendered the first-run onboarding screen and `FanPassOps` rendered the Shift staff shell. Smoke screenshots were saved at `outputs/ios-concepts/20260610-fanpass-onboarding-smoke.jpg` and `outputs/ios-concepts/20260610-fanpass-ops-shift-smoke.jpg`.
  - Native iOS concept closeness audit completed on 2026-06-10 and documented in `docs/ux/FanPass_iOS_Concept_Implementation_Audit_V4.md`. The implementation is structurally close but not high-fidelity yet. Fixes applied: secondary segmented controls now wrap instead of clipping, Account uses FanPass masked IDs instead of `0x...`, the visible Account `Demo` tab/prototype controls were removed, user-facing `concept/prototype/demo/crypto/wallet address` wording was replaced with ticketing language, and map accessibility text now names pins. Remaining visual gaps: fan-facing event/poster media treatment is still weak, and `FanPassOps` remains dark while the generated Ops boards use a lighter onsite-ops style.
  - Generated image source audit completed on 2026-06-10 after the user reported that the current UI was not matching the confirmed concept style. All 73 images under `/Users/tantalum/.codex/generated_images` were visually reviewed and renamed in place with semantic prefixes: `confirmed-` for active concept sources, `deferred-` for paused Console/Admin/Organizer boards, `paused-` for old web-route references, `superseded-` for rejected/replaced drafts, and `reference-` for non-route source imagery. The durable classification is `docs/ux/FanPass_Generated_Image_Manifest_V4.md`, with machine-readable mapping at `outputs/generated-images-audit-20260610/generated-images-classification.csv`. All Markdown references to generated images were updated to the new semantic paths.
  - On 2026-06-11, native iOS concept UI was realigned against confirmed images only. Fan-facing surfaces now share an editorial event poster/row treatment across Home, Explore, and Market, and `FPTicketCard` has a stronger wallet/pass header. `FanPassOps` now uses a dedicated light onsite-operations theme for shift, assigned events, gate selection, stats, rows, and action cards, matching the confirmed Ops board direction more closely. Verification passed: FanPass simulator Debug build with `CODE_SIGNING_ALLOWED=NO`, FanPassOps simulator Debug build with `CODE_SIGNING_ALLOWED=NO`, and XcodeBuildMCP `build_run_sim` for FanPassOps. Screenshots: `outputs/ios-concepts/review-20260611/fanpass-ops-after-light-unification.png` and `outputs/ios-concepts/review-20260611/fanpass-after-confirmed-style.png`; the latter launched to onboarding, so full post-onboarding fan-page visual QA is still pending.
  - On 2026-06-11, the fan-facing V4 iOS shell was wired to existing backend-capable services without changing the safety boundary. `FanPassBackendContext` now owns the API client/session/user, attempts a DEBUG demo API session, exposes API-backed event/ticket/scanner services, and syncs Privy email-code login through `/auth/privy/sync`. Home, Explore, and Tickets now load through the API provider first and fall back to local review data when unavailable. Ticket entry sheets generate a real QR image from `/verification/qr` payloads and refresh before the 30-second expiry without rendering raw payloads/nonces/signatures. V4 Checkout creates an API order, creates a Stripe PaymentIntent through `/payments/intents`, presents the existing native Stripe PaymentSheet presenter, and only marks the client as `authorized`; ticket assignment still waits for backend webhook settlement. Account Security now exposes Privy email-code sign-in controls and session sign-out. Verification passed: `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` and `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPassOps -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`. This is simulator compile evidence only; real HTTPS staging config, public Privy IDs, Stripe `pk_test_` plus backend Stripe test secrets, physical QR scan evidence, and TestFlight evidence remain open.
  - Later on 2026-06-11, the iOS release-boundary audit was repaired after it failed on a stale `OpsMetric(title: "Fallback")` assumption. The scanner now keeps paste-fallback wording in `#if DEBUG` branches and uses QR/NFC-only wording in release paths. The audit now accepts an Ops shell with no paste fallback metric while still rejecting the metric if it is reintroduced outside `#if DEBUG`. Verification passed: `npm run security:ios-distribution-boundaries:self-test`, `npm run security:ios-distribution-boundaries`, `npm run security:ios-physical-device-qa`, `npm run security:nfc-ndef-fixture`, FanPass Debug simulator build with `CODE_SIGNING_ALLOWED=NO`, and FanPassOps Debug simulator build with `CODE_SIGNING_ALLOWED=NO`.
  - `https://fanpass-api-staging.onrender.com/health` returned `{"ok":true,"service":"fanpass-api","target":"technical-prototype"}` on 2026-06-11 after an initial free-tier cold-start timeout. This proves the known Render staging API hostname is currently reachable, but it does not close iOS signed-build evidence because the signed apps still need external build-setting injection and saved evidence.
  - Local Apple/device status on 2026-06-11: `security find-identity -v -p codesigning` found one valid Apple Development identity and `xcrun devicectl list devices` showed one paired available iPhone. Treat those as local readiness facts only; do not paste Team IDs, profile names, signing material, or device identifiers into docs/evidence.
  - Fresh non-passing evidence drafts were generated after the scanner/audit boundary changes: `outputs/ios-staging-build/20260611T-ios-staging-build-draft.json` and `outputs/ops-scanner/20260611T-ops-scanner-device-draft.json`. Running the formal validators against both drafts failed as expected because real signed builds, HTTPS-injected runtime observations, physical QR/NFC scans, replay rejection, and backend-authority proof have not been captured yet.
  - `Config/Staging.xcconfig` and `Config/Beta.xcconfig` still use placeholder `.invalid` API URLs and empty Privy/Stripe public config slots.
  - `npm run security:ios-distribution-boundaries`, `npm run security:ios-physical-device-qa`, and `npm run security:nfc-ndef-fixture` passed.
  - `FanPass` and `FanPassOps` Debug simulator builds passed with `CODE_SIGNING_ALLOWED=NO`.
  - `FanPass` and `FanPassOps` Beta generic iOS archive compiles passed with `CODE_SIGNING_ALLOWED=NO`. These are compile confidence only, not signed/TestFlight evidence.
  - Evidence drafts were generated at `outputs/ios-staging-build/20260610T-testflight-draft.json` and `outputs/ops-scanner/20260610T-physical-qr-nfc-draft.json`.
  - Added `scripts/ios-beta-archive.sh` and npm script `ios:archive:beta` for caller-supplied signed archives without committing Apple/provider configuration.
- Next iOS actions:
  - If continuing concept polish before release hardening, decide first whether to add stronger fan-facing event/poster media and whether `FanPassOps` should stay dark or move to a lighter onsite-ops theme. Do not call the current implementation high-fidelity until those decisions are made and rendered on device.
  - Run the implemented concept UI on simulator and/or the connected iPhone for visual QA before deeper backend wiring. Check navigation density, sheet/modal behavior, text wrapping, and staff scanner launch path. Do not treat this visual pass as release evidence.
  - Configure local/staging build settings with real HTTPS API URL, public Privy app/client IDs, Stripe test publishable key, and backend Stripe test secrets, then run the V4 Home/Tickets/Checkout/Account paths against staging. Save evidence only after redaction and documented validators pass.
  - Use Xcode Run on the connected iPhone for both schemes and confirm launch-time behavior/permission prompts. The CLI has already confirmed signed Debug device builds for both apps.
  - Create/download Apple Distribution signing identity if it is not present yet.
  - Create App Store Connect apps and bundle IDs for `com.fanpass.app` and `com.fanpass.ops`; enable NFC Tag Reading only on `com.fanpass.ops`.
  - Create development and App Store/TestFlight provisioning profiles for both apps.
  - Inject `FANPASS_APPLE_TEAM_ID`, profile specifier variables, real HTTPS staging/beta API URL, public Privy app/client IDs, and `pk_test_` Stripe publishable key via local environment/build settings only.
  - Run `npm run ios:archive:beta`, upload via Xcode Organizer or caller-owned export/upload flow, then complete `outputs/ios-staging-build/20260610T-testflight-draft.json` and validate it with `npm run security:ios-staging-build:evidence -- <completed-json>`.
  - Install on a real iPhone, use FanPass Ops with a physical NDEF tag and camera QR against HTTPS staging/beta API, complete `outputs/ops-scanner/20260610T-physical-qr-nfc-draft.json`, and validate with `npm run security:ops-scanner:device-evidence -- <completed-json>`.
  - Do not claim TestFlight or physical QR/NFC blockers closed until the completed evidence files pass their validators.
- Paused lower-priority Web cursor: continue FanPass Web product-page fidelity by replacing the repeated secondary-page layouts with route-specific product surfaces only after the iOS/TestFlight and physical QR/NFC push is paused or redirected.
- Earlier web feedback remains valid: the user explicitly rejected the repeated layout pattern for `For You`, `Events`, `Venues`, `Artists`, `Collections`, and later destinations such as `My Tickets`, `Wallet`, `Orders`, `Analytics`, `Alerts`, and `Settings`. Do not resume that work by building another reused shell with different labels.
- Use the generated concept boards as the design source for missing routes before coding:
  - Discovery secondary routes concept board: `/Users/tantalum/.codex/generated_images/019ea0f2-4089-7f33-89de-bba07aeb3da4/paused-web-discovery-secondary-routes-board.png`
  - Account/ops routes concept board: `/Users/tantalum/.codex/generated_images/019ea0f2-4089-7f33-89de-bba07aeb3da4/paused-web-account-ops-routes-board.png`
  - Earlier alternate discovery concept board: `/Users/tantalum/.codex/generated_images/019ea0f2-4089-7f33-89de-bba07aeb3da4/paused-web-alternate-discovery-board.png`
- Current web Home concept direction:
  - Desktop Home must be a true long-scroll page, not a one-screen dashboard or a single compact concept board. Use top navigation with five primary destinations: `Home`, `Explore`, `Market`, `Tickets`, `Account`; no left sidebar and no duplicate account avatar.
  - Desktop Home sections should unfold vertically: hero/search/featured event, `Popular near you`, `Just announced`, trust explanation cards, `Fan Access`, then footer.
  - Mobile Home v3 is directionally acceptable: bottom five-tab navigation, simplified first screen, larger readable text, fewer modules, and later scroll sections for discovery/trust/Fan Access.
  - Latest accepted desktop long-scroll concept image: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-home-desktop-long-scroll.png`
  - Latest mobile simplified concept image: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-home-mobile-v3.png`
  - Home-owned secondary windows are limited to overlays/sheets/states: desktop search overlay, desktop notifications drawer, desktop location/currency popover, guest Home state, empty/low-data Home state, and mobile search sheet. Do not create `Popular near you`, `Just announced`, `Trust`, `Fan Access`, Event Detail, Explore, Market, Tickets, or Account as Home subpages.
  - Latest Home secondary windows concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-home-secondary-windows.png`
- Current web Explore concept direction:
  - Explore is its own top-level route, not a Home subpage. It should own event discovery, search, filters, map/list browsing, event detail, ticket-type comparison, event rules, venues, artists, collections, saved discovery, no-results, and mobile sheets.
  - Use generic city/district labels and fictional events/artists/venues only. Do not use precise personal latitude/longitude, real private user data, QR/NFC proof claims, checkout/account flows, or native evidence claims in Explore concepts.
  - Explore overview/search/filter/map/mobile concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-explore-overview-search-filter-map-mobile.png`
  - Events directory/event detail/ticket types/rules/mobile concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-explore-events-detail-ticket-rules-mobile.png`
  - Venues/artists directory and detail concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-explore-venues-artists-directory-detail.png`
  - Collections/saved/no-results/mobile concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-explore-collections-saved-no-results-mobile.png`
  - Treat generated text as visual placeholder only. Final UI copy must be typed and cleaned in code/docs, not copied from image artifacts where generation introduced spelling noise.
- Current web Market concept direction:
  - Market is its own top-level route for controlled resale and transparent price context. It should not feel like a stock, crypto, gambling, or high-frequency trading surface.
  - Market owns resale overview, event market detail, ticket-type market comparison, bounded price charts, controlled listing review, buy-resale review, listing-unavailable recovery, proof summary, seller list-ticket flow, cap validation, payout estimate, listing success, and seller error states.
  - Use fictional events and HKD test data only. Do not use real private data, precise personal location, seller identity, wallet addresses, payment provider internals, QR/NFC, Apple Wallet, scanner, chain-custody, or native evidence claims in Market concepts.
  - Market overview/fair resale/mobile concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-market-overview-fair-resale-mobile.png`
  - Event market detail/ticket types/rules/unavailable/mobile concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-market-event-detail-ticket-types-rules-unavailable-mobile.png`
  - Listing detail/buy resale review/reserved/proof summary/mobile concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-market-listing-buy-review-proof-mobile.png`
  - List ticket for resale seller flow/error states/mobile concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-market-seller-list-ticket-flow-error-mobile.png`
  - Generated Market boards contain some image-text imperfections. Use them for structure, density, and interaction states only; final UI copy and table values must be typed and cleaned.
- Current web Tickets concept direction:
  - Tickets is its own top-level route for owned-ticket retrieval, entry readiness, safe ticket lifecycle states, and Proof & History. It should stay separate from Account orders/settings and from Market resale browsing.
  - Tickets owns ticket wallet/overview, ticket detail, short-lived entry code modal/sheet, entry-code expired/not-active/listed/transfer-pending states, Proof & History, ticket rules, list-for-resale handoff, ticket support, guest/empty/loading/error states, and cancelled/refunded/redeemed/transfer-pending/listed detail states.
  - Use fictional ticket data only. Do not show full ticket IDs, raw QR payloads, nonces, signatures, owner IDs, wallet addresses, payment provider internals, Apple Wallet, NFC claims, scanner/admin UI, chain-custody, native evidence, or real personal data in Tickets concepts.
  - Tickets overview/ticket wallet/mobile concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-tickets-overview-wallet-mobile.png`
  - Ticket detail/entry code/mobile concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-tickets-detail-entry-code-mobile.png`
  - Proof & History/rules/resale handoff/support/mobile concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-tickets-proof-history-rules-resale-support-mobile.png`
  - Ticket states and recovery windows/mobile concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-tickets-states-recovery-mobile.png`
  - Generated Tickets boards contain some image-text imperfections. Use them for layout, hierarchy, and state coverage only; final UI copy and safe fragments must be typed and cleaned.
- Current web Account concept direction:
  - Account is its own top-level route for identity, privacy, security, payment methods, order/receipt history, alert rules, preferences, support, and role-access handoff. It should not take over Tickets entry-code retrieval or Market resale browsing.
  - Account owns account overview/profile hub, masked ticket identity, payment-method management, orders/receipts/refunds/failures, alerts/notification preferences, security sessions/devices, privacy/data controls, role access, connected apps, support/help, guest account, session expired, and destructive-action confirmations.
  - Use fictional account/order/payment data only. Mask email, phone, account references, ticket identity, payment methods, role details, and support references. Do not show raw provider IDs, access tokens, full card numbers, PaymentIntent/client secret fields, full wallet addresses, seed phrases, raw hashes, QR/NFC, Apple Wallet, scanner UI, admin dashboard, chain-custody, native evidence, or real personal data in Account concepts.
  - Account v1 boards generated earlier on 2026-06-10 are superseded. They were too compressed, had inconsistent Account navigation between the overview and secondary boards, and did not cover enough secondary/tertiary Account pages.
  - Current Account v2 overview/profile hub concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-account-v2-overview-profile-hub-mobile.png`
  - Current Account v2 profile details/ticket identity concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-account-v2-profile-ticket-identity-mobile.png`
  - Current Account v2 orders/receipts/refunds/failures concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-account-v2-orders-receipts-refunds-failures-mobile.png`
  - Current Account v2 alerts/preferences/rule editor concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-account-v2-alerts-preferences-rule-editor-mobile.png`
  - Current Account v2 security/privacy concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-account-v2-security-privacy-mobile.png`
  - Current Account v2 payment methods/role access/connected apps/support concept board: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-account-v2-payments-role-connected-support-mobile.png`
  - Account v2 uses a consistent desktop global top nav, a consistent Account left subnav, and a consistent mobile five-tab bottom nav on every board. Generated text is still placeholder only; final UI copy must be typed, all real identifiers must be masked, ticket-state detail must remain in Tickets, and Account role access must stay a status/handoff surface rather than scanner/admin UI.
- Navigation/sidebar stability is accepted for now. Do not reopen navigation/sidebar work unless the user reports a new navigation bug or a rendered QA check finds a real regression.
- Deferred management concept backlog:
  - The user redirected work to iOS TestFlight and physical QR/NFC before the Console management concepts were fully inspected/documented. Do not continue Console/Admin/Organizer management concept generation until the user asks to return to it.
  - FanPass Ops is no longer only a deferred management draft; the current Ops concept set is completed and indexed in `docs/ux/FanPass_Ops_Concept_Boards_V4.md`.
  - Use these generated boards later as draft references for Admin/Organizer management surfaces:
    - FanPass Console Overview: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/deferred-console-overview.png`
    - FanPass Console Event & Inventory: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/deferred-console-event-inventory.png`
    - FanPass Console Resale Rules & Fan Access: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/deferred-console-resale-rules-fan-access.png`
    - FanPass Console Orders & Risk: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/deferred-console-orders-risk.png`
    - FanPass Console Staff & Gates: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/deferred-console-staff-gates.png`
    - FanPass Console Platform Admin: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/deferred-console-platform-admin.png`
  - Earlier rejected management drafts in the same directory mixed Console/Ops/Account/fan navigation or unsafe labels; do not use them as current direction.

Latest completed:

- On 2026-06-10, all generated fan and staff concept flows were implemented into the native iOS SwiftUI prototype shell after the required startup protocol: `docs/CODEX_HANDOFF.md` was read first, then all workspace Markdown files were enumerated/read (`2720` files, `25990535` bytes, sha256 `b25b0c0d060057c7532d6eace807e0986add8bf78136c5868251a6ce2520a25d`). The implementation updated `FanPassV4HomeView`, `FanPassV4ExploreView`, `FanPassV4MarketView`, `FanPassV4TicketsView`, `FanPassV4ProfileView`, `FanPassV4ViewModels`, `OpsShellView`, and shared concept UI helpers in `FPComponents.swift`. The fan app now follows the five top-level product destinations (`Home`, `Explore`, `Market`, `Tickets`, `Account`) and includes the concept secondary/state surfaces for search, filters, venue detail, market review/listing, ticket entry code, proof/rules/support, account orders/alerts/security/payments, and empty/guest/recovery cases. `FanPassOps` now implements the Ops concept workflow around shift assignment, gate scanner launch, exception recovery, review/audit, account/device state, and admission state machine. Verification passed both `FanPass` and `FanPassOps` Debug generic iOS Simulator builds with `CODE_SIGNING_ALLOWED=NO`; XcodeBuildMCP build/run smoke passed for both schemes on `FanPass-iPhone-17`, with screenshots saved at `outputs/ios-concepts/20260610-fanpass-onboarding-smoke.jpg` and `outputs/ios-concepts/20260610-fanpass-ops-shift-smoke.jpg`. This is compile/render confidence for concept UI only and does not close signed/TestFlight, physical QR/NFC, Apple Wallet, or release-chain evidence blockers.
- On 2026-06-10, the native iOS concept implementation was re-audited against the generated concept boards after repeating the startup protocol. The audit is documented in `docs/ux/FanPass_iOS_Concept_Implementation_Audit_V4.md`. Screenshot contact sheets were generated under ignored local output path `outputs/ios-concepts/review-20260610/`. The pass fixed clipped secondary segmented controls, Account `0x...` identity wording, visible Account demo/prototype controls, and user-facing internal wording such as `concept`, `prototype`, `demo`, `crypto`, and wallet-address/data language. Verification passed both `FanPass` and `FanPassOps` Debug generic iOS Simulator builds. Remaining: the implementation is structurally close but not high-fidelity because fan event/poster media treatment is still weak and Ops visually remains dark while the generated Ops boards lean lighter and more onsite-operations focused.
- On 2026-06-10, the FanPass Ops concept set was completed after the required startup protocol: `docs/CODEX_HANDOFF.md` was read first, all 95 workspace Markdown files were enumerated and read/hashed, and the image generation skill instructions were read. Five boards were generated, inspected, archived under `docs/ux/concepts/fanpass-ops/`, and indexed in `docs/ux/FanPass_Ops_Concept_Boards_V4.md`: shift start/gate assignment, live gate scanner, exceptions/recovery, review/audit/account, and admission state machine/trust boundaries. No code was changed in this pass.
- On 2026-06-10, QR expiry was limited to 30 seconds and client auto-refresh was implemented. `VerificationService` now defaults/caps `QR_TTL_SECONDS` at 30 seconds, config validation rejects values above 30, API env templates and local/dry-run scripts were updated to `QR_TTL_SECONDS=30`, and tests assert both default and overconfigured TTLs produce 30-second payloads. `TicketWalletView` now keeps the displayed iOS QR payload in sheet state and refreshes automatically before expiry. `useTicketDetailEvidence` now schedules web Ticket Detail entry-credential refresh from credential expiry, up to a 25-second delay. Verification passed focused API tests, API full tests, API typecheck/build, web typecheck/build, `FanPass` Debug simulator build, and `FanPassOps` Debug simulator build with `CODE_SIGNING_ALLOWED=NO`.
- On 2026-06-10, backend QR/NFC admission race hardening was implemented after the startup protocol/full Markdown pass. `apps/api/src/modules/verification/verification.service.ts` now records dynamic entry credentials, supersedes older active credentials on refresh, consumes accepted credentials, blocks in-flight duplicate claims by nonce and ticket in the memory path, records concurrent duplicate attempts, and routes NFC NDEF payload validation through the same signed entry redemption path as QR. The Prisma path adds ticket-level atomic claiming and stores accepted check-ins with both unique accepted nonce and unique accepted ticket id in `apps/api/prisma/schema.prisma`, with duplicate unique-constraint races mapped to `DUPLICATE`. Added verification coverage for same-payload concurrent replay, same-ticket/different-nonce concurrent replay, NDEF URI redemption, refreshed-code revocation, event mismatch, gate scoping, listed-ticket blocking, and production QR secret enforcement. Verification passed: `scripts/with-node-22.sh npx prisma format --schema apps/api/prisma/schema.prisma`, `scripts/with-node-22.sh npm run prisma:generate -w apps/api`, `scripts/with-node-22.sh npm run test -w apps/api -- --runTestsByPath test/verification.service.spec.ts`, `scripts/with-node-22.sh npm run test -w apps/api`, `scripts/with-node-22.sh npm run typecheck -w apps/api`, `scripts/with-node-22.sh npm run build -w apps/api`, and `git diff --check -- apps/api/prisma/schema.prisma apps/api/src/modules/verification/verification.service.ts apps/api/test/verification.service.spec.ts`. This is backend/local validation only; physical QR/NFC and release custody blockers remain open until their evidence validators pass.
- On 2026-06-10, the iPhone pairing step completed. `xcodebuild -showdestinations` now lists the connected iPhone as an eligible destination for both `FanPass` and `FanPassOps`, and `xcrun devicectl list devices` reports it connected. CLI real-device Debug builds passed for both schemes. The `FanPassOps` signed build included `com.apple.developer.nfc.readersession.formats = NDEF`, confirming the local development profile supports the NFC entitlement. Xcode UI signing changed `apps/ios/FanPass/FanPass.xcodeproj/project.pbxproj` from the placeholder/manual signing variables to automatic local Apple Development signing with the real Team ID; this local project-file change must not be treated as the durable source-controlled signing approach.
- On 2026-06-10, a local debug scanner fixture was generated for physical-device capture testing only: `outputs/ops-scanner/20260610T-debug-qr-capture.png`, `outputs/ops-scanner/20260610T-debug-qr-capture-payload.json`, and `outputs/ops-scanner/20260610T-debug-nfc-uri.txt`. The QR encodes a syntactically valid `QRPayload` JSON with an intentionally invalid placeholder signature, and the NFC URI wraps the same payload as `fanpass://entry?payload=...` for an NDEF URI tag. It contains no real ticket/user/key/secret data and should be expected to capture successfully but fail redemption with invalid-signature or unreachable-service behavior until a backend-signed staging/local payload and reachable API are used.
- On 2026-06-10, the entry-product boundary was corrected after the user pointed out that fans cannot be expected to carry separate tags. Docs now treat phone-to-phone dynamic QR as the near-term admission path and NFC/RFID as an internal fixture/prototype path only. `docs/NFC_NDEF_TAG_FIXTURE.md` now states that only NFC-compatible RFID tags writable/readable as NDEF Text or URI records can test the current Core NFC implementation; generic LF/UHF/proprietary RFID cards cannot.
- On 2026-06-10, the Apple Wallet product boundary was documented after reviewing Apple Wallet/ticket examples. `docs/APPLE_WALLET_PASS_EVIDENCE.md` and `docs/IOS_DISTRIBUTION_PLAN.md` now separate standard signed `.pkpass` QR/barcode tickets from NFC/contactless Wallet tickets. Standard `.pkpass` support is the near-term Wallet route and does not require Apple Developer Enterprise Program; NFC/tap-to-reader Wallet entry requires special Apple entitlement/access, reader protocol work, and likely organization-level Apple Developer Program status plus Apple approval/agreements.
- On 2026-06-10, the user connected an iPhone and configured the Apple Developer account/team in Xcode. Startup protocol was repeated: `docs/CODEX_HANDOFF.md` was read first, all 95 Markdown files were enumerated/read/hashed, and the active iOS distribution/physical-device evidence docs were re-read. Local checks now show one valid Apple Development signing identity and the physical iPhone visible through `xcrun devicectl list devices`, but `xcodebuild -showdestinations` still marks the iPhone ineligible because it is unpaired. Next step is to pair the phone in Xcode's Devices window, then rerun real-device destination/build checks for both `FanPass` and `FanPassOps`.
- On 2026-06-10, the active priority was switched to iOS TestFlight and physical QR/NFC after the user confirmed Apple Developer account access. Startup protocol had already been repeated in this turn: `docs/CODEX_HANDOFF.md` was read first and all 95 Markdown files were enumerated/read/hashed. Relevant iOS distribution, physical-device QA, Ops scanner evidence, NFC fixture, and Privy mobile config docs were re-read. XcodeBuildMCP confirmed schemes `FanPass` and `FanPassOps`; local checks found Xcode 26.5 selected, zero valid code-signing identities in the keychain, no connected iPhone, placeholder `.invalid` Staging/Beta API URLs, and empty Privy/Stripe public config slots. Verification passed `npm run security:ios-distribution-boundaries`, `npm run security:ios-physical-device-qa`, `npm run security:nfc-ndef-fixture`, `FanPass` Debug simulator build, `FanPassOps` Debug simulator build, and unsigned Beta generic iOS archive compiles for both apps. Draft evidence files were created at `outputs/ios-staging-build/20260610T-testflight-draft.json` and `outputs/ops-scanner/20260610T-physical-qr-nfc-draft.json`. Added `scripts/ios-beta-archive.sh` plus `npm run ios:archive:beta` as a secret-free local archive helper for caller-supplied Apple signing, HTTPS API, Privy public config, and Stripe test publishable key values.
- On 2026-06-10, management concept generation was paused after the user confirmed an Apple Developer account and redirected the priority to iOS TestFlight plus physical QR/NFC. Generated management boards were recorded as a deferred backlog only; no code was changed for management concepts.
- On 2026-06-10, Account v2 concept boards were generated after user feedback that the first Account overview was too cluttered, navigation was inconsistent, and many secondary/multi-level pages were missing. Startup protocol was repeated again: `docs/CODEX_HANDOFF.md` was read first, all 95 Markdown files were enumerated and read/hashed, the Account IA/screen-list docs were re-read, and the image generation skill was followed through the built-in path. Six Account v2 boards were generated and visually inspected: Overview/Profile Hub, Profile Details/Ticket Identity, Orders/Receipts/Refunds/Failures, Alerts/Notification Preferences, Security/Privacy, and Payment Methods/Role Access/Connected Apps/Support. The generated Alerts, Profile, Orders, Security/Privacy, and Payment/Role boards were regenerated as needed to remove real-world names, crypto-like language, unsafe payment placeholders, or mobile-nav inconsistencies. No code was changed in this pass.
- On 2026-06-10, the Account route concept pass was completed after the startup protocol was repeated: `docs/CODEX_HANDOFF.md` was read first, all 95 workspace Markdown files were enumerated and read/hashed, and the active IA, screen-list, content-model, interaction-principles, UI-state checklist, and account/privacy docs were re-read before generation. Four Account concept boards were generated and inspected: Account Overview/Profile Hub, Orders/Receipts, Alerts/Preferences, and Security/Privacy/Payments/Role/Support. The boards keep Account focused on account management, safe orders/receipts, notification rules, privacy/security, payment methods, role-access handoff, and support; they avoid entry-code retrieval, Market browsing, raw provider/payment IDs, full wallet addresses, QR/NFC, Apple Wallet, scanner/admin UI, native evidence, chain-custody claims, and real personal data. No code was changed in this pass.
- On 2026-06-10, the Tickets route concept pass was completed after the startup protocol was repeated: `docs/CODEX_HANDOFF.md` was read first, all 95 workspace Markdown files were enumerated and read/hashed, and the active IA, screen-list, QR/NFC verification, user-flow, and UI guardrail docs were re-read before generation. Four Tickets concept boards were generated and inspected: Tickets Overview/Ticket Wallet, Ticket Detail/Entry Code, Proof & History/Ticket Rules/Resale Handoff/Support, and Ticket States/Recovery Windows. The boards keep Tickets focused on owned-ticket retrieval, entry readiness, safe lifecycle state, and proof/history; they avoid Apple Wallet, NFC claims, scanner/admin UI, wallet addresses, raw payload/nonce/signature, payment provider internals, native evidence, chain-custody claims, and real personal data. No code was changed in this pass.
- On 2026-06-09, the Market route concept pass was completed after the startup protocol was repeated: `docs/CODEX_HANDOFF.md` was read first, all 95 workspace Markdown files were enumerated and read/hashed, and the active orderbook, IA, screen-list, UI guardrail, and report docs were re-read before generation. Four Market concept boards were generated and inspected: Market Overview, Event Market Detail, Listing Detail/Buy Resale Review, and List Ticket For Resale Seller Flow. The boards intentionally keep Market as controlled resale with bounded charts and plain fan-friendly language rather than a speculative terminal, and avoid QR/NFC, Apple Wallet, scanner, wallet address, provider/payment internal, private-data, and native-evidence claims. No code was changed in this pass.
- On 2026-06-09, the Explore route concept pass was completed after another startup protocol pass: `docs/CODEX_HANDOFF.md` was read first, all 95 workspace Markdown files were enumerated and read/hashed, `docs/FANPASS_REPORT.md` was fully re-read, and the active IA/new-chat/Home planning docs were re-read before documentation edits. Four Explore concept boards were generated and inspected: overview/search/filter/map/mobile, events/event detail/ticket types/rules/mobile, venues/artists, and collections/saved/no-results/mobile. The boards intentionally keep Explore separate from Home, avoid precise personal latitude/longitude and private data, and avoid QR/NFC/checkout/account/native-evidence claims. No code was changed in this pass.
- On 2026-06-09, the worktree/Markdown cleanup pass followed the startup protocol: `docs/CODEX_HANDOFF.md` was read first, all workspace Markdown files were enumerated and read/hashed, and current dirty worktree state was inspected. Safe local cleanup removed repository `.DS_Store` files outside `node_modules`, removed the untracked `.playwright-mcp/` browser-session cache, and added `.playwright-mcp/` to `.gitignore`. Markdown cleanup corrected active UI guidance so `docs/QA_CHECKLIST.md`, `docs/CODEX_HANDOFF.md`, and `docs/archive/brand-v0/BRAND_VI.md` point future UI work to Clean V4 instead of the superseded FanPass VI v0.2 direction. After owner confirmation, root Blender/servo scripts (`complete_blender_ws3.py`, `complete_blender_ws3_expected.py`, `validate_blender_ws3.py`) were deleted, superseded historical brand docs were archived under `docs/archive/brand-v0/`, and non-V4 brand assets were archived under `assets/archive/brand-v0/`. No feature code was changed in this cleanup pass.
- On 2026-06-09, the Home secondary windows concept board was generated after the user confirmed the Home-owned scope. Startup protocol was followed again: `docs/CODEX_HANDOFF.md` was read first, all 95 workspace Markdown files were enumerated and read/hashed, and the image generation skill instructions were read. The new concept board is `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-home-secondary-windows.png`. It includes desktop search overlay, notifications drawer, location/currency popover, guest Home state, empty/low-data Home state, and mobile search sheet only. It intentionally leaves Event Detail, Explore, Market, Tickets, Account, and Fan Access detail to their own route concepts. No code was changed in this pass.
- On 2026-06-09, the Home concept pass was corrected after user feedback that the desktop mockup still felt like a packed one-screen dashboard. Startup protocol was followed: `docs/CODEX_HANDOFF.md` was read first, all 95 workspace Markdown files were enumerated and read/hashed for a full Markdown pass, and the active product docs were re-read. A new desktop Home long-scroll concept was generated at `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-home-desktop-long-scroll.png`. It uses one continuous desktop web page with top nav, a visible scroll continuation, hero-only first viewport, discovery sections, trust sections, Fan Access, and footer. No code was changed in this pass.
- Orderbook state ownership was partially cleaned up before the user redirected the work back to page design. `apps/web/src/hooks/useOrderbookSnapshot.ts` now owns selected event/ticket-type orderbook loading, `Live API` versus demo-depth source labeling, and explicit refresh after market actions. `App.tsx` consumes this hook instead of importing `loadOrderbook` directly. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web` and `scripts/with-node-22.sh npm run build -w apps/web`.
- Ticket Detail evidence hook ownership was completed without changing CSS, route contracts, backend endpoints, navigation behavior, provider boundaries, or intended rendered product behavior.
- `apps/web/src/hooks/useTicketDetailEvidence.ts` now owns Ticket Detail proof-history loading, short-lived entry credential loading, loading flags, safe credential caching, and the refresh-entry-code callback. `App.tsx` now consumes that hook instead of carrying the proof/credential effect and refresh function inline, decreasing from 784 lines to 730 lines. The new hook is 81 lines and keeps raw credential/provider internals out of React page state by using the existing safe `EntryCredentialPreview` and `TicketProofHistoryItem` service results only.
- Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web` and `scripts/with-node-22.sh npm run build -w apps/web`. Browser/IAB QA passed against `http://localhost:5175/`: desktop My Tickets -> Open pass -> Ticket Detail kept `product-view ticket-detail-view`, active `My Tickets`, `1471px` product width, `360px` entry panel, 121 QR-like entry cells, 81 active QR-like cells, four ticket-control cards, three custody rows, four Proof & History rows, three safe order-provenance rows, three order-step rows, a working `Refresh code` action, no framework overlay, no horizontal overflow, zero console warnings/errors, and no forbidden provider/credential/native-evidence strings. Mobile `390x844` My Tickets -> Open pass -> Ticket Detail kept `354px` product, entry panel, control strip, custody, and proof widths, 121 QR-like cells, 80 active cells after refresh, four control cards, three custody rows, four Proof & History rows, no overflow, zero console warnings/errors, and no forbidden strings. Screenshots were saved at `/tmp/fanpass-ticket-evidence-hook-desktop-20260609.png` and `/tmp/fanpass-ticket-evidence-hook-mobile-20260609.png`. Visual inspection confirmed the desktop and mobile Ticket Detail surfaces did not regress.

Next best task:

- Replace the current repeated secondary route implementation with differentiated components and CSS.
- Build a route-specific discovery component for `forYou`, `events`, `venues`, `artists`, and `collections`, using the discovery concept board. The expected distinction is: For You = personalized recommendation/taste profile; Events = calendar plus dense event table; Venues = map/list plus venue detail/readiness; Artists = artist demand/tour hub; Collections = editorial shelves/saved/organizer collections.
- Build a route-specific account/ops component for `wallet`, `orders`, `analytics`, `alerts`, and `settings` where the current implementation is still too similar. Expected distinction is: Wallet = pass/proof vault; Orders = ledger/timeline/detail rail; Analytics = market intelligence charts; Alerts = rule/watchlist builder; Settings = account/security/privacy panels.
- Prefer small typed data builders and route-owned CSS over expanding the generic `FeatureWorkspace` or adding broad `global.css` guards.
- After coding, run typecheck/build and rendered Browser/IAB QA across desktop and mobile for all changed routes, checking no overflow, no framework overlay, zero fresh console warnings/errors, and no forbidden provider/credential/native-evidence strings.
- Do not finish with another set of pages that only swap title, copy, and rows inside the same visual template. The user explicitly rejected that outcome.
- Deeper webhook/capture/refund evidence should be source-backed when explicitly scoped; the current provenance rail is safe presentation over existing web order status only.
- The non-happy state fixture coverage has started in Settings; extend it only if it improves product QA, not by adding raw backend/provider internals.
- Keep all work behind the existing Web Beta Fallback boundary: no Web NFC, no public/real-user Beta claim, no native evidence blocker closure from web proof, and no production credentials or real personal data.

Do not repeat unless new evidence changes this:

- Do not keep fixing the sidebar/navigation merely because older history mentions navigation drift.
- Do not treat `/goal` as the current subtask. `/goal` defines the destination; this `Current Active State` defines the next work cursor.
- Do not resume from the last pre-compaction user request if the work cursor says that subtask is complete.
- Do not treat the old generic `FeatureWorkspace` secondary pages as accepted product design for the next pass. They were accepted only as a previous incremental shell, and the latest user feedback supersedes that: repeated layouts for multiple nav items are now a known product/design failure.
- Do not continue generic maintainability cleanup ahead of the page-differentiation work unless it directly enables the differentiated routes.
- Do not rebuild lifecycle fixtures with ad hoc strings; keep using `ticketLifecycle.ts` and `orderPresentation.ts` unless the shared helpers themselves need a deliberate typed change.
- Do not present the new provenance rail as real webhook/capture/refund evidence. It is safe UI presentation until a source-backed web payment evidence path is explicitly scoped and validated.
- Do not repeat the `discover.css` split unless QA or code review finds a real regression; it is now the accepted CSS ownership baseline for the Discover editorial marketplace proportions and recommendation rails.
- Do not repeat the `command-strip.css` ownership split unless QA or code review finds a real regression; it is now the accepted CSS ownership baseline for shared top search, route filters, and utility actions.
- Do not repeat the `event-card.css` ownership split unless QA or code review finds a real regression; it is now the accepted CSS ownership baseline for shared Discover poster cards and event grids.
- Do not repeat the `market.css` ownership split, Market base CSS ownership extension, mobile terminal-width fix, or the narrow active-nav scroll-into-view fix unless QA or code review finds a real regression; they are now the accepted baseline for Market terminal ownership, polish, mobile terminal sizing, and mobile active-nav visibility.
- Do not reopen List Ticket price-context work unless a QA check finds a regression; the next useful List Ticket work should be true source-backed seller/order evidence or visual micro-spacing only.
- Do not repeat the `resale-listing.css` / `resale-listing-summary.css` ownership split unless QA or code review finds a real regression; it is now the accepted CSS ownership baseline for the List Ticket For Resale editor and summary panels.
- Do not reopen Checkout control-strip or settlement-ledger work unless a QA check finds a regression; the current Checkout pass is safe presentation over existing web checkout/order state, not real web payment evidence.
- Do not reopen Event Detail control-strip, price intelligence, or access-ledger work unless a QA check finds a regression; the current Event Detail pass is safe presentation over existing event/ticket/listing state, not source-backed payment, identity, or chain evidence.
- Do not repeat the `event-detail.css` / `checkout.css` ownership split or the App view-change scroll reset unless QA or code review finds a real regression; it is now the accepted CSS ownership and routing-position baseline for Event Detail and Checkout.
- Do not repeat the `pulse.css` / `pulse-drawer.css` ownership split or Pulse base CSS ownership extension unless QA or code review finds a real regression; it is now the accepted CSS ownership baseline for My Tickets, Wallet, and Orders shell, drawer, order, proof, activity, and mobile Pulse styling.
- Do not reopen Ticket Detail control-strip or custody-ledger work unless a QA check finds a regression; the current Ticket Detail pass is safe presentation over existing ticket, entry credential summary, lifecycle, and order state, not source-backed credential/payment/chain evidence.
- Do not repeat the `ticket-detail.css` / `ticket-detail-ledger.css` ownership split or the `selectedTicketId` route-position reset unless QA or code review finds a real regression; it is now the accepted CSS ownership and mobile entry-position baseline for Ticket Detail.
- Do not reopen the secondary `feature-command-strip` / `feature-evidence-rail` work unless QA finds a regression; future secondary work should add more route-specific depth or reduce style debt, not repeat the same command/evidence shell.
- Do not reopen the Venues/Artists/Collections/Alerts `feature-depth-panel` work unless QA finds a regression; future work should be component/CSS maintainability or genuinely new route-specific product depth.
- Do not repeat the route-depth extraction into `featureDepthModel.ts` and `FeatureDepthPanel.tsx` unless QA or code review finds a real regression; it is now the accepted maintainability baseline for those routes.
- Do not repeat the command/evidence/rows/config extraction into `featureWorkspaceModel.ts` unless QA or code review finds a real regression; it is now the accepted maintainability baseline for the secondary feature shell.
- Do not repeat the `feature-depth.css` / `feature-lifecycle.css` split unless QA or code review finds a real regression; it is now the accepted CSS ownership baseline for secondary depth and lifecycle fixtures.
- Do not repeat the FeatureWorkspace global residual cleanup unless QA or code review finds a real regression; `feature-workspace.css` is now the accepted owner for secondary feature shell/base styling and `global.css` should not regain unscoped secondary feature component rules.
- Do not repeat the `CommandStrip.tsx` extraction unless QA or code review finds a real regression; it is now the accepted component ownership baseline for the shared top search/filter/utility chrome.
- Do not repeat the Ticket Detail evidence hook extraction unless QA or code review finds a real regression; `useTicketDetailEvidence.ts` is now the accepted hook ownership baseline for safe proof-history and short-lived entry credential UI state.

## Context Compaction Resume Protocol

When context is compacted, resumed, or summarized mid-goal, run this audit before making further code or doc changes:

1. Read `docs/CODEX_HANDOFF.md` first and inspect `Current Active State`.
2. Compare the intended next action against `Latest completed` and `Do not repeat unless new evidence changes this`.
3. If the intended next action is already completed or explicitly marked do-not-repeat, skip it and continue the `Next best task`.
4. Treat `/goal` as the long-term destination only. It must not override the current work cursor.
5. Treat old user messages and compaction summaries as low-confidence historical context unless they match `Current Active State`.
6. After each meaningful subtask, update this section before or with the final report so future compaction resumes from the real progress point.

## Current Goal

Build toward the Beta target through three phases:

1. Technical Prototype
2. Alpha
3. Beta

The current implementation has completed the first technical prototype skeleton and a local end-to-end backend flow.

Product surface decision:

1. `FanPass` - consumer iOS app for fans.
2. `FanPass Ops` - separate iOS app for gate staff and onsite operations.
3. `FanPass Console` - web dashboard for organizers and admins.

The previous `fanpass://staff/scanner` route was a Technical Prototype bridge. It has been removed from the fan app product path; staff demo work now belongs in `FanPassOps`.

Fallback surface decision:

`FanPass Web Beta Fallback` is an optional backup delivery path while Apple Developer enrollment, TestFlight signing, and Apple Wallet signing are blocked. It is documented in `docs/technical/FanPass_Web_Beta_Fallback_Plan_V4.md`, with the workplan in `docs/product/FanPass_Web_Beta_Fallback_Workplan_V4.md` and the first landing-page plan in `docs/ux/FanPass_Web_Landing_Page_Plan_V4.md`. Keep it separate from the native iOS route. It must not include Web NFC, it must sync with iOS through shared API/backend state, and it cannot close signed iOS/TestFlight, signed Apple Wallet `.pkpass`, physical QR/NFC, or release-grade chain custody evidence.

Latest landing direction on 2026-06-07: the Web fallback landing page should be long-scroll but low-density. `Less is more` does not mean a short page; it means generous spacing, one core idea per viewport, and no dense feature grids. Do not lead with QR, NFC, scanner mechanics, Web3 language, or cross-device sync. The page should communicate three platform advantages: why a ticket is trustworthy, why resale stays controlled, and why prices are transparent.

Current phase:

`Alpha` is complete as a local demo baseline. Current work is `Beta foundation/security hardening`, not public or real-user Beta. Use `docs/DEVELOPMENT_TASKS.md`, `docs/ALPHA_SECURITY_REVIEW.md`, and `docs/PROVIDER_COST_FEASIBILITY.md` as the source of truth for remaining Beta blockers.

## Reporting Standard

Every progress report to the user must include:

- Version/stage: for example `Technical Prototype`, `Alpha`, or `Beta foundation`.
- What was completed in that stage during the current work session.
- Current overall completion percentage for the active version.
- Remaining major blockers before the next version or real-user testing.

## Tool And Plugin Authorization

The user has explicitly authorized Codex to use available plugins and app tools as needed for FanPass work, including Product Design, Build iOS Apps, Build Web Apps, Browser, Chrome, Figma, Render, Vercel, GitHub, Data Analytics, Documents, Presentations, Spreadsheets, and related MCP/tool integrations. Choose the smallest appropriate tool or plugin set for the task, and keep using project safety rules: do not expose secrets, do not use production credentials or live Stripe mode, do not use real personal data, do not commit keys/tokens/evidence with secrets, and do not run destructive git commands.

## Non-Negotiable Engineering Rules

- At the start of every FanPass work session, read `docs/CODEX_HANDOFF.md` first, then enumerate and read every Markdown file in the workspace with `rg --files -g '*.md'` before changing code, evidence, or product docs. After that, re-read the source-of-truth docs for the active task. Update `docs/NEW_CHAT_PROMPT.md` at the end of work so new chats resume from the current state.
- During `/goal` or any long autonomous run, context compaction/resume must follow the `Context Compaction Resume Protocol` above. Do not continue an old subtask solely because it appears in the latest compaction summary or the last historical user message.
- When work is completed, immediately update the relevant Markdown docs in the same change with what changed, what passed, known gaps, and any changed product boundaries, evidence status, provider assumptions, release blockers, or standing user instructions.
- Do not build "shit-mountain" or spaghetti code. Prefer existing project patterns, narrow typed adapters/services, schema validation, focused tests, and documented evidence gates. Avoid scattered provider SDK calls, stringly typed state, broad rewrites, or shortcuts that make later security work harder.
- Security is the highest priority and is a release blocker, not a cleanup task. Do not use real personal data, production credentials, live Stripe mode, raw private keys, production Privy secrets, saved tokens, unsanitized screenshots, or evidence containing secrets. Never trade security for speed or visual polish.
- Do not claim public, real-user, TestFlight, signed Wallet, physical scanner, chain custody, payment, or provider readiness unless the matching saved evidence exists and passes the documented validator.

Current version progress snapshot, based on `docs/DEVELOPMENT_TASKS.md` checklist counts on 2026-06-07:

- Technical Prototype: 100%.
- Alpha local demo baseline: 100%.
- Beta foundation/security hardening: 396/397 tasks, 99.7% by checklist count, but still not suitable for real users because saved real iOS staging/TestFlight build evidence for real HTTPS API URLs, signed Apple Wallet `.pkpass` generation and physical-device validation, real-device QR/NFC validation, and saved release-grade chain custody evidence for vault/KMS or delegated signer plus multisig/timelock remain incomplete. The prior public dependency blocker is closed for the root production path after migrating `apps/dashboard` off Next to Vite React plus a Node BFF and obtaining a clean production audit.
- On 2026-06-05, dynamic QR/Core NFC local foundation advanced: `VerificationService` now generates versioned signed entry payloads with `credentialId`, `ticketTypeId`, `entryMode`, `kid`, owner hash, expiry, and base64url HMAC signatures while preserving old hex-signature verification compatibility; `/verification/nfc/validate` is staff/admin-only and normalizes NDEF Text/URI payloads into the same redemption path; FanPass Ops NFC captures now call the NFC validation endpoint. Local verification passed `npm run test -w apps/api -- --runTestsByPath test/verification.service.spec.ts test/route-security.spec.ts`, `npm run typecheck -w apps/api`, and both FanPass/FanPassOps simulator builds. Physical-device NFC evidence, Redis replay lock, durable QR credential lifecycle, and real staging/TestFlight proof remain open.
- On 2026-06-05, local smart-contract foundation advanced: `FanPassTicket` now supports safe ticket/ticket-type/policy/metadata proof hashes, refunded state, lifecycle transfer blocking, and owner-only proof updates; `FanPassSoulbound` now supports safe Access Badge proof hashes, ERC5192-style locked behavior, and revocation; `RedemptionRegistry` now stores duplicate-protected event/gate/credential redemption context; `packages/contracts/scripts/deploy-local.ts` dry-runs all three contracts on the local Hardhat network. Verification passed `scripts/with-node-22.sh npm run test -w packages/contracts` and `scripts/with-node-22.sh npm run deploy:local -w packages/contracts`. This is not Sepolia deployment or chain custody evidence.

Brand/UI redesign foundation:

- Clean V4 is now the only visual identity source of truth for future UI/UX work. Use `FanPass_VI_Redesign_V4/` and do not redesign the V4 logo or app icon.
- Clean V4 audit and implementation guardrails live in `docs/brand/FanPass_VI_Clean_V4_Audit.md`, `docs/brand/FanPass_UI_Guardrails.md`, and `docs/brand/FanPass_Final_Design_Tokens_V4.md`.
- V4 machine tokens are mirrored at `docs/brand/fanpass-brand-tokens.json` and sourced from `FanPass_VI_Redesign_V4/docs/fanpass-brand-tokens-v4.json`.
- Superseded historical brand docs are archived under `docs/archive/brand-v0/`: `BRAND_VI.md`, `FanPass_Visual_Identity.md`, `FanPass_Brand_Tokens.md`, and `FanPass_Asset_Usage_Guide.md`.
- SwiftUI design-system foundations live in `apps/ios/FanPass/FanPass/DesignSystem/`; the color/gradient foundation now mirrors Clean V4.
- Future UI work must follow the V4 guardrails: no decorative lines crossing text, QR, logos, buttons, charts, prices, ticket metadata, or navigation; NFC waves must be contained icons/indicators or background shapes below 8% opacity.
- Complete Clean V4 UX structure docs now live in `docs/ux/`: `FanPass_Information_Architecture_V4.md`, `FanPass_User_Flows_V4.md`, `FanPass_Screen_List_V4.md`, `FanPass_Content_Model_V4.md`, and `FanPass_Interaction_Principles_V4.md`. Do not implement SwiftUI screens until the screen pass follows these IA, role-boundary, content, and interaction rules.
- Clean V4 iOS foundation now exists in the real Xcode source path `apps/ios/FanPass/FanPass/`, with `ios/FanPass` as a symlink compatibility path. The FanPass app root is now `FanPassV4AppShellView`, a mock-only SwiftUI shell using V4 tokens, V4 components, namespaced `FanPassV4` models, mock data, and mock services. It intentionally does not call backend, real payment, real chain, or real NFC services. The older API-backed `AppShellView` and feature files remain in the repo for migration/reference.
- Web Beta fallback planning is separate from Clean V4 native iOS implementation. If built, it should use its own web package/docs/evidence naming and should reuse the existing API contracts without replacing native iOS, FanPass Ops, Apple Wallet, or Core NFC work.
- FanPass Web app work now includes API-backed demo event reads, seeded orderbook reads, demo buy-order creation, API-backed sell-order/listing creation, demo ticket reads through `/tickets/owner/:userId`, demo order reads through `/orders/users/:userId`, API-backed safe ticket proof history through `/tickets/:id/proof-history`, and API-backed short-lived entry credential refresh through `/verification/tickets/:ticketId/qr`, with local fallback state if the API is offline. The current high-fidelity surfaces are Discover, Market/Orderbook, Event Detail, Checkout, My Tickets/Wallet/Orders, Ticket Detail / Entry Code / Proof & History, List Ticket For Resale, and the expanded feature surfaces for Events, Venues, Artists, Collections, Analytics, Alerts, and Settings. The latest fidelity passes added Discover hero dual CTAs, recommendation date tiles, a concept-style Market orderbook with 5 ask rows, 5 bid rows, last-price divider, price-cap row, hidden non-reference lower terminal panels, display-depth padding over sparse live orderbook data, fixed premium-display event card titles, a concept-closer ticket wallet/order drawer, stable app-wide sidebar navigation that no longer changes labels or outer shell theme between pages, compact unified secondary feature surfaces so Events/Analytics/Settings no longer render as a separate giant landing-page template, a tighter Discover editorial marketplace layout with a 302px desktop hero, right-side ticket picker spanning beside recommendation rows, filter chips, and a second recommendation rail, a navigation/surface contract so clicking all 13 sidebar destinations keeps the same labels, `aria-label`s, `data-testid` selectors, active treatment, width, shell padding, and compact feature-page rhythm, with `My Tickets` kept as a static label without a dynamic ticket-count badge, a shared `product-view` page root plus `apps/web/src/styles/view-frame.css` for route-level frame consistency, a Market detail-density pass with `Sales (24h)`, concept-style `Lower 200` seat-band labeling, shaded ask/bid market-depth fills, explicit depth-axis labels, `Auto relist` and `Smart pricing` preference rows, recent-activity icons, and mobile metric wrapping so `Price cap` and `Sales (24h)` do not truncate, a Pulse/Tickets pass that gives `My Tickets`, `Wallet`, and `Orders` page-specific drawer/tabs/activity copy while preserving one unified shell, removes duplicate premium recommendation cards, replaces rough proof placeholders with deterministic QR-like proof tiles, adds status rails and order timelines, and starts moving Pulse-specific polish into `apps/web/src/styles/pulse.css` instead of expanding `global.css`, an Event Detail/Checkout fidelity pass that keeps only real live ticket bands actionable, adds display-only price context over sparse inventory, adds Fan Access and safe issue-flow panels, expands Checkout with a safe reservation reference, receipt rail, issue preview, proof-safe marker, and order timeline, and now splits those accepted styles across `apps/web/src/styles/event-detail.css` and `apps/web/src/styles/checkout.css`, plus a Ticket Detail proof-history pass that adds `apps/web/src/components/TicketDetailView.tsx`, routes Checkout confirmation and wallet drawer cards into Ticket Detail, renders a redacted code-native Entry Code preview with 121 cells, safe ticket reference, resale/transfer rules, and four contained Proof & History rows. The latest API-backed passes fixed the ticket drawer so real API tickets are prioritized before fallback demo tickets, treat `Transferred` tickets as entry/resale eligible where the backend allows it, store only safe credential summaries in web state, keep raw QR payload internals out of the UI, Browser-verified all 13 sidebar destinations plus mobile navigation with stable labels, one active item, fixed row geometry, and no console errors, and replaced one-click local listing with `apps/web/src/components/ResaleListingView.tsx`, a cap-safe seller composer that reuses `POST /orders` with `side: "SELL"` / `ticketId`, maps open sell orders into visible market listings, handles immediately matched orders without stale listing rows, refreshes the Market/orderbook after listing, and has desktop/mobile Browser QA evidence. Latest QA evidence is tracked in `design-qa.md`.
- On 2026-06-08, the Web app sidebar/route-frame regression was tightened again after user feedback: `AppHeader` nav rows now use a fixed marker/icon/label structure, active state uses only a left gradient marker rather than a whole-row background/outline, all routes are wrapped in `.route-frame`, and `route-frame.css` plus final `navigation.css` load after older concept styles. Browser/IAB desktop QA clicked all 13 sidebar destinations with fixed labels, one active item, transparent active row background, no border/box-shadow, stable `169x28` desktop rows, route-frame presence everywhere, no horizontal overflow, and zero console warnings/errors. Mobile Browser QA at `390x844` checked representative routes with stable labels, one active item, `34px` rows, route-frame presence, no page overflow, and zero console warnings/errors. Screenshots are `/tmp/fanpass-nav-stability-desktop-fixed.png` and `/tmp/fanpass-nav-stability-mobile-fixed.png`; details are in `design-qa.md`.
- On 2026-06-08, the sidebar contract and resale cancel lifecycle were tightened again. `AppHeader` now separates visible labels, route `view`s, and stable `data-testid` values so `Home`, `For You`, `My Tickets`, and `Market` no longer break the existing nav test contract (`nav-discover`, `nav-for-you`, `nav-my-tickets`, `nav-listings`). Browser/IAB desktop QA re-clicked all 13 destinations and passed with stable labels, stable `169x28` rows, one active item, `.route-frame` on every route, no horizontal overflow, and zero console warnings/errors. The Web Market now renders `Your open listings` with Cancel controls; local fallback cancellation removed one listing, and API-backed cancellation called `POST /orders/:orderId/cancel`, removed the final open-listing panel, and rendered `LISTING CANCELLED ON API`. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web`, `scripts/with-node-22.sh npm run build -w apps/web`, and the earlier focused API route/security tests for `orderbook.service.spec.ts` plus `route-security.spec.ts`. Browser screenshot evidence was captured in-chat for the Market after API cancellation; details are in `design-qa.md`.
- On 2026-06-08, the Web resale buyer checkout path was added. Market `Review order` now opens `CheckoutView` in `data-checkout-mode="resale"` instead of immediately creating a buy order, the buy panel uses the lowest available ask as its limit price, and `Confirm resale order` calls the existing `POST /orders` BUY adapter, syncs API orders/tickets/orderbook, removes the matched listing through typed trade `sellOrderId`/`ticketId`, and routes settled purchases into Ticket Detail as `Transferred` tickets. Browser/IAB desktop QA verified Market -> Review order -> Secure resale checkout -> Authorize payment -> Confirm resale order -> Ticket Detail with `Live API` and `Transferred`, no horizontal overflow, zero console warnings/errors, and no rendered `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, or `client_secret` strings. Browser/IAB mobile QA at `390x844` verified the resale checkout surface stays in resale mode, keeps `nav-listings` active, has no horizontal overflow, and has zero console warnings/errors. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web`, `scripts/with-node-22.sh npm run build -w apps/web`, and focused API orderbook/route-security tests; details are in `design-qa.md`.
- On 2026-06-08, the Web navigation surface leak was tightened after the user reported route-to-route sidebar/page style drift. `TerminalConcept` no longer carries `discover-view`, and `PulseConcept` no longer carries `discover-view`, so Market and My Tickets/Wallet/Orders do not inherit Discover-only page-root styling. `navigation.css` now reinforces the route-level active-row contract under `.app-shell[data-route]`: active nav rows remain transparent, borderless, shadowless, outline-free, transform-free, and marker-only. `route-frame.css` keeps Pulse and Terminal route roots at the shared route width after removing the historical class. Browser/IAB desktop QA re-clicked all 13 nav destinations and passed with stable labels, exactly one active item, transparent/shadowless `169x28` active rows, matching route-frame/product widths, no `discover-view terminal-concept` or `discover-view pulse-concept` leakage, no horizontal overflow, and zero console warnings/errors. Browser/IAB mobile QA at `390x844` passed for Home, My Tickets, Wallet, Orders, Market, and Settings with stable labels, one active item, marker-only active state, no overflow, and zero console warnings/errors. Browser screenshot capture timed out twice with `Page.captureScreenshot`; DOM/CSS/interaction verification still passed. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web` and `scripts/with-node-22.sh npm run build -w apps/web`; details are in `design-qa.md`.
- On 2026-06-08, Web ticket lifecycle rendering and the secondary route surface were tightened again. `apps/web/src/lib/ticketLifecycle.ts` now centralizes typed lifecycle copy/ranking/eligibility for `Active`, `Transferred`, `Transfer Pending`, `Listed`, `Redeemed`, `Cancelled`, `Refunded`, and `Expired`; the API adapter maps `REDEEMED` to `Redeemed` instead of the legacy `Used`; Ticket Detail and Pulse drawer now disable entry/resale actions and render state-specific proof copy for listed/blocked/closed statuses without exposing raw credential, owner, nonce, signature, wallet, or provider internals. A real API seller flow rendered a `Listed` Ticket Detail with `Paused while listed`, disabled `Refresh code`, and disabled `Resale closed` on desktop and mobile. `apps/web/src/styles/feature-workspace.css` now owns the secondary-route visual treatment for For You, Events, Venues, Artists, Collections, Analytics, Alerts, and Settings, with compact `10px` rhythm, dark `8px` panels, three-column desktop content, and one-column mobile collapse. The lingering active-nav inset shadow was removed from `view-frame.css`, and navigation containment moved into `navigation.css`. Browser/IAB desktop re-clicked all 13 nav destinations with fixed labels, one active item, transparent/shadowless/transform-free marker-only active rows, unified route/product widths, secondary `feature-workspace` grids, no overflow, and zero console warnings/errors; Browser/IAB mobile at `390x844` passed representative Home/Events/My Tickets/Market/Analytics/Settings routes. Browser screenshot capture still timed out with `Page.captureScreenshot`; DOM/CSS/interaction verification passed. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web`, `scripts/with-node-22.sh npm run build -w apps/web`, and `git diff --check`; details are in `design-qa.md`.
- On 2026-06-08, Web order/payment/settlement proof presentation was added without changing the backend contract. `apps/web/src/lib/orderPresentation.ts` now derives safe order refs, payment state, settlement state, proof state, tone, and three-step order progress from `UserOrder`; `UserOrder.status` and the API order adapter now cover `Authorized`, `Failed`, `Expired`, and `Refunded` display states. `TicketDetailView` receives the related order via `relatedOrderForTicket`, renders an `Order settlement` panel, and appends `Order`, `Payment state`, and `Trade outcome` rows into Proof & History. `PulseConcept` / Orders now render safe `ORD-******` refs, payment/settlement labels, an `order-settlement-card`, and a presentation-driven timeline. Browser/IAB desktop QA verified My Tickets -> Ticket Detail order proof rows plus Orders page settlement card/timeline, no horizontal overflow, zero console warnings/errors, and no rendered `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, or `client_secret`. Browser/IAB mobile at `390x844` verified single-column Ticket Detail order proof and Orders settlement card/timeline with no overflow and zero console warnings/errors. Browser screenshot capture succeeded for the desktop Orders settlement proof state. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web` and `scripts/with-node-22.sh npm run build -w apps/web`; details are in `design-qa.md`.
- On 2026-06-08, the Pulse Tickets/Wallet/Orders workspace was tightened after user direction to move on from navigation and keep restoring the product pages. `PulseConcept` no longer leads these routes with the Home-like `Popular This Week` recommendation surface. `My Tickets` now renders `Your verified ticket control room`, `Wallet` renders `Passes, proof, and resale controls`, and `Orders` renders `Payment and settlement ledger`, each with a concept-style command hero, typed pass/order ledger rows, and compact event context strip while preserving the existing ticket drawer and order settlement card. Browser/IAB desktop QA verified the old `Popular This Week` heading was absent, the Tickets hero/ledger rendered at `403px` width, Orders showed three safe `ORD-******` ledger rows with payment/settlement labels, no forbidden provider/credential strings rendered, no horizontal overflow, and zero console warnings/errors. Browser/IAB mobile at `390x844` verified `354px` product/drawer/order widths, `354x232` command heroes, no old Popular heading, no overflow, and zero console warnings/errors. Browser screenshot capture succeeded for the desktop Orders workspace. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web` and `scripts/with-node-22.sh npm run build -w apps/web`; details are in `design-qa.md`.
- On 2026-06-08, a Settings lifecycle coverage fixture panel was added for production-like rendered QA of non-happy states without changing backend contracts or live ticket/order data. `FeatureWorkspace` now renders the panel only on Settings, deriving ticket copy from `ticketLifecycle.ts` and order copy/tones from `orderPresentation.ts`. The panel covers ticket states `Transfer Pending`, `Redeemed`, `Cancelled`, `Refunded`, and `Expired`, plus order states `Authorized`, `Failed`, `Expired`, and `Refunded`, with stable safe fixture refs such as `ORD-AUTH01` rather than raw ids. `feature-workspace.css` owns the compact two-column/one-column responsive treatment and state tone borders. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web`, `scripts/with-node-22.sh npm run build -w apps/web`, Browser/IAB desktop Settings QA, and Browser/IAB mobile `390x844` Settings QA with no horizontal overflow, zero console warnings/errors, and no rendered `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`; details are in `design-qa.md`.
- On 2026-06-08, the Web order/payment/settlement presentation gained a safe provenance rail without adding provider internals or changing backend contracts. `apps/web/src/lib/orderPresentation.ts` now exposes typed `provenance` rows for payment signal, capture/refund/listing decision, and wallet outcome across `Reserved`, `Authorized`, `Confirmed`, `Listed`, `Cancelled`, `Failed`, `Expired`, and `Refunded` states. `TicketDetailView` renders the rows inside `Order settlement`, and `PulseConcept` / Orders renders them inside the order settlement card. Current scoped styling ownership is `ticket-detail-ledger.css` for Ticket Detail provenance and `pulse-drawer.css` for Orders provenance. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web`, `scripts/with-node-22.sh npm run build -w apps/web`, Browser/IAB desktop Ticket Detail + Orders QA, and Browser/IAB mobile `390x844` Ticket Detail + Orders QA with no horizontal overflow, zero console warnings/errors, and no rendered `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`; details are in `design-qa.md`.
- On 2026-06-08, the Web List Ticket For Resale surface was tightened toward the concept-style market/order panels. `ResaleListingView` now includes selectable Face value / Suggested / Organizer cap price bands, cap-room and face-delta payout metrics, a three-step execution path, and extra rule rows for market posture plus seller cancellation control. The implementation stays local to `ResaleListingView.tsx` and `resale-listing.css`, uses existing `TicketType` / `UserTicket` data, and does not change the API-owned `POST /orders` sell-order contract. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web`, `scripts/with-node-22.sh npm run build -w apps/web`, Browser/IAB desktop My Tickets -> Ticket Detail -> List for resale QA, and Browser/IAB mobile `390x844` QA. Desktop verified three price bands, three execution rows, six rule rows, cap-band click updating `#listing-price` to the organizer cap, no overflow, zero console warnings/errors, and no rendered `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`. Mobile verified `354px` product/grid width, one-column price context, `316px` controls/rows, no overflow, and zero console warnings/errors. Browser screenshot capture timed out twice with `Page.captureScreenshot`; DOM/CSS/interaction evidence passed. Details are in `design-qa.md`.
- On 2026-06-08, the Web Checkout surface was tightened toward the concept-style order/control panels without changing the checkout or payment contracts. `CheckoutView` now renders `data-testid="checkout-control-strip"` with four safe cards for order reference, price guard, payment state, and wallet outcome, plus a `Checkout settlement ledger` with authorization, issue/transfer decision, and refund path. Resale checkout uses the same component in `data-checkout-mode="resale"` and shows transfer-decision copy; primary checkout shows issue-decision copy. The accepted styling now lives in `checkout.css`, does not expose client secrets, provider ids, wallet addresses, signatures, nonces, access tokens, or PaymentIntent internals, and remains safe presentation over current web checkout/order state rather than source-backed web payment evidence. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web`, `scripts/with-node-22.sh npm run build -w apps/web`, Browser/IAB desktop primary checkout QA, Browser/IAB desktop resale checkout QA, Browser/IAB post-authorization primary state QA, and Browser/IAB mobile `390x844` QA for both primary and resale checkout. Desktop verified four control rows, three settlement rows, `primary` and `resale` checkout modes, no overflow, zero console warnings/errors, and no rendered `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`. Mobile verified `354px` product width, `316px` control/ledger widths, single-column control cards, no overflow, and zero console warnings/errors. Browser screenshot capture succeeded for mobile checkout and was displayed in-chat. Details are in `design-qa.md`.
- On 2026-06-08, the Web Event Detail surface gained a concept-style decision layer over existing event, ticket, and listing state. `EventView` now renders `data-testid="event-control-strip"` with verified supply, market floor, cap room, and transfer window cards, plus a code-native `Price intelligence` rail and `Access ledger` for primary access, resale guard, and checkout boundary. The accepted styling now lives in `event-detail.css`, reuses existing `WebEvent`, `TicketType`, `MarketListing`, and `viewHelpers` data, and does not change backend contracts or expose provider, credential, payment, wallet, owner, signature, nonce, access-token, or PaymentIntent internals. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web`, `scripts/with-node-22.sh npm run build -w apps/web`, Browser/IAB desktop Event Detail QA, Browser/IAB `View orderbook` interaction QA, Browser/IAB mobile `390x844` Event Detail QA, and `view_image` inspection against the accepted concept plus mobile implementation screenshots. Desktop verified four event-control rows, five price-intelligence rows, three access-ledger rows, one active ticket tier, no framework overlay, no overflow, zero console warnings/errors, and no rendered `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`. Mobile verified `354px` product/hero/control/radar/ledger widths, `332px` control cards, `316px` radar and ledger rows, no overflow, and zero console warnings/errors. Browser screenshot evidence is `/tmp/fanpass-event-detail-mobile-lower-20260608.png`, `/tmp/fanpass-event-detail-mobile-control-20260608.png`, and `/tmp/fanpass-event-detail-mobile-ledger-20260608.png`; details are in `design-qa.md`.
- On 2026-06-08, the Web Ticket Detail surface gained a concept-style control strip and custody ledger over existing ticket, entry credential summary, lifecycle, and order state. `TicketDetailView` now renders `data-testid="ticket-control-strip"` with holder state, entry window, resale guard, and safe order ref cards, plus a `Ticket custody ledger` for credential boundary, lifecycle action, and safe evidence scope. The implementation stays scoped to `TicketDetailView.tsx`, with current CSS ownership split between `ticket-detail.css` for the pass/entry layer and `ticket-detail-ledger.css` for the control/order/rule/custody/proof layer. It reuses `ticketLifecycle.ts`, `orderPresentation.ts`, existing ticket/order/proof-history/credential-summary data, and does not change backend contracts or expose provider, credential, payment, wallet, owner, signing, nonce, access-token, or PaymentIntent internals. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web`, `scripts/with-node-22.sh npm run build -w apps/web`, Browser/IAB desktop/mobile Ticket Detail QA, and `view_image` inspection against the accepted concept plus mobile implementation screenshots. Desktop verified four ticket-control cards, three custody-ledger rows, 121 QR-like entry cells, three safe order-provenance rows, seven Proof & History rows, no framework overlay, no overflow, zero console warnings/errors, and no rendered `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`. Mobile verified `354px` product/control/custody widths, `332px` control cards, `316px` custody rows, no overflow, and zero console warnings/errors. Browser screenshot evidence is `/tmp/fanpass-ticket-detail-mobile-control-20260608.png` and `/tmp/fanpass-ticket-detail-mobile-custody-ledger-20260608.png`; details are in `design-qa.md`.
- On 2026-06-08, the Web secondary feature pages gained a concept-style command workspace layer over existing events, tickets, orders, listings, lifecycle, and order-presentation data. `FeatureWorkspace` now renders icon-led mastheads, `data-testid="feature-command-strip"` with four safe command cards, and `data-testid="feature-evidence-rail"` with three safe evidence rows. The implementation stays scoped to `FeatureWorkspace.tsx` and `feature-workspace.css`, keeps route data and navigation contracts unchanged, and does not expose provider, credential, payment, wallet, owner, signing, nonce, access-token, or PaymentIntent internals. Verification passed `scripts/with-node-22.sh npm run typecheck -w apps/web`, `scripts/with-node-22.sh npm run build -w apps/web`, `git diff --check -- apps/web/src/components/FeatureWorkspace.tsx apps/web/src/styles/feature-workspace.css`, Browser/IAB desktop Events/Analytics/Settings QA, Browser/IAB mobile `390x844` Events/Analytics/Settings QA, and `view_image` inspection against the accepted concept plus desktop/mobile implementation screenshots. Desktop verified four command cards, three evidence rows, one icon badge, stable active nav, no framework overlay, no overflow, zero console warnings/errors, and no rendered `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`. Mobile verified `354px` product/command widths, `332px` command cards, `326px` evidence rail, no overflow, and zero console warnings/errors. Browser screenshot evidence is `/tmp/fanpass-secondary-analytics-command-20260608.png` and `/tmp/fanpass-secondary-settings-command-20260608.png`; details are in `design-qa.md`.

## Latest New-Chat Snapshot on 2026-06-07

Use this section first when resuming in a new conversation.

Current stage: `Beta foundation/security hardening`.

Current checklist count: `396/397`, `99.7%`.

Latest deployed staging state:

- API: `https://fanpass-api-staging.onrender.com`
- Console: `https://fanpass-console-staging.onrender.com`
- GitHub repo: `https://github.com/tantalum666/fanpass`
- Latest deployed API commit verified in Render on 2026-06-03: `07d4cb6dad9dfa4cf8f2a8ff254d20d6d72c818d` (`Use Word report for FanPass handoff`). The worker implementation was introduced in the earlier deployed commit `75b4e68bc7835bc2d4532259a3cecac2ab8e99da`; `07d4cb6` only changed `README.md` and `docs/FANPASS_REPORT.md`.
- Latest deployed Console commit verified in Render on 2026-06-07: `2df41595d23dd756984fa7f0e4299ab9e62bbeef` (`Record Render Console partial staging evidence`), with the Vite React static UI plus Node BFF introduced in `2fd850e35341844a953db151652b2f4c7088b8c9`.
- Render API health returned `{"ok":true,"service":"fanpass-api","target":"technical-prototype"}` after free-plan cold start on 2026-06-03.
- Render worker scheduler env was set through the dashboard/API, not committed: `FANPASS_SIDE_EFFECT_WORKER_ENABLED=true`, `FANPASS_SIDE_EFFECT_WORKER_INTERVAL_MS=15000`, `SIDE_EFFECT_WORKER_LIMIT=10`.
- Render logs on 2026-06-03 showed the side-effect worker scheduler enabled at 15000 ms on the live service and one prior processing line after the worker deployment: `processed=1 completed=1 retried=0 dead=0 recovered=0`. A Render one-off job attempt to run `npm run side-effects:health -w @fanpass/api` could not be used because Render free-tier services do not support jobs.

Latest provider status:

- Stripe dashboard test-mode endpoint was created for the deployed Render API route. The saved dashboard evidence snapshot was refreshed on 2026-06-03 after documentation SHA drift and now passes `npm run security:stripe-dashboard:evidence -- outputs/stripe-dashboard/20260530T192215Z-dashboard-review.json`.
- Native iOS Stripe PaymentSheet was exercised in the simulator with a Stripe test card. The latest test PaymentIntent reached manual-capture authorization state (`requires_capture`, `amount_capturable=128800`, `livemode=false`) and the backend persisted the payment as `AUTHORIZED` after a signed Stripe webhook.
- Full Stripe release evidence is now saved and validator-clean at `outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json` after exercising Stripe test-mode capture, admin reconciliation, admin refund, authorization cancellation, duplicate webhook replay/idempotency, and healthy residual outbox state against the Render staging API. Neon staging proof after worker drain showed `PAYMENT_CANCEL_AUTHORIZATION`, `PAYMENT_RECONCILE`, `PAYMENT_REFUND`, three `PAYMENT_INTENT_CREATE`, and two `ORDER_MATCH_AFTER_PAYMENT_AUTH` jobs all `COMPLETED`, with no side-effect failures; payment rows included one `CANCELLED`, one `REFUNDED`, and one residual `NOT_CAPTURED` test record. Validation passed with `scripts/with-node-22.sh npm run security:stripe-testmode:evidence -- outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json` and `scripts/with-node-22.sh npm run security:evidence-redaction`.
- The full local Beta foundation gate was re-run after the Stripe evidence/documentation updates and passed with `scripts/with-node-22.sh npm run beta:foundation:verify`, including API and Console typechecks plus 12 API test suites / 59 tests.
- Follow-up on 2026-06-03: the remaining order-settlement parent tasks were closed after confirming the durable outbox/saga engineering subitems are complete and the local gates still pass: `npm run security:settlement-retry-idempotency`, `npm run side-effects:verify:self-test`, and `npm run side-effects:health:self-test`. The full `scripts/with-node-22.sh npm run beta:foundation:verify` gate was re-run afterward and passed, including side-effect live verification, side-effect health, API and Console typechecks, plus 12 API test suites / 59 tests. This does not close the separate chain custody blocker, which still requires saved vault/KMS or delegated signer plus multisig/timelock evidence.
- Hosted GitHub Actions evidence is now refreshed at `outputs/ci-hosted/20260603T141752Z-github-actions-beta-foundation.json` for a successful PR run of `FanPass Beta Foundation` at commit `bad6847617ce83fdb5b8c1a7eeb302c6ff7644fc` after the isolated Console Privy SDK login change. The run used `ubuntu-latest`, Node `22.22.3` from `.nvmrc`, `npm ci`, `postgres:16-alpine`, and `npm run beta:foundation:verify`; validation passed with `scripts/with-node-22.sh npm run security:ci-hosted:evidence -- outputs/ci-hosted/20260603T141752Z-github-actions-beta-foundation.json` and `scripts/with-node-22.sh npm run security:evidence-redaction`.
- Privy Dev app dashboard plan evidence was refreshed on 2026-06-03 at `outputs/privy-plan/privy-plan-20260603.json` after implementation/documentation SHA drift and now passes `npm run security:privy-plan:evidence -- outputs/privy-plan/privy-plan-20260603.json`. The evidence records mobile SDK support, embedded-wallet support, backend access-token verification support, custom auth UI support, and keeps webhooks plus MFA/policy controls plan-gated/optional. On 2026-06-04, the current Beta foundation webhook item was resolved as intentionally absent: production Privy webhooks are plan-gated/Enterprise-path functionality in official Privy docs/pricing, FanPass keeps backend access-token sync as the supported boundary, and `npm run security:privy-webhooks:optional` prevents webhook routes or `PRIVY_*WEBHOOK*` secrets from being introduced before selected-plan support is verified. Older mobile config evidence exists but is currently stale against the user's uncommitted DEBUG-only iOS helper edits; do not refresh or close iOS-dependent evidence until those edits are deliberately reviewed.
- FanPass Console React SDK login is implemented in isolated runtime `apps/console-auth`, which is intentionally outside root workspaces/default production audit. It posts Privy access tokens only to `/api/console/privy-session`; saved evidence passed at `outputs/privy-console-sdk/privy-console-react-sdk-20260603.json`. The main `apps/dashboard` Console now runs as Vite React static assets plus `apps/dashboard/server/console-bff.ts`; root production audit is clean, while the isolated auth runtime remains separate.
- Non-human SDK/payment implementation checklist items are closed after validating current boundaries: FanPass and FanPass Ops use the shared Privy Swift SDK email OTP provider, FanPass Console uses the isolated Privy React SDK auth runtime, Privy webhook sync is resolved as optional/absent for the current plan, and Stripe test-mode PaymentIntent/webhook/client checkout implementation is covered by native iOS PaymentSheet plus saved Render staging evidence. This does not close signed-device OTP, production tenant/staff, Wallet, scanner, or chain custody evidence blockers.
- Console Next exit is complete for `apps/dashboard`: the previous Next production runtime was replaced with Vite React plus a Node built-in HTTP BFF. `npm run security:dependency-advisories` reports `releaseBlocker: null` and a clean production audit.
- Closed-beta-only dependency risk acceptance evidence remains at `outputs/dependency-risk/20260604T120654Z-closed-beta-risk-acceptance.json`, with `acceptedByRole: "project-owner"`, `scope: "closed-beta-only"`, and expiry on 2026-07-04, but the root production dependency blocker is now closed by migration rather than risk acceptance.
- Alpha security blocker rollup was refreshed on 2026-06-06: Privy SDK login, Stripe test-mode release evidence, deployed HTTPS runtime evidence, hosted CI, production tenant/staff staging evidence, owner-skipped walkthrough recording, and public dependency readiness are closed for the current Beta foundation, while signed iOS/TestFlight, signed Wallet, physical QR/NFC, and release-grade chain custody remain open for public or real-user Beta.
- A release evidence draft helper now seeds the remaining external evidence gates without closing them: `npm run release:evidence:draft -- ios-build|apple-wallet|ops-scanner|chain-custody --out <draft-json>`. Drafts intentionally emit `ok: false`, current SHA-256 snapshots, placeholders, and the next validator command so they cannot be mistaken for release evidence.
- The latest supporting local Alpha walkthrough capture bundle is `outputs/alpha-walkthrough/20260604T122652Z/`; it passed capture, `npm run security:evidence-redaction -- outputs/alpha-walkthrough/20260604T122652Z`, and screenshot review after clearing one-time invite token panels and raw email-shaped form values. The owner removed the human-reviewed recording requirement from current Beta foundation blockers on 2026-06-04; recording evidence is optional unless deliberately reintroduced.
- FanPass/FanPass Ops simulator OTP paths worked for local/staging evidence, and production-like tenant/staff staging evidence now passes. Signed/staging-device OTP evidence remains open.
- Render free HTTPS staging runtime evidence for the current Render API plus Render Vite/Node Console passed with a real staging Privy admin bearer from the simulator login path at `outputs/staging-runtime/20260606T180256Z-render-console-vite-node-admin.json`.
- Apple Developer enrollment is currently blocked by account/enrollment issues. The owner is considering a web fallback starting from a landing page. The web fallback boundary and workplan are now documented: QR-only, no Web NFC, shared API/backend state with iOS, separate from native iOS evidence, and not a substitute for TestFlight, Apple Wallet, physical QR/NFC, or chain custody gates. The latest landing-page design instruction is long-scroll with low density: one idea per viewport, premium spacing, no feature-wall, no QR/scanner-first positioning, and no web/iOS sync as homepage copy. Lead with trustworthy tickets, controlled resale, and transparent prices.

Local working tree warning:

- There are uncommitted DEBUG-only iOS helper changes in `apps/ios/FanPass/FanPass/App/AppState.swift` and `apps/ios/FanPass/FanPass/Features/Auth/AuthView.swift`. They were used for simulator token copy/paste testing and should be reviewed before commit, reverted only with explicit user approval, or folded into a deliberate DEBUG-only evidence helper change.
- Treat all provider tokens or keys pasted in chat as exposed. Rotate the Stripe test secret, GitHub PAT, Render API token, Privy access tokens, and any Privy secret material before sharing evidence outside the local workspace or using the environment for another release decision.

Fast resume prompt:

- Read `docs/CODEX_HANDOFF.md` first, then enumerate and read every Markdown file in the workspace with `rg --files -g '*.md'`. Keep `docs/NEW_CHAT_PROMPT.md` current when work ends.
- Start by checking `git status --short --branch`, then pick the next remaining Beta blocker. Good next targets are real iOS staging/TestFlight evidence, signed Wallet evidence, physical QR/NFC evidence, or release-grade chain custody evidence.

## Repository

Workspace:

`/Users/tantalum/Documents/system and iot`

Important paths:

- `apps/api` - NestJS API.
- `apps/dashboard` - Vite React web dashboard plus Node BFF, positioned as `FanPass Console`.
- `packages/contracts` - Solidity contracts and Hardhat tests.
- `packages/shared` - shared TypeScript types.
- `apps/ios/FanPass` - SwiftUI iOS fan app source and generated Xcode project.
- `apps/ios/FanPass/FanPassOps` - SwiftUI iOS staff/onsite app target source.
- `docs/BETA_ROADMAP.md` - product roadmap.
- `docs/IOS_DISTRIBUTION_PLAN.md` - FanPass and FanPass Ops App Store/TestFlight distribution plan.
- `docs/ALPHA_PLAN.md` - Alpha scope, lifecycle states, permissions, and acceptance gates.
- `docs/ALPHA_RUNBOOK.md` - Alpha persistent database setup, reset, seed, and status checks.
- `docs/ALPHA_SECURITY_REVIEW.md` - Alpha feature completion and security review, including public Beta blockers.
- `docs/DEVELOPMENT_TASKS.md` - task checklist.
- `docs/PROVIDER_COST_FEASIBILITY.md` - Stripe/Privy low-cost plan feasibility, feature risks, and provider integration constraints.
- `docs/CONSOLE_NEXT_EXIT_PLAN.md` - Console migration guardrail for the unresolved Next/PostCSS production advisory.
- `docs/DEPENDENCY_ADVISORY_LOG.md` - current npm audit advisory status, containment decision, and external-testing gate.
- `docs/API_RESPONSE_PRIVACY_MATRIX.md` - route-level API and Console route-handler response privacy classification matrix and release rules.

## Completed

- After Chain Custody Evidence CI Secret Mask Command Redaction on 2026-05-30:
  - Updated `npm run security:chain-custody:evidence` so saved real-chain custody and contract-control evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
  - Required chain custody evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future vault/KMS or delegated signer evidence can be trusted.
  - Updated fixture-backed `npm run security:chain-custody:evidence:self-test` coverage to reject CI masking command literals and missing masking-command redaction proof.
  - Updated chain custody evidence, QA, roadmap, provider-cost, task, and security-review docs so real-chain custody evidence coverage includes CI secret masking command literals alongside private keys, seed phrases, provider secrets, provider RPC URLs, deployment/cloud credentials, database URLs, Stripe publishable keys, and real user data.
  - Marked `Add CI secret masking command literal leakage coverage to the chain custody evidence validator` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:chain-custody:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy Mobile App Config Evidence CI Secret Mask Command Redaction on 2026-05-30:
  - Updated `npm run security:privy-mobile-app-config:evidence` so saved native Privy app/client ID evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
  - Required Privy mobile app config evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future real iOS app/client ID evidence can be trusted.
  - Updated fixture-backed `npm run security:privy-mobile-app-config:evidence:self-test` coverage to reject CI masking command literals and missing masking-command redaction proof.
  - Updated Privy mobile app config evidence, QA, roadmap, provider-cost, iOS distribution, task, and security-review docs so real native Privy app config evidence coverage includes CI secret masking command literals alongside Privy secrets, access tokens, provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, production credentials, and real personal data.
  - Marked `Add CI secret masking command literal leakage coverage to the Privy mobile app config evidence validator` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:privy-mobile-app-config:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy Plan Evidence CI Secret Mask Command Redaction on 2026-05-30:
  - Updated `npm run security:privy-plan:evidence` so saved Privy dashboard plan evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
  - Required Privy plan evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future dashboard plan-support evidence can be trusted.
  - Updated fixture-backed `npm run security:privy-plan:evidence:self-test` coverage to reject CI masking command literals and missing masking-command redaction proof.
  - Updated Privy plan evidence, QA, roadmap, provider-cost, task, and security-review docs so dashboard plan evidence coverage includes CI secret masking command literals alongside Privy secrets, access tokens, provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, production credentials, and real personal data.
  - Marked `Add CI secret masking command literal leakage coverage to the Privy dashboard plan evidence validator` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:privy-plan:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Stripe Dashboard Evidence CI Secret Mask Command Redaction on 2026-05-30:
  - Updated `npm run security:stripe-dashboard:evidence` so saved Stripe dashboard feasibility evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
  - Required Stripe dashboard evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future dashboard PaymentIntent and webhook setup evidence can be trusted.
  - Updated fixture-backed `npm run security:stripe-dashboard:evidence:self-test` coverage to reject CI masking command literals and missing masking-command redaction proof.
  - Updated Stripe dashboard evidence, QA, roadmap, provider-cost, task, and security-review docs so dashboard feasibility evidence coverage includes CI secret masking command literals alongside Stripe secrets, publishable keys, client secrets, provider secrets, deployment/cloud credentials, database URLs, production credentials, and real personal data.
  - Marked `Add CI secret masking command literal leakage coverage to the Stripe dashboard evidence validator` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:stripe-dashboard:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Stripe Test-Mode Evidence CI Secret Mask Command Redaction on 2026-05-30:
  - Updated `npm run security:stripe-testmode:evidence` so saved real Stripe test-mode evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
  - Required Stripe test-mode evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future PaymentIntent, PaymentSheet, signed-webhook, capture, cancellation, refund, or reconciliation evidence can be trusted.
  - Updated fixture-backed `npm run security:stripe-testmode:evidence:self-test` coverage to reject CI masking command literals and missing masking-command redaction proof.
  - Updated Stripe test-mode evidence, QA, roadmap, provider-cost, task, and security-review docs so real Stripe evidence coverage includes CI secret masking command literals alongside Stripe secrets, publishable keys, client secrets, provider secrets, deployment/cloud credentials, database URLs, bearer tokens, and real personal data.
  - Marked `Add CI secret masking command literal leakage coverage to the Stripe test-mode evidence validator` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:stripe-testmode:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Staff Tenant Staging Evidence CI Secret Mask Command Redaction on 2026-05-30:
  - Updated `npm run security:staff-tenant:staging-evidence` so saved production-like tenant/staff staging evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
  - Required staff tenant staging evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future organizer-isolation, one-time invite, or Ops gate-scoping evidence can be trusted.
  - Updated fixture-backed `npm run security:staff-tenant:staging-evidence:self-test` coverage to reject CI masking command literals and missing masking-command redaction proof.
  - Updated staff tenant evidence, QA, roadmap, provider-cost, task, and security-review docs so production tenant/staff evidence coverage includes CI secret masking command literals alongside provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, bearer tokens, Privy tokens, invite tokens, and identity fields.
  - Marked `Add CI secret masking command literal leakage coverage to the staff tenant staging evidence validator` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:staff-tenant:staging-evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After iOS Staging Build Evidence CI Secret Mask Command Redaction on 2026-05-30:
  - Updated `npm run security:ios-staging-build:evidence` so saved signed iOS staging/TestFlight build evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
  - Required iOS staging/TestFlight build evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future signed build evidence can be trusted.
  - Updated fixture-backed `npm run security:ios-staging-build:evidence:self-test` coverage to reject CI masking command literals and missing masking-command redaction proof.
  - Updated iOS staging build evidence, QA, roadmap, provider-cost, distribution, task, and security-review docs so signed build evidence coverage includes CI secret masking command literals alongside provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, bearer tokens, signing material, and device identifiers.
  - Marked `Add CI secret masking command literal leakage coverage to the iOS staging/TestFlight build evidence validator` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ios-staging-build:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Staging Runtime Evidence CI Secret Mask Command Redaction on 2026-05-30:
  - Updated `npm run security:runtime:staging:evidence` so saved deployed staging runtime evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
  - Required staging runtime evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before future deployed HTTPS header/config evidence can be trusted.
  - Updated fixture-backed `npm run security:runtime:staging:evidence:self-test` coverage to reject CI masking command literals and missing masking-command redaction proof.
  - Updated staging runtime evidence, deployment, QA, roadmap, provider-cost, task, and security-review docs so deployed staging evidence coverage includes CI secret masking command literals alongside provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, bearer tokens, and private keys.
  - Marked `Add CI secret masking command literal leakage coverage to the staging runtime evidence validator` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:runtime:staging:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Dependency Risk Evidence CI Secret Mask Command Redaction on 2026-05-30:
  - Updated `npm run security:dependency-risk:evidence` so saved dependency clean-closeout or unresolved-advisory risk-acceptance packets reject CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
  - Required dependency-risk evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before a future owner risk packet can be trusted.
  - Updated fixture-backed `npm run security:dependency-risk:evidence:self-test` coverage to reject CI masking command literals and missing masking-command redaction proof.
  - Updated dependency risk evidence, QA, roadmap, provider-cost, task, and security-review docs so dependency-risk evidence coverage includes CI secret masking command literals alongside provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, bearer tokens, and private keys.
  - Marked `Add CI secret masking command literal leakage coverage to the dependency risk evidence validator` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:dependency-risk:evidence:self-test`
    - `scripts/with-node-22.sh npm run security:dependency-advisories`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Hosted CI Evidence CI Secret Mask Command Redaction on 2026-05-30:
  - Updated `npm run security:ci-hosted:evidence` so saved hosted GitHub Actions evidence rejects CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
  - Required hosted CI evidence to prove `redaction.ciSecretMaskingCommandsRedacted: true` before a future hosted run can close the CI blocker.
  - Updated fixture-backed `npm run security:ci-hosted:evidence:self-test` coverage to reject CI masking command literals and missing masking-command redaction proof.
  - Updated CI evidence, QA, roadmap, provider-cost, task, and security-review docs so hosted CI evidence coverage includes CI secret masking command literals alongside provider secrets, deployment/cloud credentials, Stripe publishable keys, database URLs, bearer tokens, and private keys.
  - Marked `Add CI secret masking command literal leakage coverage to the hosted CI evidence validator` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:dependency-advisories`
    - `scripts/with-node-22.sh npm run security:dependency-tooling`
    - `scripts/with-node-22.sh npm run security:ci-hosted:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence CI Secret Mask Command Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject CI secret masking command captures that still include literal values, including GitHub Actions `::add-mask::`, deprecated `::set-secret`, and Azure Pipelines `##vso[task.setvariable ... issecret=true]` forms.
  - Kept redacted CI masking placeholders accepted while rejecting fixture-backed GitHub and Azure masking command literals in `npm run security:evidence-redaction:self-test`.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes CI secret masking command literals alongside source-control tokens, chat webhooks, observability credentials, deployment credentials, IaC sensitive outputs, and other generated evidence leak forms.
  - Marked `Add CI secret masking command literal coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence IaC Sensitive Output Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject Terraform/Pulumi-style sensitive output values when copied from state, plan, or CLI JSON evidence with `sensitive`, `secret`, or `secure` flags.
  - Kept redacted IaC sensitive output placeholders accepted while rejecting fixture-backed Terraform and Pulumi plaintext sensitive output values in `npm run security:evidence-redaction:self-test`.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes IaC sensitive output values alongside deployment/cloud credential assignments, raw cloud credentials, signed URLs, encoded private keys, Kubernetes kubeconfig material, and Docker/OCI credentials.
  - Marked `Add IaC sensitive output coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Lowercase Cloud Credential Assignment Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject lowercase deployment and cloud credential exports common in `.aws/credentials`, Terraform variables, YAML, and CLI output, including `aws_secret_access_key`, `aws_session_token`, `cloudflare_api_token`, `netlify_auth_token`, and `vercel_token`.
  - Kept redacted lowercase deployment/cloud credential placeholders accepted while rejecting copied lowercase AWS, Cloudflare, Netlify, and Vercel credential snippets in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes lowercase deployment/cloud credential assignments alongside uppercase assignment, JSON field, environment-map, raw cloud credential, cloud storage signed URL, encoded private-key, Kubernetes kubeconfig, and Docker/OCI credential forms.
  - Marked `Add lowercase deployment and cloud credential assignment coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Kubernetes Kubeconfig Credential Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject Kubernetes kubeconfig credential exports such as `KUBECONFIG_BASE64`, `KUBE_CONFIG_DATA`, `client-key-data`, `client-certificate-data`, and JSON `kubernetesConfigBase64` fields.
  - Kept redacted kubeconfig placeholders accepted while rejecting copied base64 kubeconfig, client-key, and client-certificate snippets in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes Kubernetes kubeconfig credential literals as well as encoded deployment private key credential literals, cloud storage signed URL credential parameters, encoded Docker/OCI registry credential literals, visible Docker/OCI registry credential literals, Azure storage credential literals, and raw cloud credential literals.
  - Marked `Add Kubernetes kubeconfig credential coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Encoded Deployment Private Key Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject encoded deployment private key and service-account key material such as `SSH_PRIVATE_KEY_BASE64`, `DEPLOY_PRIVATE_KEY_BASE64`, and `GCP_SERVICE_ACCOUNT_KEY_BASE64`.
  - Kept redacted encoded key placeholders accepted while rejecting copied base64 deploy/private-key and service-account JSON snippets in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes encoded deployment private key credential literals as well as cloud storage signed URL credential parameters, encoded Docker/OCI registry credential literals, visible Docker/OCI registry credential literals, Azure storage credential literals, and raw cloud credential literals.
  - Marked `Add encoded deployment private key credential coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Cloud Signed URL Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject AWS S3, Google Cloud Storage, and CloudFront signed URL credential parameters such as `X-Amz-Signature`, `X-Goog-Credential`, and CloudFront policy/key-pair query parameters.
  - Kept redacted signed URL placeholders accepted while rejecting copied provider signed URL snippets in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes cloud storage signed URL credential parameters as well as encoded Docker/OCI registry credential literals, visible Docker/OCI registry credential literals, Azure storage credential literals, and raw cloud credential literals.
  - Marked `Add cloud storage signed URL credential parameter coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Encoded Registry Credential Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject encoded Docker/OCI registry credentials, including Kubernetes `.dockerconfigjson` secret data and base64 registry auth config assignments.
  - Kept redacted encoded registry placeholders accepted while rejecting copied `.dockerconfigjson`, `DOCKER_AUTH_CONFIG_BASE64`, and `REGISTRY_AUTH_CONFIG_BASE64` snippets in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes encoded Docker/OCI registry credential literals as well as visible Docker/OCI registry credential literals, Azure storage credential literals, and raw cloud credential literals.
  - Marked `Add encoded Docker and OCI registry credential coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Docker/OCI Registry Credential Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject copied Docker/OCI registry credentials, including `DOCKER_AUTH_CONFIG` auth maps and `docker login --password` or `--password-stdin` command captures.
  - Kept redacted Docker registry placeholders accepted while rejecting copied registry auth JSON, password argument, and piped password-stdin snippets in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes Docker/OCI registry credential literals as well as Azure storage and raw cloud credential literals.
  - Marked `Add Docker and OCI registry credential literal coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Azure Storage Credential Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject copied Azure Storage connection strings and shared access signature fragments when they appear in CI/deployment/provider evidence exports.
  - Kept redacted Azure storage placeholders accepted while rejecting copied Azure Storage account-key and shared-access-signature snippets in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes Docker/OCI registry credential literals, encoded Docker/OCI registry credential literals, Azure storage credential literals, and raw AWS and Google cloud credential literals.
  - Marked `Add Azure storage credential literal coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Cloud Credential Literal Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject copied raw cloud credential literals such as AWS access key IDs and Google API keys when they appear in CI/deployment/provider evidence without assignment syntax.
  - Kept redacted cloud credential placeholders accepted while rejecting copied raw AWS and Google cloud credential snippets in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes raw cloud credential literals as well as deployment/cloud credential assignments, fields, and JSON environment-map forms.
  - Marked `Add raw cloud credential literal coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Apple Automation Credential Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject copied Apple/App Store automation credentials such as App Store Connect API keys, App Store Connect private-key exports, ASC API keys, Fastlane sessions, Match passwords, Match Git basic auth, and P8 private-key assignments in iOS/TestFlight evidence.
  - Kept redacted Apple automation placeholders accepted while rejecting copied signing/distribution automation credential snippets in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes Apple/App Store automation credential assignments as well as observability credentials, chat/notification webhook URLs, source-control token literals, npm registry auth tokens, provider, deployment, Stripe, Privy, app-secret, assignment, JSON, YAML, header, URL, and identity forms.
  - Marked `Add Apple and App Store automation credential assignment coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Observability Credential Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject copied observability credentials such as Sentry auth tokens, Datadog API keys, Honeycomb API keys, New Relic license/API keys, Logtail source tokens, and Axiom tokens when they appear in CI/deployment evidence exports.
  - Kept redacted observability placeholders accepted while rejecting copied monitoring-token assignment snippets in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes observability service credential assignments as well as chat/notification webhook URLs, source-control token literals, npm registry auth tokens, provider, deployment, Stripe, Privy, app-secret, assignment, JSON, YAML, header, URL, and identity forms.
  - Marked `Add observability service credential assignment coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Chat Webhook URL Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject copied Slack, Discord, and Microsoft Teams webhook URLs even when they appear as raw notification targets rather than named token assignments.
  - Kept redacted chat/notification webhook placeholders accepted while rejecting copied CI/deployment notification webhook URLs in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes chat/notification webhook URLs as well as source-control token literals, npm registry auth tokens, provider, deployment, Stripe, Privy, app-secret, assignment, JSON, YAML, header, URL, and identity forms.
  - Marked `Add chat and notification webhook URL coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Source-Control Token Literal Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw source-control access token literals such as GitHub classic tokens (`ghp_...`, `ghs_...`), GitHub fine-grained tokens (`github_pat_...`), and GitLab personal access tokens (`glpat-...`) even when copied into CI/deployment evidence without assignment syntax.
  - Kept redacted source-control token placeholders accepted while rejecting copied GitHub and GitLab token literals in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes source-control access token literals as well as npm registry auth tokens, provider, deployment, Stripe, Privy, app-secret, assignment, JSON, YAML, header, URL, and identity forms.
  - Marked `Add source-control access token literal coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Npm Registry Auth Token Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject package-manager registry auth-token snippets such as `NPM_TOKEN=...`, `NODE_AUTH_TOKEN="..."`, `YARN_NPM_AUTH_TOKEN='...'`, `.npmrc` `//registry.npmjs.org/:_authToken=...`, bare `_authToken=...`, Yarn `npmAuthToken: ...`, and JSON `npmAuthToken` fields.
  - Kept redacted package-manager auth placeholders such as `NPM_TOKEN=<redacted>`, `NODE_AUTH_TOKEN="<redacted>"`, `//registry.npmjs.org/:_authToken=<redacted>`, and `npmAuthToken: <redacted>` accepted while rejecting copied CI/package-registry auth snippets in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes npm registry auth tokens as well as provider, deployment, Stripe, Privy, app-secret, assignment, JSON, YAML, header, URL, and identity forms.
  - Marked `Add npm registry auth token coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Snake Case Assignment Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject snake_case `.env`/shell-style secret assignments such as `access_token=...`, `refresh_token="..."`, `id_token='...'`, `chain_api_key=...`, `rpc_api_key="..."`, `client_secret=...`, `webhook_secret=...`, and `signing_secret='...'`.
  - Kept redacted snake_case assignment placeholders such as `access_token=<redacted>`, `refresh_token="<redacted>"`, `chain_api_key='<redacted>'`, and `rpc_api_key=<redacted>` accepted while rejecting copied provider, OAuth, chain-provider, webhook, and signing secret exports in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes snake_case secret assignments as well as quoted exact-name and prefixed assignments, environment name/value fields, JSON, YAML, header, URL, and provider-specific forms.
  - Marked `Add snake_case secret assignment coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Quoted Prefixed App Secret Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject quoted prefixed app/session/client/webhook secret assignments such as `FANPASS_SESSION_SIGNING_SECRET="..."`, `FANPASS_CONSOLE_CLIENT_SECRET='...'`, `NEXTAUTH_SECRET="..."`, `FANPASS_COOKIE_SECRET='...'`, `FANPASS_ENCRYPTION_KEY="..."`, and `APPLE_PASS_SIGNING_SECRET='...'`.
  - Kept quoted prefixed redacted placeholders such as `FANPASS_SESSION_SECRET="<redacted>"` and `NEXTAUTH_SECRET='<redacted>'` accepted while rejecting copied app, auth, session, cookie, encryption, and signing secret exports in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes quoted prefixed app secret assignments as well as quoted exact-name assignments, unquoted assignments, environment name/value fields, JSON, YAML, header, URL, and provider-specific forms.
  - Marked `Add quoted prefixed app secret assignment coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Quoted Assignment Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject quoted `.env`/shell-style secret assignments such as `ACCESS_TOKEN="..."`, `API_KEY='...'`, `PROVIDER_API_KEY="..."`, `AWS_SECRET_ACCESS_KEY='...'`, `VERCEL_TOKEN="..."`, and `SESSION_SIGNING_SECRET="..."`.
  - Kept quoted redacted placeholders such as `ACCESS_TOKEN="<redacted>"` and `API_KEY='<redacted>'` accepted while rejecting copied provider, CI, deployment, OAuth, and app-session secret exports in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes quoted secret assignments as well as unquoted assignments, environment name/value fields, JSON, YAML, header, URL, and provider-specific forms.
  - Marked `Add quoted secret assignment coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Env Name/Value JSON Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject JSON environment arrays/objects where a secret-bearing `name` or `key` such as `ACCESS_TOKEN`, `api_key`, `VERCEL_TOKEN`, or `AWS_SECRET_ACCESS_KEY` is paired with a real-looking `value`.
  - Kept redacted JSON env-array placeholders such as `{ "name": "ACCESS_TOKEN", "value": "<redacted>" }` accepted while rejecting copied provider, CI, Kubernetes-style, and deployment environment JSON exports in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes environment name/value JSON secret fields as well as name/value YAML fields, env-style colon fields, snake_case colon fields, assignments, JSON, header, URL, and provider-specific forms.
  - Marked `Add environment name/value JSON secret field coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Env Name/Value YAML Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject split environment YAML fields where a secret-bearing `name:` or `key:` such as `ACCESS_TOKEN`, `api_key`, `VERCEL_TOKEN`, or `AWS_SECRET_ACCESS_KEY` is followed by a real-looking `value: ...` on a nearby line.
  - Kept redacted name/value YAML placeholders such as `value: <redacted>` and `value: "<redacted>"` accepted while rejecting copied provider, CI, Kubernetes-style, and deployment environment lists in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes environment name/value YAML secret fields as well as env-style colon fields, snake_case colon fields, assignments, JSON, header, URL, and provider-specific forms.
  - Marked `Add environment name/value YAML secret field coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Env-Style YAML/Colon Field Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject environment-style YAML/plain colon fields such as `ACCESS_TOKEN: ...`, `API_KEY: ...`, `PRIVY_ACCESS_TOKEN: ...`, `PROVIDER_API_KEY: ...`, `AWS_SECRET_ACCESS_KEY: ...`, `VERCEL_TOKEN: ...`, and `CLOUDFLARE_API_TOKEN: ...`.
  - Kept redacted env-style colon placeholders such as `ACCESS_TOKEN: <redacted>` and `API_KEY: "<redacted>"` accepted while rejecting real-looking provider, OAuth, staging-admin, and deployment/cloud YAML exports in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes environment-style secret YAML/colon fields as well as snake_case colon fields, assignments, JSON, header, URL, and provider-specific forms.
  - Marked `Add environment-style secret YAML/colon field coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence YAML/Colon Field Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject secret-bearing YAML/plain colon fields such as `access_token: ...`, `refresh_token: ...`, `id_token: ...`, `client_secret: ...`, `api_key: ...`, `provider_api_key: ...`, `webhook_secret: ...`, and `signing_secret: ...`.
  - Kept redacted colon-field placeholders such as `access_token: <redacted>` and `refresh_token: "<redacted>"` accepted while rejecting real-looking provider/OAuth YAML exports in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes secret-bearing YAML/colon fields as well as assignments, JSON, header, URL, and provider-specific forms.
  - Marked `Add secret-bearing YAML/colon field coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Token Assignment Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject generic token and API-key assignment lines such as `ACCESS_TOKEN=...`, `REFRESH_TOKEN=...`, `ID_TOKEN=...`, `SESSION_TOKEN=...`, `AUTH_TOKEN=...`, `BEARER_TOKEN=...`, `CSRF_TOKEN=...`, and `API_KEY=...`.
  - Kept redacted assignment placeholders such as `ACCESS_TOKEN=<redacted>` accepted while rejecting real-looking provider/OAuth assignment values in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes generic token/API-key assignments as well as JSON, header, URL, and provider-specific forms.
  - Marked `Add generic token and API-key assignment coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Snake Case JSON Field Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject secret-bearing snake_case JSON fields such as `access_token`, `refresh_token`, `id_token`, `client_secret`, `api_key`, `provider_api_key`, `webhook_secret`, and `signing_secret`.
  - Kept redacted snake_case placeholders such as `<redacted>` accepted while rejecting real-looking provider/OAuth JSON field values in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes snake_case JSON fields as well as camel-case token fields and URL/header forms.
  - Marked `Add secret-bearing snake_case JSON field coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence URL Fragment Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject secret-bearing URL fragment parameters such as `#access_token=...` and `#id_token=...`, which can appear in browser redirect captures.
  - Kept redacted URL fragment placeholders such as `#access_token=<redacted>` accepted while rejecting real-looking fragment token values in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes URL fragment parameters as well as query parameters.
  - Marked `Add secret-bearing URL fragment parameter coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Header JSON Field Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject serialized secret-bearing HTTP header fields such as `Authorization`, `Set-Cookie`, `X-API-Key`, `Stripe-Signature`, and `Privy-Access-Token`.
  - Kept redacted JSON header placeholders such as `Bearer <accessToken>` accepted while rejecting real-looking header values in fixture-backed `npm run security:evidence-redaction:self-test` coverage.
  - Updated QA, roadmap, provider-cost, walkthrough evidence, task, and security-review docs so saved-evidence redaction coverage includes secret-bearing HTTP header JSON fields.
  - Marked `Add secret-bearing HTTP header JSON field coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Generic Token Field Redaction on 2026-05-30:
  - Updated `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject generic token/cookie JSON fields such as access tokens, refresh tokens, ID tokens, session tokens, bearer tokens, authorization values, cookies, set-cookie values, and CSRF tokens.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage that rejects those JSON fields before walkthrough, staging, CI, provider, iOS, scanner, Wallet, or chain evidence bundles are trusted.
  - Updated QA, roadmap, provider-cost, task, and security-review docs so saved-evidence redaction coverage includes generic token/cookie JSON fields.
  - Marked `Add generic token and cookie JSON field coverage to the saved evidence redaction audit` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Alpha Walkthrough Recording Review Evidence Validator on 2026-05-30:
  - Added `docs/ALPHA_WALKTHROUGH_RECORDING_EVIDENCE.md` as the saved-evidence contract for closing the human-reviewed Alpha walkthrough recording task.
  - Added `npm run alpha:walkthrough:recording:evidence` and fixture-backed `npm run alpha:walkthrough:recording:evidence:self-test`.
  - Wired the self-test into `npm run beta:foundation:verify` after the walkthrough evidence audit.
  - The validator rejects missing recording artifacts, capture-bundle substitution, stale Alpha walkthrough recording policy snapshot proof, incomplete scene or verification coverage, external-Beta overclaims, provider secret leakage, raw identity and QR payload leakage, production credential use, and weak redaction.
  - Marked `Add saved Alpha walkthrough recording review evidence validator before closing the human-reviewed recording task` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run alpha:walkthrough:recording:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Dependency Risk Policy Snapshot Evidence Binding on 2026-05-30:
  - Updated `npm run security:dependency-risk:evidence` so future clean-audit closeout or owner-approved unresolved-advisory risk acceptance evidence must include SHA-256 proof for the current dependency advisory gate, advisory gate self-test, dependency risk evidence validator/self-test, dependency tooling audit, dependency advisory log, dependency risk evidence contract, and provider-cost feasibility policy.
  - Added fixture-backed `npm run security:dependency-risk:evidence:self-test` coverage that rejects stale dependency risk policy snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before clean closeout or owner-approved risk evidence can be trusted.
  - Updated `docs/DEPENDENCY_RISK_EVIDENCE.md`, dependency advisory log, QA, roadmap, provider-cost, task, and security-review docs so dependency risk evidence must be regenerated after advisory gate, risk validator, tooling audit, or dependency policy documentation changes.
  - Marked `Bind dependency risk evidence to the current advisory gate, risk validator, tooling audit, and dependency policy docs SHA-256 snapshot` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:dependency-risk:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Hosted CI Verifier Policy Snapshot Evidence Binding on 2026-05-30:
  - Updated `npm run security:ci-hosted:evidence` so future hosted GitHub Actions evidence must include a current hosted CI verifier policy SHA-256 snapshot for the workflow, `.nvmrc`, `.npmrc`, root package manifest and lockfile, composite Beta verifier, CI workflow audit, hosted CI evidence validator/self-test, and CI evidence contract document.
  - Added fixture-backed `npm run security:ci-hosted:evidence:self-test` coverage that rejects stale hosted CI verifier policy snapshot source, missing files, unexpected files, and mismatched SHA-256 proof before hosted CI evidence can be trusted.
  - Updated `docs/CI_HOSTED_EVIDENCE.md` plus the QA, roadmap, provider-cost, task, and security-review docs so hosted CI evidence must be regenerated after workflow, Node/npm policy, package lockfile, composite verifier, CI workflow audit, hosted evidence validator, self-test, or evidence-contract changes.
  - Marked `Bind hosted CI evidence to the current Beta verifier, Node/npm policy, package lockfile, and CI evidence contract SHA-256 snapshot` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ci-hosted:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Stripe Dashboard Feasibility Evidence Validator on 2026-05-30:
  - Added `npm run security:stripe-dashboard:evidence` so future Stripe dashboard feasibility evidence must prove test-mode dashboard review, test-mode PaymentIntent availability, manual-capture support for `POST /payments/intents`, an HTTPS `POST /payments/webhook` endpoint with signed raw-body verification, required PaymentIntent events, and the current Stripe payment/webhook policy SHA-256 snapshot.
  - Added fixture-backed `npm run security:stripe-dashboard:evidence:self-test` coverage that rejects unreviewed dashboard claims, live-mode proof, stale payment/webhook policy snapshot proof, leaked Stripe/database/deployment credential markers, missing deployment credential redaction proof, incomplete PaymentIntent route proof, incomplete webhook endpoint proof, and missing redaction proof.
  - Added `docs/STRIPE_DASHBOARD_EVIDENCE.md` plus QA, roadmap, provider-cost, Stripe test-mode, task, and security-review docs so Stripe dashboard evidence must be regenerated after payment route, provider, production-like payment config, evidence validator, or provider-cost policy changes.
  - Marked `Add Stripe dashboard feasibility evidence validator for test-mode PaymentIntent and webhook setup proof` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:stripe-dashboard:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy Plan Policy Snapshot Evidence Binding on 2026-05-30:
  - Updated `npm run security:privy-plan:evidence` so future Privy dashboard plan evidence must include SHA-256 proof for the current backend Privy token verifier, account sync boundary, Console session bridge, iOS Privy provider, Privy plan evidence validator, webhook optionality audit, and provider-cost/plan evidence docs.
  - Added fixture-backed `npm run security:privy-plan:evidence:self-test` coverage that rejects stale Privy auth policy snapshot source, missing files, unexpected files, or mismatched SHA-256 proof before mobile SDK, embedded wallet, backend token verification, webhook, custom UI, or MFA/policy plan claims can be trusted.
  - Updated `docs/PRIVY_PLAN_EVIDENCE.md` plus the QA, roadmap, provider-cost, task, and security-review docs so Privy dashboard evidence must be regenerated after auth verification, account sync, Console session, iOS provider, webhook optionality, validator, or plan-policy documentation changes.
  - Marked `Bind Privy dashboard plan evidence to the current Privy auth, webhook optionality, and plan-policy implementation SHA-256 snapshot` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:privy-plan:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Staging Runtime Evidence Implementation Snapshot Binding on 2026-05-30:
  - Updated `npm run security:runtime:staging:evidence` so future deployed staging runtime evidence must include SHA-256 proof for the current API bootstrap/header/trust-proxy config, staging environment template, Socket.IO CORS adapter, admin side-effect health API boundary, Console header config, staging runtime checker, staging evidence validator, local dry-run helper, and static header-policy audit files.
  - Added fixture-backed `npm run security:runtime:staging:evidence:self-test` coverage that rejects stale staging runtime implementation snapshot source, missing files, unexpected files, or mismatched SHA-256 proof before deployed HTTPS header, trust-proxy, admin-health, or WebSocket evidence can be trusted.
  - Updated `docs/DEPLOYMENT_ENVIRONMENTS.md` plus the QA, roadmap, provider-cost, task, and security-review docs so staging runtime evidence must be regenerated after API/Console headers, production-like config, admin health, WebSocket CORS, staging checker, evidence validator, dry-run helper, or header-policy audit changes.
  - Marked `Bind deployed staging runtime evidence to the current API/Console header, trust-proxy, admin-health, WebSocket, and evidence-validator implementation SHA-256 snapshot` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:runtime:staging:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Chain Custody Implementation Snapshot Evidence Binding on 2026-05-30:
  - Updated `npm run security:chain-custody:evidence` so future real-chain custody and contract-control evidence must include SHA-256 proof for the current ownership adapter, production-like testnet guard, durable side-effect outbox, worker, health gate, Prisma outbox schema, chain operator audit, provider boundary audit, settlement idempotency audit, and side-effect verifier files.
  - Added fixture-backed `npm run security:chain-custody:evidence:self-test` coverage that rejects stale chain custody implementation snapshot source, missing files, unexpected files, or mismatched SHA-256 proof before vault/KMS or delegated signer, multisig/timelock, durable outbox, or runbook evidence can be trusted.
  - Updated `docs/CHAIN_CUSTODY_EVIDENCE.md` plus the QA, roadmap, provider-cost, task, and security-review docs so chain custody evidence must be regenerated after ownership, outbox, health, production-like guard, or boundary-audit changes.
  - Marked `Bind chain custody evidence to the current ownership adapter, production-like guard, durable outbox, worker, health, and boundary-audit implementation SHA-256 snapshot` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:chain-custody:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Apple Wallet Pass Implementation Snapshot Evidence Binding on 2026-05-30:
  - Updated `npm run security:apple-wallet:evidence` so future signed `.pkpass` evidence must include SHA-256 proof for the current iOS project, ticket wallet barcode boundary, QR payload model, iOS API client, FanPass Ops scanner compatibility, API signing/redemption boundary, prototype shortcut register, prototype shortcut audit, and iOS distribution audit files.
  - Added fixture-backed `npm run security:apple-wallet:evidence:self-test` coverage that rejects stale Wallet implementation snapshot source, missing files, unexpected files, or mismatched SHA-256 proof before signed pass, manifest/signature, physical-device add-to-Wallet, or Ops scan compatibility evidence can be trusted.
  - Updated `docs/APPLE_WALLET_PASS_EVIDENCE.md` plus the physical-device QA, QA, roadmap, provider-cost, task, and security-review docs so Wallet evidence must be regenerated after ticket wallet, QR payload, API signing/redemption, scanner compatibility, or prototype-boundary changes.
  - Marked `Bind signed Apple Wallet pass evidence to the current ticket wallet, QR payload, API signing, scanner compatibility, and prototype-boundary implementation SHA-256 snapshot` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:apple-wallet:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After FanPass Ops Scanner Implementation Snapshot Evidence Binding on 2026-05-30:
  - Updated `npm run security:ops-scanner:device-evidence` so future physical QR/NFC evidence must include SHA-256 proof for the current iOS project, Ops NFC entitlement, scanner UI, QR camera adapter, Core NFC adapter, iOS API client, FanPass Ops shell, API auth/session boundary, verification controller/service, NFC fixture contract, and iOS/NFC release-boundary audits.
  - Added fixture-backed `npm run security:ops-scanner:device-evidence:self-test` coverage that rejects stale scanner implementation snapshot source, missing files, unexpected files, or mismatched SHA-256 proof before QR camera, NFC tag, backend authority, or replay-rejection evidence can be trusted.
  - Updated `docs/OPS_SCANNER_DEVICE_EVIDENCE.md` plus the physical-device QA, QA, roadmap, provider-cost, task, and security-review docs so scanner evidence must be regenerated after scanner UI, QR/NFC transport, API redemption/auth, NFC fixture, or release-boundary audit changes.
  - Marked `Bind physical FanPass Ops scanner evidence to the current QR/NFC scanner, API redemption, auth, and fixture implementation SHA-256 snapshot` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ops-scanner:device-evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After iOS Staging/TestFlight Build Implementation Snapshot Evidence Binding on 2026-05-30:
  - Updated `npm run security:ios-staging-build:evidence` so future signed real-device or TestFlight build evidence must include SHA-256 proof for the current iOS project, local/staging/beta/production configs, generated Info.plists, Ops entitlements, app entry, environment guard, wallet/debug-helper boundary, Stripe PaymentSheet presenter/coordinator, Privy auth provider, API client, FanPass Ops shell, and iOS distribution audit files.
  - Added fixture-backed `npm run security:ios-staging-build:evidence:self-test` coverage that rejects stale iOS distribution/config implementation snapshot source, missing files, unexpected files, or mismatched SHA-256 proof before signed build, real HTTPS API URL, role-separation, or debug-helper removal evidence can be trusted.
  - Updated `docs/IOS_STAGING_BUILD_EVIDENCE.md` plus the iOS distribution plan, QA, roadmap, provider-cost, task, and security-review docs so iOS build evidence must be regenerated after project, config, app boundary, provider, or distribution-audit changes.
  - Marked `Bind iOS staging/TestFlight build evidence to the current iOS distribution/config implementation SHA-256 snapshot` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ios-staging-build:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Staff Tenant Staging Implementation Snapshot Evidence Binding on 2026-05-30:
  - Updated `npm run security:staff-tenant:staging-evidence` so future production-like tenant/staff staging evidence must include SHA-256 proof for the current API staff invite acceptance, assignment lifecycle, gate enforcement, Console staff assignment proxy/redactor, FanPass Ops linking UI, iOS API client, staff invite policy audit, and Console route contract audit files.
  - Added fixture-backed `npm run security:staff-tenant:staging-evidence:self-test` coverage that rejects stale staff tenant staging snapshot source, missing files, unexpected files, or mismatched SHA-256 proof before organizer isolation, one-time invite, or Ops gate-scoping evidence can be trusted.
  - Updated `docs/STAFF_TENANT_STAGING_EVIDENCE.md` plus the QA, roadmap, provider-cost, task, and security-review docs so tenant/staff evidence must be regenerated after staff invite, Console proxy/redaction, Ops linking, gate-enforcement, or staff-policy audit changes.
  - Marked `Bind staff tenant staging evidence to the current staff invite, Console proxy, Ops linking, and gate policy implementation SHA-256 snapshot` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:staff-tenant:staging-evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy Console React SDK Isolation Snapshot Evidence Binding on 2026-05-30:
  - Updated `npm run security:privy-console-react-sdk:isolation` so future Console React SDK isolation evidence must include SHA-256 proof for the current Console Privy session route, locked SDK-free login form, server API helper, Dashboard/root dependency manifests, Console route contract audit, and provider-boundary audit.
  - Added fixture-backed `npm run security:privy-console-react-sdk:isolation:self-test` coverage that rejects stale Console SDK isolation snapshot source, missing files, unexpected files, or mismatched SHA-256 proof before direct or isolated SDK evidence can be trusted.
  - Updated `docs/PRIVY_CONSOLE_REACT_SDK_ISOLATION.md` plus the QA, roadmap, provider-cost, task, and security-review docs so Console SDK isolation evidence must be regenerated after session bridge, login UI, server helper, dependency manifest, or boundary-audit policy changes.
  - Marked `Bind Privy Console React SDK isolation evidence to the current Console session/dependency boundary SHA-256 snapshot` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:privy-console-react-sdk:isolation:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy Mobile App Config Implementation Snapshot Evidence Binding on 2026-05-30:
  - Updated `npm run security:privy-mobile-app-config:evidence` so future real Privy mobile app configuration evidence must include SHA-256 proof for the current iOS Privy provider, environment guard, app state, API sync, FanPass/FanPass Ops auth UI, XcodeGen project, generated Info.plists, and checked-in xcconfig placeholders.
  - Added fixture-backed `npm run security:privy-mobile-app-config:evidence:self-test` coverage that rejects stale Privy iOS implementation snapshot source, missing files, unexpected files, or mismatched SHA-256 proof before real mobile app config evidence can be trusted.
  - Updated `docs/PRIVY_MOBILE_APP_CONFIG_EVIDENCE.md` plus the QA, roadmap, provider-cost, task, and security-review docs so Privy mobile app config evidence must be regenerated after iOS auth/config boundary changes.
  - Marked `Bind Privy mobile app config evidence to the current iOS auth/config implementation SHA-256 snapshot` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:privy-mobile-app-config:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Stripe Test-Mode Implementation Snapshot Evidence Binding on 2026-05-30:
  - Updated `npm run security:stripe-testmode:evidence` so future real Stripe test-mode evidence must include SHA-256 proof for the current Stripe API, side-effect worker, iOS API-client, environment, app callback, checkout UI, and PaymentSheet presenter files.
  - Added fixture-backed `npm run security:stripe-testmode:evidence:self-test` coverage that rejects stale Stripe implementation snapshot source, missing files, unexpected files, or mismatched SHA-256 proof before real Stripe evidence can be trusted.
  - Updated `docs/STRIPE_TESTMODE_EVIDENCE.md` plus the QA, roadmap, provider-cost, task, and security-review docs so Stripe test-mode evidence must be regenerated after payment implementation changes.
  - Marked `Bind Stripe test-mode evidence to the current API and iOS payment implementation SHA-256 snapshot` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:stripe-testmode:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Dependency Risk Snapshot Evidence Binding on 2026-05-30:
  - Updated `npm run security:dependency-risk:evidence` so future clean-audit closeout or owner-approved unresolved-advisory risk acceptance evidence must include SHA-256 proof for the current root lockfile and workspace package manifests.
  - Added fixture-backed `npm run security:dependency-risk:evidence:self-test` coverage that rejects stale dependency snapshot source, missing manifest/lockfile entries, unexpected files, or mismatched SHA-256 proof.
  - Updated `docs/DEPENDENCY_RISK_EVIDENCE.md` plus the advisory log, QA, roadmap, task, provider-cost, and security-review docs so dependency risk evidence must be regenerated after dependency manifest or lockfile changes.
  - Marked `Bind dependency risk evidence to the current workspace dependency manifest and lockfile SHA-256 snapshot` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:dependency-risk:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Hosted CI Workflow Hash Evidence Binding on 2026-05-30:
  - Updated `npm run security:ci-hosted:evidence` so future hosted GitHub Actions evidence must include `.github/workflows/beta-foundation.yml` and a SHA-256 digest matching the current checked-in workflow file.
  - Added fixture-backed `npm run security:ci-hosted:evidence:self-test` coverage that rejects stale workflow-path or workflow-hash proof before hosted CI evidence can be trusted.
  - Updated `docs/CI_HOSTED_EVIDENCE.md` plus the QA, roadmap, provider-cost, task, and security-review docs so the hosted CI evidence contract is bound to the current workflow file as well as the current verifier output.
  - Marked `Bind hosted CI evidence to the current Beta foundation workflow path and SHA-256 proof` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ci-hosted:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Hosted CI Test Count Evidence Alignment on 2026-05-30:
  - Updated `npm run security:ci-hosted:evidence` so future hosted GitHub Actions evidence must prove the current API unit-test result: 12 suites / 59 tests.
  - Updated fixture-backed `npm run security:ci-hosted:evidence:self-test` coverage to reject stale API test-count evidence.
  - Updated `docs/CI_HOSTED_EVIDENCE.md` and the QA, roadmap, provider-cost, task, and security-review docs so the hosted CI evidence contract matches the current `npm run beta:foundation:verify` API unit-test output.
  - Marked `Align hosted CI evidence validator with the current API unit test-count proof` complete.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ci-hosted:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Staging Trust Proxy Evidence Hardening on 2026-05-30:
  - Required `STAGING_API_TRUST_PROXY_HOPS` / `FANPASS_STAGING_API_TRUST_PROXY_HOPS` for deployed `npm run security:runtime:staging` runs and bounded it to 1-3 hops.
  - Extended staging runtime JSON output with `apiRuntime.trustProxyHops`, deployment credential absence/redaction metadata, and a checked API item for the configured trust-proxy hop count.
  - Updated `npm run security:runtime:staging:evidence` so saved staging evidence must include bounded `apiRuntime.trustProxyHops` and a matching `trust proxy hops configured: <n>` checked item before deployed rate-limit/header evidence is accepted.
  - Added fixture-backed self-test coverage for missing and invalid staging trust-proxy hop evidence in the runtime checker and saved-evidence validator, then tied the new markers into `npm run security:headers-policy`.
  - Marked `Add deployed staging runtime evidence proof for API trust-proxy hop configuration` complete and updated the QA, roadmap, deployment, provider-cost, Alpha runbook, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:runtime:staging:self-test`
    - `scripts/with-node-22.sh npm run security:runtime:staging:evidence:self-test`
    - `scripts/with-node-22.sh npm run security:headers-policy:self-test`
    - `scripts/with-node-22.sh npm run security:headers-policy`
    - `scripts/with-node-22.sh npm run security:runtime:staging:dry-run`
    - `scripts/with-node-22.sh npm run security:runtime:staging:evidence -- --allow-dry-run /tmp/fanpass-staging-runtime-dry-run-evidence.txt`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Production-Like Trust Proxy Hardening on 2026-05-30:
  - Added explicit API `trust proxy` wiring for production-like runtimes, backed by `FANPASS_TRUST_PROXY_HOPS`, before `express-rate-limit` middleware is registered.
  - Required `FANPASS_TRUST_PROXY_HOPS` in staging/production-like API config and bounded it to 1-3 hops so deployed rate limiting uses an intentional edge/proxy path instead of unbounded forwarded-header trust.
  - Updated the staging dry-run and API staging environment template to set `FANPASS_TRUST_PROXY_HOPS=1`.
  - Extended `npm run security:headers-policy` and fixture-backed self-tests to reject missing trust-proxy runtime wiring, missing production-like trust-proxy validation, missing staging template coverage, and missing docs markers.
  - Marked `Add production-like API trust-proxy hop validation before deployed rate-limit evidence is trusted` complete and updated the QA, roadmap, deployment, provider-cost, Alpha runbook, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run test -w apps/api -- --runTestsByPath test/security-config.spec.ts`
    - `scripts/with-node-22.sh npm run security:headers-policy:self-test`
    - `scripts/with-node-22.sh npm run security:headers-policy`
    - `scripts/with-node-22.sh npm run security:runtime:staging:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Production-Like HSTS Header Hardening on 2026-05-30:
  - Enabled API Helmet HSTS only in production-like environments and kept local HTTP HSTS disabled.
  - Added `Strict-Transport-Security` to FanPass Console static headers in `apps/dashboard/next.config.ts`.
  - Extended the staging runtime checker and staging runtime evidence validator to require API and Console `strict-transport-security` proof before deployed header evidence is trusted.
  - Extended `npm run security:headers-policy` and fixture-backed self-tests to reject missing production-like API HSTS markers, missing Console strict transport security config, missing staging runtime strict transport security checks, and missing staging evidence strict transport security proof.
  - Marked `Add production-like Strict Transport Security coverage to API, Console, staging runtime, and staging evidence header gates` complete and updated the QA, roadmap, provider-cost, Alpha runbook, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:runtime:staging:self-test`
    - `scripts/with-node-22.sh npm run security:runtime:staging:evidence:self-test`
    - `scripts/with-node-22.sh npm run security:headers-policy:self-test`
    - `scripts/with-node-22.sh npm run security:headers-policy`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Console Cross-Origin Opener Header Hardening on 2026-05-30:
  - Added `Cross-Origin-Opener-Policy: same-origin` to FanPass Console static headers in `apps/dashboard/next.config.ts`.
  - Extended `npm run security:runtime:local`, `npm run security:runtime:staging`, and `npm run security:runtime:staging:evidence` so Console header evidence must include cross-origin opener policy before local or deployed runtime header proof is trusted.
  - Extended `npm run security:headers-policy` and fixture-backed self-tests to reject missing Console cross-origin opener policy in config, runtime scripts, staging runtime scripts, staging evidence validation, and docs.
  - Marked `Add FanPass Console cross-origin opener policy coverage to static, local runtime, staging runtime, and staging evidence header gates` complete and updated the QA, roadmap, provider-cost, Alpha runbook, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:runtime:local:self-test`
    - `scripts/with-node-22.sh npm run security:runtime:staging:self-test`
    - `scripts/with-node-22.sh npm run security:runtime:staging:evidence:self-test`
    - `scripts/with-node-22.sh npm run security:headers-policy:self-test`
    - `scripts/with-node-22.sh npm run security:headers-policy`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Dependency Risk Evidence Deployment Credential Redaction on 2026-05-30:
  - Extended `npm run security:dependency-risk:evidence` so future saved dependency closeout or unresolved-advisory closed-beta risk acceptance evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
  - Required dependency-risk evidence to prove `"deploymentCredentialsAvailable": false` and `"redaction": { "deploymentCredentialsRedacted": true }` before clean closeout or owner-approved closed-beta risk acceptance evidence can be trusted.
  - Added fixture-backed `npm run security:dependency-risk:evidence:self-test` coverage for dependency-risk evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
  - Marked `Add deployment/cloud credential leakage coverage to the dependency risk evidence validator` complete and updated the QA, roadmap, dependency risk evidence, dependency advisory, provider-cost, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:dependency-risk:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Apple Wallet Evidence Deployment Credential Redaction on 2026-05-30:
  - Extended `npm run security:apple-wallet:evidence` so future saved signed Apple Wallet `.pkpass` evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
  - Required Wallet evidence to prove `"deploymentCredentialsAvailable": false` and `"redaction": { "deploymentCredentialsRedacted": true }` before signed `.pkpass` blockers can be closed.
  - Added fixture-backed `npm run security:apple-wallet:evidence:self-test` coverage for Wallet evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
  - Marked `Add deployment/cloud credential leakage coverage to the signed Apple Wallet evidence validator` complete and updated the QA, roadmap, Wallet evidence, provider-cost, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:apple-wallet:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After FanPass Ops Scanner Evidence Deployment Credential Redaction on 2026-05-30:
  - Extended `npm run security:ops-scanner:device-evidence` so future saved physical FanPass Ops QR/NFC evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
  - Required scanner evidence to prove `"runtime": { "deploymentCredentialsAvailable": false }` and `"redaction": { "deploymentCredentialsRedacted": true }` before physical QR/NFC validation blockers can be closed.
  - Added fixture-backed `npm run security:ops-scanner:device-evidence:self-test` coverage for scanner evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
  - Marked `Add deployment/cloud credential leakage coverage to the physical FanPass Ops scanner evidence validator` complete and updated the QA, roadmap, Ops scanner evidence, provider-cost, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ops-scanner:device-evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Chain Custody Evidence Deployment Credential Redaction on 2026-05-30:
  - Extended `npm run security:chain-custody:evidence` so future saved real-chain custody evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
  - Required chain custody evidence to prove `"deploymentCredentialsAvailable": false` and `"redaction": { "deploymentCredentialsRedacted": true }` before ASR-014 or pilot chain custody blockers can be closed.
  - Added fixture-backed `npm run security:chain-custody:evidence:self-test` coverage for chain custody evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
  - Marked `Add deployment/cloud credential leakage coverage to the chain custody evidence validator` complete and updated the QA, roadmap, chain custody evidence, provider-cost, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:chain-custody:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy Console React SDK Isolation Evidence Deployment Credential Redaction on 2026-05-30:
  - Extended `npm run security:privy-console-react-sdk:isolation` so future saved Console SDK isolation evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
  - Required Console SDK isolation evidence to prove `"deploymentCredentialsAvailable": false` and `"redaction": { "deploymentCredentialsRedacted": true }` before `@privy-io/react-auth` can be trusted for direct or isolated Console login integration.
  - Added fixture-backed `npm run security:privy-console-react-sdk:isolation:self-test` coverage for Console SDK isolation evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
  - Marked `Add deployment/cloud credential leakage coverage to the Privy Console React SDK isolation evidence validator` complete and updated the QA, roadmap, SDK isolation evidence, provider-cost, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:privy-console-react-sdk:isolation:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy Mobile App Config Evidence Deployment Credential Redaction on 2026-05-30:
  - Extended `npm run security:privy-mobile-app-config:evidence` so future saved native Privy app/client ID evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
  - Required Privy mobile app config evidence to prove `"deploymentCredentialsAvailable": false` and `"redaction": { "deploymentCredentialsRedacted": true }` before real iOS app/client IDs can be trusted for staging, beta, or TestFlight-style builds.
  - Added fixture-backed `npm run security:privy-mobile-app-config:evidence:self-test` coverage for mobile app config evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
  - Marked `Add deployment/cloud credential leakage coverage to the Privy mobile app config evidence validator` complete and updated the QA, roadmap, mobile config evidence, provider-cost, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:privy-mobile-app-config:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy Dashboard Plan Evidence Deployment Credential Redaction on 2026-05-30:
  - Extended `npm run security:privy-plan:evidence` so future saved Privy dashboard/plan evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
  - Required Privy plan evidence to prove `"deploymentCredentialsAvailable": false` and `"redaction": { "deploymentCredentialsRedacted": true }` before dashboard plan support evidence can be trusted.
  - Added fixture-backed `npm run security:privy-plan:evidence:self-test` coverage for Privy plan evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
  - Marked `Add deployment/cloud credential leakage coverage to the Privy dashboard plan evidence validator` complete and updated the QA, roadmap, Privy plan evidence, provider-cost, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:privy-plan:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Stripe Test-Mode Evidence Deployment Credential Redaction on 2026-05-30:
  - Extended `npm run security:stripe-testmode:evidence` so future saved real Stripe test-mode evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
  - Required Stripe test-mode evidence to prove `"deploymentCredentialsAvailable": false` and `"redaction": { "deploymentCredentialsRedacted": true }` before PaymentIntent, PaymentSheet, webhook, capture, cancellation, refund, or reconciliation evidence can be trusted.
  - Added fixture-backed `npm run security:stripe-testmode:evidence:self-test` coverage for Stripe evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
  - Marked `Add deployment/cloud credential leakage coverage to the Stripe test-mode evidence validator` complete and updated the QA, roadmap, Stripe evidence, provider-cost, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:stripe-testmode:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Staff Tenant Staging Evidence Deployment Credential Redaction on 2026-05-30:
  - Extended `npm run security:staff-tenant:staging-evidence` so future saved production-like tenant/staff evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
  - Required staff tenant staging evidence to prove `"runtime": { "deploymentCredentialsAvailable": false }` and `"redaction": { "deploymentCredentialsRedacted": true }` before production tenant/staff policy evidence can be trusted.
  - Added fixture-backed `npm run security:staff-tenant:staging-evidence:self-test` coverage for staff tenant evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
  - Marked `Add deployment/cloud credential leakage coverage to the staff tenant staging evidence validator` complete and updated the QA, roadmap, staff tenant evidence, provider-cost, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:staff-tenant:staging-evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After iOS Staging Build Evidence Deployment Credential Redaction on 2026-05-30:
  - Extended `npm run security:ios-staging-build:evidence` so saved signed iOS staging/TestFlight build evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
  - Required iOS build evidence to prove `"environment": { "deploymentCredentialsAvailable": false }` and `"redaction": { "deploymentCredentialsRedacted": true }` before signed staging/TestFlight build evidence can be trusted.
  - Added fixture-backed `npm run security:ios-staging-build:evidence:self-test` coverage for iOS build evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
  - Marked `Add deployment/cloud credential leakage coverage to the iOS staging/TestFlight build evidence validator` complete and updated the QA, roadmap, iOS build evidence, provider-cost, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ios-staging-build:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Staging Runtime Evidence Deployment Credential Redaction on 2026-05-30:
  - Extended `npm run security:runtime:staging:evidence` so saved deployed staging runtime evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
  - Required staging runtime evidence to prove `"deploymentCredentialsAvailable": false` and `"redaction": { "deploymentCredentialsRedacted": true }` before real staging header/config evidence can be trusted.
  - Added fixture-backed `npm run security:runtime:staging:evidence:self-test` coverage for staging evidence containing deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof.
  - Marked `Add deployment/cloud credential leakage coverage to the staging runtime evidence validator` complete and updated the QA, roadmap, deployment, provider-cost, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:runtime:staging:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Hosted CI Evidence Deployment Credential Redaction on 2026-05-30:
  - Extended `npm run security:ci-hosted:evidence` so saved hosted GitHub Actions evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
  - Required hosted CI evidence to prove deployment/cloud credentials were unavailable to the run and redacted from saved logs.
  - Added fixture-backed `npm run security:ci-hosted:evidence:self-test` coverage for hosted CI evidence containing deployment/cloud credential assignments, camel-case credential fields, and environment-map credential fields.
  - Marked `Add deployment/cloud credential leakage coverage to the hosted CI evidence validator` complete and updated the QA, roadmap, CI evidence, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ci-hosted:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Payment Response Redaction Audit on 2026-05-30:
  - Added `npm run security:payment-response-redaction` to lock payment response boundaries: only authenticated payer checkout intent responses may expose Stripe PaymentIntent client secrets, while admin payment operation responses, webhook responses, side-effect worker payloads, and Alpha operations snapshots stay redacted.
  - Added fixture-backed `npm run security:payment-response-redaction:self-test` coverage for admin operation response leakage, webhook response leakage, redacted mapper leakage, side-effect payload leakage, Alpha operations snapshot leakage, and missing composite verifier wiring.
  - Wired both payment response redaction checks into `npm run beta:foundation:verify` after the API/Console response privacy audit.
  - Marked `Add payment response redaction audit for client-secret and admin operation boundaries` complete and updated the QA, roadmap, provider-cost, and security-review docs.
  - Verification:
    - `scripts/with-node-22.sh npm run security:payment-response-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:payment-response-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Deployment Credential Environment Field Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw deployment and cloud credential JSON environment-map fields such as `"AWS_SECRET_ACCESS_KEY"`, `"VERCEL_TOKEN"`, and `"CLOUDFLARE_API_TOKEN"` in addition to existing provider, payment, token, cookie, HTTP header, deployment assignment, deployment camel-case field, database URL, identity, scanner secret, private-key/certificate, Apple signing, service URL, and staging/admin markers.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing Vercel, AWS, and Cloudflare credential environment-map fields.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence deployment/cloud credential environment-field redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Deployment Credential Field Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw deployment and cloud credential JSON fields such as AWS access/session keys, Google credential fields, Vercel tokens, GitHub tokens, Netlify tokens, and Cloudflare API token/key fields in addition to existing provider, payment, token, cookie, HTTP header, deployment assignment, database URL, identity, scanner secret, private-key/certificate, Apple signing, service URL, and staging/admin markers.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing Vercel, AWS, and Cloudflare credential fields.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence deployment/cloud credential field redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Deployment Credential Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw deployment and cloud credential assignments such as AWS access/session keys, Google service-account key JSON markers, Vercel tokens, GitHub tokens, Netlify tokens, and Cloudflare API tokens in addition to existing provider, payment, token, cookie, HTTP header, database URL, identity, scanner secret, private-key/certificate, Apple signing, service URL, and staging/admin markers.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing Vercel, AWS, and Cloudflare credential assignments.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence deployment/cloud credential redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Secret-Bearing HTTP Header Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw secret-bearing HTTP headers such as `X-API-Key`, auth/access/session/CSRF token headers, Privy token headers, and Stripe webhook signature headers in addition to existing provider, payment, token, cookie, database URL, identity, scanner secret, private-key/certificate, Apple signing, service URL, and staging/admin markers.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing an API-key header, CSRF token header, and Stripe signature header.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence secret-bearing HTTP header redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Auth Header And Cookie Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw Basic authorization headers and sensitive Cookie/Set-Cookie headers carrying session, JWT, token, auth, or CSRF values in addition to existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, service URL, and staging/admin markers.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a Basic auth header, a Console session cookie, and a CSRF cookie.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence auth header and cookie redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Credentialed Service URL Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject generic credentialed service URLs such as `scheme://user:password@host`, covering non-Postgres service URLs in addition to existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, and staging/admin markers.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a credentialed Redis-style URL.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence credentialed service URL redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Provider API-Key Field Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject provider API-key JSON fields such as `apiKey`, `providerApiKey`, `chainApiKey`, `rpcApiKey`, and common Alchemy/Infura/QuickNode/explorer API-key field names in addition to existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, and staging/admin markers.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing generic and Alchemy API-key JSON fields.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence provider API-key field redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence URL Query Secret Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject secret-bearing URL query parameters such as `access_token`, `id_token`, `client_secret`, `api_key`, signature, auth/session, and invite-token query values in addition to existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, and staging/admin markers.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing callback/provider URLs with token and client-secret query parameters.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence URL query secret redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence App Secret Field Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject app session/client/webhook-style secret JSON fields in addition to shell-style secret assignments and existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, and staging/admin markers.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing `sessionSecret`, `clientSecret`, and `webhookSecret` fields.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence app secret field redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence App Secret Assignment Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject app session/client/webhook-style secret assignments in addition to existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, and staging/admin markers.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing `SESSION_SIGNING_SECRET`, generic client-secret, and webhook-secret assignments.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence app secret assignment redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence FanPass Identifier Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw FanPass identity fields and raw ticket/event identifier fields in addition to existing provider, payment, token, database URL, identity, scanner secret, private-key/certificate, Apple signing, and staging/admin markers.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing raw staff, organizer, ticket, and event identifiers.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence FanPass identifier redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Scanner Secret Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject QR signing secret assignments, raw staff invite token fields, raw QR nonce fields, and raw signed payload fields in addition to existing provider, payment, token, database URL, identity, private-key, Apple signing, and staging/admin markers.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a QR signing secret, staff invite token, raw nonce, and signed payload.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence scanner/staff secret redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Identity Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject raw email addresses and raw EVM-style wallet addresses in addition to existing provider, payment, token, database URL, private-key, Apple signing, and staging/admin markers.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a raw staff email and wallet address.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence identity redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Apple Signing Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject Apple certificate blocks, signing material assignments, provisioning profile markers, and explicit device identifier assignments.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing Apple signing material and a device identifier.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence Apple signing/device redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence RPC Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject provider RPC URL assignments, raw Alchemy/Infura/QuickNode-style RPC URLs, and common chain provider API-key assignments.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a provider RPC URL and chain provider API key.
  - Updated the task, QA, roadmap, provider-cost, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence RPC/API-key redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Provider-Key Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject provider-secret/API-key assignments and raw `postgres://`/`postgresql://` database URLs, not only scoped provider tokens and `DATABASE_URL=` assignments.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a provider secret and raw database URL.
  - Updated the task, QA, roadmap, walkthrough evidence, and security-review docs to keep repository-wide saved-evidence provider-key/database URL redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Dependency Risk Evidence Provider-Key Redaction on 2026-05-30:
  - Extended `npm run security:dependency-risk:evidence` so future saved dependency closeout or unresolved-advisory risk acceptance evidence rejects provider-secret markers and raw `postgres://`/`postgresql://` URLs.
  - Added fixture-backed `npm run security:dependency-risk:evidence:self-test` coverage for dependency risk evidence containing a provider secret and raw database URL.
  - Updated the task, QA, roadmap, provider-cost, dependency risk evidence, advisory log, and security-review docs to keep dependency risk provider-key/database URL redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:dependency-risk:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy Mobile App Config Provider-Key Redaction on 2026-05-30:
  - Extended `npm run security:privy-mobile-app-config:evidence` so future saved native Privy app/client ID evidence rejects provider-secret markers, database URL assignments, and raw `postgres://`/`postgresql://` URLs.
  - Added fixture-backed `npm run security:privy-mobile-app-config:evidence:self-test` coverage for mobile app config evidence containing a provider secret and database URL, and required redaction proof for provider secrets and database URLs.
  - Updated the task, QA, roadmap, provider-cost, mobile app config evidence, and security-review docs to keep native Privy app config provider-key/database URL redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:privy-mobile-app-config:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After iOS Staging Build Provider-Key Redaction on 2026-05-30:
  - Extended `npm run security:ios-staging-build:evidence` so saved signed iOS staging/TestFlight build evidence rejects database URL assignments and raw `postgres://`/`postgresql://` URLs alongside Stripe publishable-key and signing/device markers.
  - Added fixture-backed `npm run security:ios-staging-build:evidence:self-test` coverage for iOS build evidence containing a raw database URL, and required redaction proof for provider secrets, Stripe publishable keys, and database URLs.
  - Updated the task, QA, roadmap, iOS build evidence, and security-review docs to keep iOS staging/TestFlight provider-key/database URL redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ios-staging-build:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy Console React SDK Isolation Provider-Key Redaction on 2026-05-30:
  - Extended `npm run security:privy-console-react-sdk:isolation` so future saved Console React SDK isolation evidence rejects Stripe publishable-key assignments, raw `pk_test_` keys, database URL assignments, and raw `postgres://`/`postgresql://` URLs.
  - Added fixture-backed `npm run security:privy-console-react-sdk:isolation:self-test` coverage for SDK isolation evidence containing a raw Stripe publishable key and database URL, and required redaction proof for provider secrets, Stripe publishable keys, and database URLs.
  - Updated the task, QA, roadmap, provider-cost, Privy Console React SDK isolation evidence, and security-review docs to keep SDK isolation evidence redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:privy-console-react-sdk:isolation:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Chain Custody Evidence Provider-Key Redaction on 2026-05-30:
  - Extended `npm run security:chain-custody:evidence` so future saved real-chain custody evidence rejects Stripe publishable-key assignments, database URL assignments, provider RPC URL assignments, raw `postgres://`/`postgresql://` URLs, and common chain-provider API-key markers.
  - Added fixture-backed `npm run security:chain-custody:evidence:self-test` coverage for custody evidence containing a raw Stripe publishable key, database URL, and provider RPC URL, and required redaction proof for provider secrets, Stripe publishable keys, database URLs, and RPC URLs.
  - Updated the task, QA, roadmap, provider-cost, chain custody evidence, and security-review docs to keep real-chain custody evidence redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:chain-custody:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Apple Wallet Evidence Provider-Key Redaction on 2026-05-30:
  - Extended `npm run security:apple-wallet:evidence` so future saved signed Apple Wallet `.pkpass` evidence rejects Stripe publishable-key assignments, database URL assignments, and raw `postgres://`/`postgresql://` URLs.
  - Added fixture-backed `npm run security:apple-wallet:evidence:self-test` coverage for Wallet evidence containing a raw Stripe publishable key and database URL, and required redaction proof for provider secrets, Stripe publishable keys, and database URLs.
  - Updated the task, QA, roadmap, provider-cost, Apple Wallet evidence, and security-review docs to keep signed Wallet evidence redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:apple-wallet:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Ops Scanner Device Evidence Provider-Key Redaction on 2026-05-30:
  - Extended `npm run security:ops-scanner:device-evidence` so future saved physical FanPass Ops QR/NFC evidence rejects Stripe publishable-key assignments, database URL assignments, and raw `postgres://`/`postgresql://` URLs.
  - Added fixture-backed `npm run security:ops-scanner:device-evidence:self-test` coverage for scanner evidence containing a raw Stripe publishable key and database URL, and required redaction proof for provider secrets, Stripe publishable keys, and database URLs.
  - Updated the task, QA, roadmap, provider-cost, Ops scanner evidence, and security-review docs to keep physical scanner evidence redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ops-scanner:device-evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Stripe Test-Mode Evidence Provider-Key Redaction on 2026-05-30:
  - Extended `npm run security:stripe-testmode:evidence` so future saved real Stripe test-mode evidence rejects provider-secret assignments, Stripe publishable-key assignments, database URL assignments, and raw `postgres://`/`postgresql://` URLs.
  - Added fixture-backed `npm run security:stripe-testmode:evidence:self-test` coverage for Stripe evidence containing a raw database URL, and required redaction proof for provider secrets and database URLs.
  - Updated the task, QA, roadmap, provider-cost, Stripe evidence, and security-review docs to keep Stripe test-mode evidence redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:stripe-testmode:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy Plan Evidence Provider-Key Redaction on 2026-05-30:
  - Extended `npm run security:privy-plan:evidence` so future saved Privy dashboard plan evidence rejects Stripe test publishable keys, `STRIPE_PUBLISHABLE_KEY=` assignments, Stripe webhook/client-secret markers, database URL assignments, and raw `postgres://`/`postgresql://` URLs.
  - Added fixture-backed `npm run security:privy-plan:evidence:self-test` coverage for Privy plan evidence containing a raw Stripe publishable key and database URL, and required redaction proof for provider secrets, Stripe publishable keys, and database URLs.
  - Updated the task, QA, roadmap, provider-cost, Privy plan evidence, and security-review docs to keep Privy dashboard plan evidence redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:privy-plan:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Staff Tenant Evidence Provider-Key Redaction on 2026-05-30:
  - Extended `npm run security:staff-tenant:staging-evidence` so future saved production-like tenant/staff evidence rejects Stripe test publishable keys, `STRIPE_PUBLISHABLE_KEY=` assignments, database URL assignments, and raw `postgres://`/`postgresql://` URLs.
  - Added fixture-backed `npm run security:staff-tenant:staging-evidence:self-test` coverage for tenant/staff evidence containing a raw Stripe publishable key and database URL, and required redaction proof for provider secrets, Stripe publishable keys, and database URLs.
  - Updated the task, QA, roadmap, provider-cost, staff tenant evidence, and security-review docs to keep tenant/staff evidence redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:staff-tenant:staging-evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy Mobile App Config Publishable-Key Redaction on 2026-05-30:
  - Extended `npm run security:privy-mobile-app-config:evidence` so future saved native app config evidence rejects Stripe test publishable keys and `STRIPE_PUBLISHABLE_KEY=` assignments, not only Stripe secrets or live publishable keys.
  - Added fixture-backed `npm run security:privy-mobile-app-config:evidence:self-test` coverage for mobile app config evidence containing a raw Stripe publishable key, and required `redaction.stripePublishableKeysRedacted`.
  - Updated the task, QA, roadmap, provider-cost, mobile app config evidence, and security-review docs to keep Privy mobile app config evidence redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:privy-mobile-app-config:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Dependency Risk Publishable-Key Redaction on 2026-05-30:
  - Extended `npm run security:dependency-risk:evidence` so saved dependency advisory closeout or risk-acceptance evidence rejects Stripe test publishable keys and `STRIPE_PUBLISHABLE_KEY=` assignments, not only Stripe secrets or live publishable keys.
  - Added fixture-backed `npm run security:dependency-risk:evidence:self-test` coverage for dependency risk evidence containing a raw Stripe publishable key, and required `redaction.stripePublishableKeysRedacted`.
  - Updated the task, QA, roadmap, dependency risk evidence, and security-review docs to keep dependency-risk evidence redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:dependency-risk:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After iOS Staging Build Publishable-Key Redaction on 2026-05-30:
  - Extended `npm run security:ios-staging-build:evidence` so saved signed iOS staging/TestFlight build evidence rejects Stripe test publishable keys and `STRIPE_PUBLISHABLE_KEY=` assignments, not only Stripe secrets or live publishable keys.
  - Added fixture-backed `npm run security:ios-staging-build:evidence:self-test` coverage for iOS build evidence containing a raw Stripe publishable key.
  - Updated the task, QA, roadmap, iOS build evidence, and security-review docs to keep iOS build evidence redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ios-staging-build:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Hosted CI Evidence Publishable-Key Redaction on 2026-05-30:
  - Extended `npm run security:ci-hosted:evidence` so saved hosted GitHub Actions evidence rejects Stripe publishable keys, PaymentIntent client secrets, broader `postgres://` and `postgresql://` database URL assignments, Privy access-token markers, bearer tokens, JWTs, private keys, staging admin token assignments, and the GitHub `secrets.*` context.
  - Added fixture-backed `npm run security:ci-hosted:evidence:self-test` coverage for hosted CI evidence containing a Stripe publishable key and raw `DATABASE_URL`.
  - Updated the task, QA, roadmap, and security-review docs to keep hosted CI evidence redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ci-hosted:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Staging Runtime Evidence Provider-Key Redaction on 2026-05-30:
  - Extended `npm run security:runtime:staging:evidence` so saved deployed staging runtime evidence rejects provider-key and database URL leakage, including Stripe secret/publishable keys, webhook secrets, PaymentIntent client secrets, Privy secret markers, bearer tokens, JWTs, private keys, and staging admin token assignments.
  - Added fixture-backed `npm run security:runtime:staging:evidence:self-test` coverage for staging runtime evidence containing a Stripe publishable key and raw `DATABASE_URL`.
  - Updated the task, QA, roadmap, and security-review docs to keep staging runtime evidence redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:runtime:staging:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Saved Evidence Stripe Publishable-Key Redaction on 2026-05-30:
  - Extended `npm run security:evidence-redaction` so generated `outputs/` evidence bundles reject Stripe publishable keys (`pk_test_` and `pk_live_`) as well as Stripe secret keys, webhook secrets, PaymentIntent client secrets, bearer tokens, JWTs, private keys, database URLs, Privy secret markers, and staging/admin token assignments.
  - Added fixture-backed `npm run security:evidence-redaction:self-test` coverage for saved evidence containing a Stripe publishable key.
  - Updated the task, QA, roadmap, walkthrough-evidence, and security-review docs to keep publishable-key redaction coverage explicit.
  - Verification:
    - `scripts/with-node-22.sh npm run security:evidence-redaction:self-test`
    - `scripts/with-node-22.sh npm run security:evidence-redaction`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy iOS Public Config Secret Guard on 2026-05-30:
  - Tightened `FanPassEnvironment.publicConfigValue` so Privy public app/client ID slots reject secret-like values, including bearer tokens, JWTs, private-key blocks, Privy app secrets, Privy verification keys, Stripe keys, webhook secrets, client secrets, and database URL markers.
  - Extended `npm run security:ios-distribution-boundaries` to require the Privy public-config secret guard and reject checked-in Privy app-secret markers in iOS xcconfig files.
  - Added fixture-backed iOS distribution audit self-test coverage for Privy app-secret config drift and runtime guard removal.
  - Extended `npm run security:privy-mobile-app-config:evidence` so future saved native app config evidence must prove `FanPassEnvironment` rejects secret-like values, not only empty or placeholder values.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ios-distribution-boundaries:self-test`
    - `scripts/with-node-22.sh npm run security:ios-distribution-boundaries`
    - `scripts/with-node-22.sh npm run security:privy-mobile-app-config:evidence:self-test`
    - `scripts/with-node-22.sh npm run alpha:verify:ios-boundaries`
    - `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -destination 'platform=iOS Simulator,name=FanPass-iPhone-17,OS=26.5' -configuration Debug build CODE_SIGNING_ALLOWED=NO`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Stripe iOS Publishable-Key Runtime Guard on 2026-05-30:
  - Tightened `FanPassEnvironment.stripePublishableKey` so the current Beta PaymentSheet path only accepts externally supplied `pk_test_` publishable keys and treats live, secret, placeholder, empty, or malformed values as unavailable.
  - Extended `npm run security:ios-distribution-boundaries` to reject checked-in Stripe publishable keys in iOS xcconfig files and to require the test publishable-key runtime guard in `FanPassEnvironment`.
  - Added fixture-backed iOS distribution audit self-test coverage for checked-in `pk_test_` drift and runtime guard removal.
  - Verification:
    - `scripts/with-node-22.sh npm run security:ios-distribution-boundaries:self-test`
    - `scripts/with-node-22.sh npm run security:ios-distribution-boundaries`
    - `scripts/with-node-22.sh npm run alpha:verify:ios-boundaries`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Stripe iOS PaymentSheet Evidence Contract Pass on 2026-05-30:
  - Extended `npm run security:stripe-testmode:evidence` so future saved real Stripe evidence must prove FanPass iOS native PaymentSheet was presented with a backend-issued PaymentIntent client secret and a redacted test publishable-key classification.
  - The validator now rejects leaked Stripe publishable keys, missing mobile-client proof, weak PaymentSheet proof that bypasses the backend client-secret boundary, local mock client-secret use, missing `fanpass-payments` return URL evidence, and missing FanPass Ops checkout-absence proof.
  - Extended `npm run security:stripe-testmode:evidence:self-test` with fixture coverage for those mobile PaymentSheet evidence requirements.
  - Verification:
    - `scripts/with-node-22.sh npm run security:stripe-testmode:evidence:self-test`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Dependency Tooling Audit Containment Gate on 2026-05-30:
  - Added `npm run security:dependency-tooling` to run the full workspace npm audit and enforce that high-severity findings remain confined to known Hardhat/contract-toolchain transitive dependencies.
  - Added `npm run security:dependency-tooling:self-test` with fixtures that reject critical advisories, unexpected high-severity packages, direct high-severity workspace dependencies, high findings outside the contract-tooling boundary, missing package scripts, missing composite verifier wiring, and missing advisory-log containment markers.
  - Wired both dependency tooling commands into `npm run beta:foundation:verify` after the dependency risk evidence self-test.
  - Verification:
    - `scripts/with-node-22.sh npm run security:dependency-tooling:self-test`
    - `scripts/with-node-22.sh npm run security:dependency-tooling`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Provider Lockfile Placement Guard on 2026-05-30:
  - Extended `npm run security:provider-boundaries` to validate provider package placement inside `package-lock.json` workspace package records, not only checked-in `package.json` manifests.
  - The lockfile guard checks direct workspace records such as `apps/api`, `apps/dashboard`, and shared/contract packages while ignoring legitimate `node_modules` transitive package entries.
  - Added fixture-backed provider-boundary self-test coverage for a package-lock drift case where `stripe` is added to the Dashboard workspace lockfile record.
  - Extended `npm run security:engineering-gates` and its fixture so lockfile placement validation and checked lockfile package output cannot be removed silently.
  - Verification:
    - `scripts/with-node-22.sh npm run security:provider-boundaries:self-test`
    - `scripts/with-node-22.sh npm run security:provider-boundaries`
    - `scripts/with-node-22.sh npm run security:engineering-gates:self-test`
    - `scripts/with-node-22.sh npm run security:engineering-gates`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Realtime/Payment Provider Placement Guard on 2026-05-30:
  - Extended `npm run security:provider-boundaries` to lock JavaScript Socket.IO server imports to the API realtime adapter/gateway/service and Socket.IO browser client imports to the Console live orderbook panel.
  - Added provider dependency placement checks for workspace `package.json` files so `stripe` remains an API dependency, `socket.io-client` remains a Console dependency or API verifier dev dependency, and direct `socket.io` declarations remain API-only.
  - Extended `npm run security:provider-boundaries:self-test` with rejected fixtures for misplaced Socket.IO client source, misplaced Stripe dependency declarations, and misplaced Socket.IO client dependency declarations.
  - Extended `npm run security:engineering-gates` and its fixture so the Socket.IO source boundaries and package placement rules cannot be removed silently.
  - Verification:
    - `scripts/with-node-22.sh npm run security:provider-boundaries:self-test`
    - `scripts/with-node-22.sh npm run security:provider-boundaries`
    - `scripts/with-node-22.sh npm run security:engineering-gates:self-test`
    - `scripts/with-node-22.sh npm run security:engineering-gates`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy React SDK Manifest Guard on 2026-05-30:
  - Extended `npm run security:provider-boundaries` to scan dependency manifests and lockfiles, not just source imports.
  - The audit now rejects `@privy-io/react-auth` in workspace `package.json` or `package-lock.json` files until Console SDK isolation evidence passes and the provider-boundary policy is intentionally updated.
  - Extended `npm run security:provider-boundaries:self-test` with a Dashboard package manifest fixture that adds `@privy-io/react-auth` and must fail.
  - Extended `npm run security:engineering-gates` and its fixture so the dependency-manifest scan and checked-manifest output cannot be removed silently.
  - Verification:
    - `scripts/with-node-22.sh npm run security:provider-boundaries:self-test`
    - `scripts/with-node-22.sh npm run security:provider-boundaries`
    - `scripts/with-node-22.sh npm run security:engineering-gates:self-test`
    - `scripts/with-node-22.sh npm run security:engineering-gates`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Privy React SDK Provider Boundary Guard on 2026-05-30:
  - Extended `npm run security:provider-boundaries` with a blocked-provider rule for `@privy-io/react-auth` across API, Dashboard, iOS, and shared source roots.
  - The guard rejects any in-workspace Privy React SDK import until `npm run security:privy-console-react-sdk:isolation -- <saved-json-output>` proves a clean direct dependency path or an isolated auth runtime boundary.
  - Extended `npm run security:provider-boundaries:self-test` with a Dashboard fixture that imports `@privy-io/react-auth` and must fail.
  - Extended `npm run security:engineering-gates` and its fixture so the global web Privy SDK block cannot be removed from provider-boundary policy without tripping the engineering gate.
  - Verification:
    - `scripts/with-node-22.sh npm run security:provider-boundaries:self-test`
    - `scripts/with-node-22.sh npm run security:provider-boundaries`
    - `scripts/with-node-22.sh npm run security:engineering-gates:self-test`
    - `scripts/with-node-22.sh npm run security:engineering-gates`
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- After Console Session Bridge Form on 2026-05-30:
  - Added `apps/dashboard/app/console-login-form.tsx` as a narrow, SDK-free FanPass Console session bridge UI for production-like locked Console screens.
  - The form accepts a Privy access token, posts it only to `POST /api/console/privy-session`, clears component state before sending, avoids browser storage/logging, and reloads after the HttpOnly session cookie is set.
  - Extended `npm run security:console-routes` and its fixture self-test to audit the Console login component in addition to Console route handlers and the server auth helper.
  - Added fixture rejections for missing session-bridge fetches, browser token storage, and direct `@privy-io/react-auth` imports in the Console login component.
  - Verified the locked Console page in production-like staging mode on a 390px mobile viewport; the Privy access token form and `Start session` action rendered with no horizontal overflow.
  - Verification:
    - `scripts/with-node-22.sh npm run security:console-routes:self-test`
    - `scripts/with-node-22.sh npm run security:console-routes`
    - `scripts/with-node-22.sh npm run typecheck -w apps/dashboard`
    - `scripts/with-node-22.sh npm exec -- prettier --check apps/dashboard/app/console-login-form.tsx apps/dashboard/app/page.tsx apps/dashboard/app/styles.css scripts/console-route-contract-audit.js scripts/console-route-contract-audit-self-test.js`
    - Playwright local render check at `http://localhost:3107/` with `FANPASS_ENV=staging`.
    - `scripts/with-node-22.sh npm run beta:foundation:verify`

- Created npm workspace monorepo.
- Added API with in-memory demo store:
  - `GET /health`
  - `GET /events`
  - `POST /events`
  - `POST /events/:eventId/ticket-types`
  - `GET /tickets`
  - `POST /tickets/issue`
  - `GET /tickets/owner/:ownerId`
  - `POST /orders`
  - `GET /orders/events/:eventId/ticket-types/:ticketTypeId/book`
  - `POST /verification/qr`
  - `POST /verification/redeem`
  - fan access task and score endpoints
- Added Prisma schema for Beta database design.
- Added Next.js dashboard and verified it renders against the API.
- Added Solidity contracts:
  - `FanPassTicket`
  - `FanPassSoulbound`
  - `RedemptionRegistry`
- Added SwiftUI iOS app source:
  - Events
  - Tickets
  - Marketplace
  - Fan Access
  - Auth
  - Profile
  - Staff Scanner source kept for later role-separated staff workflow, not shown in default fan tabs
- Generated Xcode project at:
  - `apps/ios/FanPass/FanPass.xcodeproj`
- Installed and configured Xcode 26.5.
- Installed iOS 26.5 Simulator runtime and created simulator:
  - `FanPass-iPhone-17`
- Built, installed, and launched the iOS app in the simulator.
- Added prototype fan registration/sign-in endpoints:
  - `POST /auth/register`
  - `POST /auth/login`
- Removed Scanner from the default C-side fan tab bar.
- Changed iOS fan app entry so signed-out users land on a browsable home screen, not a login wall.
- Added action-triggered auth sheet for checkout, wallet, market, fan access, and profile actions.
- Reworked the iOS UI from default `List` screens into custom ticketing-app cards, metrics, and panels.
- Defined FanPass Brand VI v0.2 before further UI expansion.
- Created Figma brand VI board:
  - https://www.figma.com/design/7ZSTtCLoLn3DMIGy4goKnX
  - Current page: `FanPass VI v0.2`
- Added brand documentation:
  - `docs/archive/brand-v0/BRAND_VI.md`
- Added shared brand token source:
  - `packages/shared/src/brand.ts`
- Added local SVG mark asset:
  - `assets/brand/fanpass-ticket-signal-mark.svg`
- Aligned iOS theme, dashboard CSS, shared tokens, and logo SVG with the VI v0.2 core palette.
- Added real iOS wallet QR generation from the signed backend payload.
- Added a wallet debug action to copy the signed scanner payload for local prototype testing.
- Added role-separated staff scanner presentation through the app deep link:
  - `fanpass://staff/scanner`
- Added `fanpass` URL scheme generation through XcodeGen.
- Originally extended the local QR payload default TTL to 300 seconds; current QR TTL is later constrained to a 30-second maximum by the 2026-06-10 dynamic QR refresh hardening pass.
- Added an AVFoundation QR camera scanner view inside the role-separated staff scanner workflow.
- Kept pasteboard payload input as the simulator/local QA fallback.
- Decided the long-term product split: FanPass, FanPass Ops, and FanPass Console.
- Added a separate `FanPassOps` iOS target in the XcodeGen project.
- Added `FanPass Ops` app shell with event selection, gate selection, scanner launch, and operational status.
- Refactored `ScannerView` to accept an injected API client and gate context instead of depending on fan `AppState`.
- Added `RedemptionResult` decoding so iOS shows backend `ACCEPTED` responses correctly instead of treating a successful non-empty response as a failure.
- Added `POST /prototype/reset` to reset the in-memory demo store and QR nonce state.
- Added prototype service scripts:
  - `npm run prototype:start`
  - `npm run prototype:stop`
  - `npm run prototype:verify`
- Added `docs/PROTOTYPE_RUNBOOK.md`.
- Added FanPass Console forms for creating events and ticket types.
- Removed the fan-app `fanpass://staff/scanner` product bridge now that `FanPassOps` covers scanner demo flow.
- Added `docs/ALPHA_PLAN.md` to define Alpha objectives, non-goals, product boundaries, lifecycle states, role permissions, data strategy, and acceptance gates.
- Reworked `docs/DEVELOPMENT_TASKS.md` into executable Alpha work slices:
  - Alpha 0 data foundation.
  - Alpha 1 FanPass Console.
  - Alpha 2 FanPass consumer app.
  - Alpha 3 FanPass Ops.
  - Alpha 4 ownership adapter and demo packaging.
- Started Alpha 0 data foundation:
  - Aligned API domain types and Prisma schema with Alpha ticket/order lifecycle states.
  - Added `TRANSFER_PENDING` ticket state.
  - Replaced prototype `FILLED` order state usage with Alpha `MATCHED` and `SETTLED`.
  - Added `PrismaService` and automatic Prisma Client generation before API dev/build.
  - Added shared session/role contract helpers.
  - Extracted matching logic from `OrdersController` into `OrderbookService`.
  - Added check-in records to the demo store.
  - `VerificationService` now records accepted and duplicate check-ins.
  - Added API Jest config and backend tests for one-ticket orderbook priority and redemption replay rejection.
- Continued Alpha 0 service boundary work:
  - Added `AuditService`.
  - Added `EventsService`.
  - Added `TicketsService`.
  - Added `FanAccessService`.
  - Updated events, tickets, and fan access controllers to delegate to services.
  - Updated `OrderbookService` to use ticket lifecycle and audit service boundaries.
  - Updated `VerificationService` to use ticket lifecycle and audit service boundaries.
  - Updated auth audit writes to use `AuditService`.
  - Fixed `/tickets/owner/:ownerId` route ordering so it is not captured by `/tickets/:id`.
  - Added ticket lifecycle tests for issuance, resale listing blocks, and transfer-limit blocks.
  - Added fan access tests for auto-approval and event-scoped scoring.
  - API dev/build now remove stale `dist` before compiling, preventing Nest watch from launching old `dist/src/main.js` output.
- Continued Alpha 0 persistence setup:
  - Added shared deterministic seed data in `apps/api/src/common/demo-seed.ts`.
  - Updated `DemoStore` to seed from the shared seed data.
  - Added Prisma Alpha seed script at `apps/api/prisma/seed-alpha.ts`.
  - Added root `npm run alpha:db:reset`.
  - Added `AlphaPersistenceService` and `GET /alpha/persistence/status`.
  - Added `docs/ALPHA_RUNBOOK.md`.
  - Installed Homebrew `postgresql@16` because Docker is not available in this shell.
  - Started `postgresql@16`, created the `fanpass` role/database, and seeded the Alpha DB.
- Continued Alpha 0 Prisma service paths:
  - `AuditService` can write/list through Prisma when `FANPASS_DATA_SOURCE=prisma`.
  - `EventsService` can list/get/create events and create ticket types through Prisma when `FANPASS_DATA_SOURCE=prisma`.
  - `TicketsService` can list/get/issue tickets and list owned tickets through Prisma when `FANPASS_DATA_SOURCE=prisma`.
  - `FanAccessService` can list tasks, submit tasks, and compute scores through Prisma when `FANPASS_DATA_SOURCE=prisma`.
  - Added `npm run alpha:verify:prisma`.
  - Updated API package start entry to `dist/src/main.js`.
- Continued Alpha 0 Prisma lifecycle paths:
  - `OrderbookService` can create sell/buy orders, match one-ticket trades, update ticket ownership/status, create trades, and write audit logs through Prisma when `FANPASS_DATA_SOURCE=prisma`.
  - `VerificationService` can generate signed QR payloads, redeem tickets, persist accepted/duplicate check-ins, update ticket redemption state, and write audit logs through Prisma when `FANPASS_DATA_SOURCE=prisma`.
  - `GET /alpha/persistence/status` now reports order, trade, check-in, and fan task submission counts in addition to seed counts.
  - `npm run alpha:verify:prisma` now verifies orderbook match, QR redemption, duplicate rejection, trade persistence, check-in persistence, and audit persistence.
- Started Alpha 1 Console operations:
  - Added `GET /alpha/operations` for normalized persistent operations data.
  - FanPass Console now shows Alpha data layer status, ticket inventory with owner/transferability/redemption state, persistent orders, settled trades, gate check-ins, fan access submissions, and audit logs.
  - Renamed dashboard metadata and visible product copy to `FanPass Console`.
  - Added denser operational table styling and responsive layout support.
- Completed the main Alpha 1 Console operations slice:
  - Added `POST /alpha/events` and `POST /alpha/events/:eventId/ticket-types` so Console inventory creation writes directly to Prisma.
  - Extended `GET /alpha/operations` with event inventory, normalized market data, orderbook levels, recent trades, and price history.
  - Console now renders role-aware workspace navigation for Organizer/Admin areas.
  - Console now uses `cache: "no-store"` for API reads so operational state does not go stale after Prisma lifecycle changes.
  - Updated `npm run alpha:verify:prisma` to verify Alpha inventory creation and price history in addition to the existing order/trade/redemption/check-in/audit flow.
- Started Alpha 2 FanPass consumer app:
  - Added API client models and methods for orderbook snapshots, one-ticket order creation, fan access tasks, task submission, and fan score.
  - Added event detail view with ticket types, face value, resale cap, transfer policy, market context, and buy action auth gate.
  - Expanded ticket wallet cards with event context, ticket type, lifecycle state, entry readiness, transfer policy, and ownership history.
  - Rebuilt the marketplace screen around live event/orderbook data, fan-readable price context, a simple price chart, orderbook levels, and one-ticket buy/list actions.
  - Rebuilt Fan Access around live tasks, task submission, and score/eligibility status.
  - Verified default FanPass tab navigation remains Events, Tickets, Market, Access, Profile with no scanner/admin/organizer controls.

## Verified

Commands that passed:

```bash
npm run build --workspaces --if-present
npm run typecheck --workspaces --if-present
npm run test -w packages/contracts
xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -destination 'platform=iOS Simulator,name=FanPass-iPhone-17,OS=26.5' -configuration Debug build CODE_SIGNING_ALLOWED=NO
```

Also verified with XcodeBuildMCP:

```bash
build_run_sim CODE_SIGNING_ALLOWED=NO
```

After Brand VI v0.2 token updates, the workspace build/typecheck and XcodeBuildMCP simulator build/run passed again on 2026-05-27.

After the QR/scanner prototype update on 2026-05-27:

- API restarted and returned healthy at `http://localhost:4000/health`.
- `npm run build --workspaces --if-present` passed.
- `npm run typecheck --workspaces --if-present` passed.
- XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` passed.
- iOS wallet generated a real QR image for `tkt_demo_001`.
- Wallet copied the signed QR payload into the simulator pasteboard.
- `fanpass://staff/scanner` opened the staff scanner outside the C-side fan tabs.
- Staff scanner exposed `Scan QR`, `Paste`, and `Redeem` actions.
- Tapping `Scan QR` on simulator triggered camera permission and then showed the expected no-camera fallback.
- Staff scanner pasted the payload and redeemed it as `Accepted`.
- A second redeem of the same payload returned `Rejected`.
- Post-build simulator launch opened the guest-browsable home screen, not a login wall.
- The default fan tab bar still does not expose the staff scanner.
- QA screenshots captured:
  - `/tmp/fanpass-real-qr.png`
  - `/tmp/fanpass-staff-scanner-open.png`
  - `/tmp/fanpass-redeem-accepted.jpg`
  - `/tmp/fanpass-redeem-duplicate-rejected.jpg`
  - `/tmp/fanpass-camera-scanner-simulator.jpg`

After the FanPass Ops target update on 2026-05-27:

- XcodeGen regenerated `FanPass.xcodeproj` with schemes for `FanPass` and `FanPassOps`.
- `npm run build --workspaces --if-present` passed.
- `npm run typecheck --workspaces --if-present` passed.
- XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` passed for `FanPassOps`.
- XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` passed again for `FanPass`.
- `FanPassOps` launched as bundle id `com.fanpass.ops`.
- `FanPassOps` loaded API events and showed `ONLINE`.
- `FanPassOps` opened the scanner with gate context.
- Cleaned stale API dev processes so only one process listens on port 4000.
- API curl verification returned `201` with `result: "ACCEPTED"`.
- `FanPassOps` paste/redeem flow showed `Accepted` on first redemption.
- A second redeem of the same payload showed `Rejected`.
- Post-build `FanPass` launch still opened the guest-browsable fan home, with no staff scanner in default navigation.
- QA screenshots captured:
  - `/tmp/fanpass-ops-home.jpg`
  - `/tmp/fanpass-ops-redeem-accepted.jpg`
  - `/tmp/fanpass-ops-redeem-duplicate-rejected.jpg`

After the Technical Prototype close-out on 2026-05-27:

- Added a reproducible runbook at `docs/PROTOTYPE_RUNBOOK.md`.
- Added `POST /prototype/reset`.
- Added `prototype:start`, `prototype:stop`, and `prototype:verify` npm scripts.
- FanPass Console can create demo events and add ticket types.
- Fan app no longer registers the `fanpass://staff/scanner` deep link.
- Staff scanner demo path is `FanPassOps`.
- `npm run build --workspaces --if-present` passed.
- `npm run typecheck --workspaces --if-present` passed.
- `npm run test -w packages/contracts` passed.
- `npm run prototype:start` passed.
- `npm run prototype:verify` passed.
- XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` passed for `FanPass`.
- XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` passed for `FanPassOps`.
- Chrome/Playwright Console smoke test passed:
  - Create Event form visible.
  - Add Ticket Type form visible.
  - Creating `FanPass Live Test` event succeeds.
  - Adding a ticket type succeeds.
- Close-out screenshots captured:
  - `/tmp/fanpass-console-closeout.png`

After Alpha 0 foundation start on 2026-05-27:

- `npm run test -w apps/api` passed.
- `DATABASE_URL=postgresql://fanpass:fanpass@localhost:5432/fanpass npx prisma validate --schema apps/api/prisma/schema.prisma` passed.
- `npm run build --workspaces --if-present` passed.
- `npm run typecheck --workspaces --if-present` passed.
- `npm run prototype:start` passed.
- `npm run prototype:verify` passed.
- Prototype backend lifecycle still works after order status and orderbook service changes:
  - sell order created;
  - buy order matched;
  - trade settled;
  - QR generated;
  - first redemption accepted;
  - duplicate redemption rejected.

After Alpha 0 service boundary continuation on 2026-05-27:

- `npm run test -w apps/api` passed.
- `npm run typecheck -w apps/api` passed.
- `npm run build --workspaces --if-present` passed.
- `npm run prototype:verify` passed.
- Full prototype lifecycle still works after controller-to-service refactors.
- `/tickets/owner/:ownerId` route was checked after reordering.

After Alpha 0 persistence setup on 2026-05-27:

- `brew install postgresql@16` completed because Docker is not available in this environment.
- `brew services start postgresql@16` completed.
- Local Postgres role/database were created:
  - user: `fanpass`
  - database: `fanpass`
  - password: `fanpass`
- `npm run alpha:db:reset` passed.
- Alpha DB seed result:
  - users: 4
  - events: 1
  - tickets: 1
  - fanTasks: 2
- `GET /alpha/persistence/status` returned `ok: true` with Prisma counts:
  - users: 4
  - events: 1
  - ticketTypes: 1
  - tickets: 1
  - fanTasks: 2
  - auditLogs: 1
- `npm run test -w apps/api` passed.
- `npm run typecheck -w apps/api` passed.
- `npm run build --workspaces --if-present` passed.
- `npm run prototype:verify` passed.

After Alpha 0 Prisma service path setup on 2026-05-27:

- `npm run alpha:verify:prisma` passed.
- The Prisma verification script starts a temporary API on `http://localhost:4100` with `FANPASS_DATA_SOURCE=prisma`.
- It verified:
  - `GET /alpha/persistence/status`;
  - `GET /events`;
  - `GET /tickets/owner/usr_fan_demo`;
  - `POST /fan-access/tasks/task_quiz_demo/submissions`;
  - `GET /fan-access/events/evt_weekend_demo/users/usr_fan_demo/score`;
  - Prisma audit log count increased after the fan access submission.
- `npm run test -w apps/api` passed.
- `npm run typecheck --workspaces --if-present` passed.
- `npm run build --workspaces --if-present` passed.
- `npm run prototype:start && npm run prototype:verify` passed when run after build completed.
- Note: do not run `npm run build --workspaces --if-present` and `npm run prototype:start` in parallel because API build intentionally removes `apps/api/dist`.

After Alpha 0 Prisma lifecycle path setup on 2026-05-27:

- `npm run alpha:verify:prisma` passed with full persistent lifecycle:
  - event loaded from Prisma;
  - owned ticket loaded from Prisma;
  - fan access task submission persisted;
  - fan score calculated from Prisma;
  - sell order created;
  - buy order matched;
  - trade persisted;
  - buyer ownership persisted;
  - QR generated from Prisma ticket ownership;
  - first redemption accepted and persisted;
  - duplicate redemption rejected and persisted as a duplicate check-in.
- Alpha Prisma verification summary included:
  - `redeem: "ACCEPTED"`
  - `duplicate: "QR nonce has already been used"`
  - `checkins: 2`
  - `auditLogs: 8`
- `npm run test -w apps/api` passed.
- `npm run test -w packages/contracts` passed, with the existing Node 25 Hardhat warning.
- `npm run typecheck --workspaces --if-present` passed.
- `npm run build --workspaces --if-present` passed.
- `npm run prototype:start && npm run prototype:verify` passed.

Manual API flow verified:

1. Create sell order for `tkt_demo_001`.
2. Create matching buy order.
3. Trade settles.
4. Ticket owner changes.
5. QR payload is generated.
6. First redemption is accepted.
7. Duplicate redemption is rejected.

Dashboard verified with Playwright at:

`http://localhost:3000`

After Alpha 1 Console operations start on 2026-05-27:

- `npm run typecheck -w apps/api` passed.
- `npm run typecheck -w apps/dashboard` passed.
- `npm run build -w apps/api` passed.
- `npm run build -w apps/dashboard` passed.
- `npm run alpha:verify:prisma` passed.
- `npm run prototype:start` passed.
- `npm run prototype:verify` passed.
- Playwright verified `http://localhost:3000` renders with page title `FanPass Console`, no browser console errors, and visible ticket transfer state, Alpha Orders, Alpha Trades, Gate Check-ins, Fan Access Review, and Audit Log sections.
- Full-page Console screenshot captured:
  - `output/playwright/fanpass-console-alpha-ops-full.png`

After Alpha 1 Console operations completion on 2026-05-27:

- `npm run typecheck -w apps/api` passed.
- `npm run typecheck -w apps/dashboard` passed.
- `npm run build -w apps/api` passed.
- `npm run build -w apps/dashboard` passed with no warnings after replacing `align-items: end` with `flex-end`.
- `npm run alpha:verify:prisma` passed and now reports:
  - `alphaEvents: 2`
  - `priceHistory: 1`
  - `checkins: 2`
  - `auditLogs: 10`
- `npm run prototype:start` passed.
- `npm run prototype:verify` passed.
- Playwright desktop verified `http://localhost:3000` renders `FanPass Console`, the Organizer/Admin nav, persisted Alpha event inventory, orderbook market summary, price history, recent trade, and no browser console errors.
- Playwright mobile viewport `390x844` verified the same page content remains reachable and no browser console errors appear.
- Full-page Console screenshot captured:
  - `output/playwright/fanpass-console-alpha-market-full.png`

After Alpha 2 FanPass consumer app start on 2026-05-27:

- XcodeBuildMCP defaults were switched back from `FanPassOps` to `FanPass`.
- XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` passed for scheme `FanPass`.
- `npm run prototype:verify` passed after the Swift changes.
- Simulator visual QA verified:
  - signed-out launch still opens browsable Events home;
  - event cards navigate to event detail;
  - Buy on event detail opens the auth sheet instead of requiring launch-time login;
  - Continue as demo fan dismisses auth;
  - Market tab renders live market context, price chart, orderbook state, and trade action area;
  - default fan tabs do not expose scanner, gate, organizer, or admin controls.
- QA screenshots captured:
  - `output/ios/fanpass-alpha2-home.jpg`
  - `output/ios/fanpass-alpha2-event-detail.jpg`
  - `output/ios/fanpass-alpha2-auth-gate.jpg`
  - `output/ios/fanpass-alpha2-market.jpg`

After Alpha 2 marketplace closure on 2026-05-27:

- Added API support for `GET /orders/users/:userId` and `POST /orders/:orderId/cancel`.
- Order cancellation now checks ownership, only cancels `OPEN` orders, sets remaining quantity to `0`, and releases listed sell tickets back to an owned state.
- Prisma cancellation is transactional and writes an `ORDER_CANCELLED` audit log.
- Updated `npm run alpha:verify:prisma` to verify user order listing, cancellation, ticket release, and audit growth.
- Updated FanPass iOS Market:
  - primary trade actions now appear above orderbook/price context on small screens;
  - signed-out private trade actions still open the auth sheet;
  - signed-in fans can create a one-ticket buy order;
  - user orders display open/cancelled/settled states;
  - open orders expose a Cancel action.
- Verification passed:
  - `npm run typecheck -w apps/api`
  - `npm run test -w apps/api`
  - `npm run alpha:verify:prisma`
  - `npm run typecheck --workspaces --if-present`
  - `npm run build --workspaces --if-present`
  - `npm run test --workspaces --if-present`
  - `npm run prototype:start`
  - `npm run prototype:verify`
- Local services are running in detached `screen` sessions:
  - API: `http://localhost:4000` (`82272.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`82275.fanpass-dashboard`)
- Final curl checks after the last restart returned:
  - `http://localhost:3000/` -> `200 text/html`
  - `http://localhost:4000/health` -> `200 application/json`
- `npm audit --omit=dev --audit-level=low` still fails with 4 moderate production advisories:
  - `postcss <8.5.10` through Next;
  - `ws 8.0.0 - 8.20.0` through ethers.
    Do not run the suggested `npm audit fix --force` casually because it proposes breaking dependency changes.
  - `npm run prototype:verify`
  - XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` for `FanPass`
- Simulator smoke QA verified:
  - signed-out Market Buy opens the auth sheet;
  - Continue as demo fan returns to the market;
  - signed-in Buy opens a visible bid in the orderbook;
  - Cancel changes status text to `Buy order cancelled.` and clears the open orderbook bid;
  - fan tabs remain Events, Tickets, Market, Access, Profile with no staff/admin controls.
- New QA screenshots captured:
  - `output/ios/fanpass-alpha2-market-actions.jpg`
  - `output/ios/fanpass-alpha2-market-auth-gate.jpg`
  - `output/ios/fanpass-alpha2-market-cancelled.jpg`

After Alpha 2 VI consistency closure on 2026-05-27:

- Updated the auth sheet to use `FanPassScreen`, the v0.2 wordmark treatment, verified/fair-access status pills, and a single SoftCard form.
- Auth sheets now present at the large detent so primary account actions are visible without cramped medium-sheet clipping.
- Updated Profile to use the ticket-signal mark language, v0.2 status pills, and a stable single-line middle-truncated wallet address.
- XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` passed after the VI pass.
- New QA screenshots captured:
  - `output/ios/fanpass-alpha2-auth-vi.jpg`
  - `output/ios/fanpass-alpha2-profile-vi.jpg`

After Alpha 3 FanPass Ops verification closure on 2026-05-27:

- Added `GET /verification/events/:eventId/gates/:gate/checkins/summary`.
- Redemption failures now include a stable `result` enum in the API error body while preserving the human `message`.
- `npm run prototype:verify` now checks duplicate result enum plus gate accepted/rejected summary.
- `npm run alpha:verify:prisma` now checks duplicate result enum plus Prisma-backed gate accepted/rejected summary.
- Added `npm run alpha:verify:ios-boundaries` through `scripts/ios-role-boundary-smoke.sh`.
- Updated `FanPassOps`:
  - Ops home shows event/gate scoped accepted, rejected, and total check-ins;
  - Scanner shows the same gate counters;
  - Scanner clears payload after accepted/rejected redemption and exposes a `Next` reset action;
  - Scanner displays specific failure labels/copy for duplicate, expired, invalid, owner mismatch, not-active, cancelled, and generic error states;
  - Scanner still supports camera QR and paste fallback.
- Hardened product boundary:
  - `FanPass` target now explicitly excludes `FanPass/Features/Scanner`;
  - `FanPassOps` remains the scanner owner;
  - XcodeGen regenerated `FanPass.xcodeproj`.
- Fixed iOS date formatting for ISO strings with fractional seconds.
- Verification passed:
  - `npm run typecheck -w apps/api`
  - `npm run test -w apps/api`
  - `npm run alpha:verify:prisma`
  - `npm run prototype:verify`
  - `npm run alpha:verify:ios-boundaries`
  - XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` for `FanPassOps`
  - XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` for `FanPass`
- Simulator smoke QA verified:
  - `FanPassOps` home renders gate summary;
  - `FanPassOps` Scanner accepts a real pasted QR payload;
  - duplicate redemption shows `Duplicate` with explanatory copy;
  - accepted/rejected/total counts update to `1/1/2`;
  - returning to Ops home preserves the gate summary;
  - `FanPass` launches to guest event discovery and does not expose scanner/gate/admin controls.
- New QA screenshots captured:
  - `output/ios/fanpass-alpha3-ops-home.jpg`
  - `output/ios/fanpass-alpha3-scanner-ready.jpg`
  - `output/ios/fanpass-alpha3-scanner-accepted.jpg`
  - `output/ios/fanpass-alpha3-scanner-duplicate.jpg`
  - `output/ios/fanpass-alpha3-ops-summary.jpg`
  - `output/ios/fanpass-alpha3-ops-summary-formatted.jpg`

After Alpha 4 ownership adapter closure on 2026-05-27:

- Added `OwnershipService` with `MockOwnershipAdapter` and `TestnetOwnershipAdapter`.
- Default ownership mode is `mock`; local demo does not require chain RPC, private keys, or deployed contracts.
- Testnet mode is behind:
  - `OWNERSHIP_ADAPTER=testnet`
  - `TESTNET_RPC_URL`
  - `TESTNET_OPERATOR_PRIVATE_KEY`
  - `FANPASS_TICKET_CONTRACT_ADDRESS`
- Testnet adapter uses the `FanPassTicket` ABI for:
  - `mintTicket(...)` during ticket issuance;
  - `transferFrom(...)` during resale settlement;
  - `redeem(...)` during accepted gate redemption.
- `TicketsService.issueTicket` now uses `OwnershipService.issueTicket` in both memory and Prisma paths.
- `OrderbookService` settled resale transfer now uses `OwnershipService.transferTicket` before mutating local/API ownership state.
- `VerificationService` accepted redemption now uses `OwnershipService.redeemTicket` before mutating ticket status.
- Ownership receipts are written into audit metadata as `ownershipAdapter`, `ownershipRef`, and `transactionHash`.
- Added `apps/api/test/ownership.service.spec.ts`.
- Updated prototype and Prisma verification scripts so `/tickets/issue` validates the ownership-adapter issuance path.
- Updated `docs/ALPHA_RUNBOOK.md` with ownership adapter configuration and current Alpha screenshot references.
- Verification passed:
  - `npm run typecheck -w apps/api`
  - `npm run test -w apps/api`
  - `npm run prototype:verify`
  - `npm run alpha:verify:prisma`
  - `npm run test -w packages/contracts`

After Alpha close-out verification on 2026-05-27:

- Full Alpha acceptance pass completed against the current workspace.
- Verification passed:
  - `npm run typecheck --workspaces --if-present`
  - `npm run build --workspaces --if-present`
  - `npm run test -w apps/api`
  - `npm run test -w packages/contracts`
  - `npm run prototype:verify`
  - `npm run alpha:verify:prisma`
  - `npm run alpha:verify:ios-boundaries`
  - XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` for `FanPass`
  - XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` for `FanPassOps`
- Console smoke passed against local services:
  - `http://localhost:4000/health` returned healthy;
  - `http://localhost:4000/alpha/persistence/status` returned Prisma counts for users, events, ticket types, tickets, orders, trades, check-ins, fan task submissions, and audit logs;
  - `http://localhost:3000` rendered `FanPass Console` with Alpha Data Layer, Inventory, Orderbook, Gate Check-ins, Fan Access Review, and Audit Log sections.
- Simulator visual smoke passed:
  - `FanPass` launches to guest-browsable event discovery with Events, Tickets, Market, Access, Profile tabs and no scanner/admin controls;
  - `FanPass Ops` launches separately with event selection, gate selection, check-in counters, and scanner entry.
- New close-out QA screenshots captured:
  - `output/ios/fanpass-alpha-closeout-fan-home.jpg`
  - `output/ios/fanpass-alpha-closeout-ops.jpg`

After Alpha completion/security review on 2026-05-27:

- Added `docs/ALPHA_SECURITY_REVIEW.md`.
- Alpha remains complete as a local demo baseline, but is explicitly not safe for public internet exposure or real-user data until critical/high security findings are fixed.
- Security priority is documented: user personal data and FanPass platform integrity have the same priority as product functionality.
- Main public-Beta blockers:
  - no production API auth/session enforcement;
  - no route-level role/ownership guards;
  - Console and Alpha admin endpoints are unauthenticated;
  - QR generation/redeem authority is not bound to authenticated fan/gate roles;
  - CORS is open with credentials enabled;
  - QR signing secret has a local fallback;
  - personal/operational data is overexposed;
  - settlement/redemption need stronger idempotency and concurrency controls;
  - dependency advisories remain unresolved.
- Removed Camera and NFC permission declarations from the consumer `FanPass` target; those permissions remain only in `FanPass Ops`.
- Regenerated `FanPass.xcodeproj` with XcodeGen.
- Verification passed:
  - `npm run alpha:verify:ios-boundaries`
- `npm audit --omit=dev` reported 4 moderate production dependency advisories.
- Full `npm audit` reported 39 total advisories, mostly in dev/contract tooling; do not run `npm audit fix --force` casually because it proposes breaking changes.

After Security Pass 1 on 2026-05-27:

- Added signed local API sessions through `AuthService`.
- `POST /auth/register` and `POST /auth/login` now return `accessToken` and `expiresAt`.
- Added `POST /auth/demo-session` for local simulator/demo sessions. It is disabled by default in `NODE_ENV=production` unless explicitly enabled.
- Added `FanPassAuthGuard`, `@Roles(...)`, and `@CurrentSession()`.
- Protected state-changing and private API routes:
  - event writes;
  - ticket list/owner/issue/detail;
  - order user list/create/match/cancel;
  - fan task submission and user score;
  - QR generation and redemption;
  - gate check-in summary;
  - Alpha persistence/operations/event/ticket-type endpoints;
  - prototype reset.
- Controllers now derive `userId` and `scannerUserId` from the verified session for protected actions instead of trusting client JSON.
- QR generation now requires a fan/admin session and checks fan ticket ownership.
- QR redemption now requires gate staff/admin and uses the authenticated scanner user.
- API startup now:
  - disables `x-powered-by`;
  - uses `FANPASS_CORS_ORIGINS` allowlist;
  - disables credentialed CORS;
  - adds JSON/urlencoded body limits;
  - enables `forbidNonWhitelisted` validation.
- FanPass iOS now stores returned `accessToken` in the in-memory session and attaches it to private API calls.
- FanPass Ops now gets a local gate staff demo session before loading protected check-in summaries or scanner redemption.
- FanPass Console server fetches now attach a server-side organizer bearer token, defaulting to local demo auth for local development.
- Added API tests for session token issue/verify, tamper rejection, and demo-auth disablement.
- Updated local verification scripts to use role-appropriate bearer tokens.
- Verification passed:
  - `npm run typecheck -w apps/api`
  - `npm run typecheck -w apps/dashboard`
  - `npm run test -w apps/api`
  - `npm run prototype:start`
  - `npm run prototype:verify`
  - `npm run alpha:verify:prisma`
  - `npm run typecheck --workspaces --if-present`
  - `npm run build --workspaces --if-present`
  - `npm run alpha:verify:ios-boundaries`
  - XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` for `FanPass`
  - XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` for `FanPassOps`
- Security smoke passed:
  - unauthenticated `POST /tickets/issue` returns `401`;
  - fan token cannot read another user's tickets and returns `403`;
  - gate staff token can read gate check-in summary and returns `200`.
- `npm audit --omit=dev` still reports 4 moderate production dependency advisories: `postcss` through Next and `ws` through ethers.

After local service recovery on 2026-05-28:

- User reported `localhost:3000` and `localhost:4000` were not usable.
- API on `http://localhost:4000/health` was healthy.
- FanPass Console on `http://localhost:3000` showed a Next.js runtime overlay:
  - `Cannot find module './901.js'`
  - Root cause was stale/inconsistent Next dev output under `apps/dashboard/.next`.
- Updated `scripts/prototype-start.sh` to remove `apps/dashboard/.next` before starting the dashboard dev server.
- Updated `scripts/prototype-start.sh` so it waits for both:
  - API health at `http://localhost:4000/health`;
  - Console HTML containing `FanPass Console` at `http://localhost:3000`.
- Restarted services in detached `screen` sessions:
  - `fanpass-api`
  - `fanpass-dashboard`
- Browser QA verified `http://localhost:3000/`:
  - page title is `FanPass Console`;
  - first viewport renders the Console dashboard;
  - `Alpha Data Layer` is visible;
  - no Next.js error overlay;
  - no browser console errors or warnings.
- Curl verified `http://localhost:4000/health` returns `200`.
- `npm run prototype:verify` passed after the restart.

After Security Pass 2 on 2026-05-28:

- Added `apps/api/src/config/security-config.ts`.
- API startup now validates production-like configuration:
  - production-like means `NODE_ENV=production`, `FANPASS_ENV=production`, or `FANPASS_ENV=staging`;
  - `QR_SIGNING_SECRET` must be explicit, non-placeholder, and at least 32 characters;
  - wildcard/non-HTTPS CORS origins are rejected in production-like runtimes;
  - `FANPASS_ENABLE_DEMO_AUTH=true` is rejected in production-like runtimes;
  - TTL and rate-limit env values are range checked.
- `VerificationService` no longer allows the local QR signing fallback in production-like runtimes.
- `AuthService` uses the same production-like environment test for session secret and demo auth decisions.
- Added API Helmet headers and first-pass API rate limiting:
  - general API limit;
  - stricter `/auth` limit;
  - stricter `/verification` limit.
- Added FanPass Console security headers in `apps/dashboard/next.config.ts` and disabled `X-Powered-By`.
- Added `acceptedNonce` / `accepted_nonce` unique field to Prisma `Checkin` so accepted QR nonces are database-unique while rejected duplicate attempts can still be recorded.
- Added tests for production-like config rejection and QR secret enforcement.
- Verification passed:
  - `npm run prisma:generate -w apps/api`
  - `npm run typecheck -w apps/api`
  - `npm run typecheck -w apps/dashboard`
  - `npm run test -w apps/api`
  - `npm run alpha:verify:prisma`
  - `npm run typecheck --workspaces --if-present`
  - `npm run build --workspaces --if-present`
  - `npm run prototype:start`
  - `npm run prototype:verify`
- Runtime header checks passed:
  - `http://localhost:4000/health` returns Helmet headers and no Express powered-by header;
  - `http://localhost:3000` returns Console security headers and no `X-Powered-By: Next.js`;
  - Browser smoke confirmed `FanPass Console` renders with no framework overlay and no browser console errors.
- `npm audit --omit=dev --audit-level=low` still fails with 4 moderate production advisories:
  - `postcss <8.5.10` through Next;
  - `ws 8.0.0 - 8.20.0` through ethers.
    Do not run the suggested `npm audit fix --force` casually because it proposes breaking dependency changes.

After Security Pass 5 on 2026-05-28:

- Added event-scoped organizer access for FanPass Console operations in `AlphaPersistenceService`.
- Organizer sessions now only read events, tickets, orders, trades, check-ins, fan access submissions, and scoped audit rows for events owned by their linked `Organizer` profile.
- Admin sessions retain global operations visibility.
- Console event creation now attaches new events to the authenticated organizer profile. Admin-created Alpha events still attach to the first organizer until a dedicated admin organizer selector exists.
- Creating ticket types rejects events outside the authenticated organizer scope.
- Updated `scripts/alpha-prisma-verify.sh` to seed a second organizer/private event and fail if the default organizer can read or mutate that private event.
- Verification passed:
  - `npm run typecheck -w apps/api`
  - `npm run test -w apps/api`
  - `npm run alpha:verify:prisma`

After Security Pass 3 on 2026-05-28:

- Added backend Privy access-token verification in `apps/api/src/modules/auth/auth.service.ts`.
- Production-like auth now:
  - requires `PRIVY_APP_ID` and a PEM `PRIVY_VERIFICATION_KEY` at startup;
  - rejects local email/demo session issuance;
  - accepts protected API bearer tokens only when the Privy JWT is ES256 signed, has `iss=privy.io`, has `aud=PRIVY_APP_ID`, is unexpired, and maps `sub` to a FanPass user `privyId`.
- Local prototype mode still supports signed local sessions for the iOS simulator and Console demo.
- Added demo `privyId` values to the shared seed and Prisma seed path.
- Added API tests for Privy token verification and production-like local-token rejection.
- Verification passed:
  - `npm run typecheck -w apps/api`
  - `npm run test -w apps/api`
  - `npm run typecheck --workspaces --if-present`
  - `npm run build --workspaces --if-present`
  - `npm run test --workspaces --if-present`
  - `npm run alpha:verify:prisma`
  - `npm run prototype:start`
  - `npm run prototype:verify`
  - `curl` smoke checks for `http://localhost:3000/` and `http://localhost:4000/health`
- Local services are running in detached `screen` sessions:
  - API: `http://localhost:4000` (`78109.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`78112.fanpass-dashboard`)
- Final curl checks after the last restart returned:
  - `http://localhost:3000/` -> `200 text/html`
  - `http://localhost:4000/health` -> `200 application/json`
- `npm audit --omit=dev --audit-level=low` still fails with 4 moderate production advisories:
  - `postcss <8.5.10` through Next;
  - `ws 8.0.0 - 8.20.0` through ethers.
    Do not run the suggested `npm audit fix --force` casually because it proposes breaking dependency changes.

After Security Pass 6 on 2026-05-28:

- Added explicit gate assignment data for FanPass Ops authority:
  - memory seed includes `ga_demo_a1`;
  - Prisma schema now includes `GateAssignment` / `gate_assignments`;
  - Alpha seed writes the gate assignment.
- Seeded `usr_gate_demo` is assigned only to `evt_weekend_demo` gate `A1`.
- `VerificationService.redeem(...)` checks gate assignment before QR validation or ticket mutation when a session is present.
- `VerificationService.checkinSummary(...)` checks gate assignment for gate staff and organizer event ownership for organizers.
- Unassigned gate staff attempts are rejected with `403` and do not create check-in records.
- Updated API unit tests, `scripts/prototype-verify.sh`, and `scripts/alpha-prisma-verify.sh` to verify `A2` is rejected while `A1` still succeeds.
- Verification passed:
  - `npm run prisma:generate -w apps/api`
  - `npm run typecheck -w apps/api`
  - `npm run test -w apps/api`
  - `npm run alpha:verify:prisma`
  - `npm run typecheck --workspaces --if-present`
  - `npm run build --workspaces --if-present`
  - `npm run test --workspaces --if-present`
  - `npm run prototype:start`
  - `npm run prototype:verify`
- Local services are running in detached `screen` sessions:
  - API: `http://localhost:4000` (`86555.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`86558.fanpass-dashboard`)
- Final curl checks after the last restart returned:
  - `http://localhost:3000/` -> `200 text/html`
  - `http://localhost:4000/health` -> `200 application/json`
- `npm audit --omit=dev --audit-level=low` still fails with 4 moderate production advisories:
  - `postcss <8.5.10` through Next;
  - `ws 8.0.0 - 8.20.0` through ethers.
    Do not run the suggested `npm audit fix --force` casually because it proposes breaking dependency changes.

Security Pass 6 follow-up on 2026-05-28:

- Removed `scannerUserId` from the public `/verification/redeem` request contract and from the Swift Ops client call.
- Scanner identity is now derived only from the verified bearer session at the API boundary; the request body carries only the signed QR payload plus `gate`.
- Updated `scripts/prototype-verify.sh` and `scripts/alpha-prisma-verify.sh` so they no longer send client-supplied scanner identity.
- Updated `docs/ALPHA_RUNBOOK.md`, `docs/DEVELOPMENT_TASKS.md`, and `docs/ALPHA_SECURITY_REVIEW.md` to reflect that QR secret config, nonce uniqueness, and gate assignment checks are complete for the current Alpha hardening pass.
- Verification passed:
  - `npm run typecheck -w apps/api`
  - `npm run test -w apps/api`
  - XcodeBuildMCP `build_run_sim CODE_SIGNING_ALLOWED=NO` for `FanPassOps`
  - `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -destination 'platform=iOS Simulator,name=FanPass-iPhone-17,OS=26.5' -configuration Debug build CODE_SIGNING_ALLOWED=NO`
  - `npm run alpha:verify:prisma`
  - `npm run prototype:start && npm run prototype:verify`
- `npm audit --omit=dev --audit-level=low` was re-run and still fails with 4 moderate production advisories:
  - `postcss <8.5.10` through Next;
  - `ws 8.0.0 - 8.20.0` through ethers.
    Do not run the suggested `npm audit fix --force` casually because it proposes breaking dependency changes.
- Local services were restarted after the latest backend build and are running in detached `screen` sessions:
  - API: `http://localhost:4000` (`88789.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`88792.fanpass-dashboard`)
- Final curl checks after restart returned:
  - `http://localhost:3000/` -> `200 text/html`
  - `http://localhost:4000/health` -> `200 application/json`

After Security Pass 7 on 2026-05-28:

- Started order settlement hardening.
- Prisma `Trade` now enforces unique `buy_order_id` and `sell_order_id`, so a buy or sell order cannot produce multiple settled trades.
- Prisma settlement now:
  - returns an existing trade for duplicate settlement attempts;
  - atomically claims still-`OPEN` buy/sell orders and the `LISTED_FOR_RESALE` ticket before ownership transfer;
  - writes `ORDER_MATCHED` only after the claim succeeds;
  - marks matched orders `REJECTED`, restores the seller ticket state, and writes `TRADE_SETTLEMENT_FAILED` if the ownership adapter transfer fails;
  - creates the final trade only after ownership transfer returns successfully.
- `POST /orders` now accepts an optional `Idempotency-Key` header; same-user retries with the same order parameters return the existing order/trade, and key reuse with different order parameters is rejected.
- Updated `scripts/prototype-verify.sh` and `scripts/alpha-prisma-verify.sh` to verify idempotent buy-order retry behavior.
- Updated `scripts/alpha-prisma-verify.sh` to attempt a duplicate trade insert and fail unless Prisma returns the expected unique-constraint error.
- Verification passed:
  - `npm run prisma:generate -w apps/api`
  - `npm run typecheck -w apps/api`
  - `npm run test -w apps/api` (26 tests)
  - `npm run alpha:verify:prisma`
  - `npm run typecheck --workspaces --if-present`
  - `npm run prototype:start && npm run prototype:verify`
- Local services were restarted again after the latest backend build:
  - API: `http://localhost:4000` (`93239.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`93242.fanpass-dashboard`)
- Final curl checks after restart returned:
  - `http://localhost:3000/` -> `200 text/html`
  - `http://localhost:4000/health` -> `200 application/json`
- `npm audit --omit=dev --audit-level=low` still fails with 4 moderate production advisories:
  - `postcss <8.5.10` through Next;
  - `ws 8.0.0 - 8.20.0` through ethers.
    Do not run the suggested `npm audit fix --force` casually because it proposes breaking dependency changes.
- Remaining settlement hardening gaps before public Beta:
  - idempotency keys for future payment authorization and settlement retries;
  - durable outbox/saga for real payment and chain side effects;
  - production payment state reconciliation.

After Security Pass 8 on 2026-05-28:

- Reviewed API controller route coverage.
- Tightened ticket inventory authorization:
  - `TicketsController.listTickets(...)`, `getTicket(...)`, `listOwnedTickets(...)`, and `issueTicket(...)` now pass the verified session into `TicketsService`;
  - organizer sessions only see tickets for organizer-owned events;
  - organizer ticket detail reads reject tickets from another organizer's event;
  - organizer ticket issuance rejects events outside the organizer's scope;
  - ticket type/event mismatches now fail before issuing.
- Added API unit coverage for cross-organizer ticket inventory, detail, and issuance rejection.
- Extended `scripts/alpha-prisma-verify.sh` to reject cross-organizer `POST /tickets/issue` in Prisma mode.
- Investigated production dependency audit remediation:
  - `npm audit --omit=dev --audit-level=low` still fails with 4 moderate advisories;
  - latest Next currently still depends on `postcss@8.4.31`;
  - latest Ethers currently still depends on `ws@8.17.1`;
  - npm non-forced remediation has no safe patch path, and `npm audit fix --force` proposes breaking dependency changes.
- Verification passed:
  - `npm run typecheck -w apps/api`
  - `npm run test -w apps/api` (27 tests)
  - `npm run alpha:verify:prisma`
  - `npm run typecheck --workspaces --if-present`
  - `npm run test --workspaces --if-present`
  - `npm run build --workspaces --if-present`

After Security Pass 9 on 2026-05-28:

- Added explicit `@PublicRoute()` metadata for intentionally public API routes:
  - `GET /health`
  - local auth demo endpoints
  - public event browsing
  - public orderbook reads
  - public fan access task reads
- Added `apps/api/test/route-security.spec.ts`, which scans App, Auth, Events, Orders, Tickets, Verification, Fan Access, and Alpha controllers.
- The route security test now fails if any controller route is neither explicitly public nor protected by `FanPassAuthGuard` plus `@Roles(...)`.
- Restarted local prototype services after the Dashboard `.next` cache error:
  - API: `http://localhost:4000` (`98886.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`98889.fanpass-dashboard`)
- Final curl checks after restart returned:
  - `http://localhost:3000/` -> `200 text/html`
  - `http://localhost:4000/health` -> `200 application/json`
- Verification passed:
  - `npm run typecheck -w apps/api`
  - `npm run test -w apps/api` (28 tests)
  - `npm run alpha:verify:prisma`
  - `npm run typecheck --workspaces --if-present`
  - `npm run test --workspaces --if-present`
  - `npm run prototype:verify`

After Security Pass 10 on 2026-05-28:

- Added `scripts/security-runtime-check.sh`.
- Added root script `npm run security:runtime:local`.
- The local runtime check verifies:
  - API has baseline Helmet headers and no `x-powered-by`;
  - Console has configured response security headers and no `x-powered-by`.
- Verification passed:
  - `npm run security:runtime:local`

After Security Pass 11 on 2026-05-28:

- Made a dependency-audit architecture decision instead of only deferring the issue:
  - removed `ethers` from `apps/api/package.json` production dependencies;
  - changed `TestnetOwnershipAdapter` to dynamically load `ethers` only when `OWNERSHIP_ADAPTER=testnet` is explicitly used;
  - kept the default Alpha/local ownership path on `MockOwnershipAdapter`.
- Result: `npm audit --omit=dev --audit-level=low` dropped from 4 moderate production advisories to 2 moderate advisories.
- Remaining production audit advisories are only the Next/PostCSS chain:
  - `next@15.5.18 -> postcss@8.4.31`;
  - do not run `npm audit fix --force`, because it proposes a breaking Next downgrade.
- Verification passed:
  - `npm run typecheck -w apps/api`
  - `npm run test -w apps/api` (28 tests)
  - `npm run build -w apps/api`

After Security Pass 12 on 2026-05-28:

- Added Prisma `SideEffectOutbox` model mapped to `side_effect_outbox`.
- Added `SideEffectOutboxService`.
- Prisma order settlement now:
  - writes an `OWNERSHIP_TRANSFER` side-effect job during the claim transaction;
  - marks it `COMPLETED` after the local/mock ownership adapter returns;
  - marks it `FAILED` if the ownership adapter throws before restoring/rejecting the matched order pair.
- Alpha operations now include `sideEffects` for Console monitoring; organizer views do not receive side-effect payloads by default.
- FanPass Console now shows a Side Effects table and a Pending effects metric.
- Alpha seed/reset now clears `side_effect_outbox` so repeated verification runs stay deterministic.
- `alpha:verify:prisma` now checks for a completed ownership side-effect job and reports:
  - `sideEffects: 1`
  - `statusSideEffects: 1`
- Verification passed:
  - `npm run typecheck -w apps/api`
  - `npm run typecheck -w apps/dashboard`
  - `npm run test -w apps/api` (28 tests)
  - `npm run build -w apps/dashboard`
  - `npm run alpha:verify:prisma`
  - `npm run typecheck --workspaces --if-present`
  - `npm run test --workspaces --if-present`
  - `npm run build --workspaces --if-present`
  - `npm run prototype:start`
  - `npm run prototype:verify`
  - `npm run security:runtime:local`
- Current local services after restart:
  - API: `http://localhost:4000` (`6778.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`6781.fanpass-dashboard`)
- Final curl checks after restart returned:
  - `http://localhost:3000/` -> `200 text/html`
  - `http://localhost:4000/health` -> `200 application/json`
- `npm audit --omit=dev --audit-level=low` still reports 2 moderate advisories:
  - `postcss <8.5.10` through Next;
  - do not run `npm audit fix --force` because it proposes a breaking Next downgrade.

After Security Pass 13 on 2026-05-28:

- Added `SideEffectWorkerService`.
- Added `apps/api/src/workers/side-effect-worker-once.ts`.
- Added package script:
  - `npm run side-effects:work-once -w @fanpass/api`
- Added root verification script:
  - `npm run side-effects:verify`
- Worker behavior:
  - finds due `PENDING`/`RETRYING` jobs;
  - claims jobs by setting `PROCESSING`, `lockedAt`, and incrementing attempts;
  - dispatches `OWNERSHIP_TRANSFER` through `OwnershipService.transferTicket(...)`;
  - marks jobs `COMPLETED` with the ownership receipt;
  - marks failed jobs `RETRYING` with exponential backoff or `DEAD` after repeated failures.
- Order settlement outbox payload now includes source/destination wallet fields for future testnet/production use.
- Added API Jest coverage for worker success and retry paths.
- Verification passed:
  - `npm run side-effects:verify`
  - `npm run typecheck --workspaces --if-present`
  - `npm run test --workspaces --if-present` (API 30 tests, contracts 1 test)
  - `npm run build --workspaces --if-present`
  - `npm run alpha:verify:prisma`
  - `npm run prototype:start`
  - `npm run prototype:verify`
  - `npm run security:runtime:local`
- Current local services after restart:
  - API: `http://localhost:4000` (`9743.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`9746.fanpass-dashboard`)
- Final curl checks after restart returned:
  - `http://localhost:3000/` -> `200 text/html`
  - `http://localhost:4000/health` -> `200 application/json`
- `npm audit --omit=dev --audit-level=low` still reports 2 moderate advisories:
  - `postcss <8.5.10` through Next;
  - do not run `npm audit fix --force` because it proposes a breaking Next downgrade.

After Security Pass 14 on 2026-05-28:

- Added Stripe PaymentIntent backend foundation:
  - Prisma `Payment` rows now link users and orders;
  - `POST /payments/intents` requires fan/admin auth and `Idempotency-Key`;
  - repeated same-user payment requests with the same key return the original payment;
  - local development creates mock PaymentIntent ids/client secrets when Stripe is not configured;
  - production-like runtimes reject missing Stripe secrets when `FANPASS_ENABLE_PAYMENTS=true`.
- Added webhook handling:
  - `/payments/webhook` is mounted with raw body parsing before JSON parsing;
  - Stripe signature verification is used when `STRIPE_WEBHOOK_SECRET` is configured;
  - unsigned local JSON webhook simulation is allowed only outside production-like runtimes;
  - supported events update payment status/capture state and write audit logs.
- Extended durable side effects:
  - `PAYMENT_INTENT_CREATE` jobs are recorded and completed;
  - `SideEffectWorkerService` can dispatch payment intent jobs through `PaymentsService`;
  - Alpha operations expose redacted payment state and payment side-effect trails.
- Updated Alpha Prisma verification:
  - creates an unmatched buy order for payment preauthorization;
  - verifies payment idempotency;
  - simulates `payment_intent.amount_capturable_updated`;
  - verifies persisted payment counts, side-effect counts, and redacted Console visibility.
- Verification passed:
  - `npm run typecheck -w @fanpass/api`
  - `npm run test -w @fanpass/api` (32 tests)
  - `npm run alpha:verify:prisma`
  - `npm run side-effects:verify`
  - `npm run typecheck --workspaces --if-present`
  - `npm run test --workspaces --if-present` (API 32 tests, contracts 1 test)
  - `npm run build --workspaces --if-present`
  - `npm run prototype:start`
  - `npm run prototype:verify`
  - `npm run security:runtime:local`
- Current local services after restart:
  - API: `http://localhost:4000` (`13414.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`13417.fanpass-dashboard`)
- Final local checks after restart returned:
  - `http://localhost:3000/` -> `200 text/html` with `FanPass Console` content and no `Runtime Error`/`Cannot find module` marker;
  - `http://localhost:4000/health` -> `200 application/json`.
- `npm audit --omit=dev --audit-level=low` still reports 2 moderate advisories:
  - `postcss <8.5.10` through Next;
  - do not run `npm audit fix --force` because it proposes a breaking Next downgrade.
- Remaining payment gaps before real-money Beta:
  - client-side Stripe Payment Element or Checkout is not integrated yet;
  - capture, refund, cancellation, reconciliation, and webhook replay/idempotency handling still need production-grade design;
  - no real Stripe test keys were used in local verification.

After Privy Sync Pass on 2026-05-28:

- Added low-cost, non-webhook Privy account sync:
  - `POST /auth/privy/sync` is public but requires a valid Privy bearer access token;
  - the endpoint verifies Privy token signature and claims before touching FanPass user state;
  - first-time Privy users are created as `FAN` only;
  - organizer, gate staff, and admin accounts must be pre-linked by `privyId`;
  - client-provided role is not accepted anywhere in the sync flow;
  - first-time users cannot claim an existing FanPass account by submitting an existing email;
  - existing linked accounts keep their FanPass email and role.
- Added `FanPassAPIClient.syncPrivySession(...)` in the iOS shared API client so the future Privy Swift SDK integration can hand a token to the backend without spreading Privy-specific code through domain screens.
- Verification passed:
  - `npm run typecheck -w @fanpass/api`
  - `npm run test -w @fanpass/api` (35 tests)
  - `npm run typecheck --workspaces --if-present`
  - `npm run test --workspaces --if-present` (API 35 tests, contracts 1 test)
  - `npm run build --workspaces --if-present`
  - `npm run prototype:verify`
  - XcodeBuildMCP `build_sim CODE_SIGNING_ALLOWED=NO` for `FanPassOps`
  - `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -destination 'platform=iOS Simulator,name=FanPass-iPhone-17,OS=26.5' -configuration Debug build CODE_SIGNING_ALLOWED=NO`
- Remaining Privy product work:
  - install/configure Privy Swift SDK in FanPass and FanPass Ops;
  - install/configure Privy React SDK in FanPass Console;
  - confirm actual Privy dashboard plan support for mobile SDK, embedded wallets, custom UI, MFA/policy controls, and webhooks;
  - keep Privy webhooks optional until plan support is confirmed.

After Console Privy Session Bridge Pass on 2026-05-28:

- Added Console-side route handler:
  - `POST /api/console/privy-session` accepts a Privy access token from a future client login component;
  - it forwards the token to the API `POST /auth/privy/sync`;
  - it only sets a Console cookie if the synced FanPass role is `ORGANIZER` or `ADMIN`;
  - the cookie is HttpOnly, same-site, secure in production-like runtimes, and capped to the Privy token expiry or 55 minutes;
  - `DELETE /api/console/privy-session` clears the cookie.
- Updated Console server API access order:
  - `FANPASS_CONSOLE_ACCESS_TOKEN`;
  - HttpOnly `fanpass_console_access_token` cookie;
  - local demo session only outside production-like runtimes.
- Tested `@privy-io/react-auth` for Console login UI:
  - `@privy-io/react-auth@3.27.2` raised production audit from 2 moderate advisories to 25 moderate advisories via WalletConnect/MetaMask/Reown dependencies;
  - `@privy-io/react-auth@3.6.1` still left 18 moderate advisories;
  - non-forced `npm audit fix` made the overall workspace worse by introducing high-severity dev/contract-tooling advisories;
  - dependency was removed, and audit returned to the existing 2 moderate Next/PostCSS advisories.
- Decision: do not keep the Privy React SDK in the repo yet. The safe bridge is ready; the UI SDK is blocked until the dependency risk is resolved or isolated.
- Verification passed:
  - `npm run typecheck -w @fanpass/dashboard`
  - `npm run build -w @fanpass/dashboard`
  - `npm run test -w @fanpass/api` (35 tests)
  - `npm run typecheck --workspaces --if-present`
  - `npm run test --workspaces --if-present`
  - `npm run build --workspaces --if-present`
  - `npm run prototype:start`
  - `npm run prototype:verify`
  - `npm run security:runtime:local`
  - `POST http://localhost:3000/api/console/privy-session` without a token returned `400` with `Privy access token is required`
- Current local services after restart:
  - API: `http://localhost:4000` (`21820.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`21823.fanpass-dashboard`)
- `npm audit --omit=dev --audit-level=low` still reports 2 moderate advisories:
  - `postcss <8.5.10` through Next;
  - do not run `npm audit fix --force` because it proposes a breaking Next downgrade.

After Payment-Aware Settlement Pass on 2026-05-28:

- Added payment authorization gating for Prisma order settlement:
  - `FANPASS_REQUIRE_PAYMENT_AUTHORIZATION=true` makes matching skip buy orders unless the linked payment is `AUTHORIZED` or `CAPTURED`;
  - the memory prototype path remains unchanged unless that safety flag is explicitly enabled;
  - production-like startup rejects `FANPASS_ENABLE_PAYMENTS=true` unless the authorization gate is also enabled.
- Added webhook-to-settlement retry plumbing:
  - `payment_intent.amount_capturable_updated`/authorized payment state now enqueues `ORDER_MATCH_AFTER_PAYMENT_AUTH`;
  - `SideEffectWorkerService` dispatches that job through `OrderbookService.tryMatch(orderId)`;
  - the job is idempotent by `(orderId, paymentId)`;
  - Organizer Console side-effect visibility now includes scoped order-level side effects.
- Updated `scripts/alpha-prisma-verify.sh`:
  - starts the Prisma API with `FANPASS_REQUIRE_PAYMENT_AUTHORIZATION=true`;
  - verifies a buy order and sell order both wait before payment authorization;
  - simulates a mock Stripe authorization webhook;
  - runs `npm run side-effects:work-once -w @fanpass/api`;
  - verifies the worker settles the waiting order pair, completes ownership side effects, and exposes `ORDER_MATCH_AFTER_PAYMENT_AUTH` in Alpha operations.
- Verification passed:
  - `npm run typecheck -w @fanpass/api`
  - `npm run test -w @fanpass/api` (37 tests)
  - `npm run alpha:verify:prisma`
  - `npm run side-effects:verify`
  - `npm run typecheck --workspaces --if-present`
  - `npm run test --workspaces --if-present` (API 37 tests, contracts 1 test)
  - `npm run build --workspaces --if-present`
  - `npm run prototype:start`
  - `npm run prototype:verify`
  - `npm run security:runtime:local`
- Final local checks after restart:
  - `http://localhost:3000/` -> `200 OK`;
  - `http://localhost:4000/health` -> `{"ok":true,"service":"fanpass-api","target":"technical-prototype"}`.
- Current local services after restart:
  - API: `http://localhost:4000` (`25761.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`25764.fanpass-dashboard`)
- `npm audit --omit=dev --audit-level=low` still reports 2 moderate advisories:
  - `postcss <8.5.10` through Next;
  - do not run `npm audit fix --force` because it proposes a breaking Next downgrade.
- Remaining payment gaps before real-money Beta:
  - client-side Stripe Payment Element or Checkout is not integrated yet;
  - capture, refund, cancellation, reconciliation, and webhook replay/idempotency still need production-grade workers and tests;
  - no real Stripe test keys were used in local verification.

After Payment Capture/Compensation Pass on 2026-05-28:

- Added backend payment side-effect handlers in `PaymentsService`:
  - `processCaptureJob(...)`;
  - `processCancelAuthorizationJob(...)`;
  - `processRefundJob(...)`;
  - `processReconcileJob(...)`.
- Extended `SideEffectWorkerService` dispatch for:
  - `PAYMENT_CAPTURE`;
  - `PAYMENT_CANCEL_AUTHORIZATION`;
  - `PAYMENT_REFUND`;
  - `PAYMENT_RECONCILE`.
- Updated Prisma order settlement:
  - after ownership transfer and trade creation, settlement enqueues `PAYMENT_CAPTURE` for the authorized buy-order payment;
  - if ownership transfer fails after orders are matched, settlement enqueues payment compensation: cancel authorization for uncaptured payments, refund for captured payments.
- Updated `alpha:verify:prisma`:
  - first worker pass processes `ORDER_MATCH_AFTER_PAYMENT_AUTH`;
  - second worker pass processes `PAYMENT_CAPTURE`;
  - verification now expects payment capture status `CAPTURED` and 4 persisted side-effect jobs.
- Verification passed:
  - `npm run typecheck -w @fanpass/api`
  - `npm run test -w @fanpass/api` (39 tests)
  - `npm run alpha:verify:prisma`
  - `npm run side-effects:verify`
  - `npm run typecheck --workspaces --if-present`
  - `npm run test --workspaces --if-present` (API 39 tests, contracts 1 test)
  - `npm run build --workspaces --if-present`
  - `npm run prototype:start`
  - `npm run prototype:verify`
  - `npm run security:runtime:local`
- Final local checks after restart:
  - `http://localhost:3000/` -> `200 OK`;
  - `http://localhost:4000/health` -> `{"ok":true,"service":"fanpass-api","target":"technical-prototype"}`.
- Current local services after restart:
  - API: `http://localhost:4000` (`29921.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`29924.fanpass-dashboard`)
- `npm audit --omit=dev --audit-level=low` still reports 2 moderate advisories:
  - `postcss <8.5.10` through Next;
  - do not run `npm audit fix --force` because it proposes a breaking Next downgrade.
- Remaining payment gaps before real-money Beta:
  - client-side Stripe Payment Element or Checkout is not integrated yet;
  - real Stripe test keys and signed webhooks have not been used yet;
  - webhook replay/idempotency hardening is still needed;
  - product/admin triggers for refund, cancellation, and reconciliation are not implemented yet.

After Stripe Webhook Replay Hardening Pass on 2026-05-28:

- Added Prisma `PaymentWebhookEvent` model mapped to `payment_webhook_events`:
  - unique `stripe_event_id`;
  - event type, PaymentIntent id, optional FanPass payment id, status, reason, payload, and processed timestamp.
- Updated Alpha seed/reset to clear webhook event records.
- Updated `PaymentsService.handleWebhook(...)`:
  - supported Stripe webhook events now require an event id;
  - the handler atomically claims the event id before mutating payment state or enqueueing outbox jobs;
  - replaying the same event returns `duplicate: true`;
  - duplicate events do not repeat payment state updates, audit writes, or side-effect enqueueing.
- Updated `AlphaPersistenceService.status(...)` to include `paymentWebhookEvents`.
- Updated `alpha:verify:prisma`:
  - sends the same mock `payment_intent.amount_capturable_updated` event twice;
  - fails unless the second delivery is treated as a duplicate;
  - expects exactly one persisted `paymentWebhookEvents` count.
- Verification passed:
  - `npm run typecheck -w @fanpass/api`
  - `npm run test -w @fanpass/api` (39 tests)
  - `npm run alpha:verify:prisma`
  - `npm run side-effects:verify`
  - `npm run typecheck --workspaces --if-present`
  - `npm run test --workspaces --if-present` (API 39 tests, contracts 1 test)
  - `npm run build --workspaces --if-present`
  - `npm run prototype:start`
  - `npm run prototype:verify`
  - `npm run security:runtime:local`
- Final local checks after restart:
  - `http://localhost:3000/` -> `200 OK`;
  - `http://localhost:4000/health` -> `{"ok":true,"service":"fanpass-api","target":"technical-prototype"}`.
- Current local services after restart:
  - API: `http://localhost:4000` (`33274.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`33277.fanpass-dashboard`)
- `npm audit --omit=dev --audit-level=low` still reports 2 moderate advisories:
  - `postcss <8.5.10` through Next;
  - do not run `npm audit fix --force` because it proposes a breaking Next downgrade.
- Remaining payment gaps before real-money Beta:
  - client-side Stripe Payment Element or Checkout is not integrated yet;
  - real Stripe test keys and signed webhooks have not been used yet;
  - admin triggers for refund, cancellation, and reconciliation exist locally, but have not been verified against real Stripe test-mode keys.

After Payment Admin Operation Trigger Pass on 2026-05-29:

- Added admin-only payment operation routes in `PaymentsController`:
  - `POST /payments/:paymentId/cancel-authorization`;
  - `POST /payments/:paymentId/refund`;
  - `POST /payments/:paymentId/reconcile`.
- Each operation requires bearer auth, `ADMIN` role, and an `Idempotency-Key`.
- The controller delegates to `PaymentsService.requestPaymentOperation(...)`; it does not call Stripe directly.
- `PaymentsService` now creates durable side-effect outbox jobs for:
  - `PAYMENT_CANCEL_AUTHORIZATION`;
  - `PAYMENT_REFUND`;
  - `PAYMENT_RECONCILE`.
- Operation idempotency is keyed by operation, payment id, and client idempotency key. Retrying the same request returns the existing side-effect job and avoids duplicate audit logs.
- Operation payloads include payment id, order id, event id, ticket type id, requester id, and reason for audit and future worker diagnostics.
- Payment operation responses and webhook responses now use redacted payment summaries and do not return Stripe client secrets or payment request idempotency keys.
- `alpha:verify:prisma` now creates an admin demo user for the verification run and checks:
  - organizer users cannot trigger payment refund operations;
  - admin users can request payment reconciliation;
  - retrying the same reconcile request returns the same `PAYMENT_RECONCILE` side-effect job;
  - Alpha operations shows the completed settlement/capture jobs plus the pending reconciliation job.
- Verification passed:
  - `npm run typecheck -w @fanpass/api`
  - `npm run test -w @fanpass/api` (39 tests)
  - `npm run alpha:verify:prisma`
  - `npm run side-effects:verify`
  - `npm run typecheck --workspaces --if-present`
  - `npm run test --workspaces --if-present` (API 39 tests, contracts 1 test)
  - `npm run build --workspaces --if-present`
  - `npm run prototype:start`
  - `npm run prototype:verify`
  - `npm run security:runtime:local`
- Final local checks after restart:
  - `http://localhost:3000/` -> `200 OK`;
  - `http://localhost:4000/health` -> `{"ok":true,"service":"fanpass-api","target":"technical-prototype"}`.
- Current local services after restart:
  - API: `http://localhost:4000` (`47928.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`47931.fanpass-dashboard`)
- `npm audit --omit=dev --audit-level=low` still reports 2 moderate advisories:
  - `postcss <8.5.10` through Next;
  - do not run `npm audit fix --force` because it proposes a breaking Next downgrade.
- Remaining payment gaps before real-money Beta:
  - client-side Stripe Payment Element or Checkout is not integrated yet;
  - real Stripe test keys and signed webhooks have not been used yet;
  - cancellation, refund, and reconciliation must be exercised against real Stripe test-mode PaymentIntent states before real-money Beta.

After WebSocket Orderbook Pass on 2026-05-29:

- Added realtime orderbook infrastructure:
  - `FanPassSocketIoAdapter` applies the existing API CORS allowlist to Socket.IO and keeps credentialed CORS disabled;
  - `OrderbookGateway` exposes the `/orderbook` namespace with `orderbook.subscribe` and `orderbook.unsubscribe`;
  - `OrderbookRealtimeService` owns scoped room naming and update publication.
- Clients subscribing to an event/ticket type room receive:
  - `orderbook.snapshot` immediately after subscription;
  - `orderbook.updated` after order creation, order cancellation, or settled trades.
- `OrderbookService` now publishes realtime snapshots after memory and Prisma orderbook mutations without moving realtime concerns into controller code.
- Realtime payloads are public market data only: event id, ticket type id, aggregated bids/asks, last trade price, floor price, volume, premium percent, reason, and optional order/trade ids.
- Added `@nestjs/platform-socket.io` as an API runtime dependency and kept `socket.io-client` as an API dev dependency for local verification only.
- Updated `prototype:verify` to connect with a real Socket.IO client, subscribe to the seeded orderbook, verify the initial snapshot, verify a sell-order update, and verify a trade-settled update.
- Verification passed:
  - `npm run typecheck -w @fanpass/api`
  - `npm run test -w @fanpass/api` (39 tests)
  - `npm run build -w @fanpass/api`
  - `npm run prototype:start`
  - `npm run prototype:verify` with `orderbookRealtime: "trade_settled"`
  - `npm run alpha:verify:prisma`
  - `npm run side-effects:verify`
  - `npm run typecheck --workspaces --if-present`
  - `npm run test --workspaces --if-present` (API 39 tests, contracts 1 test)
  - `npm run build --workspaces --if-present`
  - `npm run security:runtime:local`
- Final local checks after restart:
  - `http://localhost:3000/` -> `200 OK`;
  - `http://localhost:4000/health` -> `{"ok":true,"service":"fanpass-api","target":"technical-prototype"}`.
- Current local services after restart:
  - API: `http://localhost:4000` (`52602.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`52605.fanpass-dashboard`)
- `npm audit --omit=dev --audit-level=low` still reports 2 moderate advisories:
  - `postcss <8.5.10` through Next;
  - do not run `npm audit fix --force` because it proposes a breaking Next downgrade.
- Remaining realtime gaps before external Beta:
  - FanPass Console and FanPass iOS still need product-surface consumption of the feed;
  - deployed staging WebSocket/CORS checks are still required;
  - production traffic limits and monitoring for realtime connections are still required.

After Console Realtime Orderbook Pass on 2026-05-29:

- Wired FanPass Console to the `/orderbook` Socket.IO feed:
  - added `OrderbookLivePanel` as a narrow client component;
  - kept `app/page.tsx` server-rendered for initial protected operations data;
  - installed `socket.io-client` in `@fanpass/dashboard` production dependencies because the browser now uses it at runtime.
- Console orderbook behavior:
  - renders the server-fetched market snapshot immediately;
  - subscribes to the selected event/ticket type room;
  - updates bids, asks, last trade, floor, highest bid, spread, volume, and premium from realtime snapshots;
  - displays a compact `Live` / `Connecting` / `Offline` status row and latest update reason.
- Browser QA with the in-app browser passed:
  - desktop `http://localhost:3000/` loaded as `FanPass Console`;
  - no relevant console errors or framework overlay;
  - API-triggered sell and buy orders produced visible `Trade settled` and `HK$1329` in the orderbook panel;
  - mobile viewport 390 x 844 rendered Console and Orderbook with no horizontal overflow.
- QA screenshots:
  - `/tmp/fanpass-console-realtime.png`
  - `/tmp/fanpass-console-realtime-mobile.png`
- Verification passed:
  - `npm run typecheck -w @fanpass/dashboard`
  - `npm run build -w @fanpass/dashboard`
  - `npm run prototype:verify` with `orderbookRealtime: "trade_settled"`
  - `npm run typecheck --workspaces --if-present`
  - `npm run test --workspaces --if-present` (API 39 tests, contracts 1 test)
  - `npm run build --workspaces --if-present`
  - `npm run security:runtime:local`
- Final local checks after restart:
  - `http://localhost:3000/` -> `200 OK`;
  - `http://localhost:4000/health` -> `{"ok":true,"service":"fanpass-api","target":"technical-prototype"}`.
- Current local services after restart:
  - API: `http://localhost:4000` (`56477.fanpass-api`)
  - FanPass Console: `http://localhost:3000` (`56480.fanpass-dashboard`)
- `npm audit --omit=dev --audit-level=low` still reports 2 moderate advisories:
  - `postcss <8.5.10` through Next;
  - do not run `npm audit fix --force` because it proposes a breaking Next downgrade.
- Remaining realtime gaps before external Beta:
  - FanPass iOS does not consume the WebSocket feed yet;
  - deployed staging WebSocket/CORS checks are still required;
  - production traffic limits and monitoring for realtime connections are still required.

After Deployment Environment Pass on 2026-05-29:

- Added deployment environment templates:
  - `apps/api/.env.example`
  - `apps/api/.env.staging.example`
  - `apps/dashboard/.env.example`
  - `apps/dashboard/.env.staging.example`
- Corrected the API local template to use `STRIPE_WEBHOOK_SECRET` and documented data source, Prisma, QR TTL, payment, and payment-authorization toggles.
- Added `docs/DEPLOYMENT_ENVIRONMENTS.md` covering:
  - local/staging/production separation;
  - required staging properties;
  - environment template usage;
  - deployed staging verification command;
  - deployment order and current open items.
- Added runtime scripts:
  - `npm run security:runtime:staging` for real HTTPS staging URLs;
  - `npm run security:runtime:staging:dry-run` for local staging-like API/Console verification.
- The staging runtime check verifies:
  - API and Console security headers;
  - absent `x-powered-by`;
  - API `/auth/demo-session` does not return 2xx;
  - unauthenticated Console renders locked/sign-in state.
- Verification passed:
  - `npm run security:runtime:staging:dry-run`
- Remaining deployment gaps before external Beta:
  - real HTTPS staging API/Console URLs have not been provisioned;
  - `npm run security:runtime:staging` has not been run against deployed staging;
  - deployment provider choice and production worker process strategy are still open.

After Core NFC Ops Prototype Pass on 2026-05-29:

- Added a `FanPass Ops`-only Core NFC prototype:
  - `NFCPayloadScanner` wraps `CoreNFC` behind a small scanner adapter;
  - supports NDEF well-known text records, URI records, and raw UTF-8 payloads;
  - normalizes `fanpass://entry?payload=...` links into the existing signed QR payload JSON;
  - feeds captured NFC payloads into the existing redemption path so backend signature, nonce, gate assignment, and lifecycle checks remain the source of truth.
- Updated `ScannerView`:
  - scanner now offers QR, NFC, and paste fallback actions;
  - simulator/unsupported-device state shows `NFC unavailable` instead of pretending NFC works;
  - existing QR and paste redemption flows remain unchanged.
- Updated `FanPassOps`:
  - Ops home now labels NFC as `Beta`;
  - entry scanner copy says QR/NFC payloads;
  - `FanPassOps` has an NDEF reader entitlement and NFC usage description.
- Product boundary:
  - `FanPass` consumer target still excludes `FanPass/Features/Scanner`;
  - consumer app still has no Camera/NFC permissions and no staff scanner surface.
- Verification passed:
  - `xcodegen generate`
  - XcodeBuildMCP `build_sim CODE_SIGNING_ALLOWED=NO` for `FanPassOps`
  - XcodeBuildMCP `build_sim CODE_SIGNING_ALLOWED=NO` for `FanPass`
  - `npm run alpha:verify:ios-boundaries`
  - `npm run prototype:verify`
  - `npm run security:runtime:local`
- Local services were restarted after the prior Console 500 and are healthy:
  - `http://localhost:3000/` -> `200 OK`;
  - `http://localhost:4000/health` -> `200 OK`.
- Remaining NFC gap before external Beta:
  - real NFC reading cannot be validated in simulator; it needs a signed physical iPhone build and supported NDEF tag.

After iOS Distribution Planning Pass on 2026-05-29:

- Added `docs/IOS_DISTRIBUTION_PLAN.md` for the two native apps:
  - confirms `FanPass` and `FanPass Ops` stay separate in App Store Connect/TestFlight;
  - records current bundle ids and schemes;
  - separates capabilities so only `FanPass Ops` carries Camera/NFC requirements;
  - defines local, staging, TestFlight Beta, and production environment expectations;
  - lays out physical-device install, internal TestFlight, closed external TestFlight, and pilot-readiness stages.
- Documented TestFlight/App Store prerequisites:
  - Apple Developer Program membership;
  - Team ID, App Store Connect access, certificates, identifiers, and provisioning profiles;
  - final app ownership/name/support/privacy metadata.
- Documented external-Beta blockers:
  - concrete staging/beta/production iOS API build setting values;
  - no physical-device NFC validation yet;
  - no signed Apple Wallet `.pkpass` service yet;
  - no Privy iOS product login;
  - no Stripe client UI or real Stripe signed-webhook validation;
  - no deployed HTTPS staging environment yet.
- Source references used are official Apple docs for TestFlight, Xcode distribution, Core NFC, and App Store Connect capabilities.

After iOS API Environment Configuration Pass on 2026-05-29:

- Removed hardcoded API base URL usage from Swift app state:
  - `AppState` now builds `FanPassAPIClient` from `FanPassEnvironment.apiBaseURL`;
  - `OpsShellView` does the same for `FanPass Ops`.
- Added `FanPassEnvironment` in shared iOS code:
  - reads `FanPassAPIBaseURL` from Info.plist/build settings;
  - keeps a local Debug fallback to `http://localhost:4000`;
  - rejects local or non-HTTPS API URLs in non-Debug builds at runtime.
- Updated `project.yml`:
  - both targets define `FANPASS_API_BASE_URL`;
  - both generated Info.plists expose `FanPassAPIBaseURL`;
  - XcodeGen regenerated `FanPass.xcodeproj`.
- Verification passed:
  - XcodeBuildMCP `build_sim CODE_SIGNING_ALLOWED=NO` for `FanPassOps`;
  - XcodeBuildMCP `build_sim CODE_SIGNING_ALLOWED=NO` for `FanPass`;
  - `npm run alpha:verify:ios-boundaries`.
- Remaining distribution gap:
  - staging/beta/prod build-setting values still need to be supplied through `.xcconfig`, CI, or Xcode scheme configuration once real HTTPS API URLs exist.

After Apple Wallet Barcode Prototype Pass on 2026-05-29:

- Added an Apple Wallet barcode prototype to the FanPass ticket entry sheet:
  - the existing signed backend entry payload remains the source message;
  - the prototype exposes PassKit-compatible barcode metadata with `PKBarcodeFormatQR`, `message`, `messageEncoding`, `altText`, `eventId`, `ticketId`, and `expiresAt`;
  - users can copy the barcode JSON for local inspection;
  - the UI clearly labels this as `Prototype` rather than a real Add to Apple Wallet flow.
- Security/architecture boundary:
  - no fake `.pkpass` signing was added;
  - real Apple Wallet support still requires a backend pass signing service, Apple pass certificate, and signed pass package generation.
- Verification passed:
  - XcodeBuildMCP `build_sim CODE_SIGNING_ALLOWED=NO` for `FanPass`;
  - XcodeBuildMCP `build_sim CODE_SIGNING_ALLOWED=NO` for `FanPassOps`;
  - simulator launch of `FanPass`;
  - visual smoke opened Tickets, signed in as demo fan, issued a test ticket locally, opened Entry Code, and confirmed `Apple Wallet barcode`, `PKBarcodeFormatQR`, and `Copy barcode JSON` are visible.
- QA screenshot:
  - `/tmp/fanpass-wallet-barcode-prototype.jpg`

After FanPass iOS PaymentIntent Prep Pass on 2026-05-29:

- Added FanPass iOS payment preparation boundary:
  - `FanPassPaymentIntent` response model;
  - `FanPassAPIClient.createPaymentIntent(orderId:idempotencyKey:)`;
  - `FanPassPaymentCoordinator.prepareCheckout(...)` so SwiftUI views do not own provider/payment orchestration.
- Updated event-detail buy flow:
  - creates the buy order with an iOS-generated `Idempotency-Key`;
  - then calls `/payments/intents` with an order-scoped payment idempotency key;
  - opens a checkout sheet showing event, ticket, amount, payment id, payment status, and capture state.
- The checkout sheet deliberately stated that real checkout still needed Stripe iOS SDK PaymentSheet, publishable-key configuration, and Stripe test-mode validation. A later pass added the PaymentSheet SDK wiring; real test-key validation remains open.
- Official Stripe docs checked for iOS PaymentSheet/PaymentIntent direction:
  - `https://docs.stripe.com/payments/mobile/accept-payment?platform=ios`
  - `https://docs.stripe.com/payments/accept-a-payment?platform=ios`
- Verification passed:
  - `xcodegen generate`
  - XcodeBuildMCP `build_sim CODE_SIGNING_ALLOWED=NO` for `FanPass`
  - XcodeBuildMCP `build_sim CODE_SIGNING_ALLOWED=NO` for `FanPassOps`
  - `npm run alpha:verify:prisma`
  - `npm run alpha:verify:ios-boundaries`
  - `npm run prototype:verify`
  - `npm run security:runtime:local`
- Remaining payment UI gap:
  - real Stripe test-mode PaymentIntent confirmation has not been validated.

After iOS Build Configuration Pass on 2026-05-29:

- Added XcodeGen-managed iOS build configurations:
  - `Debug`
  - `Staging`
  - `Beta`
  - `Release`
- Added target xcconfig files:
  - `apps/ios/FanPass/Config/Local.xcconfig`
  - `apps/ios/FanPass/Config/Staging.xcconfig`
  - `apps/ios/FanPass/Config/Beta.xcconfig`
  - `apps/ios/FanPass/Config/Production.xcconfig`
- Both `FanPass` and `FanPassOps` now read `FANPASS_API_BASE_URL` from those config files through `FanPassAPIBaseURL`.
- Added placeholder `FANPASS_STRIPE_PUBLISHABLE_KEY` slots for the upcoming Stripe iOS SDK integration, without committing any real Stripe keys.
- Hardened `FanPassEnvironment` so non-Debug builds reject localhost, non-HTTPS, or `replace-me` API hosts at runtime.
- Verification passed:
  - `xcodegen generate`
  - XcodeBuildMCP Debug simulator build for `FanPass`
  - XcodeBuildMCP Beta simulator build for `FanPass`
  - XcodeBuildMCP Debug simulator build for `FanPassOps`
  - XcodeBuildMCP Beta simulator build for `FanPassOps`
  - `xcodebuild -showBuildSettings` confirmed Debug resolves `http://localhost:4000` and Beta resolves `https://replace-me-beta-api.fanpass.invalid`
  - `npm run alpha:verify:ios-boundaries`
- Remaining distribution gap:
  - replace placeholder staging/beta/production API URLs with real HTTPS endpoints before TestFlight or external device testing.

After FanPass iOS Stripe PaymentSheet Wiring Pass on 2026-05-29:

- Added Stripe iOS SDK through XcodeGen/SPM:
  - package `https://github.com/stripe/stripe-ios-spm`;
  - resolved version `25.16.0`;
  - product `StripePaymentSheet` linked only to the consumer `FanPass` target.
- Added consumer-only PaymentSheet bridge:
  - `FanPass/Features/Payments/StripePaymentSheetPresenter.swift`;
  - `STPAPIClient.shared.publishableKey` assignment inside the presenter boundary;
  - `PaymentSheet(paymentIntentClientSecret:configuration:)` presentation from SwiftUI;
  - typed completion, cancellation, and failure states without marking backend settlement complete.
- Added payment-specific app return URL handling:
  - consumer scheme `fanpass-payments`;
  - return URL `fanpass-payments://stripe-redirect`;
  - `StripeAPI.handleURLCallback(with:)` in `FanPassApp`.
- Added `FanPassEnvironment.stripePublishableKey` reading from `FanPassStripePublishableKey`/`FANPASS_STRIPE_PUBLISHABLE_KEY`.
- Kept `FanPass Ops` clean of payment UI and the Stripe dependency by placing the presenter under `FanPass/Features/Payments`, outside the Ops target source list.
- Updated `scripts/ios-role-boundary-smoke.sh` so the consumer app may register only the payment return scheme and still rejects staff/scanner schemes.
- Added a payment API guard so the in-memory prototype returns a clear 503 when checkout is attempted without `FANPASS_DATA_SOURCE=prisma`, instead of leaking an internal Prisma error.
- Verification passed:
  - `xcodegen generate`
  - XcodeBuildMCP Debug simulator build for `FanPass`
  - XcodeBuildMCP Debug simulator build for `FanPassOps`
  - XcodeBuildMCP Beta simulator build for `FanPass`
  - XcodeBuildMCP Beta simulator build for `FanPassOps`
  - `npm run alpha:verify:ios-boundaries`
  - `npm run typecheck -w apps/api`
  - `npm run alpha:verify:prisma`
  - `npm run prototype:start`
  - `npm run prototype:verify`
  - `npm run security:runtime:local`
- Simulator QA:
  - signed-out FanPass still opens the guest event screen;
  - private Buy action still gates auth at action time;
  - after demo sign-in, local in-memory checkout now shows the explicit Prisma-data-source requirement instead of `Internal server error`;
  - screenshot captured at `output/ios/fanpass-beta-stripe-local-guard.jpg`.
- Remaining Stripe gap:
  - configure real Stripe test publishable/secret keys and signed webhooks;
  - validate PaymentSheet confirmation with a real test-mode PaymentIntent client secret;
  - validate capture, cancellation, refund, reconciliation, and webhook replay against Stripe test mode.

After FanPass iOS Realtime Orderbook Pass on 2026-05-29:

- Added Socket.IO Swift client support through XcodeGen/SPM:
  - package `https://github.com/socketio/socket.io-client-swift`;
  - resolved version `16.1.1`;
  - transitive `Starscream` version `4.0.8`;
  - product `SocketIO` linked only to the consumer `FanPass` target.
- Added `FanPassOrderbookRealtimeClient` as the iOS realtime service boundary. SwiftUI screens do not own Socket.IO connection details.
- Wired the FanPass Market screen to the `/orderbook` namespace:
  - subscribes with `orderbook.subscribe` after the HTTP market load;
  - applies `orderbook.snapshot` and `orderbook.updated` payloads to the local `OrderbookSnapshot`;
  - shows compact `Live`, `Connecting`, or `Offline` state plus public update reasons such as `Order opened`;
  - disconnects on view disappearance.
- Kept `FanPass Ops` clean of market realtime dependencies by excluding `FanPassOrderbookRealtimeClient.swift` from the Ops target.
- Important implementation note: the Swift Socket.IO client uses the default polling-to-websocket upgrade path. Forcing websocket-only transport went offline in the simulator, while the default transport reached `Live`.
- Verification passed:
  - `xcodegen generate`
  - XcodeBuildMCP Debug simulator build for `FanPass`
  - XcodeBuildMCP Debug simulator build for `FanPassOps`
  - XcodeBuildMCP Beta simulator build for `FanPass`
  - XcodeBuildMCP Beta simulator build for `FanPassOps`
  - `npm run alpha:verify:ios-boundaries`
  - `npm run prototype:start`
  - `npm run prototype:verify`
  - `npm run security:runtime:local`
  - `npm run typecheck -w apps/api`
  - `npm audit --omit=dev --audit-level=low --json` still reports 2 moderate Next/PostCSS advisories with only a destructive forced downgrade path.
- Simulator QA:
  - Market screen reached `Live`;
  - an API-created buy order pushed `Order opened` to the visible iOS Market screen;
  - orderbook displayed the new `Bid HKD 1,288`;
  - screenshot captured at `output/ios/fanpass-beta-ios-live-orderbook.jpg`.
- Remaining realtime gap:
  - deployed staging WebSocket/CORS checks are still required before external Beta;
  - production traffic limits and monitoring are not configured yet.

After Beta Local Prisma Environment Pass on 2026-05-29:

- Added repeatable local Beta foundation service commands:
  - `npm run beta:local:start`
  - `npm run beta:local:stop`
  - `npm run beta:local:verify`
- `beta:local:start` runs the API on `http://localhost:4000` with:
  - `FANPASS_DATA_SOURCE=prisma`;
  - `FANPASS_ENABLE_PRISMA_CONNECT=true`;
  - `FANPASS_REQUIRE_PAYMENT_AUTHORIZATION=true`;
  - local demo auth enabled only for local runbook speed;
  - Stripe forced to local mock mode by default unless `FANPASS_BETA_USE_STRIPE=true` is explicitly set.
- The same start script resets/seeds the Alpha Prisma DB unless `FANPASS_BETA_SKIP_DB_RESET=true`, clears stale Console `.next` output, runs FanPass Console on `http://localhost:3000`, and keeps a detached local side-effect worker loop alive.
- Added `beta:local:verify`, which resets/reseeds local Prisma by default, proves the running local environment is Prisma-backed, and verifies:
  - buyer creates an open buy order;
  - backend creates a local mock PaymentIntent with an idempotency key;
  - local webhook simulation authorizes the payment;
  - seller lists the seeded ticket;
  - the authorized order pair settles into a trade;
  - the side-effect worker completes `PAYMENT_CAPTURE`;
  - Console operations exposes the captured payment, completed side effect, and trade.
- Verification passed:
  - `bash -n scripts/beta-local-start.sh scripts/beta-local-stop.sh scripts/beta-local-verify.sh`
  - `npm run beta:local:start`
  - `npm run beta:local:verify`
  - `npm run security:runtime:local`
- Remaining status:
  - this closes the local long-running Prisma environment gap and gives iOS/Console a better Beta foundation target than the in-memory prototype;
  - it does not replace real Stripe test-key validation, signed webhooks, deployed staging checks, or Privy product login.

After Staging WebSocket Runtime Check Pass on 2026-05-29:

- Extended `scripts/security-runtime-staging-check.sh` so staging verification now checks the Socket.IO `/orderbook` namespace in addition to HTTP headers and locked Console state.
- The staging runtime check now:
  - derives the API and Console origins from the supplied URLs;
  - connects to `/orderbook` with an allowed origin and verifies an `orderbook.snapshot` for `evt_weekend_demo` / `tt_cat2_demo` by default;
  - rejects snapshot payloads if private field markers such as `clientSecret`, owner/scanner email, Privy, or nonce appear;
  - attempts a second connection with `https://disallowed-origin.invalid` and fails if that origin can connect or receive a snapshot.
- Updated `scripts/security-runtime-staging-local-dry-run.sh` to pass a staging-like HTTPS origin header while still running local ports, so the CORS path is testable without relaxing production-like HTTPS CORS validation.
- The staging dry-run stops any local Console dev screen on port `3000` before running `next build`, because Next dev and Next production builds share `apps/dashboard/.next`; restore the local Beta environment with `npm run beta:local:start` afterwards.
- Verification passed:
  - `bash -n scripts/security-runtime-staging-check.sh scripts/security-runtime-staging-local-dry-run.sh`
  - `npm run security:runtime:staging:dry-run`
- Remaining status:
  - the dry-run proves the check itself and the staging-like local runtime behavior;
  - real deployed HTTPS staging URLs are still required before this can close the deployed staging gate.

After Security Pass 4 on 2026-05-28:

- Tightened FanPass Console data access:
  - production-like Console builds no longer auto-fetch local demo sessions;
  - without `FANPASS_CONSOLE_ACCESS_TOKEN`, Console renders a locked state and does not request `/alpha/operations`;
  - local prototype mode still uses the seeded organizer demo token for repeatable demos.
- Added default PII redaction to `/alpha/operations`:
  - organizer snapshots hide owner/scanner emails;
  - QR nonces are hidden;
  - fan task proof text is hidden;
  - audit metadata is hidden;
  - full user/scanner/actor ids are replaced by stable `user_ref_*` values;
  - admin sessions keep full visibility.
- Alpha event and ticket-type audit logs now use the authenticated Console actor instead of hardcoded `usr_organizer_demo`.
- Updated `scripts/alpha-prisma-verify.sh` to fail if organizer operations snapshots are not PII-redacted.
- Verification passed:
  - `npm run typecheck -w apps/api`
  - `npm run typecheck -w apps/dashboard`
  - `npm run test -w apps/api`
  - `npm run build -w apps/dashboard`
  - `npm run typecheck --workspaces --if-present`
  - `npm run build --workspaces --if-present`
  - `npm run alpha:verify:prisma`
  - staging-mode Console smoke on `http://localhost:3100` showed `Console locked` and `Authentication required`;
  - `npm run prototype:start`
  - `npm run prototype:verify`
  - Playwright opened `http://localhost:3000`, confirmed `PII redacted`, redacted user/scanner refs, and no browser console errors beyond the React DevTools info message.
- `npm audit --omit=dev --audit-level=low` still fails with 4 moderate production advisories:
  - `postcss <8.5.10` through Next;
  - `ws 8.0.0 - 8.20.0` through ethers.
    Do not run the suggested `npm audit fix --force` casually because it proposes breaking dependency changes.

iOS simulator visual QA:

- Auth screen renders full-screen on `FanPass-iPhone-17`.
- Auth screen exposes Register, Sign in, and Continue as demo fan.
- Signed-out launch opens the Events home screen instead of Auth.
- Tapping Get tickets while signed out presents the auth sheet.
- The fan tab bar shows Events, Tickets, Market, Access, Profile.
- Staff scanner is not visible in the default fan tab bar.
- Engineering QA screenshots captured. These are not VI references:
  - `/tmp/fanpass-home-final.png`
  - `/tmp/fanpass-auth-sheet.png`
  - `/tmp/fanpass-vi-ios-check.png`

Local development services can run in two modes.

For Beta foundation Prisma-backed local testing:

```bash
npm run beta:local:start
npm run beta:local:verify
npm run beta:local:stop
```

This starts detached `screen` sessions:

```bash
screen -r fanpass-beta-api
screen -r fanpass-beta-console
screen -r fanpass-beta-worker
```

The older in-memory Technical Prototype service still exists for compatibility:

```bash
npm run prototype:start
screen -ls
screen -r fanpass-api
screen -r fanpass-dashboard
```

Ports:

- API: `http://localhost:4000`
- Dashboard: `http://localhost:3000`

After the Console gate staff assignment pass on 2026-05-29:

- Added organizer/admin protected Console APIs:
  - `POST /alpha/gate-assignments`
  - `POST /alpha/gate-assignments/:assignmentId/deactivate`
- Added the public Privy-token staff invite acceptance API:
  - `POST /auth/privy/accept-staff-invite`
- Gate staff assignment creation is event-scoped to the authenticated organizer profile. Cross-organizer assignment attempts are rejected.
- Console can now create/reactivate a gate staff assignment and revoke an active assignment without touching database seed files.
- New gate staff placeholder users are created only as `GATE_STAFF`; reusing an email from a non-gate-staff account is rejected.
- Assignment creation now generates a short-lived staff invite. The API returns the plain invite token once, while Prisma stores only a SHA-256 token hash.
- Staff invite acceptance verifies a Privy access token first, then links the invite to the target `GATE_STAFF` placeholder user. A Privy account already linked to another FanPass user cannot claim the invite.
- Organizer operations snapshots include gate assignment and invite status with staff email and full staff id redacted by default; admin views keep full visibility.
- `alpha:verify:prisma` now verifies assignment creation, invite creation, cross-organizer rejection, new gate staff role creation, Privy-token invite acceptance, duplicate/incorrect invite reuse rejection, active assignment access, deactivation, post-deactivation access rejection, scoped operations visibility, and redaction.
- Playwright browser QA was added as `npm run console:verify:local` so local Console pages can be screenshot-checked after UI changes. Current screenshot:
  - `outputs/playwright/fanpass-console-beta-gate-staff-full.png`

Verification passed:

```bash
npm run typecheck -w apps/api
npm run typecheck -w apps/dashboard
npm run test -w apps/api
npm run build -w apps/dashboard
npm run alpha:verify:prisma
npm run beta:local:start
npm run beta:local:verify
npm run security:runtime:local
npm run console:verify:local
```

Manual/browser QA:

`npm run console:verify:local` opened `http://localhost:3000`, submitted the `Assign Gate Staff` form through the Console route handler, asserted the one-time invite token panel renders, clicked `Rotate invite` for the created staff row, asserted the rotated invite token panel renders, asserted no Runtime Error / Cannot find module overlay, asserted no browser console errors, and captured the screenshot above.

After the Console one-time staff invite delivery pass on 2026-05-29:

- Added `POST /api/console/gate-assignments` in FanPass Console. The route reuses the server-side Console session token, forwards assignment creation to the API, and returns the API response to the browser only for the active organizer/admin session.
- Replaced the server-action-only `Assign Gate Staff` form with a small client component that shows the plain invite token exactly after successful assignment creation/reactivation. The token is not stored in URL state or persisted in the operations snapshot.
- Added copy/clear controls and short operational copy so the organizer can deliver the token to a staff member while keeping the backend's hash-only storage policy.
- Extended `npm run console:verify:local` so browser QA now creates a QA staff assignment and fails unless the one-time invite token panel appears.

Verification passed:

```bash
npm run typecheck -w apps/dashboard
npm run typecheck -w apps/api
npm run build -w apps/dashboard
npm run test -w apps/api
npm run alpha:verify:prisma
npm run beta:local:start
npm run beta:local:verify
npm run security:runtime:local
npm run console:verify:local
```

After the Console staff invite rotation pass on 2026-05-29:

- Added organizer/admin protected API support for `POST /alpha/gate-assignments/:assignmentId/invites`. The route is event-scoped, rejects inactive assignments, and rejects already Privy-linked staff accounts.
- Rotating an invite supersedes pending invite tokens, creates a new seven-day invite with only a SHA-256 token hash stored in Prisma, and writes a `STAFF_INVITE_ROTATED` audit log.
- Added `POST /api/console/gate-assignments/[assignmentId]/invites` in FanPass Console so the browser can request a rotated token through the server-side Console session without exposing API credentials.
- Added a `Rotate invite` action on active unlinked assignment rows. The new plain token is displayed once in the current page state with copy/clear controls; it is not persisted in URLs or operations snapshots.
- Extended `alpha:verify:prisma` to verify token rotation, cross-organizer rotation rejection, superseded token rejection, accepted rotated token linking, replay rejection, and linked-staff rotation rejection.
- Extended `npm run console:verify:local` to submit a QA assignment, rotate that assignment in the browser, and fail unless both the one-time and rotated invite token panels render.

Verification passed:

```bash
npm run typecheck -w apps/api
npm run typecheck -w apps/dashboard
npm run test -w apps/api
npm run build -w apps/dashboard
npm run alpha:verify:prisma
npm run beta:local:start
npm run beta:local:verify
npm run security:runtime:local
npm run console:verify:local
```

After the Privy/staff abuse-rate-limit pass on 2026-05-29:

- Added dedicated API rate limits for high-risk auth and staff management paths:
  - `POST /auth/privy/sync`
  - `POST /auth/privy/accept-staff-invite`
  - `POST /alpha/gate-assignments`
  - `POST /alpha/gate-assignments/:assignmentId/deactivate`
  - `POST /alpha/gate-assignments/:assignmentId/invites`
- Added validated environment knobs:
  - `RATE_LIMIT_PRIVY_PER_MINUTE`
  - `RATE_LIMIT_STAFF_INVITE_PER_MINUTE`
  - `RATE_LIMIT_STAFF_ASSIGNMENT_PER_MINUTE`
- Updated `npm run security:runtime:local` so it now sends a real `/auth/privy/sync` request and fails unless the API returns `RateLimit-Policy`, proving the auth limiter is active in the running service.
- Added backend config tests for the new rate-limit bounds.

Verification passed:

```bash
npm run typecheck -w apps/api
npm run test -w apps/api -- --runTestsByPath test/security-config.spec.ts test/route-security.spec.ts
npm run test -w apps/api
npm run alpha:verify:prisma
npm run beta:local:start
npm run beta:local:verify
npm run security:runtime:local
```

After the route role-matrix coverage pass on 2026-05-29:

- Extended `test/route-security.spec.ts` so it now checks the exact public/role matrix for every current controller route, not only the presence of a guard or public marker.
- The matrix locks critical boundaries such as:
  - public health/event/orderbook/fan-task/Privy-sync/Stripe-webhook routes;
  - fan/admin order, ticket wallet, QR generation, and PaymentIntent routes;
  - gate-staff/admin redemption routes;
  - organizer/admin Console, inventory, gate assignment, and Alpha operations routes;
  - admin-only order matching and payment operation routes.
- This gives backend role drift a direct regression test before real Privy SDK UI or deployed staging is available.

Verification passed:

```bash
npm run test -w apps/api -- --runTestsByPath test/route-security.spec.ts
npm run typecheck -w apps/api
npm run test -w apps/api
npm run alpha:verify:prisma
npm run beta:local:start
npm run beta:local:verify
npm run security:runtime:local
```

After the provider boundary audit pass on 2026-05-29:

- Added root script `npm run security:provider-boundaries`.
- Added `scripts/provider-boundary-audit.js` to scan API, Console, shared, and iOS source files for provider SDK/import placement.
- The audit currently enforces:
  - Stripe Node SDK only in `apps/api/src/modules/payments/payments.service.ts`;
  - dynamic `ethers` only in `apps/api/src/modules/ownership/ownership.service.ts`;
  - Stripe iOS imports only in the app callback and `StripePaymentSheetPresenter`;
  - Socket.IO only in `FanPassOrderbookRealtimeClient`;
  - Core NFC only in `NFCPayloadScanner`;
  - AVFoundation only in `QRCodeScannerView`.
- The audit also checks `apps/ios/FanPass/project.yml` so `FanPass` keeps scanner source excluded and `FanPass Ops` keeps Stripe/Socket.IO and the consumer realtime orderbook client out of its target.

Verification passed:

```bash
npm run security:provider-boundaries
npm run test -w apps/api
npm run typecheck -w apps/api
npm run alpha:verify:ios-boundaries
npm run alpha:verify:prisma
npm run beta:local:start
npm run beta:local:verify
npm run security:runtime:local
```

After the API contract audit pass on 2026-05-29:

- Added root script `npm run security:api-contracts`.
- Added `scripts/api-contract-audit.js`, which uses the TypeScript AST to scan NestJS API controllers.
- The audit currently checks:
  - global `ValidationPipe` keeps `whitelist`, `forbidNonWhitelisted`, and `transform`;
  - mutating controller routes keep validated DTO request bodies unless explicitly allowlisted as bodyless commands;
  - order creation, PaymentIntent creation, authorization cancellation, refund, and reconciliation keep `Idempotency-Key` header boundaries.
- This turns the typed DTO/idempotency maintainability rule into a local regression check for future payment, auth, settlement, ownership, and scanner API changes.

Verification passed:

```bash
npm run security:api-contracts
npm run security:provider-boundaries
npm run test -w apps/api
npm run typecheck -w apps/api
```

After the order settlement side-effect boundary pass on 2026-05-29:

- Added `apps/api/src/modules/side-effects/settlement-side-effects.service.ts`.
- Refactored `OrderbookService` so order settlement no longer imports ownership, payment, or raw outbox provider services directly.
- `SettlementSideEffectsService` now owns:
  - ownership transfer dispatch;
  - ownership side-effect outbox enqueue/complete/fail marking;
  - payment capture side-effect enqueueing after settled trades;
  - payment compensation side-effect enqueueing when ownership transfer fails.
- Extended `npm run security:provider-boundaries` so it fails if `OrderbookService` re-imports `OwnershipService`, `PaymentsService`, or `SideEffectOutboxService`.
- This improves the domain lifecycle/provider separation specifically for order settlement. Ticket issuance and redemption still have direct ownership adapter calls and remain future hardening candidates before public Beta.

Verification passed:

```bash
npm run typecheck -w apps/api
npm run test -w apps/api
npm run security:api-contracts
npm run security:provider-boundaries
npm run side-effects:verify
npm run alpha:verify:prisma
```

After the ticket ownership side-effect boundary pass on 2026-05-29:

- Added `apps/api/src/modules/side-effects/ticket-ownership-side-effects.service.ts`.
- Refactored `TicketsService` so ticket issuance no longer imports `OwnershipService` directly. It now delegates ownership minting through `TicketOwnershipSideEffectsService` and then records ticket state plus audit metadata.
- Refactored `VerificationService` so accepted redemption no longer imports `OwnershipService` directly. It now delegates ownership redemption through the same side-effect boundary before marking tickets redeemed and recording accepted check-ins.
- Extended `npm run security:provider-boundaries` so it fails if `TicketsService` or `VerificationService` re-import the ownership adapter directly.
- With the previous settlement pass, current order settlement, ticket issuance, and ticket redemption lifecycle services no longer import ownership provider adapters directly.

Verification passed:

```bash
npm run typecheck -w apps/api
npm run test -w apps/api
npm run security:api-contracts
npm run security:provider-boundaries
npm run alpha:verify:prisma
npm run side-effects:verify
```

After the prototype shortcut register pass on 2026-05-29:

- Added `docs/PROTOTYPE_SHORTCUT_REGISTER.md`.
- Added root script `npm run security:prototype-shortcuts`.
- The register currently documents:
  - local demo auth;
  - local QR secret fallback;
  - mock Stripe and unsigned local webhooks;
  - mock ownership adapter;
  - FanPass Ops paste fallback;
  - Apple Wallet barcode metadata without signed `.pkpass`;
  - manual one-time staff invite token delivery;
  - placeholder mobile environment values.
- `scripts/prototype-shortcut-audit.js` fails unless each shortcut keeps status, scope, owner, risk, replacement path, release gate, and evidence.

Verification passed:

```bash
npm run security:prototype-shortcuts
npm run security:provider-boundaries
npm run security:api-contracts
npm run typecheck -w apps/api
```

After the Beta foundation local verifier pass on 2026-05-29:

- Added root script `npm run beta:foundation:verify`.
- Added `scripts/beta-foundation-verify.sh`, which runs:
  - `npm run security:api-contracts`;
  - `npm run security:api-privacy`;
  - `npm run security:console-routes`;
  - `npm run security:dependency-advisories`;
  - `npm run security:provider-boundaries`;
  - `npm run security:prototype-shortcuts`;
  - `npm run side-effects:verify`;
  - `npm run typecheck -w apps/api`;
  - `npm run typecheck -w apps/dashboard`;
  - `npm run test -w apps/api`.
- This is the preferred local gate after backend/security foundation changes that touch API contracts, response privacy, Console routes, dependency advisory state, provider/lifecycle boundaries, prototype shortcuts, side-effect workers, or API lifecycle behavior.

Verification passed:

```bash
npm run beta:foundation:verify
```

The verifier passed API contract, API privacy, Console route contract, provider/lifecycle boundary, and prototype shortcut audits, plus API typecheck, Console typecheck, and 9 API test suites / 41 tests.

After the API response privacy classification pass on 2026-05-29:

- Added `docs/API_RESPONSE_PRIVACY_MATRIX.md`.
- Added root script `npm run security:api-privacy`.
- Added `scripts/api-response-privacy-audit.js`, which scans API controllers and FanPass Console route handlers with the TypeScript AST and fails if:
  - a controller handler is missing from the response privacy matrix;
  - a FanPass Console route handler is missing from the response privacy matrix;
  - a documented route drifts from the source route;
  - an unknown classification is used;
  - public, provider-ingress, admin-only, auth-session, or local-debug classifications conflict with the route decorators.
- The current matrix classifies 39 controller responses across public system/catalog/market data, auth session exchange, fan-private responses, staff-private verification responses, organizer-redacted operations, one-time organizer invite secrets, admin-only commands, provider webhook ingress, and local debug reset.
- `npm run beta:foundation:verify` now includes the API response privacy audit.

Verification passed:

```bash
npm run security:api-privacy
npm run beta:foundation:verify
```

The updated verifier passed API contract, API privacy, provider/lifecycle boundary, and prototype shortcut audits, plus API typecheck and 9 API test suites / 41 tests.

After the Console route-handler privacy coverage pass on 2026-05-29:

- Extended `npm run security:api-privacy` to discover `apps/dashboard/app/api/**/route.ts` handlers.
- Added FanPass Console route-handler responses to `docs/API_RESPONSE_PRIVACY_MATRIX.md`:
  - `POST /api/console/privy-session`;
  - `DELETE /api/console/privy-session`;
  - `POST /api/console/gate-assignments`;
  - `POST /api/console/gate-assignments/:assignmentId/invites`.
- The audit now fails if Console one-time invite-token route handlers classified as `ORGANIZER_SECRET_ONCE` do not use `consoleAccessToken()`.
- Current coverage is 43 response boundaries across 9 NestJS controllers and 3 Console route files.

Verification passed:

```bash
npm run security:api-privacy
npm run beta:foundation:verify
```

The updated verifier passed API contract, API privacy, provider/lifecycle boundary, and prototype shortcut audits, plus API typecheck and 9 API test suites / 41 tests.

After the Console invite response adapter pass on 2026-05-29:

- Added `apps/dashboard/lib/gate-assignment-response.ts`.
- `POST /api/console/gate-assignments` and `POST /api/console/gate-assignments/:assignmentId/invites` now use `redactConsoleGateAssignmentResponse()` instead of forwarding raw backend assignment payloads to the browser.
- The adapter returns only the UI-required assignment id, event title, gate, staff name, invite status/expiry, and one-time invite token.
- Extended `npm run security:api-privacy` so `ORGANIZER_SECRET_ONCE` Console route handlers must use both `consoleAccessToken()` and `redactConsoleGateAssignmentResponse()`.
- `npm run beta:foundation:verify` now includes FanPass Console typecheck because the foundation gates cover Console route-handler code.

Verification passed:

```bash
npm run security:api-privacy
npm run typecheck -w apps/dashboard
npm run beta:foundation:verify
```

The updated verifier passed API contract, API privacy, provider/lifecycle boundary, and prototype shortcut audits, plus API typecheck, Console typecheck, and 9 API test suites / 41 tests.

After the Console route contract audit pass on 2026-05-29:

- Added `scripts/console-route-contract-audit.js`.
- Added root script `npm run security:console-routes`.
- The audit locks the current Console route surface to:
  - `POST /api/console/privy-session`;
  - `DELETE /api/console/privy-session`;
  - `POST /api/console/gate-assignments`;
  - `POST /api/console/gate-assignments/:assignmentId/invites`.
- The audit checks the Console Privy session bridge for organizer/admin role gating, HttpOnly/same-site/secure cookie behavior, bounded cookie max age, session cookie deletion, and no direct access-token/Privy/email/wallet echo in JSON responses.
- The audit checks staff assignment and invite-rotation proxies for server-side Console auth, `ConsoleAuthRequiredError` handling, required-field or assignment-id validation, no-store upstream fetches, bearer-token forwarding, and `redactConsoleGateAssignmentResponse()` usage instead of raw upstream payload forwarding.
- `npm run beta:foundation:verify` now includes the Console route contract audit.

Verification passed:

```bash
npm run security:console-routes
npm run beta:foundation:verify
```

The updated verifier passed API contract, API privacy, Console route contract, provider/lifecycle boundary, and prototype shortcut audits, plus API typecheck, Console typecheck, and 9 API test suites / 41 tests.

After the Console server auth helper audit pass on 2026-05-29:

- Extended `npm run security:console-routes` to also audit `apps/dashboard/lib/api.ts`.
- The audit now checks:
  - configured Console token resolution before HttpOnly cookie resolution;
  - HttpOnly cookie resolution before production-like fallback blocking;
  - production-like fallback blocking before any local `/auth/demo-session` request;
  - bearer-token forwarding for Console API requests;
  - `cache: "no-store"` on Console server API proxy requests;
  - production/staging environment detection;
  - private `FANPASS_CONSOLE_ACCESS_TOKEN` usage and no public client-exposed Console token env names.
- Console `apiPost()` now explicitly uses `cache: "no-store"` like `apiGet()`.

Verification passed:

```bash
npm run security:console-routes
npm run typecheck -w apps/dashboard
npm run beta:foundation:verify
```

The updated verifier passed API contract, API privacy, Console route/helper contract, provider/lifecycle boundary, and prototype shortcut audits, plus API typecheck, Console typecheck, and 9 API test suites / 41 tests.

## Xcode State

Xcode 26.5 is installed:

`/Applications/Xcode.app`

Global developer directory has been switched successfully to:

`/Applications/Xcode.app/Contents/Developer`

Verified:

```bash
xcode-select -p
xcodebuild -version
```

`xcodegen` is installed via Homebrew, and the iOS project was generated.

Simulator state:

- `xcodebuild -downloadPlatform iOS` exported the iOS 26.5 runtime.
- The runtime needed a manual import/registration step before CoreSimulator exposed devices:

```bash
xcodebuild -downloadPlatform iOS -exportPath /Users/tantalum/Downloads/XcodePlatforms
xcodebuild -importPlatform /Users/tantalum/Downloads/XcodePlatforms/iphonesimulator_26.5_23F77.exportedBundle
xcrun simctl create FanPass-iPhone-17 com.apple.CoreSimulator.SimDeviceType.iPhone-17 com.apple.CoreSimulator.SimRuntime.iOS-26-5
```

The app was installed and launched with bundle id:

`com.fanpass.app`

## Latest Beta Foundation Update

On 2026-05-29, backend Privy verification was moved behind a narrow verifier boundary:

- Added `apps/api/src/modules/auth/privy-token.service.ts`.
- `PrivyTokenService` now owns Privy JWT algorithm detection, ES256 signature verification, Privy app/verification-key reads, issuer/audience/expiry/not-before claim checks, and PEM normalization.
- `AuthService` now delegates Privy token verification and keeps only FanPass-specific user-linking, role-preservation, local-session, and staff-invite decisions.
- `npm run security:provider-boundaries` now locks the backend Privy verifier boundary so ES256 verifier code cannot drift back into `AuthService`.

Verified:

```bash
npm run security:provider-boundaries
npm run test -w apps/api -- auth.service.spec.ts
npm run typecheck -w apps/api
```

On 2026-05-29, payment side-effect retry idempotency was tightened:

- `SideEffectWorkerService` now passes the durable outbox job idempotency key into `PaymentsService` for `PAYMENT_CAPTURE`, `PAYMENT_CANCEL_AUTHORIZATION`, and `PAYMENT_REFUND`.
- `PaymentsService` now uses that outbox job key for Stripe capture, cancellation, and refund idempotency, with the old payment-scoped key retained only as a fallback outside durable worker execution.
- `npm run security:provider-boundaries` now locks this contract so future changes cannot silently drop the outbox idempotency key at the worker/provider boundary.
- `test/side-effect-worker.service.spec.ts` covers the exact capture/cancel/refund idempotency keys passed to `PaymentsService`.

Verified:

```bash
npm run security:provider-boundaries
npm run test -w apps/api -- side-effect-worker.service.spec.ts
npm run typecheck -w apps/api
npm run beta:foundation:verify
```

On 2026-05-29, the dependency advisory blocker was re-checked and converted into an automated advisory-state gate:

- Added `scripts/dependency-advisory-check.js` and root script `npm run security:dependency-advisories`.
- The check runs production `npm audit`, verifies that only the documented Next/PostCSS advisories remain, confirms npm's forced fix path is still the destructive `next@9.3.3` downgrade, and queries `next@latest` from the npm registry.
- Added the dependency advisory check to `npm run beta:foundation:verify`.
- Current evidence: production audit still reports exactly 2 moderate advisories, `next@latest` is `16.2.6`, and it still declares `postcss: 8.4.31`.
- The dependency blocker is not closed for public or real-user Beta; external testing still requires a clean production audit, a safe Next/PostCSS upgrade path, or explicit risk acceptance.

Verified:

```bash
npm run security:dependency-advisories
```

On 2026-05-29, production-like testnet ownership usage was blocked until real chain settlement no longer depends on synchronous order-settlement calls:

- `validateEnvironment(...)` now rejects `OWNERSHIP_ADAPTER=testnet` in production-like runtimes.
- `OwnershipService` has a runtime guard for the same condition, so direct service construction cannot bypass startup validation.
- `npm run security:provider-boundaries` now locks this guard through `testnetOwnershipProductionGuard`.
- Local Alpha/mock ownership and the side-effect worker still complete through the mock adapter; real chain calls remain a release blocker until the ownership transfer path is fully async saga-owned.

Verified:

```bash
npm run test -w apps/api -- security-config.spec.ts ownership.service.spec.ts
npm run security:provider-boundaries
npm run typecheck -w apps/api
npm run side-effects:verify
npm run beta:foundation:verify
```

On 2026-05-29, ownership settlement was moved closer to a durable async saga:

- `SideEffectWorkerService` now treats `OWNERSHIP_TRANSFER` and `OWNERSHIP_SETTLEMENT_FINALIZE` as separate jobs.
- A successful ownership provider transfer enqueues a `OWNERSHIP_SETTLEMENT_FINALIZE` continuation with the receipt, so database finalization can retry without re-running the ownership provider transfer.
- `OrderbookService.finalizeOwnershipTransfer(...)` owns the Prisma finalization step for matched orders, ticket owner/status transfer, trade creation, payment capture enqueueing, audit logging, and orderbook publication.
- `FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true` lets Prisma order settlement stop after enqueueing ownership transfer instead of synchronously calling the ownership provider in the request path.
- `npm run security:provider-boundaries` now locks the async ownership saga markers through `ownershipAsyncSagaBoundary`.
- `npm run side-effects:verify` now proves the worker completes both an ownership transfer job and a settlement finalization job against Prisma, settling the orders and moving the ticket owner to the buyer.

Verified:

```bash
npm run test -w apps/api -- side-effect-worker.service.spec.ts
npm run security:provider-boundaries
npm run typecheck -w apps/api
npm run side-effects:verify
npm run beta:foundation:verify
```

On 2026-05-29, the local Beta Prisma environment was switched to exercise async ownership settlement end to end:

- `npm run beta:local:start` now runs both the API and side-effect worker with `FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true`.
- `npm run beta:local:verify` now accepts that the sell order response may not contain an immediate trade, then waits for `OWNERSHIP_TRANSFER`, `OWNERSHIP_SETTLEMENT_FINALIZE`, and `PAYMENT_CAPTURE` side effects to complete in the operations snapshot.
- The verified flow now covers API order creation, mock PaymentIntent authorization, sell order matching, worker ownership transfer, worker settlement finalization, trade creation, and payment capture.
- The verification returned a real `ownershipFinalizeSideEffectId`, proving the local Beta happy path is no longer relying on synchronous ownership finalization in the request path.

Verified:

```bash
npm run beta:local:start
npm run beta:local:verify
npm run beta:local:stop
npm run beta:foundation:verify
```

On 2026-05-29, the composite Beta foundation verifier was extended to include side-effect worker saga integration:

- `scripts/beta-foundation-verify.sh` now runs `npm run side-effects:verify` after provider/lifecycle and prototype shortcut audits.
- The composite gate now proves the worker can process ownership transfer and ownership settlement finalization jobs against Prisma, including trade creation and ticket ownership movement, before API/Console typechecks and API unit tests run.
- This makes the async ownership saga part of the normal Beta foundation regression suite instead of a separate optional check.

Verified:

```bash
npm run beta:foundation:verify
```

On 2026-05-29, side-effect worker crash recovery was added for stale processing locks:

- `SideEffectOutboxService.recoverStaleProcessingJobs()` now requeues stale `PROCESSING` jobs as `RETRYING` before each worker pass, using `FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS` with a default of 300 seconds.
- `SideEffectWorkerService.workOnce()` reports how many jobs were recovered before processing the due outbox queue.
- `validateEnvironment(...)` now validates the lock timeout between 30 and 3600 seconds.
- `scripts/side-effects-worker-verify.sh` creates a stale locked ownership job and verifies it is recovered, retried, and completed without disrupting the two-step ownership transfer/finalization saga.
- `scripts/provider-boundary-audit.js` now locks stale lock recovery through `sideEffectStaleLockRecovery`.

Verified:

```bash
npm run test -w apps/api -- side-effect-worker.service.spec.ts security-config.spec.ts
npm run security:provider-boundaries
npm exec -- prettier --check apps/api/src/modules/side-effects/side-effect-outbox.service.ts apps/api/src/modules/side-effects/side-effect-worker.service.ts apps/api/src/config/security-config.ts apps/api/test/side-effect-worker.service.spec.ts apps/api/test/security-config.spec.ts scripts/provider-boundary-audit.js
npm run typecheck -w apps/api
npm run side-effects:verify
npm run beta:foundation:verify
```

On 2026-05-29, a side-effect outbox health gate and admin API boundary were added:

- Added `SideEffectHealthService`, `apps/api/src/workers/side-effect-health-check.ts`, and root script `npm run side-effects:health`.
- Added admin-only `GET /alpha/side-effects/health` so future staging monitoring can read the same redacted outbox health summary through the API.
- The health service reads Prisma outbox status and fails on terminal `FAILED`/`DEAD` jobs, stale `PROCESSING` locks, or stale due `PENDING`/`RETRYING` jobs.
- Health output reports status counts plus failing job id, type, aggregate, attempts, age, and last error without exposing provider payloads.
- `scripts/beta-foundation-verify.sh` now runs the health gate immediately after `npm run side-effects:verify`, so the composite local gate proves the saga finishes and leaves no unhealthy outbox residue.
- `docs/API_RESPONSE_PRIVACY_MATRIX.md` classifies the endpoint as `ADMIN_PRIVATE`, and `test/route-security.spec.ts` locks the endpoint to `ADMIN`.

Verified:

```bash
npm run side-effects:health
npm run security:api-contracts
npm run security:api-privacy
npm run test -w apps/api -- side-effect-health.service.spec.ts route-security.spec.ts security-config.spec.ts
npm run beta:foundation:verify
```

After Admin Side-Effect Health Runtime Coverage on 2026-05-29:

- Extended `scripts/beta-local-verify.sh` so the live local Beta stack now creates a local-only demo admin user after reset, requests a demo admin token, and calls admin-only `GET /alpha/side-effects/health` after async ownership finalization and payment capture complete.
- The local verifier now fails if the health response is unhealthy, malformed, or contains provider/private markers such as payload JSON, client secrets, invite tokens, Stripe secret markers, or Privy verification-key markers.
- Extended `scripts/security-runtime-staging-check.sh` with optional `STAGING_ADMIN_ACCESS_TOKEN` / `FANPASS_STAGING_ADMIN_ACCESS_TOKEN` support. When an admin bearer token is supplied, the staging runtime check verifies the same admin-only health endpoint and redaction markers without printing the token. When no token is supplied, the check reports the health gate as skipped instead of silently implying deployed coverage.
- Verification passed:
  - `bash -n scripts/beta-local-verify.sh`
  - `bash -n scripts/security-runtime-staging-check.sh`
  - `npm run security:runtime:staging:dry-run`
  - `npm run beta:local:start`
  - `npm run beta:local:verify`
  - `npm run beta:local:stop`
  - `npm run beta:foundation:verify`
- Remaining status:
  - local live-stack outbox health now uses the API/admin boundary, not just the direct CLI;
  - real deployed staging still needs HTTPS API/Console URLs and a real admin Privy/session bearer token to exercise this check outside local dry-runs.

After Staging Admin Health Dry-Run Privy Token Pass on 2026-05-29:

- Strengthened `scripts/security-runtime-staging-local-dry-run.sh` so the staging-like API now runs against local Prisma instead of memory, with `FANPASS_DATA_SOURCE=prisma`, `FANPASS_ENABLE_PRISMA_CONNECT=true`, demo auth disabled, and production-like Privy verification enabled.
- The dry-run resets/seeds local Prisma, upserts a local-only admin fixture, generates an ephemeral ES256 keypair, and signs a short-lived Privy-like admin bearer token for `did:privy:admin-demo`. The private key and token stay in the script process/temp directory and are not printed or committed.
- `scripts/security-runtime-staging-check.sh` now always verifies unauthenticated access to `GET /alpha/side-effects/health` is non-2xx, then uses the provided admin bearer token for the positive health check when available.
- Verification passed:
  - `bash -n scripts/security-runtime-staging-check.sh`
  - `bash -n scripts/security-runtime-staging-local-dry-run.sh`
  - `npm run security:runtime:staging:dry-run`
  - `npm run beta:foundation:verify`
- Remaining status:
  - local dry-run now proves the admin health positive path with a production-like Privy bearer and Prisma-backed outbox;
  - the deployed staging gate still requires real HTTPS API/Console URLs and a real admin token from the chosen staging auth source.

After Staging Runtime Evidence Metadata Pass on 2026-05-29:

- Extended `scripts/security-runtime-staging-check.sh` JSON output with `checkedAt`, `localDryRun`, redacted orderbook subscription-target proof, and the admin side-effect health status so deployed staging runs can be saved as auditable evidence.
- Updated `docs/DEPLOYMENT_ENVIRONMENTS.md` with the deployed staging evidence capture command, including safe `STAGING_ADMIN_ACCESS_TOKEN` handling, expected JSON fields, and the requirement to save output under `outputs/staging-runtime/` before summarizing it in the security review.
- Verification passed:
  - `npm run security:runtime:staging:dry-run`
- Remaining status:
  - the tooling now produces better local/deployed evidence metadata;
  - real HTTPS staging URLs and a real staging admin token are still required before the deployed staging gate can be closed.

After Staging Runtime Evidence Validator Pass on 2026-05-29:

- Added `scripts/staging-runtime-evidence-audit.js` and root script `npm run security:runtime:staging:evidence`.
- The validator accepts saved `npm run security:runtime:staging` output, extracts the JSON object even when progress text is present, rejects local dry-run output by default, requires HTTPS API/Console URLs for deployed evidence, requires `"adminSideEffectHealth": "admin side-effect outbox health ok"`, checks required API/Console/WebSocket evidence items, and fails if token, private-key, provider-key, client-secret, Privy secret, or database URL markers are present.
- `docs/DEPLOYMENT_ENVIRONMENTS.md` now requires validating saved deployed staging JSON with this script before marking the staging runtime gate closed.
- Verification passed:
  - `npm run security:runtime:staging:dry-run > /tmp/fanpass-staging-runtime-dry-run-evidence.txt`
  - `npm run security:runtime:staging:evidence -- --allow-dry-run /tmp/fanpass-staging-runtime-dry-run-evidence.txt`
  - default validator mode rejected the same dry-run evidence because `localDryRun` was true and URLs were local HTTP
- Remaining status:
  - the validator is ready for future deployed staging evidence;
  - real HTTPS staging URLs and a real staging admin bearer are still required before the deployed staging gate can close.

After Staging Runtime Evidence Validator Self-Test Pass on 2026-05-29:

- Added `scripts/staging-runtime-evidence-audit-self-test.js` and root script `npm run security:runtime:staging:evidence:self-test`.
- The self-test uses synthetic fixture files to prove deployed HTTPS evidence is accepted, local dry-run evidence is accepted only with `--allow-dry-run`, dry-run evidence is rejected by default, bearer-token markers are rejected, and deployed orderbook origins must be HTTPS.
- `scripts/beta-foundation-verify.sh` now runs the self-test as part of the composite local Beta foundation gate.
- Verification passed:
  - `npm run security:runtime:staging:evidence:self-test`
  - `npm run beta:foundation:verify`
- Remaining status:
  - validator drift is now covered locally without real staging credentials;
  - real HTTPS staging URLs and a real staging admin bearer are still required before the deployed staging gate can close.

After Dedicated Route Role Matrix Gate Pass on 2026-05-29:

- Added root script `npm run security:route-roles`, which runs the API route security/role matrix spec directly.
- `scripts/beta-foundation-verify.sh` now runs the route-role matrix gate before API privacy and provider/lifecycle checks, making access-control drift a named Beta foundation failure.
- Closed the role-based access coverage parent in `docs/DEVELOPMENT_TASKS.md`; all listed sub-items now have focused automated coverage or Console workflow support.
- Verification passed:
  - `npm run security:route-roles`
  - `npm run beta:foundation:verify`
- Remaining status:
  - local route role coverage is explicit;
  - real Privy login, deployed staging checks, production tenant/staff policy validation, and physical-device Ops validation remain open before external Beta.

After Frozen Alpha Demo Script Audit Pass on 2026-05-29:

- Added `docs/ALPHA_DEMO_SCRIPT.md` as the frozen local Alpha walkthrough script.
- The script covers the three product surfaces, local-only seeded roles, `beta:foundation:verify`, `beta:local:start`, `beta:local:verify`, marketplace/settlement, fan access, Console operations, Ops redemption/replay rejection, and a closing security boundary that names remaining Beta blockers.
- Added `scripts/alpha-demo-script-audit.js` and root script `npm run alpha:demo-script:audit`; the audit fails if the script loses required local-only/product-boundary/verification/blocker markers or includes obvious secret markers.
- `scripts/beta-foundation-verify.sh` now runs the Alpha demo script audit as part of the composite local gate.
- Verification passed:
  - `npm run alpha:demo-script:audit`
  - `npm run beta:foundation:verify`
- Remaining status:
  - the walkthrough script is frozen and audited;
  - the actual walkthrough recording remains open.

After Bounded API DTO Validation Pass on 2026-05-29:

- Added bounded field-level validators to API controller request DTOs across auth, events, Alpha operations, tickets, orders, payments, fan access, and verification.
- `scripts/api-contract-audit.js` now fails if controller request-body DTO string fields only use bare `@IsString()` or number fields only use bare `@IsNumber()` without length, format, enum, regex, integer, min, or max bounds.
- Verification passed:
  - `npm run security:api-contracts`
  - `npm run alpha:verify:prisma`
  - `npm run beta:foundation:verify`
- Remaining status:
  - request-body validation is materially stronger;
  - future public-facing params/query DTOs and malformed-input tests still need to grow with new routes.

## Known Issues

- Hardhat warns that Node.js 25.2.1 is not officially supported. Build/test still pass locally, but `.nvmrc`, `.node-version`, and `npm run security:node-runtime-policy` now require Node 22 LTS as the release-evidence runtime.
- `npm audit` reports dependency vulnerabilities, mostly transitive. Do not run `npm audit fix --force` casually because it may break Hardhat/Next/Nest versions.
- Alpha is local-demo complete and has first-pass signed-session/role-guard hardening, but it is still not public-Beta secure. Read `docs/ALPHA_SECURITY_REVIEW.md` before starting external testing or using real personal data.
- Local demo auth is intentionally available outside production. Do not enable `FANPASS_ENABLE_DEMO_AUTH=true` in public environments.
- Xcode project is generated by XcodeGen; edit `apps/ios/FanPass/project.yml` and regenerate rather than manually editing `.xcodeproj` unless necessary.
- The SwiftUI apps read `FanPassAPIBaseURL` from Info.plist/build settings. Debug builds default to `http://localhost:4000`; start the API before using live data in the simulator.
- The fan app intentionally supports guest browsing. Do not reintroduce a launch-time auth wall.
- The consumer `FanPass` target should not request Camera or NFC permissions; scanner and future NFC work belong in `FanPass Ops` unless a separate consumer use case is approved.
- UI changes must follow Clean V4: `FanPass_VI_Redesign_V4/`, `docs/brand/FanPass_VI_Clean_V4_Audit.md`, `docs/brand/FanPass_UI_Guardrails.md`, and `docs/brand/FanPass_Final_Design_Tokens_V4.md`. Do not use archived `docs/archive/brand-v0/BRAND_VI.md` or the `FanPass VI v0.2` Figma page as active visual sources.
- Do not use iOS prototype screenshots as VI artifacts; screenshots are only for engineering QA.
- The staff scanner is intentionally hidden from default fan navigation.
- Do not add new staff features to the consumer app.
- `FanPass Ops` now exists as a separate target. New staff work should go there first.
- The old `fanpass://staff/scanner` bridge has been removed from the fan app product path.
- The scanner has an AVFoundation QR camera path, but it still needs real iPhone validation because the iOS simulator has no camera device.
- The scanner still uses pasteboard payload input as a local QA fallback. `FanPass Ops` now has a Core NFC NDEF reader prototype, but simulator builds can only verify availability/fallback UI; real iPhone validation is required.
- `FanPass Console` is web-first; do not move organizer/admin tables into the fan app.
- Stripe support now has a backend payment foundation plus an iOS PaymentSheet presenter boundary. The backend verifies PaymentIntent creation, webhook state updates, webhook replay handling, idempotency, payment-authorized settlement retry, durable outbox-keyed payment capture/cancel/refund provider retries, local/mock capture, admin refund/cancellation/reconciliation triggers, and redacted Console visibility locally. It still has no real Stripe test-key verification yet.
- Production-like runtimes now reject `OWNERSHIP_ADAPTER=testnet` until the ownership transfer path is fully async saga-owned. Local mock ownership stays available for deterministic Alpha/Beta foundation verification; real testnet chain calls remain blocked for public/staging use.
- Ownership transfer and settlement finalization now have separate worker job types, so finalization retries do not re-run the ownership provider transfer. The async path is still a Beta foundation capability behind `FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true`; real staging/testnet chain enablement remains blocked until deployed worker operations and testnet validation exist.
- Side-effect workers recover stale `PROCESSING` locks before reading due jobs, using `FANPASS_SIDE_EFFECT_LOCK_TIMEOUT_SECONDS`; deployed Beta still needs worker supervision, monitoring, and alerting before real provider side effects are enabled.
- `side-effects:health` and admin-only `GET /alpha/side-effects/health` check the Prisma outbox for dead, failed, stale processing, and stale runnable jobs; `beta:local:verify` now checks the API boundary locally, and deployed staging still needs a real admin bearer token wired into `npm run security:runtime:staging` or monitoring before provider side effects can be trusted.
- `beta:local:start` enables `FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true` for both API and worker, and `beta:local:verify` waits for `OWNERSHIP_TRANSFER`, `OWNERSHIP_SETTLEMENT_FINALIZE`, and `PAYMENT_CAPTURE` to complete through the running local services.
- `beta:foundation:verify` now also runs `side-effects:verify`, so ownership transfer/finalization worker regressions are caught in the composite local gate.
- FanPass iOS now includes the Stripe iOS SDK `StripePaymentSheet` package and a native PaymentSheet presenter boundary. It is configured through `FANPASS_STRIPE_PUBLISHABLE_KEY` and `fanpass-payments://stripe-redirect`, but it intentionally stays blocked in the local in-memory prototype or when real Stripe test keys are absent.
- FanPass iOS now consumes the local Socket.IO orderbook feed in the Market screen. This uses public market payloads only and does not expose owner, payment, QR, scanner, or Privy data.
- `npm run security:runtime:staging:dry-run` now validates the orderbook Socket.IO allowed-origin path and rejects a disallowed origin locally; the deployed HTTPS staging run remains open.
- FanPass Console now has local organizer/admin gate staff assignment management. This reduces the seeded-roster shortcut, but production still needs real Privy-linked staff invitations, tenant policy, and Ops login validation before external Beta.
- `@playwright/test` is installed as a dev dependency for repeatable browser QA. Production audit remains at 2 moderate Next/PostCSS advisories, while full dev audit still includes existing Hardhat/contract-toolchain advisories; see `docs/DEPENDENCY_ADVISORY_LOG.md`.
- Added `npm run security:audit:prod`, `npm run security:audit:all`, and `npm run security:dependency-advisories`. Safe PostCSS override attempts were tested and removed because Next 15.5.18 still installs nested `postcss@8.4.31`; latest checked Next 16.2.6 also still declares `postcss: 8.4.31`. The Next/PostCSS advisory remains an external-testing blocker unless risk-accepted or a safe patched Next path appears.
- FanPass Ops now has an internal Staff access panel for the staff invite boundary. The API client can call `POST /auth/privy/accept-staff-invite` with a future Privy access token plus invite token, then reuse the Privy token for gate-staff API calls. Local demo staff remains available for simulator QA until the real Privy Swift SDK UI is connected.
- Ops screenshot after the staff access pass:
  - `outputs/ios/fanpass-ops-beta-staff-access.jpg`
- Provider cost/feature check on 2026-05-28:
  - Stripe standard/test-mode path is acceptable for Alpha/Beta payment testing; basic webhook endpoints are supported by Stripe docs and no paid add-on is currently required for the planned PaymentIntent/webhook test flow.
  - Privy core auth/wallet functionality appears suitable for low-cost testing, but Privy webhook plan access is ambiguous from public pricing wording. Do not make Privy webhooks a required dependency until verified in the actual Privy dashboard or confirmed by Privy.
- Maintainability is a release constraint. Do not build unstructured provider-specific code that makes future Stripe/Privy/chain/NFC changes require broad rewrites. Keep integrations behind services/adapters, preserve typed contracts, and document any prototype shortcut with a replacement path.
- `npm run security:api-contracts` should run after API controller, DTO, route param/query boundary, order/payment/auth mutation, or idempotency boundary changes.
- `npm run security:api-contracts:self-test` should stay paired with `npm run security:api-contracts` when API contract audit semantics change.
- `npm run security:api-privacy` should run after adding, removing, or changing API controller handlers, FanPass Console route handlers, one-time secret responses, or response exposure.
- `npm run security:provider-boundaries:self-test` should stay paired with `npm run security:provider-boundaries` when provider/lifecycle boundary audit semantics change.
- `npm run security:prototype-shortcuts` should run after adding or changing local demo shortcuts, fallback flows, mock providers, placeholder environment values, or temporary internal access flows.
- `npm run beta:foundation:verify` should run after backend or Console security foundation work when a consolidated local gate is appropriate.
- Order settlement side effects should stay behind `SettlementSideEffectsService`; do not reintroduce ownership/payment/raw outbox service imports into `OrderbookService`.
- Ticket issuance and redemption ownership side effects should stay behind `TicketOwnershipSideEffectsService`; do not reintroduce ownership adapter imports into `TicketsService` or `VerificationService`.

## After Route Parameter Validation Pass on 2026-05-29

- Added reusable API route parameter pipes:
  - `FanPassIdParamPipe` for bounded FanPass resource ids;
  - `GateCodeParamPipe` for bounded gate codes used by Ops scanner summary routes.
- Applied those pipes to controller route params across events, Alpha operations, orders, tickets, payments, fan access, and verification.
- Strengthened `npm run security:api-contracts` so controller route params must use the approved bounded pipes and any future named `@Query(...)` must declare an explicit validation boundary.
- Added Jest coverage for accepted and malformed route ids/gate codes.
- Verification passed:

```bash
npm run test -w apps/api -- --runTestsByPath test/route-param.pipe.spec.ts
npm run security:api-contracts
npm run typecheck -w apps/api
npm run alpha:verify:prisma
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 106/129 tasks, about 82% by checklist count.
- Remaining status: ASR-010 is stronger for current request bodies and route params, but public Beta still needs continued query/param DTO discipline as new surfaces appear, real Privy SDK login, real Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, and real-device validation.

## After Provider Boundary Audit Self-Test Pass on 2026-05-29

- Added `npm run security:provider-boundaries:self-test`.
- The self-test builds temporary provider/lifecycle fixtures and verifies the audit:
  - accepts approved adapter/service placement;
  - rejects Stripe Node SDK imports outside `PaymentsService`;
  - rejects lifecycle services importing provider services directly;
  - rejects `FanPassOps` linking Stripe;
  - rejects payment worker dispatch that stops passing durable outbox idempotency keys.
- Added the self-test to `npm run beta:foundation:verify` before the real workspace provider/lifecycle audit.
- Verification passed:

```bash
npm run security:provider-boundaries:self-test
npm run security:provider-boundaries
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 107/130 tasks, about 82% by checklist count.
- Remaining status: provider/lifecycle boundary semantics are now regression-tested locally, but public Beta still needs real Privy SDK login, real Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After API Contract Audit Self-Test Pass on 2026-05-29

- Added `npm run security:api-contracts:self-test`.
- The self-test builds temporary controller fixtures and verifies the audit:
  - accepts bounded DTOs, route param pipes, query validation boundaries, and idempotency headers;
  - rejects missing global `ValidationPipe` settings;
  - rejects bare string request-body validation;
  - rejects raw route params and unvalidated named query params;
  - rejects missing order creation idempotency headers;
  - rejects unallowlisted bodyless mutations.
- Added the self-test to `npm run beta:foundation:verify` before the real workspace API contract audit.
- Verification passed:

```bash
npm run security:api-contracts:self-test
npm run security:api-contracts
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 108/131 tasks, about 82% by checklist count.
- Remaining status: API contract audit semantics are now regression-tested locally, but public Beta still needs real Privy SDK login, real Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After API Response Privacy Audit Self-Test Pass on 2026-05-30

- Added `npm run security:api-privacy:self-test`.
- The self-test builds temporary API/Console route fixtures and verifies the response privacy audit:
  - accepts documented API and Console response classifications;
  - rejects undocumented handlers, stale matrix rows, route drift, private classifications on public routes, and public classifications on protected routes;
  - rejects non-ADMIN `ADMIN_PRIVATE` routes, provider ingress outside the Stripe webhook boundary, webhook classification drift, public Console route classifications, and one-time Console secret responses that bypass access-token/redaction helpers.
- Added the self-test to `npm run beta:foundation:verify` before the real workspace API response privacy audit.
- Verification passed:

```bash
npm run security:api-privacy:self-test
npm run security:api-privacy
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 109/132 tasks, about 83% by checklist count.
- Remaining status: API/Console response privacy audit semantics are now regression-tested locally, but public Beta still needs real Privy SDK login, real Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Console Route Contract Audit Self-Test Pass on 2026-05-30

- Added `npm run security:console-routes:self-test`.
- The self-test builds temporary FanPass Console route/helper fixtures and verifies the Console contract audit:
  - accepts the documented Privy session bridge, gate-assignment creation proxy, invite-rotation proxy, and shared server API helper contract;
  - rejects missing expected Console routes and unexpected new Console route handlers;
  - rejects session bridge drift that removes organizer/admin gating, leaks sensitive session fields, or weakens HttpOnly cookie handling;
  - rejects gate assignment/invite proxy drift that bypasses `consoleAccessToken()`, forwards raw upstream payloads, or stops encoding assignment ids;
  - rejects shared helper drift that lets demo auth run before the production-like block or reads public client-exposed Console token environment variables.
- Added the self-test to `npm run beta:foundation:verify` before the real workspace Console route contract audit.
- Verification passed:

```bash
npm run security:console-routes:self-test
npm run security:console-routes
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 110/133 tasks, about 83% by checklist count.
- Remaining status: Console route contract audit semantics are now regression-tested locally, but public Beta still needs real Privy SDK login, real Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Dependency Advisory Check Self-Test Pass on 2026-05-30

- Added fixture mode to `scripts/dependency-advisory-check.js` through `FANPASS_DEPENDENCY_ADVISORY_ROOT`, `FANPASS_DEPENDENCY_ADVISORY_AUDIT_JSON`, and `FANPASS_DEPENDENCY_ADVISORY_NEXT_JSON`, so advisory gate semantics can be tested without network access.
- Added `npm run security:dependency-advisories:self-test`.
- The self-test builds temporary advisory-log, production-audit, and `next@latest` metadata fixtures and verifies the advisory gate:
  - accepts the documented unresolved Next/PostCSS advisory state;
  - accepts a clean audit while reporting the closeout warning;
  - rejects undocumented production advisories, severity drift above the documented moderate findings, changed `npm audit fix` paths, newly available safe Next/PostCSS patch paths, missing latest-Next PostCSS metadata, and advisory-log drift that removes the external-testing gate.
- Added the self-test to `npm run beta:foundation:verify` before the live dependency advisory check.
- Verification passed:

```bash
npm run security:dependency-advisories:self-test
npm run security:dependency-advisories
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 111/134 tasks, about 83% by checklist count.
- Remaining status: dependency advisory gate semantics are now regression-tested locally, but the Next/PostCSS advisory remains unresolved and is still an external-testing blocker until a safe patch path appears or an explicit risk acceptance is recorded.

## After Prototype Shortcut Audit Self-Test Pass on 2026-05-30

- Added fixture-root support to `scripts/prototype-shortcut-audit.js` through `FANPASS_PROTOTYPE_SHORTCUT_AUDIT_ROOT`.
- Added `npm run security:prototype-shortcuts:self-test`.
- The self-test builds temporary prototype shortcut registers and verifies the audit:
  - accepts a complete register for `PS-001` through `PS-008`;
  - rejects missing required shortcut sections and unexpected shortcut ids;
  - rejects missing required fields, missing `Release Gate`, and missing evidence markers for shortcut-specific evidence.
- Added the self-test to `npm run beta:foundation:verify` before the real workspace prototype shortcut register audit.
- Verification passed:

```bash
npm run security:prototype-shortcuts:self-test
npm run security:prototype-shortcuts
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 112/135 tasks, about 83% by checklist count.
- Remaining status: prototype shortcut register semantics are now regression-tested locally, but public Beta still requires real Privy SDK login, real Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Alpha Demo Script Audit Self-Test Pass on 2026-05-30

- Added fixture-root support to `scripts/alpha-demo-script-audit.js` through `FANPASS_ALPHA_DEMO_SCRIPT_AUDIT_ROOT`.
- Added `npm run alpha:demo-script:audit:self-test`.
- The self-test builds temporary Alpha demo script fixtures and verifies the audit:
  - accepts a complete local-only walkthrough script fixture;
  - rejects removed local-only scope markers, product surface markers, verification command markers, required scene markers, unresolved Beta blocker markers, and the recording checklist;
  - rejects embedded provider secret markers.
- Added the self-test to `npm run beta:foundation:verify` before the real workspace Alpha demo script audit.
- Verification passed:

```bash
npm run alpha:demo-script:audit:self-test
npm run alpha:demo-script:audit
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 113/136 tasks, about 83% by checklist count.
- Remaining status: Alpha demo script audit semantics are now regression-tested locally, but the walkthrough recording is still open and public Beta still requires real Privy SDK login, real Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Local Runtime Security Check Self-Test Pass on 2026-05-30

- Added `npm run security:runtime:local:self-test`.
- The self-test runs `scripts/security-runtime-check.sh` against a fake `curl` fixture boundary and verifies the checker:
  - accepts the required API, Console, and Privy auth response headers;
  - rejects missing API hardening headers, API `x-powered-by`, missing Privy auth `ratelimit-policy`, missing Console CSP, and Console `x-powered-by`.
- Added the self-test to `npm run beta:foundation:verify` before the staging evidence validator self-test.
- Verification passed:

```bash
npm run security:runtime:local:self-test
bash -n scripts/security-runtime-check-self-test.sh scripts/security-runtime-check.sh scripts/beta-foundation-verify.sh
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 114/137 tasks, about 83% by checklist count.
- Remaining status: local runtime header-check semantics are now regression-tested without live services, but deployed HTTPS staging evidence is still open and public Beta still requires real Privy SDK login, real Stripe signed-webhook validation, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Staging Runtime Security Check Self-Test Pass on 2026-05-30

- Added `npm run security:runtime:staging:self-test`.
- The self-test runs `scripts/security-runtime-staging-check.sh` against fake `curl` and `node` fixture boundaries and verifies the checker:
  - accepts deployed-style HTTPS staging runtime evidence with admin side-effect health enabled;
  - rejects non-HTTPS staging URLs without explicit local override;
  - rejects missing API hardening headers, API `x-powered-by`, missing Console CSP, staging demo-session issuance, unauthenticated side-effect health access, unlocked unauthenticated Console rendering, private admin-health payload markers, and orderbook origin-check failures.
- Added the self-test to `npm run beta:foundation:verify` before the staging evidence validator self-test.
- Verification passed:

```bash
npm run security:runtime:staging:self-test
bash -n scripts/security-runtime-staging-check-self-test.sh scripts/security-runtime-staging-check.sh scripts/beta-foundation-verify.sh
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 115/138 tasks, about 83% by checklist count.
- Remaining status: staging runtime checker semantics are now regression-tested without real staging credentials, but deployed HTTPS staging evidence with real URLs and a real staging admin bearer remains open before external Beta.

## After Beta Local Start Safety Self-Test Pass on 2026-05-30

- Added `npm run beta:local:start:self-test`.
- The self-test runs `scripts/beta-local-start.sh` against fake `screen`, `curl`, `npm`, and process-tool boundaries and verifies the local stack launcher:
  - clears inherited Stripe secret values by default;
  - forwards Stripe settings only when `FANPASS_BETA_USE_STRIPE=true` is explicitly set;
  - preserves `FANPASS_REQUIRE_PAYMENT_AUTHORIZATION=true`, `FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true`, local mock payment mode, and local demo auth for the Beta local API/worker commands;
  - resets the Alpha database by default and honors `FANPASS_BETA_SKIP_DB_RESET=true`.
- Added the self-test to `npm run beta:foundation:verify` before runtime header self-tests.
- Verification passed:

```bash
npm run beta:local:start:self-test
bash -n scripts/beta-local-start-self-test.sh scripts/beta-local-start.sh scripts/beta-foundation-verify.sh
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 116/139 tasks, about 83% by checklist count.
- Remaining status: local Beta startup safety semantics are now regression-tested without launching services or using real credentials, but public Beta still needs real Privy SDK login, Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Provider Boundary Audit Self-Test Expansion on 2026-05-30

- Expanded `npm run security:provider-boundaries:self-test` to cover newer provider/lifecycle audit semantics:
  - rejects `AuthService` owning Privy verifier details instead of delegating to `PrivyTokenService`;
  - rejects removed production-like testnet ownership guard markers;
  - rejects ownership settlement finalization saga drift;
  - rejects stale side-effect `PROCESSING` lock recovery drift.
- This keeps the synthetic fixture coverage aligned with the real workspace provider audit before `npm run security:provider-boundaries` runs.
- Verification passed:

```bash
npm run security:provider-boundaries:self-test
npm run security:provider-boundaries
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 117/140 tasks, about 84% by checklist count.
- Remaining status: provider/lifecycle boundary self-test semantics are stronger, but public Beta still needs real Privy SDK login, Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Route Role Matrix Self-Test Pass on 2026-05-30

- Added `npm run security:route-roles:self-test`.
- The self-test builds synthetic Nest route metadata fixtures and verifies the route-role audit semantics:
  - accepts public routes and routes protected by `FanPassAuthGuard` plus explicit roles;
  - rejects uncovered route handlers;
  - rejects role metadata without `FanPassAuthGuard`;
  - rejects role matrix drift, public/private drift, unexpected handlers, and missing expected handlers.
- Added the self-test to `npm run beta:foundation:verify` before the real workspace `npm run security:route-roles` controller matrix test.
- Verification passed:

```bash
npm run security:route-roles:self-test
npm run security:route-roles
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 118/141 tasks, about 84% by checklist count.
- Remaining status: route role matrix semantics are now regression-tested locally, but public Beta still needs real Privy SDK login, Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Beta Local Verify Self-Test Pass on 2026-05-30

- Added `npm run beta:local:verify:self-test`.
- The self-test runs `scripts/beta-local-verify.sh` against fake network/process boundaries and verifies the embedded local verifier keeps:
  - async ownership transfer and `OWNERSHIP_SETTLEMENT_FINALIZE` checks;
  - local payment capture and `PAYMENT_CAPTURE` side-effect checks;
  - admin-only `GET /alpha/side-effects/health` access through an admin bearer;
  - side-effect health response redaction checks for provider payloads, client secrets, invite tokens, Stripe secret markers, and Privy verification key markers;
  - default Prisma reset and explicit `FANPASS_BETA_VERIFY_SKIP_DB_RESET=true` skip behavior.
- Added the self-test to `npm run beta:foundation:verify` after the Beta local start safety self-test.
- Verification passed:

```bash
npm run beta:local:verify:self-test
bash -n scripts/beta-local-verify-self-test.sh scripts/beta-local-verify.sh scripts/beta-foundation-verify.sh
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 119/142 tasks, about 84% by checklist count.
- Remaining status: local Beta verifier semantics are now regression-tested without live services or credentials, but public Beta still needs real Privy SDK login, Stripe signed-webhook validation, deployed staging evidence, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Side-Effect Health Self-Test Expansion on 2026-05-30

- Added root `npm run side-effects:health:self-test`.
- Expanded `apps/api/test/side-effect-health.service.spec.ts` so side-effect health fixture coverage now verifies:
  - healthy outbox output does not expose provider payloads;
  - stale `PROCESSING` jobs fail health as `stale_processing_lock`;
  - stale `PENDING` and `RETRYING` jobs fail health as `stale_runnable_job`;
  - terminal `FAILED` and `DEAD` jobs fail health as `terminal_or_failed_job`;
  - hidden fixture payload markers do not appear in serialized health output.
- Added the self-test to `npm run beta:foundation:verify` immediately before the live `npm run side-effects:health` command.
- Verification passed:

```bash
npm run side-effects:health:self-test
bash -n scripts/beta-foundation-verify.sh
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 120/143 tasks, about 84% by checklist count.
- Remaining status: side-effect outbox health semantics are stronger locally, but public Beta still needs real Privy SDK login, Stripe signed-webhook validation, deployed staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Side-Effect Worker Verifier Self-Test Pass on 2026-05-30

- Added `npm run side-effects:verify:self-test`.
- The self-test runs `scripts/side-effects-worker-verify.sh` through fake `npm` and `node` boundaries and verifies the worker saga verifier keeps:
  - the direct ownership transfer fixture;
  - stale `PROCESSING` recovery fixture setup;
  - async ownership transfer fixture setup;
  - exactly two `side-effects:work-once` worker passes;
  - ownership finalization job lookup;
  - completed transfer/finalization checks;
  - ticket ownership/status and buy/sell order settlement checks.
- Added the self-test to `npm run beta:foundation:verify` immediately before the live `npm run side-effects:verify` command.
- Verification passed:

```bash
npm run side-effects:verify:self-test
bash -n scripts/side-effects-worker-verify-self-test.sh scripts/side-effects-worker-verify.sh scripts/beta-foundation-verify.sh
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 121/144 tasks, about 84% by checklist count.
- Remaining status: side-effect worker verifier semantics are stronger locally, but public Beta still needs real Privy SDK login, Stripe signed-webhook validation, deployed staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Engineering Quality Gate Audit Pass on 2026-05-30

- Added `npm run security:engineering-gates` and `npm run security:engineering-gates:self-test`.
- The real audit verifies:
  - `npm run beta:foundation:verify` runs provider-boundary self-tests before the real provider/lifecycle audit;
  - the composite verifier also runs the engineering gate self-test and real audit;
  - the provider/lifecycle audit still covers Stripe, Privy, chain, realtime, NFC, scanner, and iOS Stripe provider surfaces;
  - `OrderbookService`, `TicketsService`, and `VerificationService` stay separated from provider SDK/service imports through the narrow side-effect services;
  - QA and provider feasibility docs keep the maintainability constraints explicit.
- The fixture self-test rejects missing composite provider-boundary self-test coverage, missing provider SDK markers, missing lifecycle boundary markers, and missing maintainability documentation markers.
- Closed the two Engineering Quality Gate checklist items for provider adapter isolation and domain lifecycle/provider separation.
- Verification passed:

```bash
npm run security:engineering-gates:self-test
npm run security:engineering-gates
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 127/150 tasks, 84.7% by checklist count.
- Remaining status: engineering maintainability gates are now locally enforced, but public Beta still needs real Privy SDK login, Stripe signed-webhook validation, deployed staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Privy Webhook Optionality Audit Pass on 2026-05-30

- Added `npm run security:privy-webhooks:optional` and `npm run security:privy-webhooks:optional:self-test`.
- The real audit verifies:
  - application code does not add Privy webhook routes/handlers before actual plan support is verified;
  - application code does not require `PRIVY_*WEBHOOK*` secrets before actual plan support is verified;
  - backend `/auth/privy/sync` and `/auth/privy/accept-staff-invite` stay present as the access-token sync boundaries;
  - FanPass Console keeps using `/auth/privy/sync` for the HttpOnly session bridge;
  - the iOS API client keeps token-sync and staff-invite acceptance methods;
  - QA, roadmap, provider feasibility, and task docs keep the webhook optionality decision explicit.
- The fixture self-test rejects Privy webhook routes, required webhook secrets, missing access-token sync, missing optionality docs, and missing composite verifier wiring.
- Added both commands to `npm run beta:foundation:verify` after the dependency advisory gate.
- Marked `Keep Privy webhooks optional until plan support is verified` complete.
- Verification passed:

```bash
npm run security:privy-webhooks:optional:self-test
npm run security:privy-webhooks:optional
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 128/150 tasks, 85.3% by checklist count.
- Remaining status: Privy webhooks are now locally enforced as optional, but public Beta still needs real Privy dashboard plan validation, real Privy SDK login, Stripe signed-webhook validation, deployed staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Settlement Retry Idempotency Audit Pass on 2026-05-30

- Added `npm run security:settlement-retry-idempotency` and `npm run security:settlement-retry-idempotency:self-test`.
- The real audit verifies:
  - side-effect outbox writes are idempotency-key upserts;
  - `RETRYING` jobs remain runnable, claim increments attempts, and retry/dead transitions stay scheduled;
  - ownership transfer and ownership settlement finalization use deterministic durable outbox keys;
  - ownership provider transfer and settlement finalization remain separate worker steps so finalization retries do not re-run the provider transfer;
  - payment capture, authorization cancellation, refund, and admin payment operation jobs use deterministic durable keys;
  - payment capture/cancel/refund worker dispatch passes the outbox job idempotency key into provider calls.
- The fixture self-test rejects non-upsert outbox writes, missing ownership finalization keys, missing payment job idempotency-key forwarding, missing provider idempotency keys, missing worker test coverage, and missing composite verifier wiring.
- Added both commands to `npm run beta:foundation:verify` before the live side-effect worker verifier.
- Marked `Add settlement retry idempotency around payment capture, refund, and ownership retries` complete.
- Verification passed:

```bash
npm run security:settlement-retry-idempotency:self-test
npm run security:settlement-retry-idempotency
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 129/150 tasks, 86.0% by checklist count.
- Remaining status: local settlement retry idempotency is now enforced, but public/real-money Beta still needs real Stripe test-key signed-webhook validation for capture/refund/cancellation/reconciliation, deployed staging evidence with a real admin bearer, real Privy SDK login, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After iOS Distribution Boundary Audit Pass on 2026-05-30

- Added `npm run security:ios-distribution-boundaries` and `npm run security:ios-distribution-boundaries:self-test`.
- The real audit verifies:
  - `FanPass` keeps scanner sources excluded and has no Camera/NFC permissions or Ops entitlements;
  - `FanPass Ops` owns Camera/NFC usage descriptions, the NDEF entitlement, and the `fanpass-ops` URL scheme;
  - `FanPass Ops` does not inherit the consumer Stripe publishable-key setting, Stripe PaymentSheet dependency, or `fanpass-payments` URL scheme;
  - local iOS config remains localhost-only while staging, beta, and production configs stay HTTPS-only and free of server-side secret markers;
  - the ticket wallet keeps Apple Wallet as barcode metadata labeled `Prototype` and does not expose a fake unsigned `.pkpass` flow;
  - distribution, QA, roadmap, and task docs keep the real HTTPS staging, signed `.pkpass`, and real-device blocker language explicit.
- The fixture self-test rejects FanPass camera/NFC drift, missing Ops NFC entitlement, local HTTP in release configs, server-side secret markers in iOS configs, Ops Stripe leakage, fake Apple Wallet pass flows, and missing composite verifier wiring.
- Added both commands to `npm run beta:foundation:verify` after the engineering quality gate audit.
- Marked `Add automated iOS distribution boundary audit for release configs, app capabilities, and Apple Wallet prototype limits` complete.
- Verification passed:

```bash
npm run security:ios-distribution-boundaries:self-test
npm run security:ios-distribution-boundaries
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 130/151 tasks, 86.1% by checklist count.
- Remaining status: local iOS distribution boundaries are now enforced, but public/TestFlight Beta still needs real HTTPS staging/beta API URLs, Apple signing/provisioning, signed Apple Wallet `.pkpass`, real-device NFC validation, real Privy SDK login, real Stripe signed-webhook validation, deployed staging evidence with a real admin bearer, and dependency advisory closure or risk acceptance.

## After Staff Invite Policy Audit Pass on 2026-05-30

- Hardened `AuthService.acceptStaffInvite` so invite acceptance now:
  - rechecks invite status inside a Prisma transaction;
  - requires the linked gate assignment to still be active;
  - revokes pending acceptance if the assignment is inactive;
  - atomically claims only `PENDING` invites with no previous acceptance before linking the target staff user.
- Added `npm run security:staff-invite-policy` and `npm run security:staff-invite-policy:self-test`.
- The real audit verifies:
  - staff invite acceptance requires a verified Privy access token and Prisma storage;
  - acceptance uses a one-time hashed invite token and a pending-only atomic claim;
  - the target account remains `GATE_STAFF` and cannot be claimed by a conflicting linked Privy user;
  - inactive assignments cannot receive invite rotation or acceptance;
  - staff invite and assignment routes stay rate-limited;
  - Console proxies use server-side bearer auth, no-store requests, assignment id encoding, and the redacting response adapter;
  - FanPass Ops links through the shared API client boundary and clears temporary invite/token fields after success.
- The fixture self-test rejects invite acceptance outside a Prisma transaction, missing active assignment checks, non-atomic pending invite claims, missing staff role gates, invite rotation for already linked staff, raw Console assignment forwarding, missing staff invite rate limits, and missing composite verifier wiring.
- Added both commands to `npm run beta:foundation:verify` after the iOS distribution boundary audit.
- Marked `Add automated production staff invitation/linking policy audit for one-time staff invite, active gate assignment, and Console/Ops proxy boundaries` complete.
- Verification passed:

```bash
npm run security:staff-invite-policy:self-test
npm run security:staff-invite-policy
npm run typecheck -w apps/api
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 131/152 tasks, 86.2% by checklist count.
- Remaining status: local staff invitation/linking policy is now stronger and regression-checked, but public Beta still needs real Privy SDK login, real Privy dashboard plan validation, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Prototype Reset Policy Audit Pass on 2026-05-30

- Added `npm run security:prototype-reset-policy` and `npm run security:prototype-reset-policy:self-test`.
- The real audit verifies:
  - `POST /prototype/reset` stays protected by `FanPassAuthGuard`;
  - reset access remains limited to organizer/admin roles, with no fan or gate-staff role drift;
  - the response stays classified as `LOCAL_DEBUG` in `docs/API_RESPONSE_PRIVACY_MATRIX.md`;
  - the reset endpoint is registered as `PS-009` in `docs/PROTOTYPE_SHORTCUT_REGISTER.md`;
  - local prototype start/verify scripts use a seeded organizer bearer token before calling reset;
  - `npm run beta:foundation:verify` runs the self-test before the real audit.
- The fixture self-test rejects public reset access, missing guards, fan-role exposure, missing privacy classification, missing shortcut registration, unauthenticated reset scripts, and missing composite verifier wiring.
- Added both commands to `npm run beta:foundation:verify` after the staff invite policy audit and before the general prototype shortcut register audit.
- Marked `Add automated prototype reset policy audit for local-debug route access, privacy classification, and authenticated local scripts` complete.
- Verification passed:

```bash
npm run security:prototype-reset-policy:self-test
npm run security:prototype-reset-policy
npm run security:prototype-shortcuts:self-test
npm run security:prototype-shortcuts
```

- Current progress: Beta foundation/security hardening is 132/153 tasks, 86.3% by checklist count.
- Remaining status: the stale public-reset finding is closed for the local Beta foundation, but public Beta still needs real Privy SDK login, real Privy dashboard plan validation, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Security Header Policy Audit Pass on 2026-05-30

- Added `npm run security:headers-policy` and `npm run security:headers-policy:self-test`.
- The real audit verifies:
  - API bootstrap keeps Helmet configured with frameguard/referrer policy and intentionally local-safe HSTS/CSP settings;
  - API powered-by disclosure stays disabled;
  - API JSON/urlencoded request body limits remain configured;
  - general/auth/Privy/staff-invite/staff-assignment/verification rate-limit boundaries stay present;
  - FanPass Console keeps Next powered-by disabled and baseline security headers, including `Content-Security-Policy`;
  - local runtime, staging runtime, and staging evidence validators keep header, powered-by, HTTPS, admin-health, dry-run, and secret-marker checks wired;
  - QA, roadmap, provider feasibility, and security review docs keep ASR-011 local mitigation and deployed-staging limits explicit.
- The fixture self-test rejects missing Helmet, API powered-by drift, missing Console CSP, missing local runtime powered-by assertion, missing staging HTTPS enforcement, missing staging evidence dry-run validation, missing composite verifier wiring, and missing documentation markers.
- Added both commands to `npm run beta:foundation:verify` after the local/staging runtime checker self-tests.
- Marked `Add static security header policy audit for API Helmet, Console CSP, runtime checks, and staging evidence gates` complete.
- Verification passed:

```bash
npm run security:headers-policy:self-test
npm run security:headers-policy
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 133/154 tasks, 86.4% by checklist count.
- Remaining status: ASR-011 is locally mitigated and regression-checked, but external/public Beta still needs saved real HTTPS staging evidence with a real staging admin bearer, plus real Privy SDK login and dashboard plan validation, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device validation.

## After Chain Operator Key Boundary Audit Pass on 2026-05-30

- Added `npm run security:chain-operator-key` and `npm run security:chain-operator-key:self-test`.
- The real audit verifies:
  - production-like `OWNERSHIP_ADAPTER=testnet` remains blocked in startup validation and the `OwnershipService` runtime boundary;
  - `ethers` stays dynamically loaded only inside the explicit testnet ownership adapter path;
  - `TESTNET_OPERATOR_PRIVATE_KEY` stays inside the ownership service and is not logged, returned, or persisted;
  - `npm run beta:local:start` pins API and worker ownership to `OWNERSHIP_ADAPTER=mock`;
  - API env examples and Alpha runbook docs use placeholder-only operator key values, not copyable private-key patterns;
  - QA, roadmap, provider feasibility, and ASR-014 docs keep the vault/KMS or delegated signer plus multisig/timelock blocker explicit;
  - `npm run beta:foundation:verify` runs the self-test before the real audit.
- The fixture self-test rejects removed production-like testnet guards, static `ethers` imports, operator private-key logging, local Beta testnet startup drift, exact private-key assignments in examples, copyable `0x...` key docs, missing composite verifier wiring, and missing ASR-014 documentation markers.
- Added both commands to `npm run beta:foundation:verify` after the provider/lifecycle boundary audit and before the engineering quality gate audit.
- Marked `Add automated chain operator key boundary audit for production-like testnet blocking, dynamic signer adapter loading, placeholder-only key examples, and KMS/multisig blocker documentation` complete.
- Verification passed:

```bash
npm run security:chain-operator-key:self-test
npm run security:chain-operator-key
npm run security:provider-boundaries
npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 134/155 tasks, 86.5% by checklist count.
- Remaining status: ASR-014 is locally partially mitigated and regression-checked, but public Beta/pilot still needs real vault/KMS or delegated signer integration, multisig/timelock/admin separation for contract ownership, key rotation and incident runbooks, plus real Privy SDK login/dashboard validation, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and real-device NFC validation.

## After iOS Debug Payload Boundary Pass on 2026-05-30

- Debug-gated local payload copy/paste helpers before external TestFlight decisions:
  - FanPass Wallet `Copy entry payload` and `Copy barcode JSON` buttons now compile only under `#if DEBUG`;
  - FanPass Ops scanner paste text field/button and paste fallback hint now compile only under `#if DEBUG`;
  - FanPass Ops shell `Fallback: Paste` metric now compiles only under `#if DEBUG`;
  - non-debug Ops scanner waiting copy is QR/NFC-only.
- Extended `npm run security:ios-distribution-boundaries` so it verifies debug-gated payload copy/paste helpers in addition to release URLs, target capabilities, secret-free xcconfigs, and signed `.pkpass` blockers.
- Extended `npm run security:ios-distribution-boundaries:self-test` with fixture cases that reject wallet payload copy outside debug, Ops paste payload entry outside debug, Ops shell paste fallback metric drift, and missing debug payload documentation.
- Updated `docs/PROTOTYPE_SHORTCUT_REGISTER.md` PS-005 from Ops-only paste fallback to debug payload copy/paste helpers, keeping the release gate explicit.
- Marked `Debug-gate iOS payload copy/paste helpers and lock the boundary in the iOS distribution audit before external TestFlight decisions` complete.
- Verification passed:

```bash
npm run security:ios-distribution-boundaries:self-test
npm run security:ios-distribution-boundaries
npm run security:prototype-shortcuts
```

- Current progress: Beta foundation/security hardening is 135/156 tasks, 86.5% by checklist count.
- Remaining status: debug simulator payload tools are now locally gated and regression-checked, but public/TestFlight Beta still needs real Privy SDK login/dashboard validation, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, Apple signing/provisioning, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and chain operator key hardening with vault/KMS or delegated signer plus multisig/timelock.

## After Alpha Walkthrough Evidence Gate Pass on 2026-05-30

- Added `docs/ALPHA_WALKTHROUGH_EVIDENCE.md` as the local-only evidence contract for the frozen Alpha walkthrough recording.
- Added `npm run alpha:walkthrough:evidence:audit` and `npm run alpha:walkthrough:evidence:audit:self-test`.
- The real audit verifies:
  - the evidence contract keeps local-only scope explicit;
  - all seven frozen walkthrough scenes remain required;
  - the recording artifact path stays under `outputs/alpha-walkthrough/`;
  - the required verification commands stay named: `npm run beta:foundation:verify`, `npm run beta:local:start`, `npm run beta:local:verify`, and `npm run beta:local:stop`;
  - forbidden evidence markers such as Stripe secret prefixes, Privy verification key assignments, private-key blocks, and bearer-token strings are rejected;
  - `docs/DEVELOPMENT_TASKS.md` keeps the actual walkthrough recording task open until a real artifact set exists.
- The fixture self-test rejects missing local-only scope, missing seven-scene coverage, premature recording-task closeout, embedded provider secret markers, and missing composite verifier wiring.
- Added both commands to `npm run beta:foundation:verify` immediately after the frozen demo script audit.
- Marked `Add repeatable Alpha walkthrough recording evidence gate before closing the local walkthrough task` complete.
- Verification passed:

```bash
npm run alpha:walkthrough:evidence:audit:self-test
npm run alpha:walkthrough:evidence:audit
```

- Current progress: Beta foundation/security hardening is 136/157 tasks, 86.6% by checklist count.
- Remaining status: the walkthrough recording itself is still intentionally open; it now requires a local-only artifact set under `outputs/alpha-walkthrough/` plus the Beta foundation and local verifier evidence before closeout. Public/TestFlight Beta remains blocked by real Privy SDK login/dashboard validation, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, Apple signing/provisioning, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and chain operator key hardening with vault/KMS or delegated signer plus multisig/timelock.

## After Alpha Walkthrough Capture Automation Pass on 2026-05-30

- Added `npm run alpha:walkthrough:capture` as a repeatable local artifact bundle command for the frozen Alpha walkthrough.
- The capture command:
  - runs `npm run alpha:demo-script:audit`;
  - runs `npm run alpha:walkthrough:evidence:audit`;
  - runs `npm run beta:foundation:verify`;
  - starts the local Beta stack with `npm run beta:local:start`;
  - runs `npm run beta:local:verify`;
  - captures a FanPass Console screenshot through `npm run console:verify:local`;
  - stops the local stack with `npm run beta:local:stop`;
  - writes command logs, a screenshot, and a manifest under `outputs/alpha-walkthrough/<timestamp>/`;
  - scans generated logs/manifests for obvious Stripe, Privy, private-key, and bearer-token markers.
- Added `npm run alpha:walkthrough:capture:self-test` with a fake npm boundary that verifies command order, output files, screenshot path handling, no-secret marker checks, and the manifest language that keeps the walkthrough recording open.
- Extended `npm run alpha:walkthrough:evidence:audit` so the evidence contract must mention the capture command, the capture automation task must be checked, and `npm run beta:foundation:verify` must run the capture self-test.
- Added the capture self-test to `npm run beta:foundation:verify` immediately after the walkthrough evidence audit.
- Marked `Add repeatable Alpha walkthrough capture automation and self-test for local artifact bundles` complete.
- Verification passed:

```bash
npm run alpha:walkthrough:evidence:audit:self-test
npm run alpha:walkthrough:evidence:audit
npm run alpha:walkthrough:capture:self-test
bash -n scripts/alpha-walkthrough-capture.sh scripts/alpha-walkthrough-capture-self-test.sh scripts/beta-foundation-verify.sh
```

- Current progress: Beta foundation/security hardening is 137/158 tasks, 86.7% by checklist count.
- Remaining status at that time: the actual human-reviewed Alpha walkthrough recording was still open. Later on 2026-06-04 the owner removed the recording requirement from current Beta foundation blockers. Public/real-user Beta remains blocked by signed iOS/TestFlight staging evidence, public dependency readiness, signed Wallet evidence, physical QR/NFC validation, and chain custody evidence.

## After Alpha Walkthrough Evidence Bundle Capture on 2026-05-30

- Ran `npm run alpha:walkthrough:capture` and produced a reviewed local evidence bundle, superseded by the 2026-06-04 clean capture:
  - `outputs/alpha-walkthrough/20260604T122652Z/manifest.md`
  - `outputs/alpha-walkthrough/20260604T122652Z/fanpass-console.png`
  - command logs for the demo script audit, walkthrough evidence audit, Beta foundation verifier, local Beta start/verify/stop flow, and Console visual check.
- The capture confirmed:
  - `npm run beta:foundation:verify` passed with API typecheck, Console typecheck, side-effect health, and 11 API test suites / 54 tests;
  - `npm run beta:local:verify` passed through local Prisma order settlement, async ownership finalization, payment capture, and admin-only side-effect health;
  - `npm run console:verify:local` captured a FanPass Console screenshot without runtime errors;
  - `npm run beta:local:stop` stopped the local stack cleanly;
  - the generated bundle had no obvious Stripe, Privy, private-key, or bearer-token markers from the capture scan.
- Marked `Capture and review a local Alpha walkthrough evidence bundle with the repeatable capture command` complete.
- Verification passed:

```bash
npm run alpha:walkthrough:capture
npm run security:evidence-redaction -- outputs/alpha-walkthrough/20260604T122652Z
```

- Current progress: Beta foundation/security hardening is 138/159 tasks, 86.8% by checklist count.
- Remaining status at that time: the human-reviewed walkthrough recording was still open. Later on 2026-06-04 the owner removed the recording requirement from current Beta foundation blockers. The local bundle supports optional future recording review but does not prove public/real-user Beta readiness; remaining blockers are signed iOS/TestFlight staging evidence, public dependency readiness, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and chain custody evidence.

## After Node Runtime Policy Gate on 2026-05-30

- Added Node 22 LTS runtime pins:
  - `.nvmrc`
  - `.node-version`
  - root `package.json` and `package-lock.json` `engines.node` set to `>=22 <23`.
- Added `npm run security:node-runtime-policy` and `npm run security:node-runtime-policy:self-test`.
- Wired both commands into `npm run beta:foundation:verify` before dependency advisory checks.
- The audit verifies Node 22 LTS pins, lockfile/package engine drift, docs mentioning Hardhat runtime expectations, and composite verifier wiring. It reports a warning when the active shell is not Node 22 unless strict runtime mode is enabled.
- Current shell note: `node -v` reports `v25.2.1`, so authoritative Hardhat contract/security/dependency evidence should be regenerated under Node 22 LTS before external Beta decisions.
- Marked `Pin Node 22 LTS for Hardhat/security tooling and add an automated runtime policy audit` complete.
- Verification passed:

```bash
npm run security:node-runtime-policy:self-test
npm run security:node-runtime-policy
```

- Current progress: Beta foundation/security hardening is 139/160 tasks, 86.9% by checklist count.
- Remaining status: Node runtime policy drift is guarded, but public/TestFlight Beta remains blocked by real Privy SDK login/dashboard validation, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, actually running release evidence on Node 22 LTS, real iOS staging/beta URLs, Apple signing/provisioning, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and chain operator key hardening with vault/KMS or delegated signer plus multisig/timelock.

## After Node 22 Evidence Pass on 2026-05-30

- Installed Homebrew `node@22` and added `scripts/with-node-22.sh`, which discovers the keg-only Homebrew Node 22 runtime or an NVM Node 22 runtime and executes a command with that runtime first in `PATH`.
- Added package scripts:
  - `tooling:node22`
  - `tooling:node22:verify`
- Restored the broken linked Homebrew `node` formula after the `node@22` install changed shared Homebrew libraries; the global shell now reports Node `26.0.0`, while the helper reports Node `22.22.3`.
- Reran release-evidence checks through `scripts/with-node-22.sh`:
  - `npm run security:node-runtime-policy` passed with `currentRuntime: "22.22.3"` and no warning;
  - `npm run test -w packages/contracts` passed without the unsupported Node warning;
  - `npm run security:dependency-advisories` passed and still reports only the known unresolved Next/PostCSS production advisories;
  - `npm run beta:foundation:verify` passed under Node 22, including API/Console typechecks, side-effect health, and 11 API test suites / 54 tests.
- Marked `Add a Node 22 helper and rerun contract, dependency, and Beta foundation evidence under Node 22` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:node-runtime-policy
scripts/with-node-22.sh npm run test -w packages/contracts
scripts/with-node-22.sh npm run security:dependency-advisories
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 140/161 tasks, 87.0% by checklist count.
- Remaining status: Node 22 local evidence now exists, but public/TestFlight Beta remains blocked by real Privy SDK login/dashboard validation, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, CI/developer-shell Node 22 pinning, real iOS staging/beta URLs, Apple signing/provisioning, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and chain operator key hardening with vault/KMS or delegated signer plus multisig/timelock.

## After CI Node 22 Workflow Pass on 2026-05-30

- Added `.github/workflows/beta-foundation.yml` as the CI Node 22 Beta foundation workflow.
- The workflow uses `actions/setup-node@v4` with `node-version-file: .nvmrc`, runs `npm ci`, supplies a local `postgres:16-alpine` service, sets `FANPASS_STRICT_NODE_RUNTIME=true`, skips local Docker Compose Postgres startup with `FANPASS_SKIP_DOCKER_POSTGRES=true`, and runs `npm run beta:foundation:verify`.
- Added `npm run security:ci-node22-workflow` and `npm run security:ci-node22-workflow:self-test`, then wired both into `npm run beta:foundation:verify` after the Node runtime policy audit.
- Updated `scripts/alpha-db-reset.sh` so CI can use the GitHub Actions Postgres service without trying to start a second local Docker Compose Postgres instance on the same port.
- Marked `Add CI Node 22 Beta foundation workflow and static workflow audit` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:ci-node22-workflow:self-test
scripts/with-node-22.sh npm run security:ci-node22-workflow
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 141/162 tasks, 87.0% by checklist count.
- Remaining status: CI and local helper coverage now pin authoritative Node 22 Beta foundation evidence, but the global Homebrew shell still reports Node `26.0.0`. Public/TestFlight Beta remains blocked by real Privy SDK login/dashboard validation, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, Apple signing/provisioning, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and chain operator key hardening with vault/KMS or delegated signer plus multisig/timelock.

## After Developer Shell Node 22 Enforcement on 2026-05-30

- Added `.npmrc` with `engine-strict=true` so npm install/ci flows reject unsupported Node majors instead of only warning from package `engines`.
- Extended `npm run security:node-runtime-policy` and `npm run security:node-runtime-policy:self-test` to verify `.npmrc` `engine-strict`, alongside `.nvmrc`, `.node-version`, package engine ranges, helper discovery, docs, and composite verifier wiring.
- Marked `Add developer-shell npm engine-strict enforcement for the Node 22 runtime policy` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:node-runtime-policy:self-test
scripts/with-node-22.sh npm run security:node-runtime-policy
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 142/163 tasks, 87.1% by checklist count.
- Remaining status: developer-shell installs and CI are now pinned to Node 22 policy, but the global Homebrew shell still reports Node `26.0.0`; use `scripts/with-node-22.sh` unless the active shell is switched. Public/TestFlight Beta remains blocked by real Privy SDK login/dashboard validation, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, Apple signing/provisioning, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and chain operator key hardening with vault/KMS or delegated signer plus multisig/timelock.

## After Stripe Test-Mode Evidence Gate on 2026-05-30

- Added `docs/STRIPE_TESTMODE_EVIDENCE.md` as the saved-evidence contract for real Stripe test-mode validation.
- Added `npm run security:stripe-testmode:evidence` to validate saved Stripe test-mode evidence JSON before closing PaymentIntent, signed-webhook, capture, cancellation, refund, or reconciliation Beta blockers.
- Added `npm run security:stripe-testmode:evidence:self-test` and wired it into `npm run beta:foundation:verify` after the Privy webhook optionality audit.
- The validator rejects local mock evidence, leaked Stripe secret/webhook/client-secret markers, missing signed raw-body webhook verification, missing duplicate replay idempotency, missing capture/cancellation/refund/reconciliation proof, missing retry idempotency, and unhealthy residual side-effect outbox state.
- Marked `Add Stripe test-mode evidence validator and self-test with npm run security:stripe-testmode:evidence` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:stripe-testmode:evidence:self-test
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 143/164 tasks, 87.2% by checklist count.
- Remaining status: the real Stripe test-mode runs are still open until saved evidence from real test keys and signed webhooks passes `npm run security:stripe-testmode:evidence`; public/TestFlight Beta also remains blocked by real Privy SDK login/dashboard validation, production tenant/staff policy validation in staging, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, Apple signing/provisioning, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and chain operator key hardening.

## After Privy Dashboard Evidence Gate on 2026-05-30

- Added `docs/PRIVY_PLAN_EVIDENCE.md` as the saved-evidence contract for actual Privy dashboard plan validation.
- Added `npm run security:privy-plan:evidence` to validate saved Privy dashboard evidence JSON before closing mobile SDK, embedded wallet, backend token verification, webhook, custom auth UI, or MFA/policy plan-support blockers.
- Added `npm run security:privy-plan:evidence:self-test` and wired it into `npm run beta:foundation:verify` after the Privy webhook optionality audit.
- The validator rejects unreviewed dashboard evidence, leaked Privy app secrets, verification keys, access tokens, private keys, unknown feature support status, webhooks as a required Beta dependency, SDK-unblock drift, and missing redaction proof.
- Marked `Add Privy dashboard plan evidence validator and self-test with npm run security:privy-plan:evidence` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:privy-plan:evidence:self-test
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 144/165 tasks, 87.3% by checklist count.
- Remaining status: the actual Privy dashboard review is still open until saved evidence passes `npm run security:privy-plan:evidence`; public/TestFlight Beta also remains blocked by real Privy SDK login, real Stripe test-mode evidence, production tenant/staff policy validation in staging, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, Apple signing/provisioning, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and chain operator key hardening.

## After Apple Wallet Signed-Pass Evidence Gate on 2026-05-30

- Added `docs/APPLE_WALLET_PASS_EVIDENCE.md` as the saved-evidence contract for real signed Apple Wallet `.pkpass` validation.
- Added `npm run security:apple-wallet:evidence` to validate future Wallet evidence JSON before closing the signed-pass blocker.
- Added `npm run security:apple-wallet:evidence:self-test` and wired it into `npm run beta:foundation:verify` after the Stripe test-mode evidence self-test.
- The validator rejects local unsigned barcode prototype evidence, leaked Apple signing private-key/certificate markers, exported certificate private keys, simulator-only proof, invalid barcode formats, pass contents with real personal/payment data, and missing redaction proof.
- Marked `Add signed Apple Wallet .pkpass evidence validator and self-test with npm run security:apple-wallet:evidence` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:apple-wallet:evidence:self-test
scripts/with-node-22.sh npm exec -- prettier --check scripts/apple-wallet-pass-evidence-audit.js scripts/apple-wallet-pass-evidence-audit-self-test.js package.json docs/APPLE_WALLET_PASS_EVIDENCE.md docs/CODEX_HANDOFF.md docs/DEVELOPMENT_TASKS.md docs/ALPHA_SECURITY_REVIEW.md docs/QA_CHECKLIST.md docs/BETA_ROADMAP.md docs/PROVIDER_COST_FEASIBILITY.md
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 145/166 tasks, 87.3% by checklist count.
- Remaining status: real Apple signing/provisioning and physical-device `.pkpass` validation are still open until saved evidence passes `npm run security:apple-wallet:evidence`; public/TestFlight Beta also remains blocked by real Privy SDK login, saved Privy dashboard evidence, real Stripe test-mode evidence, production tenant/staff policy validation in staging, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, physical QR/NFC validation, and chain operator key hardening.

## After FanPass Ops Device Scanner Evidence Gate on 2026-05-30

- Added `docs/OPS_SCANNER_DEVICE_EVIDENCE.md` as the saved-evidence contract for real FanPass Ops physical QR/NFC scanner validation.
- Added `npm run security:ops-scanner:device-evidence` to validate future real-device scanner evidence before closing physical QR/NFC blockers.
- Added `npm run security:ops-scanner:device-evidence:self-test` and wired it into `npm run beta:foundation:verify` after the Apple Wallet evidence self-test.
- The validator rejects simulator-only proof, localhost or non-HTTPS API evidence, debug paste fallback use, leaked bearer/private-key markers, missing physical NFC tag proof, missing QR replay and invalid-payload proof, missing backend authority proof, real-user or production credential evidence, and missing redaction proof.
- Marked `Add physical FanPass Ops QR/NFC scanner evidence validator and self-test with npm run security:ops-scanner:device-evidence` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:ops-scanner:device-evidence:self-test
scripts/with-node-22.sh npm exec -- prettier --check scripts/ops-scanner-device-evidence-audit.js scripts/ops-scanner-device-evidence-audit-self-test.js package.json docs/OPS_SCANNER_DEVICE_EVIDENCE.md docs/CODEX_HANDOFF.md docs/DEVELOPMENT_TASKS.md docs/ALPHA_SECURITY_REVIEW.md docs/QA_CHECKLIST.md docs/BETA_ROADMAP.md docs/PROVIDER_COST_FEASIBILITY.md
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 146/167 tasks, 87.4% by checklist count.
- Remaining status: physical QR/NFC scanner validation is still open until saved evidence passes `npm run security:ops-scanner:device-evidence`; public/TestFlight Beta also remains blocked by real Privy SDK login, saved Privy dashboard evidence, real Stripe test-mode evidence, production tenant/staff policy validation in staging, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and chain operator key hardening.

## After Chain Custody Evidence Gate on 2026-05-30

- Added `docs/CHAIN_CUSTODY_EVIDENCE.md` as the saved-evidence contract for ASR-014 chain custody and contract-control closure.
- Added `npm run security:chain-custody:evidence` and `npm run security:chain-custody:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the chain operator key boundary audit.
- The validator requires future saved evidence to prove vault/KMS or delegated signer custody, no raw private-key access by the app, signer policy/audit logs, multisig ownership, timelock/admin delay, durable outbox-only chain calls, ownership transfer/finalization and stale recovery proof, healthy residual outbox state, rotation/incident/disable runbooks, monitoring, and redaction.
- The validator rejects local mock-only proof, production credential or real-user evidence, raw private-key/token/seed markers, copyable `0x` 64-hex values, secret-bearing JSON fields, missing custody proof, hot-key contract ownership, direct request-path chain calls, unhealthy outbox state, missing runbooks, and missing redaction proof.
- Marked `Add chain custody evidence validator and self-test for vault/KMS or delegated signer, multisig/timelock, durable outbox, runbook, and redaction proof before real chain blockers are closed` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:chain-custody:evidence:self-test
bash -n scripts/beta-foundation-verify.sh
scripts/with-node-22.sh npm exec -- prettier --write scripts/chain-custody-evidence-audit.js scripts/chain-custody-evidence-audit-self-test.js package.json docs/CHAIN_CUSTODY_EVIDENCE.md docs/DEVELOPMENT_TASKS.md docs/BETA_ROADMAP.md docs/QA_CHECKLIST.md docs/PROVIDER_COST_FEASIBILITY.md docs/ALPHA_SECURITY_REVIEW.md
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 147/168 tasks, 87.5% by checklist count.
- Remaining status: real chain custody validation is still open until saved evidence passes `npm run security:chain-custody:evidence`; public/TestFlight Beta also remains blocked by real Privy SDK login, saved Privy dashboard evidence, real Stripe test-mode evidence, production tenant/staff policy validation in staging, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, and physical QR/NFC validation.

## After Staff Tenant Staging Evidence Gate on 2026-05-30

- Added `docs/STAFF_TENANT_STAGING_EVIDENCE.md` as the saved-evidence contract for production-like staging tenant and staff policy validation.
- Added `npm run security:staff-tenant:staging-evidence` and `npm run security:staff-tenant:staging-evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the staff invite policy audit.
- The validator requires future saved evidence to prove HTTPS staging API/Console URLs, production-like config, isolated staging database, verified Privy-backed Console/Ops sessions, seeded demo auth rejection, organizer tenant isolation, one-time staff invite display and replay rejection, superseded/deactivated invite behavior, cross-organizer rejection, assigned-gate-only Ops access, client-supplied staff rejection, and redaction.
- The validator rejects local dry-run proof, demo auth, localhost or non-HTTPS URLs, raw bearer/Privy/invite tokens, raw emails or identity fields, missing organizer isolation proof, missing verified Privy auth proof, missing one-time invite/revocation proof, missing Ops gate-assignment proof, real-user or production credential evidence, and missing redaction proof.
- Marked `Add staging tenant/staff policy evidence validator and self-test for organizer isolation, Privy-backed staff invite acceptance, Ops gate scoping, and redaction before production staff blockers are closed` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:staff-tenant:staging-evidence:self-test
bash -n scripts/beta-foundation-verify.sh
scripts/with-node-22.sh npm exec -- prettier --write scripts/staff-tenant-staging-evidence-audit.js scripts/staff-tenant-staging-evidence-audit-self-test.js package.json docs/STAFF_TENANT_STAGING_EVIDENCE.md docs/CODEX_HANDOFF.md docs/DEVELOPMENT_TASKS.md docs/ALPHA_SECURITY_REVIEW.md docs/QA_CHECKLIST.md docs/BETA_ROADMAP.md docs/PROVIDER_COST_FEASIBILITY.md
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 148/169 tasks, 87.6% by checklist count.
- Remaining status: production tenant/staff policy validation is still open until saved staging evidence passes `npm run security:staff-tenant:staging-evidence`; public/TestFlight Beta also remains blocked by real Privy SDK login, saved Privy dashboard evidence, real Stripe test-mode evidence, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and saved chain custody evidence.

## After Hosted CI Evidence Gate on 2026-05-30

- Added `docs/CI_HOSTED_EVIDENCE.md` as the saved-evidence contract for hosted GitHub Actions Beta foundation runs.
- Added `npm run security:ci-hosted:evidence` and `npm run security:ci-hosted:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the static CI Node 22 workflow audit.
- The validator requires future saved evidence to prove a successful hosted `FanPass Beta Foundation` GitHub Actions run on `ubuntu-latest`, Node 22 from `.nvmrc`, strict Node runtime mode, `npm ci`, a healthy `postgres:16-alpine` service, the full Beta foundation verifier, dependency advisory gate, side-effect health gate, API unit tests, and no provider secrets.
- The validator rejects local dry-run proof, failed or forked runs, non-GitHub Actions URLs, non-Node-22 runtime evidence, missing `.nvmrc` setup, missing `npm ci`, missing Postgres service proof, missing full verifier proof, provider secret availability, production credential evidence, and missing log-redaction proof.
- Marked `Add hosted GitHub Actions evidence validator and self-test for successful Node 22 Beta foundation runs before hosted CI evidence is trusted` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:ci-hosted:evidence:self-test
bash -n scripts/beta-foundation-verify.sh
scripts/with-node-22.sh npm exec -- prettier --write scripts/ci-hosted-evidence-audit.js scripts/ci-hosted-evidence-audit-self-test.js package.json docs/CI_HOSTED_EVIDENCE.md docs/CODEX_HANDOFF.md docs/DEVELOPMENT_TASKS.md docs/ALPHA_SECURITY_REVIEW.md docs/QA_CHECKLIST.md docs/BETA_ROADMAP.md docs/PROVIDER_COST_FEASIBILITY.md
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 149/170 tasks, 87.6% by checklist count.
- Remaining status: hosted CI evidence is still open until a successful GitHub Actions run is saved and passes `npm run security:ci-hosted:evidence`; public/TestFlight Beta also remains blocked by real Privy SDK login, saved Privy dashboard evidence, real Stripe test-mode evidence, production tenant/staff policy validation in staging, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, physical QR/NFC validation, and saved chain custody evidence.

## After Dependency Risk Evidence Gate on 2026-05-30

- Added `docs/DEPENDENCY_RISK_EVIDENCE.md` as the saved-evidence contract for dependency advisory clean closeout or explicit closed-beta risk acceptance.
- Added `npm run security:dependency-risk:evidence` and `npm run security:dependency-risk:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the live dependency advisory state check.
- The validator accepts clean production audit evidence or unresolved-advisory evidence that proves Node 22 production-audit commands, exactly the known moderate Next/PostCSS findings, no high/critical advisories, no safe patched path, closed-beta-only owner acceptance, expiry within 90 days, review cadence no longer than 30 days, mitigation coverage, and redaction.
- The validator rejects undocumented packages, severity drift, newly available safe patch paths, missing or overbroad risk acceptance, stale/long-lived acceptance, missing mitigations, bearer tokens, Stripe/Privy/provider secret markers, database URLs, private keys, and real personal data markers.
- Marked `Add dependency risk acceptance evidence validator and self-test before any unresolved-advisory external testing decision` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:dependency-risk:evidence:self-test
bash -n scripts/beta-foundation-verify.sh
scripts/with-node-22.sh npm exec -- prettier --write scripts/dependency-risk-evidence-audit.js scripts/dependency-risk-evidence-audit-self-test.js package.json docs/DEPENDENCY_RISK_EVIDENCE.md docs/DEPENDENCY_ADVISORY_LOG.md docs/CODEX_HANDOFF.md docs/DEVELOPMENT_TASKS.md docs/ALPHA_SECURITY_REVIEW.md docs/QA_CHECKLIST.md docs/BETA_ROADMAP.md docs/PROVIDER_COST_FEASIBILITY.md
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 150/171 tasks, 87.7% by checklist count.
- Remaining status: dependency advisory risk is not accepted by this pass; the blocker remains open until production audit is clean, a safe patched Next/PostCSS path exists, or a saved owner-approved risk acceptance passes `npm run security:dependency-risk:evidence`. Public/TestFlight Beta also remains blocked by real Privy SDK login, saved Privy dashboard evidence, real Stripe test-mode evidence, production tenant/staff policy validation in staging, deployed HTTPS staging evidence with a real admin bearer, real iOS staging/beta URLs, signed Apple Wallet `.pkpass`, physical QR/NFC validation, saved hosted CI evidence, and saved chain custody evidence.

## After iOS Staging Build Evidence Gate on 2026-05-30

- Added `docs/IOS_STAGING_BUILD_EVIDENCE.md` as the saved-evidence contract for signed iOS staging/TestFlight build configuration validation.
- Added `npm run security:ios-staging-build:evidence` and `npm run security:ios-staging-build:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the static iOS distribution boundary audit.
- The validator requires future saved evidence to prove both `FanPass` and `FanPass Ops` signed builds, physical-device or TestFlight install evidence, real non-placeholder HTTPS staging/beta API URLs observed by the apps, demo auth disabled, test provider modes, debug compilation and payload helper removal, FanPass without Camera/NFC/staff controls, FanPass Ops with Camera/NFC but without consumer wallet/market/payment surfaces, deployed runtime evidence linkage, and redaction.
- The validator rejects local dry-run proof, localhost or placeholder `.invalid` URLs, missing app evidence, debug builds or debug payload helpers, app capability/role leakage, missing deployed runtime proof, Apple signing material, provisioning profile markers, device identifiers, provider secrets, bearer tokens, real personal data, and missing redaction proof.
- Marked `Add iOS staging/TestFlight build evidence validator and self-test for signed builds, real HTTPS API URLs, debug helper removal, app separation, and redaction` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:ios-staging-build:evidence:self-test
bash -n scripts/beta-foundation-verify.sh
scripts/with-node-22.sh npm exec -- prettier --write scripts/ios-staging-build-evidence-audit.js scripts/ios-staging-build-evidence-audit-self-test.js package.json docs/IOS_STAGING_BUILD_EVIDENCE.md docs/IOS_DISTRIBUTION_PLAN.md docs/CODEX_HANDOFF.md docs/DEVELOPMENT_TASKS.md docs/ALPHA_SECURITY_REVIEW.md docs/QA_CHECKLIST.md docs/BETA_ROADMAP.md
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 151/172 tasks, 87.8% by checklist count.
- Remaining status: real iOS staging/TestFlight build validation is still open until Apple signing, real HTTPS staging/beta endpoints, and saved build evidence pass `npm run security:ios-staging-build:evidence`. Public/TestFlight Beta also remains blocked by real Privy SDK login, saved Privy dashboard evidence, real Stripe test-mode evidence, production tenant/staff policy validation in staging, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, signed Apple Wallet `.pkpass`, physical QR/NFC validation, saved hosted CI evidence, and saved chain custody evidence.

## After NFC NDEF Fixture Gate on 2026-05-30

- Added `docs/NFC_NDEF_TAG_FIXTURE.md` as the allowed physical NFC tag fixture contract for `FanPass Ops`.
- Added `npm run security:nfc-ndef-fixture` and fixture-backed `npm run security:nfc-ndef-fixture:self-test`.
- Wired both commands into `npm run beta:foundation:verify` after the FanPass Ops physical scanner evidence validator self-test.
- The audit requires FanPass Ops-only scope, QR-equivalent backend authority, supported NDEF Text/URI records, placeholder-only fixture examples, no bearer/Privy/Stripe/QR secret content, no raw nonces or raw signed payload fixtures, debug-only paste fallback, and a handoff to `npm run security:ops-scanner:device-evidence` for real-device closure.
- Marked `Add NFC NDEF tag fixture format document and audit for supported physical-tag payloads` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:nfc-ndef-fixture:self-test
scripts/with-node-22.sh npm run security:nfc-ndef-fixture
```

- Current progress: Beta foundation/security hardening is 152/173 tasks, 87.9% by checklist count.
- Remaining status: the fixture contract is documented and regression-checked, but physical QR/NFC validation is still open until a signed real-device or TestFlight build reads a physical NDEF tag against a real HTTPS staging/beta API and saved evidence passes `npm run security:ops-scanner:device-evidence`. Public/TestFlight Beta also remains blocked by real Privy SDK login, saved Privy dashboard evidence, real Stripe test-mode evidence, production tenant/staff policy validation in staging, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, signed Apple Wallet `.pkpass`, saved iOS staging/TestFlight build evidence, saved hosted CI evidence, and saved chain custody evidence.

## After iOS Physical-Device QA Checklist Gate on 2026-05-30

- Added `docs/IOS_PHYSICAL_DEVICE_QA.md` as the signed real-device QA checklist for `FanPass` and `FanPass Ops`.
- Added `npm run security:ios-physical-device-qa` and fixture-backed `npm run security:ios-physical-device-qa:self-test`.
- Wired both commands into `npm run beta:foundation:verify` after the iOS staging/TestFlight build evidence validator self-test.
- The audit requires real-iPhone scope, signed development-device/TestFlight build scope, real HTTPS staging/beta API configuration, Stripe test mode, Privy test app usage, separate app installs, FanPass/FanPass Ops role separation, no debug fallback proof, no secrets or real personal data, and handoffs to the saved-evidence validators for iOS builds, scanner, Apple Wallet, staging runtime, staff tenant policy, Stripe, and Privy plan evidence.
- Marked `Add physical-device QA checklist and audit for FanPass and FanPass Ops before external tester evidence is trusted` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:ios-physical-device-qa:self-test
scripts/with-node-22.sh npm run security:ios-physical-device-qa
bash -n scripts/beta-foundation-verify.sh
```

- Current progress: Beta foundation/security hardening is 153/174 tasks, 87.9% by checklist count.
- Remaining status: physical-device execution remains open until Apple signing/provisioning exists, real HTTPS staging/beta endpoints are configured, and saved build/scanner evidence passes `npm run security:ios-staging-build:evidence` and `npm run security:ops-scanner:device-evidence`. Public/TestFlight Beta also remains blocked by real Privy SDK login, saved Privy dashboard evidence, real Stripe test-mode evidence, production tenant/staff policy validation in staging, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, signed Apple Wallet `.pkpass`, saved hosted CI evidence, and saved chain custody evidence.

## After iOS Signing Placeholder Gate on 2026-05-30

- Added placeholder Apple signing settings to `apps/ios/FanPass/project.yml` for both `FanPass` and `FanPass Ops` using build-setting variables only.
- Extended `npm run security:ios-distribution-boundaries` so `project.yml` must keep `DEVELOPMENT_TEAM`, `CODE_SIGN_STYLE`, and `PROVISIONING_PROFILE_SPECIFIER` placeholder settings for both targets.
- Extended the fixture self-test so the gate rejects missing signing placeholders, raw Apple team IDs, real provisioning profile names, Apple certificate identity markers, certificate/private-key markers, and missing signing-boundary documentation.
- Marked `Add placeholder Apple signing settings to project.yml without committing team IDs, provisioning profile names, certificates, or private keys` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:ios-distribution-boundaries:self-test
scripts/with-node-22.sh npm run security:ios-distribution-boundaries
bash -n scripts/beta-foundation-verify.sh
scripts/with-node-22.sh npm exec -- prettier --write apps/ios/FanPass/project.yml scripts/ios-distribution-boundary-audit.js scripts/ios-distribution-boundary-audit-self-test.js docs/DEVELOPMENT_TASKS.md docs/QA_CHECKLIST.md docs/BETA_ROADMAP.md docs/PROVIDER_COST_FEASIBILITY.md docs/IOS_DISTRIBUTION_PLAN.md docs/CODEX_HANDOFF.md docs/ALPHA_SECURITY_REVIEW.md
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 154/175 tasks, 88.0% by checklist count.
- Remaining status: signing placeholders are now locally guarded, but real Apple Developer team configuration, provisioning profiles, certificates, Xcode archive/export commands, and saved iOS staging/TestFlight build evidence remain open. Public/TestFlight Beta also remains blocked by real Privy SDK login, saved Privy dashboard evidence, real Stripe test-mode evidence, production tenant/staff policy validation in staging, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, signed Apple Wallet `.pkpass`, physical QR/NFC validation, saved hosted CI evidence, and saved chain custody evidence.

## After Privy Swift SDK iOS Auth Gate on 2026-05-30

- Added `privy-ios` 2.12.0 to the XcodeGen/SPM project for both `FanPass` and `FanPass Ops`, with the generated package resolution pinned in `Package.resolved`.
- Added empty checked-in `FANPASS_PRIVY_APP_ID` and `FANPASS_PRIVY_APP_CLIENT_ID` build-setting placeholders plus generated Info.plist keys. No Privy app secrets, verification keys, access tokens, or production credentials were added.
- Added `FanPassPrivyAuthProvider` as the narrow Swift SDK adapter. It initializes `PrivySDK` only when public app/client IDs are configured, sends email OTP codes, verifies codes, retrieves a Privy access token, and hands that token to the existing backend `POST /auth/privy/sync` boundary.
- Wired FanPass auth UI to Privy email OTP while preserving local demo/register login for local QA. Wired FanPass Ops staff access to Privy email OTP so the returned access token can be used with the existing staff invite acceptance boundary.
- Extended `npm run security:provider-boundaries` and its self-test so direct `PrivySDK` imports are allowed only in `FanPassPrivyAuthProvider`, and both iOS targets must link the Privy package through XcodeGen.
- Marked `Integrate Privy Swift SDK into FanPass and FanPass Ops auth UI` complete.
- Verification passed:

```bash
cd apps/ios/FanPass && xcodegen generate
xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -resolvePackageDependencies
xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -destination 'platform=iOS Simulator,name=FanPass-iPhone-17,OS=26.5' -configuration Debug build CODE_SIGNING_ALLOWED=NO
xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPassOps -destination 'platform=iOS Simulator,name=FanPass-iPhone-17,OS=26.5' -configuration Debug build CODE_SIGNING_ALLOWED=NO
scripts/with-node-22.sh npm run security:provider-boundaries:self-test
scripts/with-node-22.sh npm run security:provider-boundaries
scripts/with-node-22.sh npm run security:ios-distribution-boundaries
```

- Current progress: Beta foundation/security hardening is 155/175 tasks, 88.6% by checklist count.
- Remaining status: iOS SDK wiring is local and placeholder-configured only. Public/TestFlight Beta still needs real Privy dashboard evidence and public app/client IDs, FanPass Console Privy React login, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight build evidence, signed Apple Wallet `.pkpass`, physical QR/NFC validation, saved hosted CI evidence, and saved chain custody evidence.

## After Privy Console React SDK Isolation Gate on 2026-05-30

- Added `docs/PRIVY_CONSOLE_REACT_SDK_ISOLATION.md` as the saved-evidence contract before `@privy-io/react-auth` can be integrated into FanPass Console.
- Added `npm run security:privy-console-react-sdk:isolation` to validate future evidence for either a clean direct Console dependency path or a dedicated isolated auth workspace/runtime boundary.
- Added `npm run security:privy-console-react-sdk:isolation:self-test` and wired it into `npm run beta:foundation:verify` after the Privy plan evidence self-test.
- The validator requires Node 22 dependency evidence, reviewed `@privy-io/react-auth` package metadata, no high/critical advisories, no new production advisory packages for direct integration, an isolated runtime boundary for isolated integration, the existing `/api/console/privy-session` HttpOnly cookie bridge, no browser-storage token persistence, Console route/provider-boundary checks, and token/secret redaction.
- Checked the current package metadata with `npm view @privy-io/react-auth@latest version dependencies peerDependencies --json`; latest is `3.28.0` with a broad wallet/provider dependency surface, so the SDK remains gated rather than installed.
- Re-checked the current dependency blocker under Node 22: production audit still reports only the known 2 moderate Next/PostCSS advisories, and `next@latest` is still `16.2.6` with `postcss: 8.4.31`, so no safe Next/PostCSS closeout path exists today.
- Marked `Add Privy Console React SDK dependency isolation evidence validator before SDK login can be integrated` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm view @privy-io/react-auth@latest version dependencies peerDependencies --json
scripts/with-node-22.sh npm run security:dependency-advisories
scripts/with-node-22.sh npm audit --omit=dev --audit-level=low --json
scripts/with-node-22.sh npm run security:privy-console-react-sdk:isolation:self-test
bash -n scripts/beta-foundation-verify.sh
scripts/with-node-22.sh npm exec -- prettier --check scripts/privy-console-react-sdk-isolation-audit.js scripts/privy-console-react-sdk-isolation-audit-self-test.js package.json docs/PRIVY_CONSOLE_REACT_SDK_ISOLATION.md docs/DEVELOPMENT_TASKS.md docs/QA_CHECKLIST.md docs/BETA_ROADMAP.md docs/PROVIDER_COST_FEASIBILITY.md docs/DEPENDENCY_ADVISORY_LOG.md docs/CODEX_HANDOFF.md docs/ALPHA_SECURITY_REVIEW.md
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 156/176 tasks, 88.6% by checklist count.
- Remaining status: this adds the missing dependency-isolation gate but does not install or integrate the Console React SDK. Public/TestFlight Beta still needs real Privy dashboard evidence, the actual FanPass Console SDK login UI behind the session bridge, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight build evidence, signed Apple Wallet `.pkpass`, physical QR/NFC validation, saved hosted CI evidence, and saved chain custody evidence.

## After Privy Mobile App Config Evidence Gate on 2026-05-30

- Added `docs/PRIVY_MOBILE_APP_CONFIG_EVIDENCE.md` as the saved-evidence contract before real non-placeholder Privy public app IDs and app client IDs can be trusted in FanPass or FanPass Ops staging/beta builds.
- Added `npm run security:privy-mobile-app-config:evidence` and fixture-backed `npm run security:privy-mobile-app-config:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the Privy plan evidence self-test.
- The validator requires actual Privy dashboard review, staging/beta environment scope, both native bundle ids (`com.fanpass.app` and `com.fanpass.ops`), app ID and app client ID setup, placeholder-only checked-in xcconfigs, outside-source-control value injection, generated Info.plist key verification, `FanPassEnvironment` placeholder rejection, provider/iOS boundary checks, optional webhooks, linked Privy plan/iOS/staff evidence requirements, and redaction of secrets, tokens, and user identifiers.
- Marked `Add Privy mobile app configuration evidence validator before real iOS app/client IDs are trusted` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:privy-mobile-app-config:evidence:self-test
bash -n scripts/beta-foundation-verify.sh
scripts/with-node-22.sh npm exec -- prettier --check scripts/privy-mobile-app-config-evidence-audit.js scripts/privy-mobile-app-config-evidence-audit-self-test.js package.json docs/PRIVY_MOBILE_APP_CONFIG_EVIDENCE.md docs/DEVELOPMENT_TASKS.md docs/QA_CHECKLIST.md docs/BETA_ROADMAP.md docs/PROVIDER_COST_FEASIBILITY.md docs/IOS_DISTRIBUTION_PLAN.md docs/CODEX_HANDOFF.md docs/ALPHA_SECURITY_REVIEW.md
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 157/177 tasks, 88.7% by checklist count.
- Remaining status: this adds the missing mobile app config evidence gate but does not provide real Privy dashboard evidence or real public app/client IDs. Public/TestFlight Beta still needs actual Privy dashboard evidence, real injected app/client IDs, the FanPass Console SDK login UI, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight build evidence, signed Apple Wallet `.pkpass`, physical QR/NFC validation, saved hosted CI evidence, and saved chain custody evidence.

## After Console Mutation Origin Guard on 2026-05-30

- Added `assertConsoleMutationOrigin(request)` in `apps/dashboard/lib/api.ts` as the narrow origin/CSRF boundary for FanPass Console cookie-backed mutations.
- Applied the guard to `POST`/`DELETE /api/console/privy-session`, `POST /api/console/gate-assignments`, and `POST /api/console/gate-assignments/:assignmentId/invites` before those routes set, delete, or use the HttpOnly Console session cookie.
- Production-like Console routes now require an allowed Console origin through `FANPASS_CONSOLE_ORIGINS` or related Console origin env. Local missing-origin requests remain allowed for developer tooling.
- Extended `npm run security:console-routes` and its fixture self-test to reject missing mutation origin guards and missing helper origin-policy markers.
- Marked `Add Console mutation origin guard for cookie-backed session and staff invite proxy routes` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:console-routes:self-test
scripts/with-node-22.sh npm run security:console-routes
scripts/with-node-22.sh npm run typecheck -w apps/dashboard
bash -n scripts/beta-foundation-verify.sh
scripts/with-node-22.sh npm exec -- prettier --check apps/dashboard/lib/api.ts apps/dashboard/app/api/console/privy-session/route.ts apps/dashboard/app/api/console/gate-assignments/route.ts 'apps/dashboard/app/api/console/gate-assignments/[assignmentId]/invites/route.ts' scripts/console-route-contract-audit.js scripts/console-route-contract-audit-self-test.js docs/DEPLOYMENT_ENVIRONMENTS.md docs/DEVELOPMENT_TASKS.md docs/QA_CHECKLIST.md docs/BETA_ROADMAP.md docs/ALPHA_SECURITY_REVIEW.md docs/CODEX_HANDOFF.md
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 158/178 tasks, 88.8% by checklist count.
- Remaining status: this reduces cross-origin mutation risk for Console session and staff invite proxy routes but does not implement the actual Privy Console React SDK login UI. Public/TestFlight Beta still needs real Privy dashboard evidence and Console SDK login, real injected mobile app/client IDs, production tenant/staff policy validation in staging, real Stripe signed-webhook validation, deployed HTTPS staging evidence with a real admin bearer, dependency advisory closure or risk acceptance, saved iOS staging/TestFlight build evidence, signed Apple Wallet `.pkpass`, physical QR/NFC validation, saved hosted CI evidence, and saved chain custody evidence.

## After Saved Evidence Redaction Audit on 2026-05-30

- Added `scripts/saved-evidence-redaction-audit.js` and `scripts/saved-evidence-redaction-audit-self-test.js`.
- Added `npm run security:evidence-redaction` and fixture-backed `npm run security:evidence-redaction:self-test`.
- Wired both commands into `npm run beta:foundation:verify` after the hosted CI evidence validator self-test.
- The audit scans generated files under `outputs/` and rejects obvious Stripe secret keys, webhook secrets, PaymentIntent client secrets, bearer tokens, JWTs, private-key blocks, database URLs, Privy verification-key assignments, Privy app-secret markers, and staging/admin access-token assignments.
- The current live scan passes across 102 existing output artifacts, including the reviewed Alpha walkthrough capture bundle and local visual evidence.
- Marked `Add saved evidence redaction audit for generated output artifacts before trusting local or staging evidence bundles` complete.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:evidence-redaction:self-test
scripts/with-node-22.sh npm run security:evidence-redaction
bash -n scripts/beta-foundation-verify.sh
scripts/with-node-22.sh npm exec -- prettier --check scripts/saved-evidence-redaction-audit.js scripts/saved-evidence-redaction-audit-self-test.js package.json docs/DEVELOPMENT_TASKS.md docs/QA_CHECKLIST.md docs/BETA_ROADMAP.md docs/ALPHA_WALKTHROUGH_EVIDENCE.md docs/ALPHA_SECURITY_REVIEW.md docs/CODEX_HANDOFF.md
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress: Beta foundation/security hardening is 159/179 tasks, 88.8% by checklist count.
- Remaining status: this lowers saved-artifact leakage risk, but it does not replace domain-specific evidence validators or close any external dashboard, staging, signing, provider, physical-device, hosted CI, dependency, Wallet, or chain-custody blocker.

## After Stripe Backend Test-Mode Verification on 2026-05-30

- Installed and verified Stripe CLI locally for test-mode work.
- Corrected local webhook forwarding to `localhost:4000/payments/webhook`; the FanPass API listens on port `4000`, not the Stripe example port `4242`.
- Fixed the Stripe SDK runtime import in `apps/api/src/modules/payments/payments.service.ts` by using the CommonJS-compatible import form required by the current NestJS/ts-node execution path.
- Ran a real FanPass-created Stripe test-mode PaymentIntent through manual authorization, signed raw-body webhook delivery, payment-authorized order matching, worker capture, admin refund, admin authorization cancellation, reconciliation, and side-effect health checks. The validation used local-only demo users and no real personal data.
- Stopped the local API/listener processes and removed temporary secret-bearing helper scripts after the verification pass. Do not reuse any Stripe key material that was pasted into chat or printed by local tooling; rotate the Stripe test secret before treating new evidence as clean.
- Marked the backend capture/refund/cancellation/reconciliation verification tasks complete in `docs/DEVELOPMENT_TASKS.md`.
- Verification passed:

```bash
scripts/with-node-22.sh npm run test -w apps/api -- --runTestsByPath test/side-effect-worker.service.spec.ts test/security-config.spec.ts
scripts/with-node-22.sh npm run typecheck -w apps/api
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress by full `docs/DEVELOPMENT_TASKS.md` checkbox count is 364/381 tasks, 95.5%.
- Remaining Stripe status: the backend Stripe test-mode capture/refund/cancellation/reconciliation path is verified, but the overall Stripe blocker is still open until real iOS PaymentSheet evidence and HTTPS Stripe Dashboard webhook endpoint evidence are saved and pass their validators. Do not fabricate `npm run security:stripe-testmode:evidence` output without native PaymentSheet proof.

## After Privy Local Config Check Gate on 2026-05-30

- Added `scripts/privy-local-config-check.js` as a secret-safe local guard for real Privy setup. It validates that `apps/api/.env` is ignored by source control, `PRIVY_APP_ID` matches the expected public app id when supplied, `PRIVY_VERIFICATION_KEY` is present as a parseable PEM public key, the iOS Privy app client id is supplied outside source control, checked-in iOS xcconfigs remain blank placeholders, and `project.yml` still covers `com.fanpass.app` and `com.fanpass.ops`.
- Added fixture-backed `npm run security:privy-local-config:self-test` and wired that self-test into `npm run beta:foundation:verify` after the Privy webhook optionality audit. The composite verifier does not read local secrets.
- Ran the real local check with the current public Privy app id and app client id; it passed without printing the verification key or any token material.
- `apps/api/.env` remains ignored by `.gitignore`; do not commit or paste the Privy verification key.
- Tightened `apps/api/test/verification.service.spec.ts` so the production-like missing-`QR_SIGNING_SECRET` test deletes any inherited local QR signing secret before constructing `ConfigService`; this keeps local `.env` setup from masking the fail-fast QR signing boundary.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:privy-local-config:self-test
FANPASS_EXPECTED_PRIVY_APP_ID=<public-app-id> FANPASS_PRIVY_APP_ID=<public-app-id> FANPASS_PRIVY_APP_CLIENT_ID=<public-client-id> scripts/with-node-22.sh npm run security:privy-local-config
scripts/with-node-22.sh npm run security:privy-webhooks:optional
scripts/with-node-22.sh npm run security:privy-mobile-app-config:evidence:self-test
scripts/with-node-22.sh npm run security:privy-plan:evidence:self-test
scripts/with-node-22.sh npm run test -w apps/api -- --runTestsByPath test/auth.service.spec.ts test/security-config.spec.ts
scripts/with-node-22.sh npm run test -w apps/api -- --runTestsByPath test/verification.service.spec.ts
scripts/with-node-22.sh npm run test -w apps/api
scripts/with-node-22.sh npm run beta:foundation:verify
```

- Current progress by full `docs/DEVELOPMENT_TASKS.md` checkbox count remains 364/381 tasks, 95.5%; no checklist item was closed by this local guard alone.
- Remaining Privy status: local backend/mobile config is now structurally validated, but real Privy dashboard plan evidence, saved mobile app config evidence, actual FanPass/FanPass Ops OTP login on a signed/staging-style build, Console React SDK isolation/login, and production tenant/staff staging evidence remain open.

## After Privy Local iOS Build Setting Injection Gate on 2026-05-30

- Tightened `npm run security:privy-local-config` so local iOS OTP readiness now requires both public build settings, `FANPASS_PRIVY_APP_ID` and `FANPASS_PRIVY_APP_CLIENT_ID`, to be supplied outside source control.
- The check now confirms the iOS `FANPASS_PRIVY_APP_ID` matches the API `PRIVY_APP_ID`, rejects missing or mismatched iOS app id injection, keeps checked-in xcconfigs blank, and reports only boolean/redacted status plus build setting names.
- Updated fixture-backed self-test coverage for mismatched iOS app id injection and missing local iOS app id injection.
- Ran the real local check with the current public app id/client id values; it passed without printing the Privy verification key, access tokens, or provider secrets.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:privy-local-config:self-test
FANPASS_EXPECTED_PRIVY_APP_ID=<public-app-id> FANPASS_PRIVY_APP_ID=<public-app-id> FANPASS_PRIVY_APP_CLIENT_ID=<public-client-id> scripts/with-node-22.sh npm run security:privy-local-config
```

- Current progress by full `docs/DEVELOPMENT_TASKS.md` checkbox count remains 364/381 tasks, 95.5%; this closes a local configuration gap but does not close real Dashboard, signed-build, OTP-login, Console SDK, or staging staff evidence.

## After Privy Evidence Draft Helper on 2026-05-30

- Added `scripts/privy-evidence-draft.js` and `npm run privy:evidence:draft -- plan|mobile|console` to generate non-passing, secret-free draft evidence with the current SHA-256 snapshots for Privy dashboard plan evidence, mobile app config evidence, and Console React SDK isolation evidence.
- Added fixture-backed `npm run privy:evidence:draft:self-test` and wired it into `npm run beta:foundation:verify` after the local Privy config self-test. The helper intentionally emits `ok: false` / review placeholders so it cannot close real Dashboard, mobile, or Console blockers by itself.
- Updated the Privy evidence contracts, QA checklist, Beta roadmap, development task notes, and security review to make the draft helper the recommended starting point before filling real dashboard/build/dependency facts and running the matching validators.
- Verification passed:

```bash
scripts/with-node-22.sh npm run privy:evidence:draft:self-test
scripts/with-node-22.sh npm run privy:evidence:draft -- plan --checked-at 2026-05-30T00:00:00.000Z
```

- Current progress by full `docs/DEVELOPMENT_TASKS.md` checkbox count remains 364/381 tasks, 95.5%; this helper improves evidence collection but does not close any real Privy blocker without validated dashboard/device/dependency evidence.
- Remaining Privy status: collect real dashboard plan support evidence, generate completed mobile app config evidence after dashboard/build review, validate real FanPass/FanPass Ops OTP login on signed/staging-style builds, prove Console SDK isolation before adding `@privy-io/react-auth`, and save production-like tenant/staff evidence.

## After Privy Ops SDK-First Staff Linking Gate on 2026-05-30

- Tightened FanPass Ops staff invite linking so release builds use the Privy Swift SDK email OTP result before `Link invite` can run.
- Kept manual Privy access-token entry available only inside `#if DEBUG`, which preserves local debugging without exposing a normal TestFlight/release token paste path.
- Updated `npm run security:staff-invite-policy` and fixture-backed self-test coverage so the staff invite gate requires the Ops SDK OTP token path and rejects manual token entry outside debug builds.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:staff-invite-policy:self-test
scripts/with-node-22.sh npm run security:staff-invite-policy
scripts/with-node-22.sh npm run security:provider-boundaries
scripts/with-node-22.sh npm run security:ios-distribution-boundaries:self-test
scripts/with-node-22.sh npm run security:ios-distribution-boundaries
scripts/with-node-22.sh npm run security:privy-mobile-app-config:evidence:self-test
```

- Current progress by full `docs/DEVELOPMENT_TASKS.md` checkbox count remains 364/381 tasks, 95.5%; no real Dashboard, signed-device, Console SDK, or staging evidence task was closed by this local UI/audit hardening.
- Remaining Privy status: collect real dashboard plan support evidence, generate completed mobile app config evidence after dashboard/build review, validate real FanPass/FanPass Ops OTP login on signed/staging-style builds, prove Console SDK isolation before adding `@privy-io/react-auth`, and save production-like tenant/staff evidence.

## After Privy Dev App Dashboard Evidence Capture on 2026-05-30

- Created and completed redacted evidence files from the current Privy Dev app dashboard screenshots:
  - `outputs/privy-plan/privy-plan-20260530.json`
  - `outputs/privy-mobile-app-config/privy-mobile-20260530.json`
- The plan evidence records `selectedPlan: "Development app state"`, mobile SDK support, embedded-wallet support, backend access-token verification support, custom auth UI support, and keeps webhooks plus MFA/policy controls `plan-gated` so webhooks remain optional.
- The mobile config evidence records the native client for both bundle ids, `com.fanpass.app` and `com.fanpass.ops`, public app/client ID setup, placeholder-only checked-in xcconfigs, outside-source-control injection, generated Info.plist checks, and provider/iOS boundary checks.
- No Privy app secret, verification key, access token, provider secret, deployment/cloud credential, CI masking command literal, Stripe publishable key, database URL, production credential, or real user identifier was saved in the evidence.
- Verification passed:

```bash
scripts/with-node-22.sh npm run security:privy-plan:evidence -- outputs/privy-plan/privy-plan-20260530.json
scripts/with-node-22.sh npm run security:privy-mobile-app-config:evidence -- outputs/privy-mobile-app-config/privy-mobile-20260530.json
scripts/with-node-22.sh npm run security:evidence-redaction -- outputs/privy-plan outputs/privy-mobile-app-config
```

- Current progress by full `docs/DEVELOPMENT_TASKS.md` checkbox count remains 364/381 tasks, 95.5%; no new checklist item was added.
- Remaining Privy status: the saved Dev app dashboard/mobile config evidence now exists and passes validators, but public/TestFlight Beta still needs real FanPass/FanPass Ops OTP execution on signed/staging-style builds, Console React SDK login or accepted isolation integration, production tenant/staff staging evidence, and deployed HTTPS staging evidence.

## After Free Staging Deployment Prep on 2026-05-30

- Created a Neon Postgres project named `fanpass-staging`, pushed the current Prisma schema, and loaded the local demo seed data. Do not commit or print the Neon connection string.
- Added `render.yaml` for a Render free web service named `fanpass-api-staging`. The blueprint uses Node 22, `FANPASS_ENV=staging`, Prisma storage, demo auth disabled, mock ownership, payments disabled until Stripe staging secrets are intentionally configured, generated QR/session secrets, and secret placeholders for Neon/Privy values.
- Added `apps/api/.env.staging.example`, `apps/dashboard/.env.staging.example`, and `docs/STAGING_DEPLOYMENT_FREE_PATH.md` to make the Render/Vercel free-path setup explicit without storing secrets.
- Verified local production builds for the deploy targets:

```bash
scripts/with-node-22.sh npm run build -w apps/api
scripts/with-node-22.sh npm run build -w apps/dashboard
```

- Current limitation: this Codex session exposes Neon and Vercel tools, but no Render deployment tool, no Render CLI, no Render API token, and no Git remote for this checkout. Render API project creation and Vercel project creation still need an external project/repo connection step before deployed HTTPS URLs exist.
- Current progress by full `docs/DEVELOPMENT_TASKS.md` checkbox count remains 364/381 tasks, 95.5%; deployed staging evidence is still open until real HTTPS API/Console URLs pass `npm run security:runtime:staging` and `npm run security:runtime:staging:evidence`.

## After Render API Free Staging Deployment on 2026-05-31

- Pushed the local repository to `https://github.com/tantalum666/fanpass` from the initial commit `f20becf`; `.env`, `outputs/`, build output, and dependency directories remain ignored.
- Connected Render to the GitHub repository through the `FanPass` Render workspace and deployed the API as the free Node web service `fanpass-api-staging`.
- Render service details:
  - Service ID: `srv-d8dh521o3t8c73eidcv0`
  - API origin: `https://fanpass-api-staging.onrender.com`
  - Branch: `main`
  - Plan/runtime: Render free Node service
- Fixed the reproducible Render build command in `render.yaml` to use `npm ci --include=dev` so the Nest CLI is available during Render builds.
- Verified the deployed API health endpoint:

```bash
curl -sS https://fanpass-api-staging.onrender.com/health
# {"ok":true,"service":"fanpass-api","target":"technical-prototype"}
```

- No Render, GitHub, Neon, Privy, or Stripe secrets were written into repo files or deployment docs. The Neon connection string and Privy verification key were entered only into Render environment settings.
- Current progress by full `docs/DEVELOPMENT_TASKS.md` checkbox count remains 364/381 tasks, 95.5%; Render API HTTPS is live, but deployed staging evidence remains open until the Vercel Console HTTPS URL exists, Render CORS is updated to the final Console origin, and `npm run security:runtime:staging` plus `npm run security:runtime:staging:evidence` pass.

## After Vercel Console Free Staging Deployment on 2026-05-31

- Deployed FanPass Console to Vercel as project `fanpass-dashboard`.
- Console origin: `https://fanpass-dashboard.vercel.app`
- The first Vercel build failed because the dashboard root package did not declare the repo's Node `>=22 <23` engine and Vercel tried Node 24. Added the same `engines.node` constraint to `apps/dashboard/package.json`; the follow-up Vercel deployment became `READY`.
- Updated Render `FANPASS_CORS_ORIGINS` to `https://fanpass-dashboard.vercel.app` through the Render API and triggered a new API deploy, which reached `live`.
- Fixed `scripts/security-runtime-staging-check.sh` so its deployed JSON evidence includes the implementation SHA-256 snapshot and CI secret-masking redaction proof required by `npm run security:runtime:staging:evidence`.
- Verification run against the real HTTPS origins:

```bash
STAGING_API_URL=https://fanpass-api-staging.onrender.com/health \
STAGING_CONSOLE_URL=https://fanpass-dashboard.vercel.app \
STAGING_API_TRUST_PROXY_HOPS=1 \
npm run security:runtime:staging
```

- Result: the deployed runtime check passed API/Console headers, absent `x-powered-by`, disabled demo sessions, unauthenticated admin health rejection, unauthenticated Console locked/sign-in state, and orderbook allowed/disallowed-origin checks.
- Saved output: `outputs/staging-runtime/20260530T180132Z-render-vercel.json` (ignored by git).
- Evidence validator status:

```bash
npm run security:runtime:staging:evidence -- outputs/staging-runtime/20260530T180132Z-render-vercel.json
```

The validator now rejects only the missing positive admin side-effect outbox health proof because no `STAGING_ADMIN_ACCESS_TOKEN` is available yet. Do not mark the deployed staging evidence task complete until a real staging admin bearer token is provided and the evidence validator passes.

- Current progress by full `docs/DEVELOPMENT_TASKS.md` checkbox count remains 364/381 tasks, 95.5%; no checkbox was closed because the final deployed staging evidence gate still needs admin-token-backed health evidence.

## After Privy Simulator Admin Staging Evidence on 2026-05-31

- Built and launched `FanPassOps` on the iOS simulator with staging API, Privy app ID, and Privy client ID supplied as Xcode build-setting overrides so public provider identifiers were not committed to source control.
- Added a DEBUG-only `Copy Privy token` action in FanPass Ops to move a successful Privy email OTP access token to the simulator pasteboard for local evidence collection. The token is not logged, printed, saved in source control, or written into saved evidence.
- Completed Privy email OTP in the simulator, read the token from the simulator pasteboard without printing it, and called `POST https://fanpass-api-staging.onrender.com/auth/privy/sync`.
- Promoted the synthetic staging Privy-linked user `staging-admin+privy@fanpass.invalid` to `ADMIN` in Neon through the Neon MCP. Do not use real personal data for staging evidence users.
- Verified the deployed API sees the synced Privy user as `ADMIN`.
- Ran and accepted deployed staging runtime evidence:

```bash
STAGING_API_URL=https://fanpass-api-staging.onrender.com/health \
STAGING_CONSOLE_URL=https://fanpass-dashboard.vercel.app \
STAGING_API_TRUST_PROXY_HOPS=1 \
STAGING_ADMIN_ACCESS_TOKEN="<from simulator pasteboard, not printed>" \
npm run security:runtime:staging > outputs/staging-runtime/20260530T185440Z-render-vercel-admin.json

npm run security:runtime:staging:evidence -- outputs/staging-runtime/20260530T185440Z-render-vercel-admin.json
```

- Result: the evidence validator passed with `adminSideEffectHealth: "admin side-effect outbox health ok"`, real HTTPS Render/Vercel URLs, `localDryRun: false`, `apiRuntime.trustProxyHops: 1`, redacted orderbook subscription-target proof, implementation SHA-256 snapshot proof, deployment credential absence/redaction proof, CI masking-command redaction proof, and no token/private-key/provider/database/deployment credential markers in saved output. `npm run security:evidence-redaction` also passed after regenerating staging evidence without raw demo event or ticket identifiers.
- Current progress by full `docs/DEVELOPMENT_TASKS.md` checkbox count is 366/381 tasks, 96.1%; the deployed staging runtime/header/config evidence blocker is closed.

## After Stripe Dashboard and iOS PaymentSheet Staging Authorization on 2026-05-31

- Stripe dashboard test-mode webhook endpoint setup was completed for the deployed Render API route.
- FanPass iOS simulator successfully used the native Stripe PaymentSheet path with a Stripe test card, a backend-issued PaymentIntent client secret, and test-mode publishable-key configuration injected outside source control.
- The latest observed Stripe test PaymentIntent was in manual-capture authorization state (`requires_capture`, capturable amount present, `livemode=false`), and the backend persisted the payment as `AUTHORIZED` after signed webhook delivery.
- Render API commit `75b4e68bc7835bc2d4532259a3cecac2ab8e99da` is live with the API-hosted side-effect worker scheduler enabled through Render environment settings, not committed secrets.
- Current progress by full `docs/DEVELOPMENT_TASKS.md` checkbox count is 371/382 tasks, 97.1%.
- Follow-up on 2026-06-03: Stripe test-mode capture, authorization cancellation, refund, reconciliation, duplicate webhook replay/idempotency, and healthy residual outbox state were exercised against Render staging and saved at `outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json`. The saved evidence passed `npm run security:stripe-testmode:evidence -- outputs/stripe-testmode/20260603T060959Z-stripe-testmode-release-evidence.json` and repository evidence redaction.
- Follow-up on 2026-06-03: Hosted GitHub Actions evidence was refreshed for a successful PR run of `FanPass Beta Foundation` at commit `bad6847617ce83fdb5b8c1a7eeb302c6ff7644fc`. The saved evidence lives at `outputs/ci-hosted/20260603T141752Z-github-actions-beta-foundation.json` and passed `npm run security:ci-hosted:evidence -- outputs/ci-hosted/20260603T141752Z-github-actions-beta-foundation.json` plus repository evidence redaction.
- Operational note: the Neon MCP tools were intermittently unavailable in the previous thread. If available, query the staging outbox/payment state without printing secrets or real user data; otherwise use Render logs to confirm worker processing.

## After Release Evidence Draft Helper on 2026-06-04

- Added `scripts/release-evidence-draft.js` and `npm run release:evidence:draft -- staff-tenant|ios-build|apple-wallet|ops-scanner|chain-custody` to seed non-passing, secret-free evidence drafts for the five remaining external release gates.
- Each draft includes `ok: false`, `draft: true`, a gate-specific `draftStatus`, the current implementation SHA-256 snapshot, placeholder proof fields, redaction proof defaults, and the exact next validator command. The helper does not close any blocker by itself.
- Generated current local draft starting points under ignored `outputs/` paths:
  - `outputs/staff-tenant/20260604T000000Z-draft.json`
  - `outputs/ios-staging-build/20260604T000000Z-draft.json`
  - `outputs/apple-wallet/20260604T000000Z-draft.json`
  - `outputs/ops-scanner/20260604T000000Z-draft.json`
  - `outputs/chain-custody/20260604T000000Z-draft.json`
- Updated the new-chat prompt, QA checklist, roadmap, development task notes, and each evidence contract to route future collection through the draft helper before real staging/signing/device/Wallet/custody proof is filled.
- Added a durable `Non-Negotiable Engineering Rules` section covering maintainable code, start-of-work doc reads, same-change doc updates, and security-as-release-blocker rules.
- Verification:
  - `scripts/with-node-22.sh npm run release:evidence:draft:self-test`
  - `scripts/with-node-22.sh npm run security:evidence-redaction -- outputs/staff-tenant/20260604T000000Z-draft.json outputs/ios-staging-build/20260604T000000Z-draft.json outputs/apple-wallet/20260604T000000Z-draft.json outputs/ops-scanner/20260604T000000Z-draft.json outputs/chain-custody/20260604T000000Z-draft.json`
  - `scripts/with-node-22.sh npm run beta:foundation:verify`
- Remaining status: staff tenant staging now has passing real staging evidence, and the helper remains useful if staff invite, Console proxy, Ops linking, or gate policy implementation drift requires regeneration. Signed iOS/TestFlight, signed Wallet, physical QR/NFC, and chain custody still require real external proof and passing validators.

## After Completed Staff Tenant Staging Evidence on 2026-06-04

- Completed production-like staging staff evidence against the Render API and Vercel Console URL without printing or saving bearer tokens, Privy access tokens, invite tokens, raw emails, staff ids, organizer ids, ticket ids, wallet addresses, provider secrets, deployment credentials, database URLs, or Stripe keys.
- Read the separate staff Privy token from the booted iOS simulator pasteboard and used the previously saved one-time invite state from `/tmp/fanpass-staff-tenant-state.json`; both remained outside source control and saved evidence.
- Verified in staging:
  - Staff invite acceptance with a separate verified Privy staff session returned `GATE_STAFF`.
  - Reusing the same staff invite was rejected.
  - Superseded invite acceptance was rejected.
  - Linked staff invite rotation was rejected.
  - Deactivating a gate assignment revoked the linked staff session's gate access.
  - Inactive assignments could not receive new invites.
  - Linked staff could read check-in summary only for assigned gates.
  - Assigned-gate QR redemption succeeded, duplicate QR redemption was rejected, unassigned-gate redemption was rejected, and a client-supplied scanner identity field was rejected by request validation.
  - Deployed staging `POST /auth/demo-session` rejected a real existing verified test user with `Demo sessions are disabled`.
  - Deployed Console mutations from the allowed staging auth origin rejected unauthenticated access with 401.
  - The deployed Console Privy session bridge set the expected HttpOnly, Secure, SameSite cookie for a verified admin session.
  - The deployed Console staff invite proxy created and rotated one-time invite tokens without returning raw identity fields or persisting tokens in a URL.
  - The deployed Console session bridge rejected a linked gate-staff role with 403 and did not set a cookie. This supports non-console-role rejection but does not satisfy the validator's separate fan-role proof requirement.
  - The deployed Console session bridge rejected a verified fan role with 403 and did not set a cookie.
- Saved completed redacted staging evidence at `outputs/staff-tenant/20260604T135635Z-staging-evidence.json` (ignored by git). `npm run security:staff-tenant:staging-evidence -- outputs/staff-tenant/20260604T135635Z-staging-evidence.json` and `npm run security:evidence-redaction -- outputs/staff-tenant/20260604T135635Z-staging-evidence.json` passed.
- Completed the remaining staff-tenant evidence gaps:
  - Second-organizer isolation plus cross-organizer Console read, staff assignment, and invite rotation rejection.
- Console origin note: deployed Console mutations accept the staging auth origin `https://fanpass-console-staging.vercel.app`; the dashboard origin `https://fanpass-dashboard.vercel.app` is not itself in the mutation-origin allowlist. Keep Vercel `FANPASS_CONSOLE_ORIGINS` aligned with the auth bridge origin before collecting future Console session evidence.
- Current progress by full `docs/DEVELOPMENT_TASKS.md` checkbox count is 391/392 tasks, 99.7%; the staff tenant staging evidence blocker, owner-skipped walkthrough recording task, dynamic QR/Core NFC local foundation, and local smart-contract foundation are closed for current local Beta foundation scope, while the remaining open checkbox is the overall public/real-user Alpha security blocker umbrella.

## After Local Smart-Contract Foundation on 2026-06-05

- Extended `packages/contracts/contracts/FanPassTicket.sol` with safe proof hashes for ticket id, ticket type, policy, and metadata; added refunded lifecycle state; blocked transfer after cancelled, refunded, or redeemed states; and added owner-only proof updates.
- Extended `packages/contracts/contracts/FanPassSoulbound.sol` with safe Access Badge proof hashes, ERC5192-style locked behavior, and owner-only revocation state.
- Extended `packages/contracts/contracts/RedemptionRegistry.sol` with duplicate-protected event, gate, credential, and redemption context hashes.
- Added `packages/contracts/scripts/deploy-local.ts` and `npm run deploy:local -w packages/contracts` for local Hardhat deployment dry-run only.
- Added `docs/technical/FanPass_Contract_Deployment_Runbook_V4.md` and updated V4 blockchain/review/task/QA/new-chat docs to make the local-vs-testnet boundary explicit.
- Fixed `docs/API_RESPONSE_PRIVACY_MATRIX.md` so the staff/admin-only `POST /verification/nfc/validate` route is classified as `STAFF_PRIVATE`; this was required for the full Beta foundation verifier after the QR/NFC local foundation work.
- Verification:
  - `scripts/with-node-22.sh npm run test -w packages/contracts`
  - `scripts/with-node-22.sh npm run deploy:local -w packages/contracts`
  - `scripts/with-node-22.sh npm run security:chain-operator-key`
  - `scripts/with-node-22.sh npm run security:chain-operator-key:self-test`
  - `scripts/with-node-22.sh npm run security:chain-custody:evidence:self-test`
  - `scripts/with-node-22.sh npm run security:dependency-tooling`
  - `scripts/with-node-22.sh npm run security:node-runtime-policy`
  - `scripts/with-node-22.sh npm run security:api-privacy:self-test`
  - `scripts/with-node-22.sh npm run security:api-privacy`
  - `scripts/with-node-22.sh npm run beta:foundation:verify` (passed; API unit tests 12 suites / 61 tests)
  - `git diff --check`
- Remaining status: this does not close Sepolia deployment, real chain custody, vault/KMS or delegated signer, multisig/timelock ownership, backend proof sync, or saved chain custody evidence.

## After Chain Custody Draft/Runbook Preparation on 2026-06-05

- Generated a fresh non-passing chain custody draft at `outputs/chain-custody/20260605T051653Z-draft.json` with current implementation SHA-256 snapshots.
- Added `docs/technical/FanPass_Chain_Custody_Runbook_V4.md` with signer policy, rotation, signer-disable, incident response, monitoring, and rollback/pause procedures.
- Selected the future evidence architecture as Sepolia + Safe multisig owner + OpenZeppelin Relayer with Turnkey signer. Added `docs/technical/FanPass_Sepolia_Safe_Relayer_Setup_V4.md`.
- Updated `docs/CHAIN_CUSTODY_EVIDENCE.md`, `docs/technical/FanPass_Contract_Deployment_Runbook_V4.md`, and `docs/technical/FanPass_Blockchain_Integration_Plan_V4.md` to reference the custody runbook and setup guide.
- Remaining status: the draft must stay `ok: false` until real vault/KMS or delegated signer proof, multisig/timelock proof, testnet ownership change proof, durable outbox testnet run proof, healthy residual outbox proof, and redacted signer audit logs are collected.

## After Sepolia Dev-Only Hot-Key Deployment Prep on 2026-06-06

- The owner accepted deferring Safe/multisig and delegated signer setup until later because all signer wallets would currently be owner-operated and manual setup would slow contract development.
- Added a dev-only Sepolia deployment lane for contract/ABI validation:
  - `packages/contracts/hardhat.config.ts` now defines `sepoliaDev`.
  - `packages/contracts/scripts/deploy-sepolia-dev.ts` deploys `FanPassTicket`, `FanPassSoulbound`, and `RedemptionRegistry`, performs fictional proof mint/badge mint/redemption writes, prints a redacted summary, and writes full local deployment details only to `.fanpass-local/chain-dev/`.
  - `packages/contracts/package.json` now includes `npm run deploy:sepolia-dev -w packages/contracts`.
  - `.fanpass-local/` is gitignored.
- The script refuses to run unless `FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY=true`, an HTTPS `FANPASS_SEPOLIA_RPC_URL`, a valid `FANPASS_SEPOLIA_DEV_PRIVATE_KEY`, Sepolia chain id `11155111`, and a funded temporary deployer are present.
- Added `docs/technical/FanPass_Sepolia_Dev_Hotkey_Runbook_V4.md` and updated chain custody/deployment docs to clarify that this is not release evidence. It must remain `custodyEvidence: false` and cannot close chain custody, public Beta, real-user Beta, production signing, or pilot readiness.
- Final custody target remains Sepolia + Safe multisig owner + OpenZeppelin Relayer with Turnkey signer.

## After Sepolia Dev-Only Deployment on 2026-06-06

- Configured dev-only Sepolia RPC in ignored `.env.local` using PublicNode: `https://ethereum-sepolia-rpc.publicnode.com`. The temporary private key remains only in ignored local env and must not be pasted into chat, docs, screenshots, git, or saved evidence.
- Deployed the current contracts to Sepolia with the gated temporary-hot-key path:
  - `FanPassTicket`
  - `FanPassSoulbound`
  - `RedemptionRegistry`
- The deployment script minted one fictional ticket proof, one fictional Access Badge proof, and one fictional redemption context.
- Saved only a redacted deployment log at `docs/technical/FanPass_Sepolia_Dev_Deployment_Log_V4.md`; full local deployment details remain under gitignored `.fanpass-local/chain-dev/`.
- Verification:
  - `scripts/with-node-22.sh npm run build -w packages/contracts`
  - `scripts/with-node-22.sh npm run test -w packages/contracts`
  - `scripts/with-node-22.sh npm run deploy:sepolia-dev -w packages/contracts`
- Remaining status: this proves only dev contract/ABI viability. It does not close chain custody, Safe/multisig, timelock/admin delay, delegated signer/vault/KMS, durable outbox backend proof-sync, public Beta, or real-user Beta blockers.

## After Backend Sepolia Dev Ownership Smoke on 2026-06-06

- Added owner-only `FanPassTicket.syncTicketTransfer(from, to, tokenId)` so backend-authorized proof synchronization does not pretend the operator has fan wallet approval for `transferFrom`.
- Updated API `OwnershipService` testnet adapter to use `mintTicketWithProof`, SHA-256 namespaced `bytes32` proof hashes, and `syncTicketTransfer`.
- Added focused adapter tests proving raw local ticket ids and ticket type ids are not sent as proof parameters and transfer sync uses the owner-only sync function.
- Added `apps/api/src/workers/sepolia-dev-ownership-smoke.ts`, exposed as `npm run chain:sepolia-dev:ownership-smoke`, for manual dev-only Sepolia mint -> sync transfer -> redeem smoke testing.
- Re-deployed the updated Sepolia dev-only contracts and ran the backend ownership smoke successfully. Redacted logs:
  - `docs/technical/FanPass_Sepolia_Dev_Deployment_Log_V4.md`
  - `docs/technical/FanPass_Sepolia_Dev_Backend_Smoke_V4.md`
- Added `docs/technical/FanPass_Chain_Security_Review_V4.md`.
- Remaining status: this is still dev-only and `custodyEvidence: false`; it does not close real chain custody or public/real-user Beta blockers.

## After Final Self-Solvable Chain Validation on 2026-06-06

- Completed the current self-solvable chain development pass without requiring additional owner action:
  - local contract tests and local Hardhat deployment dry-run pass;
  - Sepolia dev-only deployment and backend ownership smoke pass with redacted logs only;
  - API `OwnershipService` typecheck and focused ownership/ticket/outbox tests pass;
  - provider-boundary, chain-operator-key, chain-custody self-test, saved-evidence redaction, and full `beta:foundation:verify` pass;
  - `.env.local` and `.fanpass-local/chain-dev/` are ignored by git, and `git diff --check` passes.
- Security decision unchanged: the temporary Sepolia hot key is development-only and must be rotated/discarded before real evidence. It cannot close chain custody, public Beta, real-user Beta, pilot readiness, Safe/multisig, timelock/admin delay, delegated signer/vault/KMS, or deployed durable-outbox proof-sync blockers.
- Next chain work now requires deliberate release custody infrastructure: Safe/multisig or equivalent owner, timelock/admin delay, delegated signer/vault/KMS or accepted relayer custody, testnet ownership transfer, outbox-routed chain writes, signer audit logs, outbox health proof, and a saved redacted artifact that passes `npm run security:chain-custody:evidence`.

## After Outbox-Backed Chain Proof-Sync Prewire on 2026-06-06

- Added opt-in `FANPASS_CHAIN_PROOF_SYNC_OUTBOX=true` support to `TicketOwnershipSideEffectsService`.
- Ticket issue now can enqueue `OWNERSHIP_ISSUE`, resale transfer already enqueues `OWNERSHIP_TRANSFER` and `OWNERSHIP_SETTLEMENT_FINALIZE`, and scanner redemption now can enqueue `OWNERSHIP_REDEEM`.
- Prisma ticket issue and redemption paths write their ticket/check-in/audit state and outbox job in the same transaction when proof-sync outbox mode is enabled.
- `SideEffectWorkerService` now dispatches issue, transfer, redemption, and finalization ownership jobs through the same durable retry loop.
- Added focused tests for the new outbox proof-sync behavior and extended settlement idempotency/provider-boundary audits so issue/redeem chain proof-sync cannot drift out of the side-effect boundary.
- Default remains `OWNERSHIP_ADAPTER=mock`; production-like `OWNERSHIP_ADAPTER=testnet` is still blocked. This is an integration prewire only, not chain custody evidence.

## After Dynamic QR Lifecycle and Dev-Only Outbox Chain Smoke on 2026-06-06

- Added Prisma `EntryCredential` lifecycle storage for dynamic QR/NFC credentials.
- Prisma QR issue now persists an active credential and supersedes prior active credentials for the same ticket. Accepted redemption consumes the credential in the same transaction as ticket redemption, check-in creation, audit logging, and optional `OWNERSHIP_REDEEM` outbox enqueue.
- The memory verification path mirrors credential supersession/consumption for local tests.
- Added `apps/api/src/workers/sepolia-dev-outbox-proof-sync-smoke.ts` and npm script `chain:sepolia-dev:outbox-smoke`.
- The new smoke passed against the current Sepolia dev-only contract for `OWNERSHIP_ISSUE`, `OWNERSHIP_TRANSFER`, and `OWNERSHIP_REDEEM` through `SideEffectWorkerService`. Console output was redacted; the full artifact is ignored at `.fanpass-local/chain-dev/sepolia-dev-outbox-proof-sync-smoke-20260606T143025Z.json`.
- Fixed the Sepolia dev smoke scripts so an empty `FANPASS_TICKET_CONTRACT_ADDRESS` env value falls back to the latest ignored deployment artifact.
- Fixed `SideEffectWorkerService` ownership issue/redeem completion payloads to include the provider `tokenId`.
- Verification so far:
  - `scripts/with-node-22.sh npm run prisma:generate -w apps/api`
  - `scripts/with-node-22.sh npm run test -w apps/api -- --runTestsByPath test/verification.service.spec.ts`
  - `scripts/with-node-22.sh npm run typecheck -w apps/api`
  - `scripts/with-node-22.sh npm run chain:sepolia-dev:outbox-smoke`
- Remaining status: this is still dev-only and `custodyEvidence: false`; it does not close release-grade chain custody, physical QR/NFC evidence, signed Wallet evidence, signed iOS/TestFlight evidence, public dependency readiness, public Beta, or real-user Beta.

## After V4 iOS API Provider Foundation on 2026-06-06

- Added `apps/ios/FanPass/FanPass/Services/FanPassV4APIDataProvider.swift`.
- Added V4 service protocols for event, ticket, and scanner operations in `FanPassV4MockServices.swift`.
- `FanPassV4APIDataProvider` maps existing backend event, ticket, and signed QR payload DTOs into Clean V4 models. It keeps mock fallback for product actions whose backend contract is not ready for the V4 prototype yet.
- `ExploreViewModel`, `CheckoutViewModel`, `TicketsViewModel`, and `ScannerViewModel` now accept injected protocol services while defaulting to mock services for offline product review.
- Regenerated the Xcode project with `xcodegen generate --spec apps/ios/FanPass/project.yml` so the new Swift file is included in both app targets.
- Verification:
  - `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`
  - `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPassOps -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`
- Current checklist count after closing the Console dependency blocker is 396/397 tasks, 99.7%.
- Remaining status: this prepares staging-backed V4 UI integration but does not replace mock review flows by default, does not add production auth/session exchange, and does not close signed iOS/TestFlight, signed Wallet, physical QR/NFC, release-grade chain custody, public Beta, or real-user Beta evidence.

## After User App Direct Home Launch And Home Fidelity Pass on 2026-06-11

- Per owner direction, the user-facing `FanPass` target now opens directly into the Home tab instead of showing the V4 splash/onboarding/welcome flow. The root stage default in `apps/ios/FanPass/FanPass/ViewModels/FanPassV4ViewModels.swift` is `.main`, and the default tab remains `.home`.
- Reworked `apps/ios/FanPass/FanPass/Views/Home/FanPassV4HomeView.swift` against the confirmed mobile Home concept at `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-home-mobile-v3.png`.
- Home now uses a dedicated ticketing first viewport: FanPass brand header, search/notification/profile controls, `Hey Alex`, `Find verified tickets`, search bar, horizontal filter chips, large featured event card, `Popular near you`, and `Just announced`. Trust, Fan Access, next ticket, and recovery windows remain lower in the scroll.
- Fixed the visual overlap found during screenshot QA where the `Next up` pill collided with the featured date badge.
- Verification:
  - `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`
  - Installed/launched `com.fanpass.app` on simulator `41D28602-FF01-4E4C-98AA-DA7F4FC93D27`.
  - Final screenshot: `outputs/ios-concepts/review-20260611/fanpass-home-direct-final.png`.
- Current fidelity assessment: launch route is correct and Home's core hierarchy now matches the confirmed concept much more closely, but it is not pixel-perfect because event photography is still represented by maintainable SwiftUI poster art. Do not claim signed/TestFlight, physical QR/NFC, Wallet, public Beta, or chain-custody readiness from this UI evidence.

## After iOS Release Boundary And Ops Staff Linking Repair on 2026-06-11

- Completed the mandatory startup context pass for this workstream: `docs/CODEX_HANDOFF.md` was read first, then every workspace Markdown file was enumerated and fully read via `rg --files -g '*.md'` plus complete local read checks before continuing from the current active state.
- Repaired the iOS distribution boundary audit after it failed on an outdated assumption that the old `OpsMetric(title: "Fallback")` paste metric must exist. The audit now accepts the safer current state where that metric is absent, while still rejecting any reintroduced fallback metric outside `#if DEBUG`.
- Kept scanner paste-fallback copy out of release UI states. `ScannerView` and `NFCPayloadScanner` now reserve paste/simulator fallback wording for `#if DEBUG`; release copy points staff to QR/NFC paths only.
- Restored the FanPass Ops release staff-linking path in `OpsShellView`: the Account surface now sends a Privy email code, completes `privyAuthProvider.loginWithEmailCode(...)`, accepts the one-time staff invite through `apiClient.acceptStaffInvite(...)`, installs the returned staff access token via `apiClient.withAccessToken(...)`, and clears transient Privy/invite code state after linking.
- Verification passed:
  - `npm run security:ios-distribution-boundaries:self-test`
  - `npm run security:ios-distribution-boundaries`
  - `npm run security:ios-physical-device-qa`
  - `npm run security:nfc-ndef-fixture`
  - `npm run security:staff-invite-policy`
  - `npm run beta:foundation:verify`
  - `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`
  - `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPassOps -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`
- `https://fanpass-api-staging.onrender.com/health` returned healthy after an initial free-tier cold-start timeout. This proves the known Render staging API is reachable now, but does not close iOS/TestFlight evidence.
- Local readiness remains favorable but external gates remain open: one Apple Development signing identity and one paired iPhone are available locally, but Team IDs, profile names, signing material, and device identifiers must stay out of docs and saved evidence.
- Fresh non-passing evidence drafts were generated at `outputs/ios-staging-build/20260611T-ios-staging-build-draft.json` and `outputs/ops-scanner/20260611T-ops-scanner-device-draft.json`. They remain intentionally non-passing until real signed builds, HTTPS runtime observations, Privy/Stripe public config, physical QR/NFC scans, replay rejection, and backend-authority proof are captured.
- Remaining status: the local release-boundary and staff-linking gates are green again. Public/TestFlight or real-user Beta is still blocked by signed iOS/TestFlight evidence, physical QR/NFC evidence, signed Apple Wallet `.pkpass` evidence, and release-grade chain custody evidence.

## After Fan iOS Guest Home, Checkout, QR Seconds, And Staging Ticket-Type Pass on 2026-06-12

- Completed the required startup context pass for this continuation: `docs/CODEX_HANDOFF.md` was read first, all workspace Markdown files were enumerated/read at command level with `rg --files -g '*.md'`, `wc -l`, and `shasum -a 256`, then the active Clean V4/Stripe/QR/iOS architecture docs were re-read before code changes.
- Restored the owner-approved fan app launch boundary: the user-facing `FanPass` target now opens directly into Home as a signed-out guest, not a login wall. `FanPassBackendContext` now initializes/signs out to a real `Guest` V4 user, while ticket wallet, checkout, and QR entry remain gated.
- Added local auth gates for protected fan actions. Guest users can browse Home/events, but `Buy Ticket` opens a sign-in sheet; `Tickets` shows a single working `Continue as test fan` action plus a Privy sign-in instruction, avoiding inert buttons.
- Reworked Checkout action placement so `Complete simulator purchase` and `Pay with Stripe` render immediately after the price breakdown instead of at the bottom near the Tab Bar. This fixed a simulator QA issue where the payment button tap could be intercepted by the bottom tab region.
- Tightened Stripe staging behavior. The iOS app now prioritizes API events with real `ticketTypes`, so the default event is `FanPass Demo Concert` / `CAT 2` / `HK$1,288` / `100 left` instead of an empty-ticket staging record. Test-fan sessions are treated as local-only and cannot open real Stripe PaymentSheet; real Stripe still requires Privy sign-in from Account and an API-online FanPass session.
- Added three additional priced demo events to `apps/api/src/common/demo-seed.ts` for future staging/demo seed use: `Aurora Nights World Tour` (HK$880 GA), `Hong Kong City Finals` (HK$680 Lower Bowl), and `Neon Theatre Weekend` (HK$420 Balcony). This is code/seed readiness only; it does not prove those rows have been inserted into the current Render staging database.
- Changed dynamic QR lifetime UI from percentage to seconds remaining. The entry-code sheet now displays values such as `20s` beside `Credential lifetime` while retaining the progress bar and 30-second refresh behavior.
- Verification passed:
  - `xcodebuild -quiet -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Beta -destination 'platform=iOS Simulator,id=41D28602-FF01-4E4C-98AA-DA7F4FC93D27' -derivedDataPath outputs/ios-sim-build/FanPassBeta build`
  - `npm --workspace apps/api run typecheck`
  - Clean install/launch of `com.fanpass.app` on simulator `41D28602-FF01-4E4C-98AA-DA7F4FC93D27`.
  - XcodeBuildMCP UI automation verified guest Home (`Welcome`), default priced staging event (`FanPass Demo Concert`, `CAT 2`, `HK$1,288`, `100 left`), guest `Buy Ticket` auth sheet, test-fan Checkout, `Complete simulator purchase` -> `Payment complete`, Tickets guest gate, test-fan QR sheet, and QR lifetime seconds (`20s` observed).
- Screenshots saved:
  - `outputs/ios-sim-screenshots/fanpass-guest-home.png`
  - `outputs/ios-sim-screenshots/fanpass-qr-seconds.jpg`
  - `outputs/ios-sim-screenshots/fanpass-checkout-payment-complete.png`
- Remaining status: native simulator UX is materially more testable, but this still does not close real Stripe PaymentSheet evidence, Privy live sign-in evidence, signed/TestFlight evidence, physical fan QR -> Ops scanner evidence, signed Apple Wallet evidence, or release-grade chain custody. Full Stripe can only be claimed after a real Privy session creates an API order and a non-mock Stripe test PaymentIntent on HTTPS staging, with webhook settlement evidence saved.

## After Fan iOS Privy Routing And Staff Checkout Boundary Fix on 2026-06-12

- Repeated the required startup context pass after the owner reported checkout still could not be tested: `docs/CODEX_HANDOFF.md` was read first, then all workspace Markdown files were enumerated/read/hashed again before implementation.
- Root cause 1: `Use Privy in Account` in the checkout/auth sheet only dismissed the sheet. It did not navigate anywhere, so it looked like a dead button and forced the owner to manually go to Account.
- Fix 1: `FanPassRootViewModel` now owns `accountSection` plus `openPrivySignIn()`. The app shell injects the root view model into the SwiftUI environment. Auth sheets and the Tickets guest state call `openPrivySignIn()`, which switches to the Account tab and opens the Security/Privy section directly.
- Root cause 2: Checkout treated `session.accessToken == nil` as acceptable for Stripe because `nil != "local-review-token"` evaluated as true. This allowed an unauthenticated `/orders` request to reach the API and return `Authentication is required` even though the UI copy said it was ready to create an order.
- Fix 2: Checkout now requires a non-empty FanPass API bearer token before Stripe readiness or PaymentSheet preparation can proceed. Missing bearer state renders a specific message telling the user to reopen Account Privy sign-in and verify the code.
- Root cause 3: The owner had signed in with a staff account. Backend order creation is guarded by `@Roles("FAN", "ADMIN")`; `GATE_STAFF` is valid for Ops but is not a buying identity in the consumer app.
- Fix 3: Event Detail and Checkout now block non-fan/non-admin accounts from purchase. The UI explicitly says staff accounts belong in `FanPass Ops` and purchases require a fan account, instead of surfacing a generic API auth failure.
- Verification passed:
  - `xcodebuild -quiet -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Beta -destination 'platform=iOS Simulator,id=41D28602-FF01-4E4C-98AA-DA7F4FC93D27' -derivedDataPath outputs/ios-sim-build/FanPassBeta build`
  - `npm --workspace apps/api run typecheck`
  - Clean simulator install/launch.
  - XcodeBuildMCP UI automation verified Home -> Event Detail -> Buy -> `Open Privy sign-in` routes directly to Account with Security selected and Privy sign-in fields visible.
  - XcodeBuildMCP UI automation also verified Tickets guest `Open Privy sign-in` routes directly to Account/Security.
- Screenshot saved: `outputs/ios-sim-screenshots/fanpass-privy-signin-routed.jpg`.
- Remaining status: a real Stripe end-to-end still requires signing into the fan app with a Privy account that syncs as `FAN` and returns a non-empty FanPass API bearer token. A staff/Ops account cannot be used to buy tickets. Ops login and fan-app login are separate app/session contexts.

## After Fan iOS Privy Bearer Preservation Fix on 2026-06-12

- Repeated the required startup pass after the owner reported that switching to fan still produced `missing a FanPass API bearer token`: `docs/CODEX_HANDOFF.md` was read first, then all Markdown files were enumerated/read/hashed.
- Root cause: backend Privy sync intentionally returns `accessToken: null` while validating and accepting the Privy access token as the API bearer. The V4 iOS context applied that null session token, so the UI role could be `FAN` while the stored session had no bearer for `/orders`.
- Added `UserSession.withAccessToken(_:)` and updated `FanPassBackendContext.loginWithPrivyEmailCode` so a successful Privy sync stores the backend session with `fanPassSession.accessToken ?? privySession.accessToken`.
- Updated legacy `AppState.loginWithPrivyAccessToken` the same way so both old and V4 auth surfaces preserve the bearer consistently.
- Verification passed:
  - `xcodebuild -quiet -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Beta -destination 'platform=iOS Simulator,id=41D28602-FF01-4E4C-98AA-DA7F4FC93D27' -derivedDataPath outputs/ios-sim-build/FanPassBeta build`
  - `npm --workspace apps/api run typecheck`
- Remaining status: the owner still needs to rebuild/reinstall the fan app with this fix, then sign into the fan app with a Privy account that syncs as `FAN`. Staff/Ops login remains separate and cannot buy tickets.

## After FanPass Simulator Reinstall Check on 2026-06-12

- Rechecked the active simulator after the owner asked whether the new fan app was installed. XcodeBuildMCP defaults were `FanPass` / `Beta` / `FanPass-iPhone-17` / `com.fanpass.app`, with DerivedData path `outputs/ios-sim-build/FanPassBeta`.
- The installed simulator app was stale before reinstall: build product timestamp was `2026-06-12 11:09:04 +0800`, installed app timestamp was `2026-06-12 10:59:13 +0800`, and executable SHA-256 hashes differed.
- Installed the latest `FanPass.app` onto simulator `41D28602-FF01-4E4C-98AA-DA7F4FC93D27` with XcodeBuildMCP `install_app_sim`, then relaunched `com.fanpass.app` successfully.
- After reinstall, the installed executable hash matched the build product hash: `71f7953583c944bdcea85307bcf96d5b9fe60ca6ecff07aca77a7bbc58989c40`.
- Next retest should use the freshly installed simulator app. If checkout still reports a missing bearer after fan Privy login, clear the app state or delete/reinstall the simulator app so no pre-fix role-only session remains.

## After iOS Checkout Success Feedback And Ticket Wallet Sync on 2026-06-12

- Repeated the required startup pass for the owner's report that Stripe succeeded but the app showed no success/failure UI and Tickets stayed empty.
- iOS V4 now records checkout-created tickets in `FanPassBackendContext.pendingCheckoutTickets` for the current signed-in session and wraps the API ticket service so pending checkout tickets are merged into wallet results until the backend returns a matching real ticket.
- `FanPassRootViewModel.openTickets()` now routes directly to the Tickets tab.
- `FanPassV4CheckoutView` now presents a result sheet for successful, failed, or cancelled checkout. Successful simulator or Stripe checkout records a ticket, offers `View in Tickets`, and navigates to the Tickets tab.
- Real Stripe success is represented as a client-visible ticket-sync state: the ticket appears in Tickets immediately, while copy still states that entry QR depends on backend settlement returning the final ticket record. This is simulator/client UX closure, not release evidence for webhook settlement or production ticket issuance.
- Verification passed:
  - XcodeBuildMCP `build_sim` for `FanPass` / `Beta` on simulator `41D28602-FF01-4E4C-98AA-DA7F4FC93D27`.
  - XcodeBuildMCP `install_app_sim` and `launch_app_sim`.
  - Installed executable hash matched build product hash `dfaee9f1cce606f4417762c3420811f4b085dc9c6011bffcc6cd4f2154a86508`.
  - XcodeBuildMCP UI smoke: guest Home -> event detail -> Buy -> Continue as test fan -> Buy -> Complete simulator purchase showed `Simulator purchase complete`, then `View in Tickets` navigated to Tickets with Upcoming `5 tickets`.
- Screenshot: `/var/folders/w9/57v4cx3137g74nh7t0g2g2qc0000gn/T/screenshot_optimized_0a1b4f0e-83c2-4453-a087-a66b4a939b52.jpg`.

## After Backend Primary Ticket Settlement For Stripe Authorization on 2026-06-12

- Repeated the required startup pass before implementation: `docs/CODEX_HANDOFF.md` was read first, then all Markdown files were enumerated/read/hashed.
- Root cause: Stripe webhook authorization queued `ORDER_MATCH_AFTER_PAYMENT_AUTH`, but the worker only called `orderbook.tryMatch(orderId)`. That path only settled BUY orders against existing resale SELL asks. A primary purchase with no resale ask could authorize payment but never create a backend `Ticket`, so the fan wallet/QR path had no authoritative ticket to load.
- Added `OrderbookService.settleAfterPaymentAuthorization(orderId)`. It first attempts the existing resale settlement path. If no eligible ask exists and the BUY order has an authorized payment, it issues a primary ticket to the buyer, marks the buy order `SETTLED`, writes `ORDER_PRIMARY_TICKET_ISSUED`, publishes a `primary_ticket_issued` realtime reason, and queues payment capture with `tradeId: null` plus a primary-ticket idempotency key.
- Added failure compensation for primary ticket issuance: failed primary issue marks the claimed BUY order `REJECTED`, cancels any already-issued ACTIVE primary ticket if final settlement persistence fails, and queues payment cancel/refund compensation with reason `primary_ticket_issue_failed`.
- `SideEffectWorkerService` now completes `ORDER_MATCH_AFTER_PAYMENT_AUTH` with structured settlement output: `ticketId`, `tradeId`, `fulfillmentType`, `matched`, and `issued`, so resale matches and primary ticket issuance are distinguishable.
- Updated tests for memory orderbook primary issuance and worker resale/primary authorization results.
- QR status after this change:
  - A ticket returned by the backend uses `/verification/qr` to create a signed, 30-second QR payload.
  - Local iOS worktree note: `FanPassV4APIScannerService.refreshQRCredential` was tightened in the local untracked V4 iOS source used for the device build so it no longer silently falls back to `local-review` when `/verification/qr` fails. API-backed tickets must display a backend QR or show an error; only the explicit mock service path can generate local-review QR. Because the current V4 iOS source tree is broadly untracked, this Swift file was not included in the Render/API Git deployment commit.
  - `FanPass Ops` scanner decodes the QR and calls `/verification/redeem` unless the payload is explicitly `kid == "local-review"`.
  - Backend verification returns accepted/rejected states including duplicate, expired, invalid signature, invalid ticket, wrong ownership/current holder mismatch, and inactive/cancelled ticket failures.
  - The simulator/local fallback QR remains `local-review` and is not release evidence. Physical fan QR -> Ops scanner evidence is still open.
- Verification passed:
  - `npm run test -w apps/api -- --runTestsByPath test/orderbook.service.spec.ts test/side-effect-worker.service.spec.ts`
  - `npm run test -w apps/api -- --runTestsByPath test/verification.service.spec.ts`
  - `npm run typecheck -w apps/api`
  - `xcodebuild -quiet -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Beta -destination 'platform=iOS Simulator,id=41D28602-FF01-4E4C-98AA-DA7F4FC93D27' -derivedDataPath outputs/ios-sim-build/FanPassBeta build`
  - `xcrun simctl install 41D28602-FF01-4E4C-98AA-DA7F4FC93D27 outputs/ios-sim-build/FanPassBeta/Build/Products/Beta-iphonesimulator/FanPass.app && xcrun simctl launch 41D28602-FF01-4E4C-98AA-DA7F4FC93D27 com.fanpass.app`
  - `git diff --check`
- Remaining status: the backend issuance path is implemented and unit-verified, but Render staging needs redeploy plus a real Stripe webhook/order evidence pass before claiming production-like settlement evidence. Physical device QR scan evidence, TestFlight, Wallet, and release-grade chain custody remain open.

## After Render Push And Physical iPhone FanPass Install on 2026-06-12

- Repeated the required startup pass before deployment/device work: `docs/CODEX_HANDOFF.md` was read first, then all Markdown files were enumerated/read.
- Render CLI/API credentials were not available in the local shell, so deployment was triggered through the Git-backed Render path by committing and pushing the backend settlement changes to `origin/codex/beta-foundation-hosted-ci`.
- Pushed commit: `d2a0767426c2b5fdf89563ec35609266f146b655` (`Settle primary tickets after Stripe auth`).
- Staged files for that commit were limited to the API settlement/worker files, focused tests, and deployment handoff docs. The broader dirty worktree was left untouched.
- `https://fanpass-api-staging.onrender.com/health` returned `{"ok":true,"service":"fanpass-api","target":"technical-prototype"}` after the push. Because `/health` does not expose a deployed commit SHA and no Render API/Dashboard tool session was available, this confirms staging is online but does not independently prove Render has finished deploying commit `d2a0767`.
- Physical iPhone status:
  - `xcrun devicectl list devices` showed connected iPhone `tantalum` / iPhone 16 Pro Max.
  - The device already had `FanPass` (`com.fanpass.app`) and `FanPass Ops` (`com.fanpass.ops`) installed.
  - Built `FanPass` for the connected iPhone with `xcodebuild -quiet -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Beta -destination 'platform=iOS,id=00008140-001E5D801409801C' -derivedDataPath outputs/ios-device-build/FanPassBetaDevice build`.
  - Installed `outputs/ios-device-build/FanPassBetaDevice/Build/Products/Beta-iphoneos/FanPass.app` to the phone with `xcrun devicectl device install app`.
  - Launched `com.fanpass.app` on the phone successfully.
  - Device build executable SHA-256: `a160b10e8419bb6a1eeed50002cea8b30ad167c206971cf476ca4f46416a4d87`.
- Git status after deployment: API settlement files and deployment docs are committed/pushed. The local V4 iOS file `apps/ios/FanPass/FanPass/Services/FanPassV4APIDataProvider.swift` remains untracked with the no-mock-QR-fallback behavior used in the installed phone build.
- Boundary: this is a local development-device install, not TestFlight evidence. Render staging online check is not yet webhook settlement evidence. Next live check should wait for Render to finish deploying or manually deploy latest commit from Render Dashboard if auto-deploy is off, then run a real Stripe test checkout and verify the backend ticket appears.

## After Render CLI Setup And API Staging Deploy on 2026-06-12

- Repeated the required startup pass for the Render CLI continuation: `docs/CODEX_HANDOFF.md` was read first, then all Markdown files were enumerated/read before continuing.
- Installed Render CLI locally with Homebrew. `render login` completed through the Render Dashboard device flow, `render whoami -o json` confirmed the account, and `render workspace set tea-d8dg6inavr4c73fo04m0 --confirm` set the active workspace to `FanPass`.
- Render service discovery via CLI found:
  - API service `fanpass-api-staging`, id `srv-d8dh521o3t8c73eidcv0`, public URL `https://fanpass-api-staging.onrender.com`, configured branch `main`.
  - Console service `fanpass-console-staging`, id `srv-d8i5oma8qa3s73e3vug0`, public URL `https://fanpass-console-staging.onrender.com`, configured branch `codex/beta-foundation-hosted-ci`.
- Important deployment finding: pushing `codex/beta-foundation-hosted-ci` does not auto-deploy the API because the API service is configured against `main`. API staging was deployed by explicitly passing commit SHAs to `render deploys create srv-d8dh521o3t8c73eidcv0 --commit <sha> --wait --confirm`.
- Several deploy attempts correctly exposed missing committed backend pieces and staging config mismatches:
  - `593f5ac6eedffd09348e80031ddaa95354629301` failed because `side-effect-worker.service.ts` referenced `ticketTypeId` before the ownership input/type changes were committed.
  - `0bfad75d1ebd17037237b8dfa04080ce22cfceba` failed because `tickets.service.ts` still had uncommitted `ticketTypeId` issue-call changes.
  - `1e7a86f893f256ee9aadd592b9108b5d936eafa9` failed because Prisma `EntryCredential` schema changes had not been committed.
  - `ac44656df4c34000a919bcc0fb9856c4723d90c2` failed during `prisma db push` because a new `acceptedTicketId @unique` constraint required a data-loss override.
  - `1eed5a05aebfa04d6a8a4f4b39351bfbb714cd33` built but failed startup because Render had an older `QR_TTL_SECONDS` value and strict config validation required exactly `30`.
- Fixes committed and pushed to `origin/codex/beta-foundation-hosted-ci`:
  - `0bfad75d1ebd17037237b8dfa04080ce22cfceba` (`Complete ownership proof sync worker types`): committed ownership proof-sync input/types and tests.
  - `1e7a86f893f256ee9aadd592b9108b5d936eafa9` (`Harden entry credentials and proof history`): committed QR credential lifecycle, NFC validate, proof-history, demo market-depth, and tests.
  - `ac44656df4c34000a919bcc0fb9856c4723d90c2` (`Add entry credential persistence schema`): committed Prisma `EntryCredential` persistence.
  - `1eed5a05aebfa04d6a8a4f4b39351bfbb714cd33` (`Avoid staging data-loss warning for entry credentials`): removed the unnecessary `acceptedTicketId` uniqueness so staging `prisma db push` does not require `--accept-data-loss`.
  - `a1b6d56b5083c33b8a35b7ebc6d91a2150c810d9` (`Clamp QR TTL at runtime without blocking staging env`): allowed existing staging `QR_TTL_SECONDS` config to pass startup while runtime QR issuance still clamps credentials to 30 seconds.
- Final Render deploy:
  - Deploy id `dep-d8m046bbc2fs73ee9l4g`.
  - Commit `a1b6d56b5083c33b8a35b7ebc6d91a2150c810d9`.
  - Status `live`.
  - `curl -m 30 -fsS https://fanpass-api-staging.onrender.com/health` returned `{"ok":true,"service":"fanpass-api","target":"technical-prototype"}`.
- Verification run locally before final deploy:
  - `npm run test -w apps/api -- --runTestsByPath test/ownership.service.spec.ts test/ticket-ownership-side-effects.service.spec.ts test/side-effect-worker.service.spec.ts test/orderbook.service.spec.ts test/verification.service.spec.ts`
  - `npm run test -w apps/api -- --runTestsByPath test/verification.service.spec.ts test/tickets.service.spec.ts test/route-security.spec.ts test/security-config.spec.ts test/ownership.service.spec.ts test/ticket-ownership-side-effects.service.spec.ts test/side-effect-worker.service.spec.ts test/orderbook.service.spec.ts`
  - `npm run prisma:push -w apps/api`
  - `npm run test -w apps/api -- --runTestsByPath test/security-config.spec.ts test/verification.service.spec.ts`
  - `npm run typecheck -w apps/api`
  - `npm run build -w apps/api`
- Current backend status: Render API staging is live on the latest API commit above and now includes primary ticket settlement after Stripe authorization, dynamic entry credential persistence, 30-second runtime QR credential windows, NFC validate endpoint support, and proof-history support.
- Physical iPhone follow-up after the deploy: `xcrun devicectl list devices` still showed connected iPhone `tantalum` / iPhone 16 Pro Max. `xcrun devicectl device info apps` confirmed both `com.fanpass.app` (`FanPass`) and `com.fanpass.ops` (`FanPass Ops`) remain installed as developer-built apps. No iOS source changed during the Render CLI/deploy fix, so the previously installed `FanPass` device build with executable SHA-256 `a160b10e8419bb6a1eeed50002cea8b30ad167c206971cf476ca4f46416a4d87` was not reinstalled.
- Remaining evidence boundary: this deploy closes the Render API staging deployment gap, but it does not by itself close real Stripe webhook settlement evidence, physical fan QR -> Ops scanner evidence, signed/TestFlight evidence, signed Wallet evidence, or release-grade chain custody evidence.
- Worktree caution: many pre-existing non-API files remain dirty/untracked. This deployment intentionally staged only the API files and docs needed for the Render deploy path.

## After Web Event Detail And Checkout Concept Pass on 2026-06-07

- Confirmed the non-negotiable engineering rules are present in `docs/NEW_CHAT_PROMPT.md`, `docs/CODEX_HANDOFF.md`, and `docs/QA_CHECKLIST.md`.
- Added the same rules to root `README.md`; current corrected rule is to read `docs/CODEX_HANDOFF.md` first, enumerate/read every Markdown file before work, avoid "shit-mountain" or spaghetti code, treat security as release-blocking, and update relevant Markdown docs plus `docs/NEW_CHAT_PROMPT.md` when work completes.
- Extracted `EventView` and `CheckoutView` out of `apps/web/src/App.tsx` into focused components under `apps/web/src/components/`.
- Rebuilt Event Detail toward the supplied premium marketplace concept with a large editorial hero, right-side ticket stack, market pulse, resale cap/face-value comparison, and FanPass fairness/policy cards.
- Rebuilt Checkout toward the supplied ticketing order concept with event strip, reserve/authorize/issue steps, test-mode payment boundary copy, rule/session assurance cards, ticket preview, and protected order summary.
- Kept security/product boundaries unchanged: web remains a review/fallback app, does not include Web NFC, does not claim live payment or production readiness, and does not close native iOS/TestFlight, signed Apple Wallet, physical scanner, or chain custody evidence blockers.
- Verification:
  - `scripts/with-node-22.sh npm run typecheck:web`
  - `scripts/with-node-22.sh npm run build:web`
  - Playwright flow through `http://localhost:5175/`: Discover -> Event Detail -> Checkout Select -> Checkout Confirm.
  - Screenshots:
    - `/Users/tantalum/Documents/system and iot/apps/web/dist/event-detail-concept-v2.png`
    - `/Users/tantalum/Documents/system and iot/apps/web/dist/checkout-select-concept-v2.png`
    - `/Users/tantalum/Documents/system and iot/apps/web/dist/checkout-confirm-concept-v2.png`
    - `/Users/tantalum/Documents/system and iot/apps/web/dist/event-detail-mobile-concept-v2.png`
  - Browser QA reported zero console errors and zero horizontal overflow at desktop 1728 x 1117 and mobile 390 x 844.
- Maintainability status: `apps/web/src/App.tsx` is down from 1,223 lines to 1,011 lines after extraction, but it is still too large. `apps/web/src/styles/global.css` is now 4,912 lines and should be split or layered before more large visual variants are added.

## After Web Component Boundary Pass on 2026-06-07

- Continued the Web Beta Fallback implementation toward the supplied marketplace/orderbook/ticket concept while prioritizing maintainable code boundaries.
- Reworked `apps/web/src/App.tsx` into a state/routing composition layer and extracted:
  - `apps/web/src/components/AppHeader.tsx`
  - `apps/web/src/components/EventCard.tsx`
  - `apps/web/src/components/DiscoverView.tsx`
  - `apps/web/src/components/TerminalConcept.tsx`
  - `apps/web/src/components/PulseConcept.tsx`
- `App.tsx` is now 445 lines, down from 1,011 lines after the previous pass and 1,223 lines before Event/Checkout extraction.
- Preserved current product/security boundaries: web remains a review/fallback app, no Web NFC, no production payment/readiness claims, no real personal data, and no substitution for native iOS/TestFlight, signed Wallet, physical scanner, or release-grade chain custody evidence.
- Verification:
  - `scripts/with-node-22.sh npm run typecheck:web`
  - `scripts/with-node-22.sh npm run build:web`
  - Playwright flow through `http://localhost:5175/`: Discover -> Listings/Market -> Review order -> Tickets -> Discover -> Event Detail -> Checkout.
  - Market `Review order` still created an API-backed demo order and rendered `Order open on API`.
  - Screenshots:
    - `/Users/tantalum/Documents/system and iot/apps/web/dist/component-extraction-pass/discover.png`
    - `/Users/tantalum/Documents/system and iot/apps/web/dist/component-extraction-pass/market.png`
    - `/Users/tantalum/Documents/system and iot/apps/web/dist/component-extraction-pass/tickets.png`
    - `/Users/tantalum/Documents/system and iot/apps/web/dist/component-extraction-pass/event.png`
    - `/Users/tantalum/Documents/system and iot/apps/web/dist/component-extraction-pass/checkout.png`
    - `/Users/tantalum/Documents/system and iot/apps/web/dist/component-extraction-pass/mobile-discover.png`
  - Browser QA reported zero console errors and zero horizontal overflow at desktop 1728 x 1117 and mobile 390 x 844.
- Remaining maintainability gaps: `FeatureWorkspace.tsx` remains large at 447 lines, and `global.css` remains large at 4,912 lines. Continue splitting secondary feature surfaces and CSS layers before adding more major UI behavior.

## Next Engineering Tasks

1. If continuing the current Web Beta Fallback path, continue refining the actual `apps/web` product app, not a landing page. Prioritize high-fidelity parity with the supplied marketplace/orderbook/wallet concept, maintainable component boundaries, API-backed ticket/order/listing flows, and browser QA evidence. Keep Web NFC out of scope and keep the web path separate from native iOS/TestFlight/Wallet evidence.
2. If returning to release hardening, continue security work before any real-user/public Beta: iOS/TestFlight staging build evidence, signed Wallet evidence, physical QR/NFC evidence, and release-grade chain custody evidence.
3. Collect release-grade chain custody evidence only after Safe/multisig or equivalent ownership, timelock/admin delay, delegated signer/vault/KMS or accepted relayer custody, deployed outbox-routed chain writes, signer audit logs, and outbox health proof are available.
4. Validate the Core NFC scanner prototype on a physical iPhone with a supported NDEF tag after signing/provisioning is available.

## Context Strategy

Codex cannot create separate conversation windows by itself. Keep durable state in repo docs instead:

- Update this file after every meaningful milestone.
- Keep task state in `docs/DEVELOPMENT_TASKS.md`.
- Keep product decisions in `docs/BETA_ROADMAP.md`.
- Keep security findings and release blockers in `docs/ALPHA_SECURITY_REVIEW.md`.
- Keep provider pricing/feature checks in `docs/PROVIDER_COST_FEASIBILITY.md`.
- Before starting any new implementation turn, read this file first, enumerate and read every Markdown file in the workspace with `rg --files -g '*.md'`, then re-read the active source-of-truth docs for the task such as `docs/BETA_ROADMAP.md`, `docs/DEVELOPMENT_TASKS.md`, `docs/QA_CHECKLIST.md`, and the Clean V4 docs when UI is involved.
- Also read `docs/ALPHA_PLAN.md` during Alpha work.
