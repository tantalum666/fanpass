# FanPass Mock Data Guide V4

Status: internal product prototype data reference
Date: 2026-06-05

## Purpose

The V4 mock data gives the iOS prototype stable, realistic states for product review, UI validation, and later test coverage. It uses fictional users, events, venues, ticket IDs, wallet fragments, and proof references only.

## Mock Users

| Scenario | User | Role | Purpose |
| --- | --- | --- | --- |
| Normal fan | `Demo Fan` | Fan | Empty or early browsing state. |
| Verified fan with Access Badge | `Verified Fan` | Fan | Fan Access and badge state. |
| Fan with purchased ticket | `Ticket Fan` | Fan | Default wallet, checkout, QR/NFC, Proof & History flow. |
| Fan with listed resale ticket | `Resale Fan` | Fan | Listed/sold resale state review. |
| Gate staff | `Gate Staff` | Gate staff | Staff scanner mode. |
| Organizer/admin-lite | `Organizer Admin` | Organizer | Admin-lite profile and future organizer review. |

All emails use `example.test`. Wallet references are masked demo fragments.

## Mock Events

| Event | Category | City | Product purpose |
| --- | --- | --- | --- |
| Aurora Nights World Tour | Concerts | Hong Kong | Primary purchase, active ticket, NFC-ready pass. |
| Neon Harbor Festival | Festivals | Singapore | Listed resale and sold resale state. |
| City Finals 2026 | Sports | London | Sold out, refund state, resale cap review. |
| Indie Pulse Live | Concerts | Berlin | Non-transferable ticket and Fan Access. |
| Global Sound Lab | Theatre | Tokyo | Redeemed and expired past tickets. |
| Midnight Stadium Show | Concerts | Los Angeles | QR-only active ticket and stadium scenario. |
| Future Beats Conference | Conference | Amsterdam | Transfer pending and conference category. |

Each event includes category, venue, city, date/time, hero gradient metadata, ticket types, face value, resale cap, transfer rule, Fan Access availability, market summary, and price history.

## Ticket States

The mock wallet includes:

- Valid upcoming ticket.
- Transferable ticket.
- Non-transferable ticket.
- Listed ticket.
- Sold/transferred ticket.
- Transfer-pending ticket.
- Refunded ticket.
- Cancelled ticket.
- Expired past ticket.
- Already redeemed ticket.
- NFC-ready ticket.
- QR-only ticket.

## Market Data

Market data is intentionally plain-language:

- Floor price.
- Face value.
- Premium percentage.
- Fans willing to buy.
- Tickets listed for resale.
- Recent verified sales.
- Price history.
- Volume.
- Spread.
- Suggested resale price.
- Organizer cap.

Orderbook rows should explain fan demand and available listings, not resemble a professional trading terminal.

## Safety Rules

- Do not replace mock data with real users, real artist names, production credentials, live Stripe data, QR payloads, or full wallet addresses.
- Keep proof references as safe fragments such as `proof...A91C`.
- Keep Web3 details hidden behind `Verified Ticket`, `Proof & History`, and `Ticket identity`.
