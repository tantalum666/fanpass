# FanPass UI State Checklist V4

Status: implementation checklist for the SwiftUI prototype
Date: 2026-06-05

## Global Rules

- Use Clean V4 tokens and assets only.
- Do not redesign the logo or app icon.
- Do not place decorative lines across text, QR, charts, logos, buttons, ticket cards, or tab bars.
- Keep NFC waves contained in icons or low-risk indicators.
- Pair every status color with text and icon.
- Keep Web3 concepts behind `Verified Ticket`, `Proof & History`, `Ticket identity`, and `Secure Resale`.

## Empty States

| State | Current handling | Later integration |
| --- | --- | --- |
| No upcoming tickets | Home and Wallet empty cards. | Ticket inventory API. |
| No past tickets | Wallet section empty card. | Ticket lifecycle history API. |
| No resale listings | Market should show `No resale listings` when listings array is empty. | Resale listing API. |
| No completed fan tasks | Fan Access uses task empty and completion state patterns. | Fan task API and proof review. |
| No market data | Market recent trades empty state. | Aggregated resale data API. |
| No scanner event selected | Scanner empty state with event selection recovery. | Staff assignment API. |
| No proof history yet | Ticket Detail Proof & History empty state. | Proof history API. |
| No saved payment method | Profile payment empty state. | Stripe customer payment method API. |

## Error States

| State | UI treatment |
| --- | --- |
| Payment failed | Red `FPStateBanner` with retry/reset. |
| Checkout expired | Amber `FPStateBanner` explaining reservation timeout. |
| QR expired | QR result state asks fan to refresh ticket. |
| QR already redeemed | QR result state blocks entry and explains duplicate. |
| Wrong event | QR result state explains ticket belongs elsewhere. |
| Invalid ticket | QR result state rejects the code. |
| Ticket not transferable | List Ticket blocks submission and shows organizer rule. |
| Listing price above resale cap | List Ticket red cap validation. |
| NFC tag unreadable | NFC result asks staff to retry or use QR. |
| NFC credential expired | NFC result asks fan to refresh ticket. |
| Network unavailable | Documented but not yet wired to real service layer. |
| Unknown verification error | QR result state routes to manual lookup/retry. |

## Confirmation States

| State | Current handling |
| --- | --- |
| Purchase success | `FPConfirmationCard` on Purchase Success. |
| Listing created | List Ticket confirmation card. |
| Listing cancelled | List Ticket success banner. |
| Ticket transferred | Not yet interactive; should reuse `FPConfirmationCard`. |
| Ticket redeemed | Represented through redeemed ticket state and scanner accepted result. |
| Fan Access task completed | Fan Access success banner. |
| Access Badge earned | Fan Access confirmation card. |
| Payment method added | Profile success banner. |

## Screen Checklist

| Screen | Required states to verify before UI handoff |
| --- | --- |
| Splash | Logo clear, tagline readable, no crossing decoration. |
| Onboarding | Three slides, clear CTA, no crypto-heavy copy. |
| Login | Apple/email choices, trust note, no exposed tokens. |
| Home | Next ticket, no-ticket fallback, Fan Access, resale highlight. |
| Explore | Search, no-results fallback, category and filter chips. |
| Event Detail | Transferability, resale cap, face value, Fan Access, checkout path. |
| Fan Access | Progress, task list, empty tasks, task completed, Access Badge earned. |
| Checkout | Price breakdown, rules, success, failed payment, expired checkout. |
| Purchase Success | Verified ticket confirmation, wallet placeholder, no QR. |
| Tickets Wallet | Upcoming, listed, past, empty sections. |
| Ticket Detail | QR quiet zone, NFC indicator, inactive ticket banners, Proof & History. |
| Market | Floor price, face value, premium, recent trades, no market data. |
| Orderbook | Plain-language bids/sells, recent trades, non-trader explanation. |
| List Ticket | Cap validation, non-transferable block, created/cancelled states. |
| Scanner | Staff label, event selected/empty, QR/NFC routes. |
| QR Result | Valid, redeemed, invalid, wrong event, expired, unknown. |
| NFC Result | Ready, scanning, valid, invalid, redeemed, unreadable, expired. |
| Profile | Masked identity, no payment method, payment added, staff mode gate. |
