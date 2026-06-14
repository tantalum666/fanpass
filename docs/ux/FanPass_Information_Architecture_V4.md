# FanPass Information Architecture V4

Status: UX structure for Clean V4 UI/UX implementation.
Date: 2026-06-05
Visual source: Clean V4 only.

Required visual references:

- `docs/brand/FanPass_VI_Clean_V4_Audit.md`
- `docs/brand/FanPass_UI_Guardrails.md`
- `docs/brand/FanPass_Final_Design_Tokens_V4.md`
- `FanPass_VI_Redesign_V4/assets/fanpass-ticket-card-v4.png`

## Product Principle

FanPass is a mainstream iOS ticketing app with hidden Web3 trust infrastructure. Users should understand tickets, entry, resale rules, proof, and history without needing crypto vocabulary.

## App Structure

FanPass has three product surfaces:

| Surface | Platform | Primary role | Purpose |
| --- | --- | --- | --- |
| FanPass | iOS app | Fan / ticket buyer / seller | Browse events, buy tickets, hold tickets, access resale, use Fan Access. |
| FanPass Ops | iOS app / staff mode | Gate staff | Scan QR/NFC, accept or reject entry, view gate check-in state. |
| FanPass Console | Web | Organizer / admin-lite | Manage events, inventory, staff, resale rules, check-in summaries, and reviews. |

This document focuses on native iOS UX structure. Console is referenced only where organizer/admin-lite flows affect mobile navigation.

## Tab Navigation

Recommended FanPass iOS tabs:

| Tab | Purpose | Primary user | Notes |
| --- | --- | --- | --- |
| Home | Personalized landing and next best action. | Fan | Shows upcoming ticket, Fan Access progress, featured events, and account status. |
| Explore | Event discovery and event detail entry. | Fan / guest | Guest browsing is allowed. Login is deferred until purchase, resale, wallet, or private actions. |
| Market | Controlled resale and transparent prices. | Fan buyer / seller | Must feel like fair resale, not trading. Use plain language and bounded charts. |
| Tickets | Verified ticket wallet. | Fan | Emotional center of the app. Shows active, upcoming, listed, transferred, refunded, cancelled, and redeemed tickets. |
| Profile | Identity, payment, privacy, staff access, settings. | Fan / staff / organizer-lite | Staff scanner entry appears here only for accounts with staff permission. |

Default tab order:

1. Home
2. Explore
3. Market
4. Tickets
5. Profile

Default first launch:

- Guest: Explore or Home with guest-friendly event discovery.
- Returning fan with active ticket: Home highlights the next ticket and Tickets tab badge.
- Staff account: Profile includes staff scanner entry, but scanner is not a default tab.

## Role-Based Access

| Capability | Guest | Fan | Fan seller | Gate staff | Organizer/admin-lite |
| --- | --- | --- | --- | --- | --- |
| Browse events | Yes | Yes | Yes | Yes | Yes |
| View event detail | Yes | Yes | Yes | Yes | Yes |
| Join Fan Access | Prompt login | Yes | Yes | No by default | Review in Console |
| Buy primary ticket | Prompt login | Yes | Yes | No | No |
| Buy resale ticket | Prompt login | Yes | Yes | No | No |
| View wallet | No | Own tickets | Own tickets | No fan wallet unless also fan | Support view only in Console |
| Show dynamic QR | No | Own active ticket | Own active ticket | No | No |
| List ticket for resale | No | If transferable | Yes | No | Policy controls in Console |
| Scan QR/NFC | No | No | No | Yes | Admin override only in Ops/Console |
| Manage inventory | No | No | No | No | Console only |
| Review Fan Access | No | No | No | No | Console only |

Role rules:

- Consumer FanPass must not expose gate scanner features to normal users.
- Staff scanner mode is accessible from Profile only when the account has staff permission.
- Staff scanner mode must clearly feel operational and separate from fan ticket browsing.
- Organizer/admin-lite mobile access should be limited to profile status and deep links into Console unless a future mobile admin surface is deliberately scoped.

## Normal Fan Flow

Normal fan IA:

