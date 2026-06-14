# FanPass Interaction Principles V4

Status: interaction rules before SwiftUI implementation.
Date: 2026-06-05
Visual source: Clean V4 only.

## iOS-Native Interaction Principles

- Use native navigation patterns: tab bar, navigation stack, sheets, alerts, confirmation dialogs, and context menus where appropriate.
- Keep primary actions fixed and predictable on purchase, ticket, and scanner flows.
- Use large touch targets, with 44 pt as the practical minimum.
- Prefer system haptics for purchase success, scan accepted, scan rejected, and destructive confirmations.
- Keep loading states stable; skeletons should not shift layout.
- Respect Dynamic Type where feasible, especially for ticket metadata, prices, buttons, and scanner decisions.
- Use Apple system typography and SF Symbols-compatible icon behavior.
- Do not create custom gestures where a standard tap, sheet, or swipe action is clearer.

## Dark Mode-First Interaction Rules

- Dark mode is the default consumer mode.
- Use `Night` background with `Surface` and `Elevated Surface`.
- Keep interactions readable before adding brand atmosphere.
- Use the V4 gradient only for high-value primary actions, selected premium ticket edges, or brand identity moments.
- Avoid overusing glassmorphism. Glass surfaces must have enough opacity for text contrast.
- Do not place decorative lines, glow strokes, or NFC waves behind interactive content.

## Ticket Card Behavior

Ticket cards are the emotional center of FanPass.

Card states:

| State | Behavior |
| --- | --- |
| Active | Show `Verified Ticket`, entry readiness, event metadata, and primary `Show Entry Code`. |
| NFC Ready | Show contained `NFC Ready` pill or icon. No background wave behind text. |
| Listed | Show listing state and disable entry QR if ticket is reserved by policy. |
| Transfer pending | Show processing state and disable duplicate actions. |
| Transferred | Move to history/past context for seller; active in buyer wallet. |
| Redeemed | Show accepted entry time and disable QR/listing/transfer. |
| Cancelled | Show reason and disable QR/listing/transfer. |
| Refunded | Show refund state and disable QR/listing/transfer. |
| Expired | Show expired state and disable entry actions. |

Rules:

- Ticket card padding must never collapse below 20 pt on iPhone.
- Ticket ID and metadata must stay inside the card.
- QR code must live in its own quiet zone.
- Proof & History must be a contained panel.
- Status pills must use text plus color, not color alone.

## Dynamic QR Refresh Behavior

Purpose:

- Give fans a short-lived entry code that staff can verify quickly.

Behavior:

1. User taps `Show Entry Code`.
2. App requests a signed QR payload.
3. QR appears only after payload is ready.
4. A countdown shows refresh timing.
5. App refreshes before expiry.
6. If refresh fails, keep the last QR only until expiry and show retry.
7. If ticket becomes inactive, remove QR and show reason.
8. If app backgrounds, hide or blur QR where practical.

Copy:

- `QR refreshes every 30s`.
- `Refreshing entry code`.
- `Code expired. Refresh to continue.`
- `Ticket is no longer active.`

Security:

- Never expose raw nonce, signature, owner hash, or full payload.
- Do not allow screenshots to reveal secrets in saved evidence.

## NFC Scanner Feedback

Purpose:

- Support staff reading a compatible NFC/NDEF payload and redeeming it through the same verification path as QR.

Behavior:

1. Staff taps `Start NFC Scan`.
2. App shows contained NFC ready indicator.
3. App starts NFC session.
4. On tag read, app validates payload shape.
5. App redeems through scanner endpoint.
6. App shows accepted/rejected result.
7. App ends session and returns to scan-ready state.

Feedback:

- Ready: cyan contained indicator.
- Reading: brief progress state.
- Accepted: green state plus strong success label.
- Rejected: red or amber state plus reason.
- Unsupported: explain and offer QR fallback.

Rules:

- Do not use NFC waves as page decoration.
- Do not imply unsupported iPhone card emulation.
- Scanner must recover quickly after every scan.

## Market Data Explanation

FanPass market data is for transparent resale, not speculation.

Use these labels:

- `Transparent Prices`.
- `Lowest available resale`.
- `Organizer cap`.
- `Recent verified sales`.
- `Resale range`.
- `Available listings`.

Avoid:

- Candles.
- Pump/moon language.
- Exchange-style buy/sell pressure language.
- Red/green trading board aesthetics.

Orderbook explanation:

- A fan should understand it as available resale prices and recent verified sales.
- Show the lowest listing and organizer cap before depth.
- If showing bids/asks, explain in plain language:
  - `Fans willing to buy`.
  - `Tickets listed for resale`.

Chart rules:

- Charts stay inside bounded containers.
- Chart lines do not cross price values, labels, buttons, or tabs.
- Use no more than three active chart colors on mobile.
- Put the numeric price outside the plotted line area.

## Resale Rule Explanation

Rules should be visible before purchase and before listing.

Explain:

- Whether the ticket is transferable.
- Maximum resale price.
- Maximum transfer count.
- Whether resale is allowed after entry window opens.
- Whether listing reserves the ticket from QR entry.
- Refund/cancel limitations.

Plain-language examples:

- `Organizer cap: resale cannot exceed HK$1,500.`
- `This ticket cannot be transferred.`
- `Listed tickets cannot be used for entry while the listing is open.`
- `Redeemed tickets cannot be listed or transferred.`

## Error Prevention

Prevent invalid actions before showing errors:

- Disable `Buy Ticket` when sold out, cancelled, or eligibility is missing.
- Disable `List for Resale` when ticket is non-transferable, redeemed, cancelled, refunded, expired, or already listed.
- Disable `Show Entry Code` when ticket is not active.
- Prevent duplicate purchase taps with idempotent processing state.
- Confirm destructive actions like cancel listing or sign out.
- Keep payment retry separate from duplicate order creation.

Error style:

- Use specific reason.
- Provide recovery action.
- Do not expose internal API details.
- Preserve user's place in flow.

## Confirmation Patterns

Use confirmation for:

- Listing a ticket for resale.
- Cancelling a listing.
- Buying resale ticket.
- Submitting Fan Access proof.
- Signing out.
- Starting staff scanner mode from Profile.

Do not over-confirm:

- Opening event detail.
- Viewing market.
- Viewing Proof & History.
- Refreshing QR.

Confirmation content:

- What will happen.
- What cannot be undone, if any.
- Policy impact.
- Safe next step.

## Privacy-First UX

Privacy defaults:

- Mask email in shared or screenshot-prone contexts.
- Mask wallet references and call them `Ticket identity` or `Wallet reference`.
- Show ticket ID fragments, not full IDs.
- Never show QR nonce, signature, owner hash, access token, payment client secret, webhook data, staff personal identity, or raw provider IDs.
- In staff scanner, show result and safe ticket fragment only.
- In market, keep buyers and sellers anonymous.

Evidence and demo safety:

- Demo screens must not use real personal data.
- Do not use real artist names, real event posters, real venues, or copyrighted imagery.
- Any future screenshots must be reviewed for tokens, emails, QR payloads, and private identifiers.

## Web3-Hidden UX Language

Consumer-facing preferred terms:

| Use | Avoid |
| --- | --- |
| Verified Ticket | NFT |
| Proof & History | On-chain transaction |
| Ownership History | Blockchain ledger |
| Secure Resale | Token marketplace |
| Fan Access | Token-gated drop |
| Ticket identity | Wallet seed phrase |
| Entry Code | QR nonce |
| Transfer Limit | Smart contract restriction |

When technical detail is needed:

- Keep it one layer deeper in Proof & History.
- Use short explanation and safe proof fragments.
- Do not place technical chain details in purchase CTAs, ticket cards, or onboarding headlines.

## Motion And Feedback

Motion should be functional:

- Button press: quick scale/opacity.
- Purchase success: short confirmation.
- QR refresh: subtle progress.
- NFC ready: contained pulse only.
- Scan accepted/rejected: strong state transition.
- Market updates: gentle number update, no flashing.

Respect Reduce Motion:

- Replace pulses with static state.
- Avoid continuous background animation.
- Keep scanner state readable without animation.

## Demo Route Recommendation

Use this 10-15 minute route for product review:

1. Start on Home and show V4 brand atmosphere.
2. Open Explore and browse demo-safe events.
3. Open Event Detail and explain Verified Ticket, Secure Resale, Fan Access, and Transparent Prices.
4. Join Fan Access and complete one task.
5. Buy a primary ticket through checkout simulation.
6. Show Purchase Success.
7. Open Tickets and view the verified ticket card.
8. Open Dynamic QR and explain refresh/quiet zone.
9. Open Proof & History and explain hidden trust layer.
10. Open Market and show transparent resale without trading-app language.
11. List a transferable ticket or show blocked non-transferable handling.
12. Switch to staff scanner mode.
13. Scan QR, show Accepted.
14. Scan same QR again, show Duplicate/Already used.
15. Show NFC concept and fallback constraints.

## Implementation Watchlist

- Do not let V4 gradients become page decoration.
- Keep ticket card text inside boundaries at Dynamic Type sizes.
- Keep QR quiet zone clear.
- Keep Market understandable to non-traders.
- Keep scanner separate from fan tabs.
- Keep payment language aligned with current test-mode/staging evidence.
- Keep Web3 proof language secondary.
- Keep real personal data and real event imagery out of demos.
