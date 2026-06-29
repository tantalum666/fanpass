# FanPass iOS Concept Implementation Audit V4

Date: 2026-06-10

This audit checks whether the native iOS SwiftUI concept implementation is visually and structurally close to the generated concept boards for `Home`, `Explore`, `Market`, `Tickets`, `Account`, and `FanPassOps`.

## Evidence

- Startup protocol was repeated before review: `docs/CODEX_HANDOFF.md` was read first, then all workspace Markdown files were enumerated/read (`2720` files, `25996742` bytes, sha256 `56ed73d6cf507b28e1964853d9fd52382bfbd16170404d4845d06f1ac70dab9b`).
- Current implementation screenshot set is saved locally under `outputs/ios-concepts/review-20260610/`. The `outputs/` directory is gitignored and these screenshots are visual QA artifacts only.
- Reference concept contact sheet was generated at `outputs/ios-concepts/review-20260610/reference-concepts-contact-sheet.jpg`.
- Current implementation contact sheet was generated at `outputs/ios-concepts/review-20260610/current-ios-contact-sheet.jpg`.

## Assessment

The iOS implementation is structurally close but not yet high-fidelity. It covers the right destinations, secondary states, and safety boundaries, but the native UI still reads more like a componentized prototype than a polished ticketing product.

Current closeness by area:

- `Home`: Medium. The route has the correct long-scroll mobile structure, search, featured event, quick actions, next ticket, discovery sections, trust, Fan Access, and low-data windows. It is still less visual than the concept because event artwork/posters are represented mostly by cards/gradients rather than a stronger ticketing media treatment.
- `Explore`: Medium-high after fixes. Overview, filters, map/list, events, venues, artists, collections, saved, and no-results exist. The segmented subnav now wraps cleanly instead of clipping.
- `Market`: Medium-high. Controlled resale, price context, event market, buy/listing, seller flow, guardrails, and plain-language copy are represented. It intentionally avoids a trading/crypto terminal feel.
- `Tickets`: Medium-high. Ticket wallet, entry readiness, 30-second QR entry sheet, lifecycle states, Proof & History, rules, resale handoff, and support states are represented with safe copy.
- `Account`: Medium-high after fixes. Account now has overview, profile, orders, alerts, security/privacy, payments/support, role handoff, and masked identity. The visible `0x...` identity and clipped `Payments` nav issue were fixed.
- `FanPassOps`: Structurally high, visually medium. Shift assignment, live scanner, recovery, audit, account/device health, and safe-payload rules exist. However, the generated Ops concept boards use a lighter onsite-ops tool style, while the current implementation keeps the dark FanPass V4 theme. A full visual match would require a deliberate Ops-specific theme pass.

## Fixes Applied

- Replaced the horizontal `FPConceptSegmentedControl` with an adaptive grid so secondary navigation does not clip labels on iPhone width.
- Changed mock ticket identity fragments from `0x...` to FanPass-owned masked IDs such as `FP-6C91...22AA`.
- Removed the visible `Demo` tab from `Account` and deleted the unused prototype-controls UI from that route.
- Replaced visible `concept`, `prototype`, `demo`, `crypto`, and `wallet address/data` wording in user-facing V4 views with product-safe ticketing language.
- Updated map accessibility text to describe actual pins instead of internal concept language.

## Remaining Visual Gaps

- Fan-facing Home, Explore, Market, and Tickets now have stronger poster/pass treatment, but still use generated SwiftUI visual abstractions rather than production event artwork. A later asset pass should decide real/local-safe poster assets.
- `FanPassOps` now uses a lighter onsite-operations theme for the main workflow, but scanner result cards still use high-contrast state panels where they help readability. Review the scanner/recovery depths on device before further light-theme expansion.
- Do a second pass on spacing and information density after post-onboarding simulator or connected-iPhone screenshots for Home, Explore, Market, Tickets, and Account.

## 2026-06-11 Confirmed Concept Alignment Pass

The confirmed-image manifest was used as the source of truth: `docs/ux/FanPass_Generated_Image_Manifest_V4.md`. Superseded, paused, deferred, and reference-only images were not used as implementation targets.

Changes applied:

- Added a shared editorial event poster system in `FPComponents.swift` and wired it into fan-facing Home, Explore, and Market surfaces. This moves event discovery away from plain gradient/icon cards and closer to the confirmed boards' poster-heavy ticketing marketplace style.
- Upgraded `FPTicketCard` with a stronger pass/poster header and clearer ticket-face hierarchy so Tickets and detail screens read more like wallet/pass surfaces.
- Reused the same editorial event row across Home, Explore, and Market listings to avoid small cross-route inconsistencies in thumbnail size, status treatment, price placement, and event metadata.
- Changed `FanPassOps` to a dedicated light onsite-operations theme for the shift workflow, assigned events, gate selection, stats, rows, and action cards. This better matches the confirmed Ops boards, while scanner result panels can still use high-contrast states where useful.

Evidence:

- FanPass simulator Debug build passed with `CODE_SIGNING_ALLOWED=NO`.
- FanPassOps simulator Debug build passed with `CODE_SIGNING_ALLOWED=NO`.
- XcodeBuildMCP `build_run_sim` passed for `FanPassOps`.
- Ops visual screenshot after the light-theme unification: `outputs/ios-concepts/review-20260611/fanpass-ops-after-light-unification.png`.
- FanPass app launch screenshot: `outputs/ios-concepts/review-20260611/fanpass-after-confirmed-style.png`. The simulator launched to onboarding, so this proves launch stability only; it is not a full Home/Explore/Market/Tickets visual QA pass.

Residual work:

- Capture post-onboarding screenshots for Home, Explore, Market, Tickets, and Account after navigating through the fan app on simulator or physical iPhone.
- Continue micro-spacing and density tuning only against `confirmed-*` images, not superseded drafts.
- This remains concept UI evidence only and does not close signed/TestFlight, physical QR/NFC, Apple Wallet, or release-chain custody evidence blockers.

## 2026-06-11 Direct Home Launch And Home Fidelity Pass

User-facing `FanPass` now opens directly to Home instead of routing through the V4 splash, onboarding, or welcome/login screens. The root view model default stage is `.main`, and the default selected tab remains `.home`.

Home was reworked against the confirmed mobile Home concept:

- Replaced the generic scaffold first screen with a dedicated ticketing Home layout.
- Added the FanPass brand header, search/notification/profile icon cluster, greeting, `Find verified tickets` headline, search bar, horizontal filter chips, a large featured event card, `Popular near you`, and `Just announced`.
- Kept trust, Fan Access, next-ticket, and recovery window entry points lower in the scroll so the first viewport is not overloaded.
- Fixed the post-check overlap where the `Next up` pill collided with the date badge by increasing the featured poster height and tightening title sizing.

Evidence:

- FanPass simulator Debug build passed with `CODE_SIGNING_ALLOWED=NO`.
- The app was installed and launched on simulator `41D28602-FF01-4E4C-98AA-DA7F4FC93D27` with bundle id `com.fanpass.app`.
- Final Home screenshot: `outputs/ios-concepts/review-20260611/fanpass-home-direct-final.png`.
- Source concept used for comparison: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-home-mobile-v3.png`.

Assessment:

- The launch route is correct: no welcome/onboarding screen is shown before Home.
- Home now matches the confirmed concept's core information architecture and first-viewport hierarchy.
- It is not pixel-perfect yet because the native implementation uses maintainable SwiftUI-generated poster art rather than real event photography/assets. A future asset pass should replace those generated poster abstractions with approved local-safe artwork.

## Verification

- `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`
- `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPassOps -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`

Both builds passed after the visual/copy fixes.

This audit is concept UI review only. It does not close signed/TestFlight, physical QR/NFC, Apple Wallet, or release-chain custody evidence blockers.

## 2026-06-11 Backend Wiring Addendum

The native V4 concept UI now has first-pass backend connectivity for the user app:

- Root `FanPassBackendContext` injects API/session/user state into the fan app.
- Home, Explore, and Tickets prefer API-backed V4 services and fall back to local review fixtures when the API is unavailable.
- Ticket entry-code sheets render a real QR image from backend `/verification/qr` payloads and refresh before the 30-second expiry.
- Account Security exposes Privy email-code login and syncs the resulting Privy session to FanPass API.
- Checkout creates a backend order and PaymentIntent before presenting native Stripe PaymentSheet.

Visual/product caveat:

- These changes are integration wiring and state behavior, not a new visual concept pass.
- The QR image is real client rendering, but physical fan-phone to Ops-phone acceptance still needs staging/physical-device evidence.
- PaymentSheet completion is shown as authorization only; ticket issue/completion still depends on backend webhook settlement.

Verification:

- `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPass -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`
- `xcodebuild -project apps/ios/FanPass/FanPass.xcodeproj -scheme FanPassOps -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`

## 2026-06-29 Account Subpage Completion Pass

After reviewing current public App Store descriptions for Ticketmaster, Eventbrite, AXS, and DICE, Account was expanded from a mostly static menu into a more complete ticketing account hub. The public references reinforce the expected Account surface: ticket apps commonly expose account-managed payment choices, receipt/order support, alerts/notifications, friend/following preferences, ticket transfer/resale adjacency, and safe support handoff.

Changes applied:

- Account root is now grouped into `Account`, `Activity`, `Money`, and `Preferences and help` sections.
- Added Account routes for `Payment methods`, `Selling and payouts`, and `Credits and promos`.
- Expanded `Profile` with editable local display-name state, verified email/contact rows, social sign-in status, and a data-export request state.
- Expanded `Orders` with receipt delivery, fee-breakdown, masked support reference, and order/refund/expired timeline rows.
- Expanded `Alerts` with toggles for push, email receipts, price alerts, entry reminders, and Fan Access updates.
- Expanded `Privacy and security` with trusted-device, friend-discovery, and diagnostics toggles, plus explicit privacy boundary copy.
- Expanded `Settings` with segmented currency, region, and appearance controls.
- Expanded `Help and support` with support-topic selection, issue text entry, and local submitted state.

Safety boundaries preserved:

- Ticket entry, resale actions, transfer eligibility, and QR refresh remain in Tickets.
- Account does not display raw provider IDs, PaymentIntent/client secret values, raw QR payloads, private keys, seed phrases, or full chain proof internals.
- Card management remains represented as secure checkout-owned; Account does not collect or store card numbers.
- Payout method is presentation-only in this prototype and does not collect bank details.

Verification:

- Full Markdown startup pass completed before work: 4,315 files, 759,704 lines, SHA-256 `4634a8700d94d85e146f2cd8face4b5a1245e9950b0368ed876604a1b5b07110`.
- XcodeBuildMCP `FanPass` Debug simulator build/run passed on `FanPass-iPhone-17` with `CODE_SIGNING_ALLOWED=NO`.
- Simulator screenshot captured after launch at `/var/folders/w9/57v4cx3137g74nh7t0g2g2qc0000gn/T/screenshot_optimized_fd5f3690-85f3-4daf-aa39-b6231c3527cb.jpg`.
- `npm run security:ios-distribution-boundaries` passed.
- `git diff --check` passed.

## 2026-06-29 Account Spacing And Scrollbar Repair

After the owner showed Account pages with large empty space below the final rows and a visible right-side scroll indicator, the shared iOS scaffold and Account route spacing were tightened.

Changes applied:

- `FanPassV4Scaffold` now hides vertical scroll indicators.
- Account root removed the extra 88pt transparent spacer that was added after `Sign out`.
- Account root keeps only the bottom padding needed for the tab bar.
- Account child routes and the sign-in page use normal bottom padding because the tab bar is hidden on those pages.

Verification:

- Full Markdown startup pass completed before work: 4,315 files, 759,772 lines, SHA-256 `789ab0fbf6e689b8fd0098fa72da6d1553e1edc2691f6ffc080919f748db823b`.
- XcodeBuildMCP `FanPass` Debug simulator build/run passed on `FanPass-iPhone-17` with `CODE_SIGNING_ALLOWED=NO`.
- Runtime Account root snapshot/screenshot confirmed no visible right-side scrollbar in the signed-out simulator state; screenshot: `/var/folders/w9/57v4cx3137g74nh7t0g2g2qc0000gn/T/screenshot_optimized_c89edbad-e8a2-44aa-b4ea-6c115488fc08.jpg`.
- `npm run security:ios-distribution-boundaries` passed.
- `git diff --check` passed.

## 2026-06-29 Account Simplification Redesign

After the owner rejected the Account/Profile redesign as too card-heavy and text-heavy, the Account UI was simplified while preserving the newly added functionality.

Reference direction:

- Public App Store descriptions for Ticketmaster, Eventbrite, AXS, and DICE were reviewed for current ticketing-account expectations.
- Those references were used for information architecture only: account identity, orders/receipts, payment readiness, transfer/resale adjacency, notifications, support, and privacy/security controls.
- The implementation does not copy a specific app's visual treatment.

Changes applied:

- Account root now uses compact section labels and single-line entry rows; per-row explanatory subtitles were removed from the root.
- Account child pages now share compact list groups with thin rows, short right-side status values, inline toggles, inline segmented choices, inline issue text entry, and small footer notes.
- Removed the previous repeated large-card pattern from Profile, Orders, Alerts, Privacy and security, Payment methods, Wallet, Selling and payouts, Credits and promos, Settings, Help and support, and private-key export.
- Profile replaced the large display-name card plus gradient save button with an inline editable row and compact Save action.
- Account detail navigation adds extra top padding so the large page title does not sit under the iOS back affordance.

Boundaries preserved:

- Ticket entry, resale, transfer, and QR refresh still remain in Tickets.
- Card management remains secure-checkout-owned; Account only shows safe payment readiness and receipt preference state.
- Wallet and private-key surfaces still avoid raw secrets, seed phrases, and fabricated private-key display.
- Account still avoids raw provider IDs, PaymentIntent/client secret values, QR payloads, and full chain proof internals.

Verification:

- Context-compaction Markdown resume pass completed before continuation: 102 files, 27,733 lines, SHA-256 `a0a26dcd4281e07171c47638edd0c6c87a4162d47da84a3120e1def0cdf0794d`.
- XcodeBuildMCP `FanPass` Debug simulator build/run passed on `FanPass-iPhone-17` with `CODE_SIGNING_ALLOWED=NO`.
- Runtime Account root snapshot confirmed simplified entry labels only; screenshot: `/var/folders/w9/57v4cx3137g74nh7t0g2g2qc0000gn/T/screenshot_optimized_b3fb5a63-15b3-4576-9391-989ce36e03a6.jpg`.
- The current simulator session was signed out, so authenticated Profile/detail pages were build/runtime-path verified but not live-screenshot verified in an authenticated state.
- `npm run security:ios-distribution-boundaries` passed.
- `git diff --check` passed.

## 2026-06-29 Design-System And Home Simplification Pass

After the owner called out that Home and other pages still felt too card-heavy and text-heavy, a durable design guide was added and the fan-facing surfaces were simplified.

Reference direction:

- DICE, SeatGeek, and Eventbrite App Store/iTunes Lookup data and screenshots were reviewed for current ticketing app patterns: image-led discovery, concise event rows, clear pricing, and account/ticket readiness separation.
- GitHub `VoltAgent/awesome-design-md`, `bergside/awesome-design-skills`, and `bergside/design-md-chrome` were read for safe DESIGN.md structure and AI-agent design rules. No external repo scripts or extension code were executed.
- The new `docs/design.md` is the local agent-readable design standard for future FanPass iOS work.

Changes applied:

- Home now leads with a poster-sized hero instead of a multi-part card. Verified state, price, venue, and `Tickets` action sit on the image.
- Home search became a light pill, popular events became cardless poster tiles, and `Just announced` became compact list rows with dividers.
- Explore route and section subtitles were removed where they only explained the obvious. `Signals` now uses row-list content instead of two stacked cards.
- Tickets route subtitle and signed-out copy were shortened while preserving entry/payment/security explanations where needed.
- Shared `FPSurfaceCard` and `FPConceptRowList` were made lighter so repeated rows do not default to heavy boxed cards.
- Account root remained a compact settings-style list and was re-smoked with Computer Use.

Boundaries preserved:

- Payment, entry QR, resale rules, wallet/private-key, and chain-proof screens may still use more explicit safety copy.
- No external visual assets, screenshots, or proprietary layouts from competitor apps were copied into source.
- Provider/payment/credential secrecy boundaries remain unchanged.

Verification:

- Context-compaction Markdown resume pass completed before continuation: 102 files, 27,790 lines, SHA-256 `892aaef2f659041f926cc908d144a8dfaa0d97f9ddf031b8bb448f90fed626bb`.
- XcodeBuildMCP `FanPass` Debug simulator build/run passed twice on `FanPass-iPhone-17` with `CODE_SIGNING_ALLOWED=NO`.
- Computer Use visually checked Home, Explore, Tickets, and Account on the simulator. Home and Account showed no visible right-side scroll indicator.
- Home screenshot evidence from XcodeBuildMCP: `/var/folders/w9/57v4cx3137g74nh7t0g2g2qc0000gn/T/screenshot_optimized_b9afd830-6e2c-4796-9e36-7c49c7fbec01.jpg`.
- `npm run security:ios-distribution-boundaries` passed.
- `git diff --check` passed.