1. Open FanPass.
2. Browse Home or Explore as guest.
3. View event detail.
4. Review ticket types, availability, Verified Ticket promise, resale rules, and Fan Access opportunities.
5. Login only when taking private action.
6. Buy primary or resale ticket.
7. Complete checkout.
8. See purchase success.
9. Ticket appears in Tickets.
10. Open ticket detail.
11. Show dynamic QR at venue.
12. Review Proof & History when needed.
13. Use Market to list transferable tickets or buy controlled resale.

Home should answer:

- What is my next event?
- Is my ticket ready for entry?
- Is Fan Access available?
- Are there relevant events or resale opportunities?

Explore should answer:

- What can I attend?
- What ticket types exist?
- What are the rules before I buy?

### Web Explore Concept Scope

For the current Web Beta Fallback design pass, Explore is a top-level route under the five-item web navigation:

1. Home
2. Explore
3. Market
4. Tickets
5. Account

Explore is not a Home subpage. It owns the browsing and evaluation flow before purchase, while Market owns controlled resale depth, Tickets owns ticket retrieval/entry, and Account owns private account, order, wallet-like proof, alert, and settings surfaces.

Explore page/window scope:

| Level | Page or window | Primary purpose |
| --- | --- | --- |
| L1 | Explore Overview | Search, browse featured events, scan categories, and enter Events, Venues, Artists, or Collections. |
| L2 | Search Results | Show relevant events from a query with date, place, category, and trust/rule signals. |
| L2 | Filter Drawer / Mobile Filter Sheet | Let users narrow by date, district/city, category, price band, availability, and fan-access eligibility. |
| L2 | Map/List View | Compare event cards against city/district-level location context without exposing precise personal coordinates. |
| L2 | Events Directory | Calendar/list view for all eligible events with denser sorting and availability scanning. |
| L3 | Event Detail | Evaluate the event, venue, ticket types, availability, resale rules, and Fan Access options before private action. |
| L3 | Ticket Types Panel | Compare primary/resale availability, face value, organizer cap, transferability, and eligibility. |
| L3 | Event Rules Drawer | Explain refund, transfer, real-name, resale-cap, and entry-readiness rules in plain language. |
| L2 | Venues | Browse venues by city/district, capacity, upcoming events, access notes, and operational readiness. |
| L3 | Venue Detail | Show venue overview, upcoming events, transport/access notes, and event-specific entry guidance. |
| L2 | Artists | Browse artists by demand, upcoming shows, tour timeline, and Fan Access opportunities. |
| L3 | Artist Detail | Show artist spotlight, upcoming events, demand trend, and related collections. |
| L2 | Collections | Browse editorial, seasonal, organizer, and saved discovery shelves. |
| L3 | Collection Detail | Present a curated event set with short editorial context and filterable event cards. |
| State | Saved Discovery | Show saved events, artists, venues, and collections without becoming Account. |
| State | No Results / Low Data | Recover from empty search with alternative filters, nearby districts, and collection suggestions. |

Current Explore concept boards:

- Explore overview/search/filter/map/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-explore-overview-search-filter-map-mobile.png`
- Events directory/event detail/ticket types/rules/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-explore-events-detail-ticket-rules-mobile.png`
- Venues/artists directory and detail: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-explore-venues-artists-directory-detail.png`
- Collections/saved/no-results/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-explore-collections-saved-no-results-mobile.png`

Explore implementation guardrails:

- Use fictional events, venues, artists, districts, and city-level location labels.
- Do not use precise personal latitude/longitude, real private user data, production data, or account-specific order/ticket details.
- Do not introduce QR/NFC, Apple Wallet, checkout, scanner, chain-custody, or native evidence claims inside Explore concepts.
- Generated image text is placeholder only. Final UI copy must be typed, cleaned, and reviewed in code/docs.

Tickets should answer:

- What do I own?
- Which ticket is ready, listed, transferred, refunded, cancelled, or redeemed?
- Can I show entry code?

### Web Tickets Concept Scope

For the current Web Beta Fallback design pass, Tickets is a top-level route under the five-item web navigation:

1. Home
2. Explore
3. Market
4. Tickets
5. Account

