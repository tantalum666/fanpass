# FanPass User Flows V4

Status: UX flow specification before screen implementation.
Date: 2026-06-05
Visual source: Clean V4 only.

## Flow Principles

- Let guests browse before login.
- Ask for login only when the action needs identity, ownership, payment, proof, or staff permission.
- Keep Web3 infrastructure hidden behind `Verified Ticket`, `Proof & History`, `Secure Resale`, and `Ownership History`.
- Make resale understandable for non-traders.
- Keep scanner flows operational and separate from fan browsing.
- Prevent invalid ticket actions before users reach a destructive or blocked state.

## New User Onboarding And Login

1. User opens FanPass.
2. App shows Clean V4 identity briefly or lands directly on Home/Explore.
3. User can continue as guest.
4. App explains only essential value: verified tickets, fair resale, easy entry.
5. User taps a protected action: buy, list, wallet, Fan Access submission, profile payment, staff scanner.
6. App opens login sheet.
7. User chooses email OTP / Privy-backed login.
8. App shows short security reassurance: `Secure sign-in protects your tickets.`
9. User completes OTP.
10. App returns to the original action.
11. If wallet reference exists, show `Ticket identity ready` without crypto-heavy copy.

Empty state:

- `No account yet. Continue browsing events or sign in when you are ready to buy.`

Error state:

- OTP expired: allow resend.
- Network unavailable: allow retry.
- Session sync failed: explain that tickets are safe and retry is available.

## Browse Event

1. User opens Explore.
2. App lists published events with city, date, availability, and starting price.
3. User filters by city, date, category, or availability.
4. User taps an event.
5. App opens Event Detail.

Visual rules:

- Event cards are clean surfaces.
- No real artist names or copyrighted posters in demo data.
- Use generated or abstract venue/event imagery only when assets are safe.

## View Event Detail

1. User sees event title, date, venue, start time, and status.
2. User sees ticket types with face value, supply/availability, transferability, and resale cap.
3. User sees `Verified Ticket`, `Secure Resale`, and `Fan Access` modules.
4. User can view Transparent Prices for resale context.
5. User selects a ticket type.
6. App shows primary CTA: `Buy Ticket` or `Join Fan Access` if eligibility is required.

Blocked states:

- Sold out: show resale market CTA if allowed.
- Fan Access required: show task path.
- Non-transferable: explain before purchase.

## Join Fan Access Program

1. User opens event detail or Home Fan Access card.
2. App shows available tasks, points, eligibility status, and reward or access rule.
3. User taps `Join Fan Access`.
4. If not logged in, app prompts login.
5. App creates or loads fan score state.
6. User sees task list.

Copy:

- Use `Fan Access`, `Access Badge`, `Eligible`, `In Review`.
- Avoid token-gated or NFT wording.

## Complete Fan Task

1. User opens Fan Access task.
2. App shows task description, points, verification method, and privacy note.
3. User submits proof text or allowed attachment reference.
4. App validates required fields.
5. User confirms submission.
6. App shows `In Review`.
7. When approved, score updates and badge appears.

Privacy:

- Show what proof is visible to organizers.
- Avoid displaying raw private data in shared screens.

## Buy Primary Ticket

1. User opens Event Detail.
2. User selects ticket type.
3. App shows price, fee estimate, transferability, resale cap, and refund/cancellation policy.
4. User taps `Buy Ticket`.
5. If not logged in, app prompts login and returns.
6. App checks availability and Fan Access eligibility.
7. App creates order or reservation.
8. App opens checkout.

Prevention:

- Disable buy if sold out, not eligible, event cancelled, or ticket type unavailable.
- Explain transfer limits before checkout.

## Checkout With Apple Pay / Card

1. Checkout shows item summary, price, fees, total, and payment method.
2. User chooses Apple Pay or card.
3. App uses Apple Pay / Stripe PaymentSheet simulation in current Beta foundation.
4. User authorizes payment.
5. Payment enters authorized state.
6. Backend captures or settles according to order flow.
7. App shows processing state until ticket ownership is confirmed.

Rules:

- Do not expose Stripe internals to consumers.
- Do not use live payment language unless environment evidence supports it.
- Use `Payment authorized`, `Securing ticket`, and `Ticket confirmed`.

## Purchase Success

1. App shows success state with V4 premium ticket preview.
2. User sees `Verified Ticket`.
3. User sees event summary and ticket type.
4. Primary CTA: `View Ticket`.
5. Secondary CTA: `Add reminder` or `Explore Fan Access`.
6. App confirms receipt/payment state without showing secrets or full IDs.

## View Ticket In Wallet

1. User opens Tickets tab.
2. App lists owned tickets by event date and status.
3. Active ticket shows `Verified Ticket` and `NFC Ready` if available.
4. User taps ticket.
5. Ticket Detail opens with event, seat, ticket status, resale rule, and Proof & History.

States:

- Active.
- Listed for resale.
- Transfer pending.
- Transferred.
- Redeemed.
- Cancelled.
- Refunded.
- Expired.

## Show Dynamic QR For Entry

1. User opens active ticket detail.
2. User taps `Show Entry Code`.
3. App requests short-lived QR payload.
4. App shows QR code in a quiet zone with countdown.
5. QR refreshes automatically before expiry.
6. App offers fallback refresh if network fails.
7. App hides or blurs QR when app backgrounds if needed.

