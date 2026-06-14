# FanPass Screen List V4

Status: screen inventory before SwiftUI implementation.
Date: 2026-06-05
Visual source: Clean V4 only.

## Screen Inventory

### 1. Home

| Field | Detail |
| --- | --- |
| User role | Guest, Fan |
| Purpose | Provide next best action and personalized event/ticket summary. |
| Key content | Next ticket, featured events, Fan Access summary, market alerts, account state. |
| Primary CTA | `View Ticket` if active ticket exists, otherwise `Explore Events`. |
| Secondary actions | Join Fan Access, view market, sign in. |
| Main data shown | Upcoming event, ticket status, Fan Access score, recommended events. |
| Empty state | No tickets yet; show featured events and `Explore Events`. |
| Loading state | Skeleton cards with stable heights. |
| Error state | Inline retry for personalized data; keep Explore fallback visible. |
| Security/privacy notes | Do not show private ticket IDs or QR on Home. |
| Visual notes | Dark-first. Use V4 surfaces, restrained gradient, no decorative lines over content. |

### 2. Explore Event List

| Field | Detail |
| --- | --- |
| User role | Guest, Fan |
| Purpose | Browse published events. |
| Key content | Event cards, filters, city/date/category, availability, starting price. |
| Primary CTA | Open event detail. |
| Secondary actions | Filter, search, save event in future scope. |
| Main data shown | Event title, date, city, venue, status, ticket availability. |
| Empty state | No events for selected filters; offer reset filters. |
| Loading state | List skeleton. |
| Error state | Retry event fetch. |
| Security/privacy notes | Public event data only. |
| Visual notes | Clean cards, no copyrighted posters or real artist imagery. |

### 3. Event Detail

| Field | Detail |
| --- | --- |
| User role | Guest, Fan |
| Purpose | Explain event, ticket options, resale rules, Fan Access, and purchase path. |
| Key content | Event header, ticket types, Verified Ticket promise, Secure Resale rules, Fan Access module, Transparent Prices preview. |
| Primary CTA | `Buy Ticket` or `Join Fan Access`. |
| Secondary actions | View market, view rules, share event in future scope. |
| Main data shown | Ticket type, face value, availability, resale cap, transferability, venue, date/time. |
| Empty state | No ticket types available; show market if resale allowed. |
| Loading state | Header and ticket-type skeleton. |
| Error state | Retry detail load; preserve event list back navigation. |
| Security/privacy notes | Do not expose internal inventory or private organizer data. |
| Visual notes | Premium but readable. Charts must stay in contained market preview. |

### 4. Fan Access Event

| Field | Detail |
| --- | --- |
| User role | Fan |
| Purpose | Show event-specific access program, tasks, score, and eligibility. |
| Key content | Score, badge status, task list, review state, eligibility rule. |
| Primary CTA | `Complete Task`. |
| Secondary actions | View badge, view eligible ticket types. |
| Main data shown | Fan tasks, points, submission status, score, entitlement. |
| Empty state | No active tasks for event. |
| Loading state | Task skeleton rows. |
| Error state | Retry tasks; keep score cached if available. |
| Security/privacy notes | Explain what proof is shared with organizer. |
| Visual notes | Use contained badges. Do not use token-gating visuals. |

### 5. Fan Task Detail

| Field | Detail |
| --- | --- |
| User role | Fan |
| Purpose | Submit proof for one Fan Access task. |
| Key content | Task instructions, points, verification method, proof input, privacy note. |
| Primary CTA | `Submit Proof`. |
| Secondary actions | Cancel, view program rules. |
| Main data shown | Task title, proof requirements, status. |
| Empty state | Not applicable. |
| Loading state | Disable submit with progress. |
| Error state | Field validation, duplicate submission, network retry. |
| Security/privacy notes | Do not ask for unnecessary personal data. |
| Visual notes | Form-first, high contrast, no decorative background effects behind input. |

### 6. Checkout