Tickets is the owned-ticket retrieval and entry-readiness surface. It should stay separate from Explore discovery, Market resale browsing, and Account orders/settings. Account may own long-lived profile, order, alert, wallet-like account proof, and settings surfaces, but the high-frequency venue flow belongs in Tickets.

Tickets page/window scope:

| Level | Page or window | Primary purpose |
| --- | --- | --- |
| L1 | Tickets Overview / Ticket Wallet | Show upcoming, listed, past, cancelled, refunded, redeemed, and transfer-pending tickets with safe ticket fragments only. |
| L2 | Ticket Detail | Manage one owned ticket, show event metadata, seat/section, status, transfer count, resale eligibility, entry window, and support actions. |
| L3 | Entry Code Modal / Mobile Sheet | Show a short-lived entry QR only after owner action, with countdown, refresh, done, and a clean quiet zone. |
| L3 | Entry Code Expired | Explain expiry and offer refresh without showing raw payload, nonce, or signature. |
| L3 | Entry Code Not Active | Explain entry window has not opened yet. |
| L3 | Entry Code Unavailable While Listed | Explain listed tickets cannot show entry code until unlisted or policy allows. |
| L3 | Entry Code Transfer Pending | Explain ownership transfer is in progress and actions are locked. |
| L2 | Proof & History | Explain issued, purchased, entry-code generated, listed, transferred, cancelled/refunded, and entry-accepted lifecycle using safe labels and fragments. |
| L2 | Ticket Rules Drawer | Explain resale permission, organizer cap, transfer count, entry window, refund boundary, ticket holder policy, and support path. |
| L2 | List For Resale Handoff | Check ticket eligibility and route the seller into Market without turning Tickets into a resale browsing page. |
| L2 | Ticket Support Drawer | Provide recovery for missing ticket, transfer pending, refund/cancelled event, and other ticket issues. |
| State | Guest Tickets | Prompt sign-in and keep Explore fallback visible. |
| State | Empty Tickets | Show no tickets yet, recommended events, and Explore route. |
| State | Loading Skeleton | Preserve stable list/detail dimensions while ticket data loads. |
| State | Error / Retry | Explain unable-to-load state with retry and support. |
| State | Cancelled Ticket | Disable entry code, explain cancellation, show safe refund/support summary and proof/history route. |
| State | Refunded Ticket | Disable entry code, show muted refunded state and safe refund summary. |
| State | Redeemed Ticket | Disable entry code, show entry accepted summary and proof/history route. |
| State | Transfer Pending Ticket | Lock duplicate transfer/listing/entry actions and show a short timeline. |
| State | Listed Ticket | Disable entry code while listed and provide manage-listing route. |
| State | Offline Entry Unavailable | Explain entry code cannot be viewed or refreshed while offline. |

Current Tickets concept boards:

- Tickets overview/ticket wallet/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-tickets-overview-wallet-mobile.png`
- Ticket detail/entry code/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-tickets-detail-entry-code-mobile.png`
- Proof & History/rules/resale handoff/support/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-tickets-proof-history-rules-resale-support-mobile.png`
- Ticket states and recovery windows/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-tickets-states-recovery-mobile.png`

Tickets implementation guardrails:

- Use fictional events, tickets, users, and safe ticket fragments only.
- Do not show full ticket IDs, raw QR payloads, nonces, signatures, owner IDs, wallet addresses, payment provider IDs, PaymentIntent/client secret fields, real personal data, or production data.
- Do not introduce Apple Wallet, Web NFC, native NFC, scanner/admin UI, chain-custody, TestFlight, physical-entry evidence, or native evidence claims inside Tickets concepts.
- Entry QR may appear only inside the owner-triggered short-lived entry-code window/sheet. It must have a clean quiet zone with no logos, waves, gradients, strokes, or text intruding.
- Generated image text is placeholder only. Final UI copy must be typed, cleaned, and reviewed in code/docs.

Market should answer:

- What is the fair resale range?
- What is the organizer cap?
- What listings are available?
- Can my ticket be listed?

### Web Market Concept Scope

