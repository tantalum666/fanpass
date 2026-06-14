# FanPass Product Overview V4

Status: internal product handoff
Date: 2026-06-05
Visual source: Clean V4 only

## Product Vision

FanPass is a mainstream, mobile-native ticketing product that makes event access safer, fairer, and easier to verify. It uses blockchain-backed records, controlled resale, dynamic QR, NFC-ready verification, and fan rewards as infrastructure, not as the consumer-facing story.

The product should feel closer to Apple Wallet, DICE, Ticketmaster, SeatGeek, and fintech apps than a crypto exchange.

## Target Users

| User | Need |
| --- | --- |
| Fan / ticket buyer | Buy and hold a verified ticket without needing crypto knowledge. |
| Fan-to-fan seller | List an eligible ticket under organizer rules and understand payout expectations. |
| Gate staff | Verify tickets quickly and prevent duplicate or invalid entry. |
| Organizer/admin-lite | Configure events, ticket policies, Fan Access rules, and operational verification. |
| Platform admin | Monitor risk, payments, disputes, audit logs, and production health. |

## User Roles

- Guest: browse events and market summaries.
- Fan: buy tickets, hold wallet tickets, join Fan Access, list eligible tickets.
- Gate staff: access scanner mode for assigned events and gates.
- Organizer/admin-lite: manage future event and policy workflows.
- Platform admin: production-only operations, risk, audit, and support.

## Core Value Proposition

- For fans: verified tickets, clearer resale rules, and safer entry.
- For sellers: controlled resale with organizer-defined caps and transparent demand signals.
- For gate staff: fast QR/NFC-style validation with clear accepted/rejected states.
- For organizers: policy control after issuance and better auditability.
- For the platform: a trust layer that can support proof history, market integrity, and future Web3 settlement without making the UI crypto-first.

## Main Product Modules

| Module | Purpose |
| --- | --- |
| Onboarding and login | Explain verified access and establish a protected account. |
| Home | Show next ticket, featured events, Fan Access, and market highlights. |
| Explore | Browse fictional event catalog by category, city, date, and resale availability. |
| Event Detail | Explain event, tickets, face value, resale cap, transfer rules, and Fan Access. |
| Checkout | Simulate Apple Pay/card purchase and payment states. |
| Ticket Wallet | Show upcoming, listed, past, refunded, cancelled, and redeemed tickets. |
| Ticket Detail | Show digital ticket, dynamic QR placeholder, NFC-ready state, rules, and Proof & History. |
| Fan Access | Track tasks, points, rewards, and non-transferable Access Badge state. |
| Resale Market | Show floor price, face value, organizer cap, recent trades, and simple bid/ask demand. |
| Scanner | Staff-only verification for QR/NFC result states. |
| Profile | Account, role, verification, masked wallet reference, settings, and prototype controls. |

## Fan Journey

1. Open the app and see the Clean V4 brand.
2. Learn the value through onboarding.
3. Sign in with Apple or email in the prototype.
4. Browse events from Home or Explore.
5. Open Event Detail and review ticket type, resale rules, and market context.
6. Buy a primary ticket through simulated checkout.
7. View purchase success and open the ticket wallet.
8. Open Ticket Detail to see Dynamic QR, NFC Ready state, rules, and Proof & History.
9. Join Fan Access and complete tasks to earn an Access Badge.
10. List an eligible ticket for resale or buy a resale ticket from a transparent market.

## Organizer Journey

The current prototype only represents organizer/admin-lite as a role and future pathway. The planned organizer journey is:

1. Create organizer tenant.
2. Add venues and events.
3. Define ticket types, supply, face value, refund policy, transferability, and resale cap.
4. Configure Fan Access tasks and badge criteria.
5. Assign gate staff and scanner permissions.
6. Monitor orders, refunds, resale activity, check-ins, and audit logs.

## Gate Staff Journey

1. Staff account opens Profile and enters staff-only scanner mode.
2. Staff selects event and gate.
3. Staff chooses QR scan, NFC scan, or manual lookup.
4. App shows an operational state: accepted, already redeemed, wrong event, expired credential, invalid ticket, or unknown error.
5. Staff scans next ticket quickly.

## Business Logic Summary

- Tickets are issued from organizer-defined ticket types.
- Each ticket has one current owner, status, entry mode, and transfer count.
- Transfer and resale actions are allowed only when organizer rules and ticket lifecycle state permit them.
- Listed tickets may reserve entry eligibility while resale is open.
- Purchase success should issue a ticket only after payment is reconciled in production.
- Proof & History records safe lifecycle events such as issued, payment confirmed, listed, transferred, refunded, cancelled, and redeemed.
- Dynamic QR credentials must be short-lived, signed, and replay-protected.
- NFC credentials are scanner-side validation concepts and must not expose long-lived secrets.

## Current Prototype Scope

Included:

- Native SwiftUI V4 prototype.
- Clean V4 assets, tokens, and reusable components.
- Mock data for users, events, tickets, market/orderbook, scanner states, and proof history.
- Mock services and ViewModels for state transitions.
- Prototype controls for internal QA.
- Technical plans for backend, payments, blockchain, QR/NFC, and orderbook.

## Out-Of-Scope Items

- Real backend connectivity.
- Production authentication.
- Live Stripe mode or real Apple Pay charges.
- Real blockchain writes.
- Real Core NFC reads.
- Production Apple Wallet pass signing.
- Real organizer dashboard.
- Legal/compliance/KYC workflows.
- Real anti-bot, fraud, venue access control, or support operations.