| Field | Detail |
| --- | --- |
| User role | Fan |
| Purpose | Confirm ticket purchase and payment method. |
| Key content | Event summary, ticket type, price, fees, total, payment method, rules. |
| Primary CTA | `Pay with Apple Pay` or `Continue to Card`. |
| Secondary actions | Change ticket, view resale/refund rules. |
| Main data shown | Total, currency, payment state, ticket policy. |
| Empty state | No selected ticket; return to event detail. |
| Loading state | Payment sheet loading and authorization progress. |
| Error state | Payment failed, reservation expired, item unavailable. |
| Security/privacy notes | Do not show card details beyond provider-safe labels. No live payment claims without release evidence. |
| Visual notes | Calm fintech surface, minimal gradient, clear totals. |

### 7. Purchase Success

| Field | Detail |
| --- | --- |
| User role | Fan |
| Purpose | Confirm ownership and route to wallet. |
| Key content | Verified Ticket preview, event summary, payment state, next step. |
| Primary CTA | `View Ticket`. |
| Secondary actions | Explore Fan Access, back to event. |
| Main data shown | Ticket status, event title, ticket type, safe receipt summary. |
| Empty state | Not applicable. |
| Loading state | `Securing ticket` while ownership settles. |
| Error state | Payment authorized but ticket pending; show safe retry/status. |
| Security/privacy notes | Do not expose payment intent/client secret or full internal IDs. |
| Visual notes | Use V4 premium ticket feel, no QR on success screen. |

### 8. Ticket Wallet

| Field | Detail |
| --- | --- |
| User role | Fan |
| Purpose | Show owned tickets and lifecycle states. |
| Key content | Upcoming tickets, listed tickets, past/redeemed/refunded/cancelled tickets. |
| Primary CTA | Open ticket detail. |
| Secondary actions | Filter, view past tickets. |
| Main data shown | Event, date, ticket type, status, transferability. |
| Empty state | No tickets; link to Explore. |
| Loading state | Ticket card skeleton. |
| Error state | Retry wallet load; explain tickets are tied to account. |
| Security/privacy notes | Do not show full QR or sensitive proof data in list. |
| Visual notes | Use V4 ticket-card language with enough spacing. |

### 9. Ticket Detail

| Field | Detail |
| --- | --- |
| User role | Fan |
| Purpose | Manage one ticket and show entry readiness. |
| Key content | Ticket card, Verified Ticket, NFC Ready, seat metadata, status, resale/transfer rules. |
| Primary CTA | `Show Entry Code` for active tickets. |
| Secondary actions | Proof & History, List for Resale, View Rules, Support. |
| Main data shown | Ticket ID fragment, event, seat, status, transfer count, rules. |
| Empty state | Ticket missing; return to wallet. |
| Loading state | Stable card skeleton. |
| Error state | Ticket unavailable, not active, cancelled/refunded/redeemed. |
| Security/privacy notes | Only owner can generate QR. No full owner data. |
| Visual notes | Match V4 ticket card spacing. NFC graphics contained. |

### 10. Dynamic QR

| Field | Detail |
| --- | --- |
| User role | Fan |
| Purpose | Show short-lived entry QR for venue scan. |
| Key content | QR, countdown, event, ticket holder-safe info, refresh state. |
| Primary CTA | `Done` or `Refresh Code`. |
| Secondary actions | Brightness hint, help. |
| Main data shown | QR image, expiration countdown, ticket status. |
| Empty state | No active ticket; return to ticket detail. |
| Loading state | QR placeholder with spinner. |
| Error state | Expired, offline, not active, cancelled, redeemed. |
| Security/privacy notes | QR is short-lived. Hide full payload and nonce. |
| Visual notes | QR quiet zone must be clean. No waves, strokes, gradients, or logos intruding. |

### 11. Proof & History

| Field | Detail |
| --- | --- |
| User role | Fan, organizer support view in Console |
| Purpose | Explain ticket authenticity and ownership lifecycle. |
| Key content | Timeline of issue, purchase, transfer/listing, redemption, cancellation/refund. |
| Primary CTA | None or `Done`. |
| Secondary actions | Copy safe proof fragment, view policy. |
| Main data shown | Proof state, timestamp, safe ID fragments, status labels. |
| Empty state | No history yet; show issued state. |
| Loading state | Timeline skeleton. |
| Error state | Unable to load proof; ticket remains usable if active. |
| Security/privacy notes | Redact full wallet addresses, private user IDs, scanner identities. |
| Visual notes | Contained panel. NFC/proof icon may appear as a small indicator only. |