For the current Web Beta Fallback design pass, Market is a top-level route under the five-item web navigation:

1. Home
2. Explore
3. Market
4. Tickets
5. Account

Market is not a financial trading surface. It exists to explain controlled resale, fair price context, organizer caps, and listing eligibility in plain fan-friendly language. The product may use orderbook data under the hood, but the UI must not copy stock, crypto, DEX, gambling, or high-frequency trading patterns.

Market page/window scope:

| Level | Page or window | Primary purpose |
| --- | --- | --- |
| L1 | Market Overview | Show events with resale activity, floor price, face value, organizer cap, recent verified sale, available listings, and no-resale recovery. |
| L2 | Event Market Detail | Explain one event's fair resale range, ticket-type segments, bounded price trend, organizer cap, transfer window, and available listings. |
| L2 | Ticket Type Comparison | Compare face value, typical fair range, organizer cap, transferability, and best-fit guidance across ticket types. |
| L2 | Resale Rules Drawer | Explain organizer cap, transfer count, refund boundary, listing window, and plain-language resale obligations. |
| L2 | Market Unavailable / Low Activity | Recover when resale data is unavailable or no listings exist, with route back to Explore primary tickets. |
| L3 | Listing Detail | Review a specific resale listing without exposing seller identity or private ticket/provider data. |
| L3 | Buy Resale Review | Confirm price, fees, total, reservation timer, protected transfer, and resale rules before payment handoff. |
| L3 | Listing Unavailable | Recover when a listing is sold, reserved, expired, or policy-blocked. |
| L3 | Proof Summary | Show safe lifecycle labels only, such as issued, listed, reserved, and transfer pending. |
| L2 | List Ticket For Resale | Let the seller choose an eligible ticket, set an asking price, validate organizer cap, estimate payout, review, and list. |
| State | Seller Eligibility Check | Confirm account standing, restrictions, transfer window, and eligible tickets. |
| State | Cap Validation | Show within-cap success or cap-exceeded recovery before listing. |
| State | Listing Success | Confirm listing state and route to My Listings/Tickets. |
| State | Seller Error States | Explain not transferable, cap exceeded, already listed, redeemed, and no eligible tickets without backend internals. |

Current Market concept boards:

- Market overview/fair resale/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-market-overview-fair-resale-mobile.png`
- Event market detail/ticket types/rules/unavailable/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-market-event-detail-ticket-types-rules-unavailable-mobile.png`
- Listing detail/buy resale review/reserved/proof summary/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-market-listing-buy-review-proof-mobile.png`
- List ticket for resale seller flow/error states/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-market-seller-list-ticket-flow-error-mobile.png`

Market implementation guardrails:

- Use fictional events, tickets, listing states, and HKD test data.
- Use face value, floor, recent verified sale, organizer cap, typical fair range, listing count, transfer count, fee, payout, and reservation timer as the primary concepts.
- Use bounded line charts and range bands only; do not use candlesticks, flashing ticks, red/green trading boards, leverage/order-entry metaphors, or crypto wallet language.
- Do not expose seller identity, private user data, exact personal location, wallet addresses, raw hashes, payment provider IDs, PaymentIntent/client secret fields, QR/NFC, Apple Wallet, scanner, chain-custody, or native evidence claims.
- Generated image text is placeholder only. Final UI copy must be typed, cleaned, and reviewed in code/docs.

### Web Account Concept Scope

For the current Web Beta Fallback design pass, Account is a top-level route under the five-item web navigation:

1. Home
2. Explore
3. Market
4. Tickets
5. Account

Account is the private account-management surface. It owns identity, preferences, safe order records, payment-method labels, alert rules, privacy, security, role access, and support. It must not absorb Tickets entry-code retrieval or Market resale browsing; those remain high-frequency product routes.

Account page/window scope:

| Level | Page or window | Primary purpose |
| --- | --- | --- |
| L1 | Account Overview / Profile Hub | Summarize masked profile, ticket identity, role, payment methods, orders, alerts, privacy, security, support, next actions, and sync status. |
| L2 | Profile Details | Edit display/contact details using masked email/phone display and reauthentication where needed. |
| L2 | Ticket Identity | Show a masked ticket identity/proof reference and safe sync status, without exposing wallet internals. |
| L2 | Payment Methods | Manage provider-safe payment labels, primary method, add/remove flows, and payout method where applicable. |
| L2 | Orders | Show fan-owned order/receipt history with safe order fragments and status filters. |
| L3 | Order Detail | Show receipt summary, payment status label, ticket summary, and settlement timeline without payment provider internals. |
| L3 | Invoice / Receipt Drawer | Show a safe receipt and download/export action without claiming production invoice evidence. |
| L3 | Refund Status Drawer | Explain refund requested/approved/processed states with provider-safe labels only. |
| L3 | Failed Payment Recovery | Explain payment failure and route to retry/update payment method. |
| L3 | Expired Reservation Recovery | Explain reservation expiry and route back to Explore/Market. |
| L2 | Alerts | Manage price, listing, entry-window, Fan Access, and order-status alert rules. |
| L3 | Alert Rule Editor | Edit trigger, event/ticket type, threshold, delivery channels, pause, and delete rule. |
| L2 | Notification Preferences | Configure push/email/in-app, quiet hours, language, city/currency, and saved-event notification rules. |
| L2 | Security | Manage password, two-step check, active sessions, trusted devices, and sign-out-all. |
| L3 | Reauthenticate | Confirm sensitive account changes with a secure reauth sheet. |
| L2 | Privacy | Manage data sharing, marketing preferences, data export request, and account deletion request. |
| L3 | Delete Account Confirmation | Confirm destructive deletion without exposing backend internals. |
| L2 | Role Access | Show Fan role, staff access request/status, organizer-lite Console handoff, and access summaries only. |
| L2 | Connected Apps | Show connected app/account status and revoke confirmations when scoped. |
| L2 | Support / Help | Route to help centre, contact support, report issue, legal links, and app version. |
| State | Guest Account | Prompt sign-in and keep Explore fallback visible. |
| State | Session Expired | Reauthenticate or cancel without losing public browsing state. |
| State | Account Loading Skeleton | Preserve stable profile and settings dimensions while account data loads. |
| State | Account Error / Retry | Explain account data could not load and offer retry/support. |
| State | Notification Permission Denied | Explain push permission recovery. |
| State | Empty Alerts | Invite user to create first alert. |
| State | Pause All Alerts | Confirm temporary notification pause. |
| State | Delete Alert Rule | Confirm destructive alert deletion. |

Current Account concept boards:

- Account v2 overview/profile hub/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-account-v2-overview-profile-hub-mobile.png`
- Account v2 profile details/ticket identity/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-account-v2-profile-ticket-identity-mobile.png`
- Account v2 orders/receipts/refunds/failures/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-account-v2-orders-receipts-refunds-failures-mobile.png`
- Account v2 alerts/preferences/rule editor/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-account-v2-alerts-preferences-rule-editor-mobile.png`
- Account v2 security/privacy/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-account-v2-security-privacy-mobile.png`
- Account v2 payment methods/role access/connected apps/support/mobile: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-account-v2-payments-role-connected-support-mobile.png`

Account v2 supersedes the earlier 2026-06-10 Account v1 boards. The v2 set uses a cleaner overview, consistent desktop global nav, consistent Account side subnav, consistent mobile five-tab nav, and fuller secondary/tertiary coverage for profile, identity, orders, alerts, security, privacy, payment methods, role access, connected apps, and support.

Account implementation guardrails:

- Use fictional users, orders, payment labels, alert rules, support records, and role states.
- Mask email, phone, account references, ticket identity, payment methods, order references, and role details wherever screenshot-prone.
- Use provider-safe labels only, such as card network plus last four. Do not show full card numbers, raw payment provider IDs, PaymentIntent/client secret fields, access tokens, wallet addresses, seed phrases, raw hashes, real personal data, or production data.
- Do not introduce QR/NFC, Apple Wallet, scanner/admin UI, chain-custody, TestFlight, physical-entry evidence, native evidence claims, or production credential claims inside Account concepts.
- Staff and organizer access in Account are permission/status handoffs only. Scanner UI belongs to FanPass Ops/staff scanner, and organizer management belongs to Console.
- Generated image text is placeholder only. Final UI copy must be typed, cleaned, and reviewed in code/docs.