Rules:

- QR code must never have decorative graphics behind it.
- QR refresh status must be clear and calm.
- Use `QR refreshes every 30s` style copy.

## Gate Staff QR Scan

1. Staff opens scanner mode from FanPass Ops or Profile permission entry.
2. Staff selects assigned event and gate.
3. Staff opens QR scanner.
4. Staff points camera at fan QR.
5. App decodes signed payload.
6. App sends redeem request with gate.
7. App shows result.

Result states:

- Accepted: green, clear success, optional haptic.
- Duplicate: warning/danger, already used.
- Expired: ask fan to refresh QR.
- Invalid signature: reject.
- Invalid ticket: reject.
- Owner mismatch: reject.
- Not active: reject.
- Cancelled/refunded: reject with reason.

Recovery:

- Scanner returns to ready state quickly.
- Staff can tap `Scan next`.

## Gate Staff NFC Scan

1. Staff opens scanner mode.
2. Staff chooses NFC scan if device supports it.
3. App shows contained NFC ready indicator.
4. Staff taps/reads supported NDEF tag.
5. App parses payload into same verification path as QR.
6. App shows accepted/rejected result.
7. Unsupported device or tag shows fallback to QR.

Rules:

- NFC is a scanner concept, not a page decoration.
- Use contained wave icon only.
- Do not imply iPhone card emulation unless supported evidence exists.

## List Transferable Ticket For Resale

1. User opens active ticket detail.
2. App checks transferable, unredeemed, uncancelled, not refunded, not already listed.
3. User taps `List for Resale`.
4. App explains organizer cap and current market context.
5. User chooses price within allowed cap.
6. App shows fee and estimated payout.
7. User confirms.
8. Ticket status changes to `Listed`.
9. Ticket cannot generate entry QR while reserved for sale unless policy says otherwise.

Blocked:

- Non-transferable ticket: explain rule.
- Already redeemed: cannot list.
- Event cancelled/refunded: cannot list.
- Transfer pending: wait.

## View Market Price Data

1. User opens Market tab or event detail market module.
2. App shows `Transparent Prices`.
3. User sees floor price, organizer cap, recent sales, available listings, and simple bid/ask depth.
4. User can choose `Buy Resale` or `List My Ticket`.

Non-trader explanation:

- `Lowest available resale`.
- `Organizer cap`.
- `Recent verified sales`.
- `Demand range`.

Rules:

- Keep orderbook summary readable.
- Do not use exchange-style candlesticks as primary mobile UI.
- Charts stay inside chart area.

## Buy Resale Ticket

1. User opens Market.
2. User chooses event and ticket type.
3. App shows available listing and policy.
4. User taps `Buy Resale`.
5. App prompts login if needed.
6. App shows total, fees, resale rule, and transfer confirmation.
7. User completes payment.
8. Ownership transfer enters processing.
9. App shows success when ticket appears in wallet.

Failure:

- Listing sold: refresh market.
- Ownership transfer delayed: show processing and do not duplicate purchase.
- Payment authorization failed: retry payment.

## Transfer Ticket Ownership

1. Transfer starts from resale settlement or allowed direct transfer in future scope.
2. App shows pending state.
3. Ticket is locked from listing, QR generation, or duplicate transfer while pending.
4. Backend finalizes ownership.
5. Seller sees transferred history.
6. Buyer sees active verified ticket.
7. Proof & History records transfer.

UX rule:

- Explain `Securing transfer` instead of blockchain transaction terms.

## View Proof & History

1. User opens ticket detail.
2. User taps `Proof & History`.
3. App shows timeline:
   - issued by organizer;
   - purchased;
   - listed if applicable;
   - transferred if applicable;
   - QR generated events as private or summarized;
   - redeemed;
   - cancelled/refunded if applicable.
4. App shows proof status and policy notes.
5. Technical IDs are truncated and copyable only where safe.

Copy:

- `Verified issue`.
- `Ownership updated`.
- `Secure resale completed`.
- `Entry accepted`.

## Non-Transferable Ticket Handling

1. User sees `Non-transferable` on ticket type and ticket detail.
2. `List for Resale` is disabled or hidden.
3. User taps info.
4. App explains organizer-defined rule.
5. App may offer refund policy or support path if applicable.

Rule:

- Explain early, before checkout.

## Refunded Or Cancelled Ticket Handling

1. Ticket appears in Tickets with muted/danger status.
2. Ticket detail explains reason and effective time.
3. QR generation is disabled.
4. Resale/listing/transfer actions are disabled.
5. Payment/refund status is shown with safe, non-sensitive receipt details.
6. Proof & History records state change.

Copy:

- `Ticket cancelled`.
- `Refund processing`.
- `Refunded`.

## Already Redeemed Ticket Handling

1. Ticket appears as `Redeemed`.
2. Ticket detail shows accepted gate/time where allowed.
3. QR generation is disabled.
4. Resale/listing/transfer actions are disabled.
5. Proof & History shows `Entry accepted`.
6. If staff scans again, scanner shows `Already used`.

Privacy:

- Do not expose staff personal data or full scanner identity in consumer UI.