### 12. Market Overview

| Field | Detail |
| --- | --- |
| User role | Guest, Fan |
| Purpose | Show fair resale opportunities and price context. |
| Key content | Events with resale activity, transparent prices, organizer caps, available listings. |
| Primary CTA | Open event market detail. |
| Secondary actions | Filter, learn resale rules. |
| Main data shown | Floor price, recent sale, cap, volume, availability. |
| Empty state | No resale listings; show primary ticket discovery. |
| Loading state | Market row skeleton. |
| Error state | Retry market data. |
| Security/privacy notes | Public aggregated market data only. |
| Visual notes | Not a trading terminal. Bounded charts only. |

### 13. Event Market Detail

| Field | Detail |
| --- | --- |
| User role | Guest, Fan buyer, Fan seller |
| Purpose | Help users understand resale range and take buy/list action. |
| Key content | Floor price, organizer cap, recent sales, orderbook summary, listing list. |
| Primary CTA | `Buy Resale` or `List My Ticket`. |
| Secondary actions | View rules, refresh market. |
| Main data shown | Bids/asks summary, recent trades, cap, premium percent. |
| Empty state | No current listings or bids. |
| Loading state | Chart and listing skeleton. |
| Error state | Market unavailable; retry. |
| Security/privacy notes | Do not expose buyer/seller identity. |
| Visual notes | Chart lines stay inside plot area and never cross price values. |

### 14. List Ticket For Resale

| Field | Detail |
| --- | --- |
| User role | Fan seller |
| Purpose | Create a compliant resale listing. |
| Key content | Ticket summary, transferability, organizer cap, suggested price range, payout estimate. |
| Primary CTA | `List Ticket`. |
| Secondary actions | Cancel, view rules. |
| Main data shown | Ticket ID fragment, max resale price, fees, payout. |
| Empty state | No eligible ticket; explain why. |
| Loading state | Listing creation progress. |
| Error state | Non-transferable, already listed, redeemed, cancelled, cap exceeded. |
| Security/privacy notes | Require ownership and state check. No full internal IDs. |
| Visual notes | Form-first. Avoid exchange styling. |

### 15. Buy Resale Ticket

| Field | Detail |
| --- | --- |
| User role | Fan buyer |
| Purpose | Purchase a resale ticket under organizer rules. |
| Key content | Listing summary, resale rule, price, fees, transfer confirmation, checkout. |
| Primary CTA | `Buy Resale`. |
| Secondary actions | View Proof & History summary, back to market. |
| Main data shown | Price, cap, ticket type, settlement state. |
| Empty state | Listing unavailable; return to market. |
| Loading state | Reserving listing and payment authorization. |
| Error state | Listing sold, payment failed, transfer delayed. |
| Security/privacy notes | Do not expose seller identity. Use idempotent purchase status. |
| Visual notes | Premium checkout style, no speculative market language. |

### 16. Profile

| Field | Detail |
| --- | --- |
| User role | Guest, Fan, Staff, Organizer-lite |
| Purpose | Account, privacy, payment, role-specific entry points. |
| Key content | Identity state, wallet reference, payment methods, privacy, support, staff scanner entry if permitted. |
| Primary CTA | `Sign In` for guest, otherwise role-specific action. |
| Secondary actions | Manage payment, privacy, support, sign out. |
| Main data shown | Display name, role badge, masked email, masked wallet reference. |
| Empty state | Guest profile prompting sign-in. |
| Loading state | Account skeleton. |
| Error state | Session expired; reauthenticate. |
| Security/privacy notes | Mask email/wallet. Staff scanner appears only with permission. |
| Visual notes | Calm settings structure, no large decorative graphics. |

### 17. Staff Scanner Entry