## Gate Staff Flow

Staff scanner mode is separate and fast:

1. Staff signs in.
2. Staff opens Profile.
3. Staff sees `Staff Scanner` only if permission exists.
4. Staff selects assigned event and gate if not already scoped.
5. Scanner opens with large QR scan region and NFC option.
6. Staff scans QR or NFC.
7. App shows one of: Accepted, Duplicate, Expired, Invalid, Owner Mismatch, Not Active, Cancelled, Error.
8. App logs check-in result and returns to scan-ready state quickly.
9. Staff can view gate check-in count and connection status.

Scanner must prioritize:

- large touch targets;
- high contrast;
- clear result language;
- short recovery loop;
- no decorative brand clutter;
- no market, wallet, purchase, or Fan Access features.

## Organizer/Admin-Lite Flow

Organizer/admin-lite in native iOS should be minimal:

1. Organizer account logs in.
2. Profile shows organizer role badge.
3. Profile can link to Console, show assigned events, and show high-level status.
4. Inventory, staff management, resale rule editing, check-in summaries, Fan Access review, refunds, and audit logs remain Console-first.

Admin-lite mobile is not a replacement for Console. It exists only to confirm identity, view status, and hand off to the correct admin surface.

## Relationship Between Fan App And Scanner Mode

Current product relationship:

- FanPass is fan-first and uses five tabs.
- FanPass Ops is the dedicated scanner product.
- Staff-only scanner entry may be visible from Profile when staff permission exists, but it must not become a tab for normal users.
- The scanner must not be discoverable through Home, Explore, Market, or Tickets for normal fans.
- QR/NFC entry payload generation belongs to the fan ticket detail.
- QR/NFC payload redemption belongs to staff scanner mode.

Security boundary:

- Fans generate their own short-lived entry code.
- Staff redeems signed payloads through assigned gate permissions.
- API derives scanner identity from authenticated staff session.
- UI must never ask users to manually enter scanner identity.

## Navigation Map

```text
FanPass
  Home
    Next Ticket
    Featured Events
    Fan Access Summary
    Market Alerts
  Explore
    Event List
    Event Detail
    Ticket Type Detail
    Fan Access Event Detail
  Market
    Market Overview
    Event Market Detail
    Listing Detail
    List Ticket
    Buy Resale Ticket
  Tickets
    Ticket Wallet
    Ticket Detail
    Dynamic QR
    Proof & History
    Transfer / Resale Rules
  Profile
    Account
    Payment Methods
    Privacy & Security
    Staff Scanner Entry, permission only
    Organizer Console Link, role only

FanPass Ops / Staff Scanner
  Staff Login
  Event And Gate Selection
  QR Scanner
  NFC Scanner
  Scan Result
  Gate Summary
```

## Deferred Management Concept Boards

Management concept generation paused on 2026-06-10 when the owner confirmed Apple Developer account access and redirected priority to iOS TestFlight plus physical QR/NFC validation. Do not continue this concept pass until requested.

Draft references for later:

- FanPass Console Overview: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/deferred-console-overview.png`
- FanPass Console Event & Inventory: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/deferred-console-event-inventory.png`
- FanPass Console Resale Rules & Fan Access: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/deferred-console-resale-rules-fan-access.png`
- FanPass Console Orders & Risk: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/deferred-console-orders-risk.png`
- FanPass Console Staff & Gates: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/deferred-console-staff-gates.png`
- FanPass Console Platform Admin: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/deferred-console-platform-admin.png`
- FanPass Ops Staff Scanner: `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-ops-staff-scanner-secondary.png`

## Clean V4 IA Visual Notes

- Home and Tickets can use the V4 ticket card atmosphere.
- Explore and Market should be cleaner, flatter, and less decorative.
- Market charts must stay inside bounded panels and never overlap price values.
- NFC waves must be contained to scan indicators and Proof & History panels.
- No decorative line may cross content.
