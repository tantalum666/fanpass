# FanPass User Scenarios V4

Status: internal prototype scenario map
Date: 2026-06-05

## Normal Fan

Purpose:

- Browse events.
- See empty or low-ownership states.
- Validate no forced crypto onboarding.

Expected UI:

- Explore and Event Detail are useful before purchase.
- Wallet can show empty states.
- Profile masks ticket identity.

## Verified Fan With Access Badge

Purpose:

- Validate Fan Access progress, completed tasks, and Access Badge state.

Expected UI:

- Fan Access shows approved and available tasks.
- Access Badge appears as non-transferable.
- Proof & History can contain the technical non-transferable credential note.

## Fan With Purchased Ticket

Purpose:

- Default demo flow for purchase, wallet, ticket detail, QR/NFC readiness, Proof & History.

Expected UI:

- Home shows next verified ticket.
- Wallet shows active, transfer-pending, refunded, cancelled, redeemed, and expired states.
- Ticket Detail shows Dynamic QR and the correct entry mode.

## Fan With Listed Resale Ticket

Purpose:

- Validate listed ticket, sold ticket, secure resale, listing cancellation, and payout estimate.

Expected UI:

- Listed ticket cannot be used for entry while the listing is open.
- Sold/transferred ticket stays in history.
- Market and List Ticket explain organizer cap.

## Gate Staff

Purpose:

- Validate staff-only scanner entry and QR/NFC result states.

Expected UI:

- Scanner is available from Profile only for staff demo.
- Staff can review valid, duplicate, invalid, wrong event, expired, unreadable, and unknown verification outcomes.

## Organizer/Admin-Lite

Purpose:

- Reserve a stable admin-lite user for future organizer review without building Console into the iOS consumer app.

Expected UI:

- Profile can show organizer role.
- No consumer ticket wallet ownership is implied.
- Future organizer screens should remain separate from normal fan purchase flows.

## Scenario Switching

Use Profile → Prototype Controls to switch:

- User role.
- Ticket state.
- Payment result.
- Scanner result.
- Network condition.
- Transferability condition.
- Resale cap condition.

The panel is demo-only and should not ship as a normal user feature.
