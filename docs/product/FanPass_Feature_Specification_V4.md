# FanPass Feature Specification V4

Status: internal feature specification
Date: 2026-06-05

## Feature Matrix

| Feature | Purpose | Role | Entry point | Main UI states | Main actions | Data dependencies | Error states | Future backend requirements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Onboarding | Explain verified tickets, secure resale, and fan rewards. | Guest | App launch after splash | Slide 1-3, final CTA | Continue, Get Started | Static copy, Clean V4 assets | None in prototype | Remote config later for copy experiments. |
| Login | Establish protected ticket account. | Guest, fan, staff | Onboarding, protected action | Apple placeholder, email placeholder, trust note | Sign in, continue as demo staff | `MockAuthService`, demo users | Network unavailable, provider failure later | Auth provider session exchange, token storage, role sync. |
| Home | Provide daily fan overview. | Fan | Home tab | Featured event, next ticket, Fan Access, market preview | Open event, view ticket, open market | Events, tickets, access badge, market summary | No next ticket, no market data | Home API, wallet summary, personalized recommendations. |
| Explore | Browse event catalog. | Guest, fan | Explore tab | Search, category chips, event cards, filters | Search, filter, open event | Events, venues, ticket types | Empty results, network unavailable | Events API with filters, pagination, cache. |
| Event Detail | Explain event purchase and rules. | Guest, fan | Event card | Hero, ticket types, resale cap, transfer rule, market overview | Buy Ticket, Join Fan Access, view market | Event, ticket types, transfer rule, market summary, fan tasks | Sold out, not eligible, cancelled | Event detail API, reservation eligibility, Fan Access status. |
| Fan Access | Track tasks and rewards. | Fan | Home, Event Detail | Progress, tasks, reward cards, Access Badge | Complete task, earn badge | Fan tasks, badge, user | No tasks, submission failed | Task submissions, organizer review, badge issuance. |
| Checkout | Simulate ticket purchase. | Fan | Event Detail Buy Ticket | Idle, authorizing, paid, failed, expired | Pay with Apple Pay, Pay with card, reset checkout | Event, ticket type, payment result control | Payment failed, checkout expired, network unavailable | Orders, PaymentIntent, PaymentSheet params, webhook reconciliation. |
| Ticket Wallet | Show owned ticket inventory. | Fan | Tickets tab | Upcoming, past, listed, refunded/cancelled | Open ticket, inspect status | Tickets, user | No upcoming, no past, no listed | Wallet API, local cache, lifecycle filters. |
| Ticket Detail | Show entry-ready ticket and actions. | Fan | Ticket card | Active, listed, redeemed, refunded, cancelled, expired | Show QR, add to Wallet, transfer, resell, view rules | Ticket, proof history, transfer rule | QR expired, listed, not active, proof unavailable | Ticket detail API, QR credential API, Apple Wallet pass API. |
| Proof & History | Explain safe ownership and lifecycle records. | Fan, staff, organizer | Ticket Detail, Access Badge | Timeline rows, empty history | Expand/collapse, inspect safe proof fragment | Proof history items | No proof history, load failure | Proof history API, chain sync references, audit redaction. |
| Resale Market | Show transparent resale context. | Guest, fan | Market tab, Event Detail | Floor price, face value, premium, chart, trades | Buy Resale Ticket, List My Ticket, open orderbook | Market summary, orderbook, trades, price history | No market data, listing unavailable | Market snapshot API, websocket updates, listing/trade APIs. |
| Orderbook | Make fan demand understandable. | Guest, fan | Market detail | Buy interest, resale listings, recent trades | Review depth, return to market | Bid orders, ask orders, trades | Empty bids/asks | Orderbook REST snapshot, realtime updates, validation. |
| List Ticket | Create controlled resale listing. | Fan seller | Ticket Detail, Market | Ticket selector, suggested price, cap warning, payout | Submit listing, adjust price, cancel | Owned tickets, resale cap, platform fee | Non-transferable, above cap, already listed | Listing API, cap enforcement, ticket reservation, seller payout plan. |
| Scanner Home | Staff-only entry verification. | Gate staff | Profile staff mode | Event selector, Scan QR, Scan NFC, Manual lookup | Select event, scan | Staff role, event assignment | No scanner event selected, network unavailable | Staff RBAC, event assignment, check-in API. |
| QR Verification | Validate dynamic QR credential. | Gate staff | Scanner Home | Valid, already redeemed, invalid, wrong event, expired | Scan next, manual lookup | QR payload, check-in result | Duplicate, expired, invalid, wrong event, cancelled/refunded | Signed QR payloads, Redis nonce, atomic redemption. |
| NFC Verification | Validate NFC credential concept. | Gate staff | Scanner Home | Ready, scanning, valid, invalid, already redeemed | Scan NFC, use QR fallback | NFC scan state, check-in result | Tag unreadable, expired, invalid, duplicate | Core NFC NDEF read, validation endpoint, physical-device QA. |
| Profile | Show account and settings. | Fan, staff, organizer | Profile tab | Account, role, verified status, masked wallet, settings | Toggle staff demo, open controls | User, role, wallet reference | No saved payment method | User profile API, payment methods, security settings. |
| Prototype Controls | Internal state switching for review. | Internal/demo only | Profile | Role, ticket, payment, scanner, network, transfer, cap | Apply prototype state | `PrototypeControlState` | None in production | Debug-only feature flags or test harness. Remove from production UI. |

## Implementation Notes

- Views should not contain backend or payment business logic.
- ViewModels should own loading, action state, success state, and mapped error copy.
- Mock services are the replacement boundary for real repositories and API clients.
- Primary consumer wording should follow `docs/ux/FanPass_Microcopy_Guide_V4.md`.
- All screens must follow Clean V4 guardrails: no decorative line crossing content, QR quiet zone preserved, market labels readable, NFC waves contained, and glass effects subtle.
