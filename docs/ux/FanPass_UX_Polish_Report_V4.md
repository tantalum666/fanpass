# FanPass UX Polish Report V4

Status: product prototype polish pass
Date: 2026-06-05
Scope: native iOS SwiftUI prototype only. No slides, speech scripts, or presentation content.

## Summary

This pass tightened the Clean V4 prototype around product usability, state clarity, and development readiness. The visual direction remains unchanged: FanPass is a premium iOS ticketing product with Web3 trust infrastructure hidden behind consumer-friendly language.

## Issues Fixed

| Area | Previous issue | Fix |
| --- | --- | --- |
| Ticket privacy | Wallet/home ticket cards visually implied an entry QR in list contexts. | Ticket cards now default to a ticket preview icon; QR appears only in ticket detail/entry context. |
| Ticket detail | Inactive lifecycle states were not explained strongly enough. | Added listed, redeemed, cancelled, refunded, expired, transferred, and transfer-pending state banners. |
| Checkout | Payment failure and expired reservation states were missing. | Added simulated payment failed and checkout expired states with recovery copy. |
| Fan Access | Task completion and badge earning were static. | Added mock task completion and Access Badge earned confirmation. |
| Event detail | Transfer/resale policy was too subtle. | Added Organizer rule notices, Secure Resale labels, and Non-transferable labels. |
| Market/listing | Listing cap validation was not interactive. | Added listing price adjustment, cap validation, non-transferable blocking, listing created, and listing cancelled states. |
| Scanner | Scanner lacked a no-event empty state and complete error matrix. | Added no scanner event state, QR unknown error, NFC unreadable, and NFC expired states. |
| Profile | Saved payment method empty/confirmation states were missing. | Added no saved payment method and payment method added mock states. |
| Reusable UI | Error/confirmation/policy UI was duplicated. | Added `FPStateBanner`, `FPConfirmationCard`, and `FPPolicyNotice`. |

## Main Flow Quality

1. Splash introduces the Clean V4 mark and tagline without crossing logo lines.
2. Onboarding explains Verified Tickets, Secure Resale, and fan rewards without crypto-first wording.
3. Login reassures users that ticket verification happens in the background.
4. Home routes to featured event, next ticket, Fan Access, and resale context.
5. Explore supports search and no-results recovery.
6. Event Detail explains ticket types, face value, resale cap, transferability, Fan Access, and market context.
7. Checkout handles success, failed payment, and expired reservation states.
8. Purchase Success confirms assignment and routes to Ticket Detail.
9. Tickets Wallet separates upcoming, listed, and past/closed states.
10. Ticket Detail explains Dynamic QR, NFC Ready, Proof & History, and blocked lifecycle states.
11. Market explains transparent resale without exchange-style language.
12. List Ticket validates cap and eligibility before confirming a mock listing.
13. Scanner is staff-only and handles QR/NFC outcomes with direct operational copy.
14. Profile contains account, ticket identity, payment, security, and staff scanner access.

## Mock-Only Areas

- Apple Pay and card payment authorization.
- Stripe PaymentSheet, customer, payment method, capture, refund, and reconciliation.
- Apple Wallet pass signing and add-to-wallet handoff.
- Dynamic QR payload generation, countdown, refresh, and background protection.
- Core NFC reading and redemption.
- Resale listing reservation, settlement, cancellation, and payout.
- Privy login/session sync.
- Proof & History persistence and chain-backed custody records.
- Network unavailable state handling.

## Backend Integration Later

| Feature | Needed integration |
| --- | --- |
| Checkout | Order reservation, idempotent payment authorization/capture, expired reservation handling. |
| Wallet | Authenticated ticket inventory, status refresh, cancellation/refund sync. |
| Dynamic QR | Short-lived signed credential endpoint with refresh and expiry. |
| Scanner | QR decode, NFC payload parse, redeem endpoint, duplicate protection, staff event assignment. |
| Resale | Eligibility check, cap validation, listing reservation, matching, settlement, payout. |
| Proof & History | Redacted ownership timeline from backend/chain records. |
| Profile | Privy identity, masked wallet reference, payment method management. |

## Product Readiness Notes

- Keep orderbook as a secondary detail screen; Market should lead with floor price, face value, organizer cap, and recent verified sales.
- Keep all Web3 terminology out of primary CTAs and onboarding.
- QR should remain absent from list cards and success screens.
- Any future real scanner work must be tested on signed device builds, not only simulator.