| Field | Detail |
| --- | --- |
| User role | Gate staff |
| Purpose | Enter scanner mode from Profile permission gate. |
| Key content | Assigned events/gates, permission status, scanner readiness. |
| Primary CTA | `Open Scanner`. |
| Secondary actions | Switch gate, view connection. |
| Main data shown | Event, gate, assignment, last sync. |
| Empty state | No assigned gate; contact organizer. |
| Loading state | Assignment loading. |
| Error state | Permission missing, session expired, no gate assignment. |
| Security/privacy notes | API derives staff identity; do not ask for scanner user ID. |
| Visual notes | Operational, high contrast, no market/ticket browsing content. |

### 18. QR Scanner

| Field | Detail |
| --- | --- |
| User role | Gate staff |
| Purpose | Scan signed QR entry payloads. |
| Key content | Camera region, event/gate, ready state, last result, connection. |
| Primary CTA | Scan happens through camera. |
| Secondary actions | Paste fallback in simulator, switch to NFC, view summary. |
| Main data shown | Gate, connection, last result. |
| Empty state | Camera unavailable; show paste/fallback. |
| Loading state | Redeeming payload. |
| Error state | Invalid, expired, duplicate, not active, cancelled, owner mismatch. |
| Security/privacy notes | No fan personal data beyond safe ticket/result summary. |
| Visual notes | Large touch targets, result color plus text, minimal brand. |

### 19. NFC Scanner

| Field | Detail |
| --- | --- |
| User role | Gate staff |
| Purpose | Read supported NFC/NDEF ticket payloads into same verification flow. |
| Key content | NFC ready indicator, instructions, event/gate, fallback to QR. |
| Primary CTA | `Start NFC Scan`. |
| Secondary actions | Use QR instead, view supported tags. |
| Main data shown | NFC support state, last result. |
| Empty state | Device unsupported; QR fallback. |
| Loading state | NFC scanning session active. |
| Error state | Unsupported tag, invalid payload, session timeout. |
| Security/privacy notes | Do not imply unsupported card emulation. |
| Visual notes | Contained NFC wave only. No waves behind text. |

### 20. Scan Result

| Field | Detail |
| --- | --- |
| User role | Gate staff |
| Purpose | Show immediate accept/reject decision. |
| Key content | Result label, reason, ticket/event/gate safe summary, next scan action. |
| Primary CTA | `Scan Next`. |
| Secondary actions | View gate summary, report issue. |
| Main data shown | Result, timestamp, safe ticket fragment. |
| Empty state | Not applicable. |
| Loading state | Short redeeming state before result. |
| Error state | Network unavailable; retry or fallback procedure. |
| Security/privacy notes | Avoid exposing owner email, raw QR nonce, full scanner identity. |
| Visual notes | High contrast and unmistakable. Minimal decorative effects. |

### 21. Gate Summary

| Field | Detail |
| --- | --- |
| User role | Gate staff |
| Purpose | Show gate check-in counts and operational health. |
| Key content | Accepted/rejected count, last scan time, result breakdown, connection state. |
| Primary CTA | `Back to Scanner`. |
| Secondary actions | Refresh, switch gate if allowed. |
| Main data shown | Total, accepted, rejected, result counts. |
| Empty state | No scans yet. |
| Loading state | Metric skeleton. |
| Error state | Summary unavailable; scanner still usable if redeem path works. |
| Security/privacy notes | Aggregated data only. |
| Visual notes | Dense but readable metrics. No charts crossing numbers. |

### 22. Organizer/Admin-Lite Profile

| Field | Detail |
| --- | --- |
| User role | Organizer/admin-lite |
| Purpose | Confirm role and hand off to Console. |
| Key content | Role badge, assigned organization, Console link, support/admin status. |
| Primary CTA | `Open Console`. |
| Secondary actions | View assigned events, sign out. |
| Main data shown | Organization name, role, safe account details. |
| Empty state | No organization assigned. |
| Loading state | Role loading. |
| Error state | Permission unavailable. |
| Security/privacy notes | Do not expose management tools in fan tabs. |
| Visual notes | Calm profile surface, not a mobile admin dashboard. |

## First Implementation Group

The first implementation pass should focus on:

1. Home.
2. Explore Event List.
3. Event Detail.
4. Ticket Wallet.
5. Ticket Detail.
6. Dynamic QR.
7. Market Overview / Event Market Detail.
8. Staff QR Scanner.

These create the minimum coherent fan plus staff demo path without implementing every secondary state first.
