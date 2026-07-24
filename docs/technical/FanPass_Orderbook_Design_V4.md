# FanPass Orderbook Design V4

Status: controlled resale architecture plan
Date: 2026-06-05

## Product Principle

FanPass orderbook exists to make resale transparent and fair for normal fans. It should not look or behave like a speculative trading terminal.

## Off-Chain Orderbook Model

The authoritative orderbook and settlement state is off-chain in PostgreSQL. Current WebSocket admission, leases, revision replay, and fan-out are single-process in-memory state. Redis/Valkey is the required shared-state/fan-out design before horizontal API scaling; it is not implemented in the active path today.

Core entities:

- Resale listing.
- Buy interest/order.
- Trade.
- Ticket reservation.
- Market snapshot.

## Event/Ticket-Type Grouping

Orderbook partitions:

- `event_id`
- `ticket_type_id`
- optional seat/section grouping for reserved seating

Mobile UI should lead with:

- Lowest available resale.
- Face value.
- Organizer cap.
- Recent verified sales.
- Available listings.

Depth details stay secondary.

## Price-Time Priority Matching

Matching rules:

1. Validate listing or buy order eligibility.
2. Group by event/ticket type.
3. Sort best price first.
4. Break ties by created time.
5. Reserve ticket during checkout.
6. Finalize trade only after payment succeeds.

## Resale Cap Validation

Before listing:

- Load ticket type transfer rule.
- Compare price to organizer cap.
- Reject above-cap listings.
- Write audit log for failed and successful attempts.

Before purchase:

- Re-check cap and listing state.
- Ensure organizer policy version is still valid.

## Ticket Ownership Validation

Before listing:

- Seller owns ticket.
- Ticket status is active.
- Ticket is not already listed.
- Ticket is not redeemed, refunded, cancelled, expired, or transfer pending.

Before trade:

- Listing still maps to seller-owned ticket.
- Ticket is reserved during payment.

## Transferability Validation

- Non-transferable tickets cannot be listed.
- Tickets exceeding max transfer count cannot be listed.
- Listed tickets cannot generate entry QR if `listing_reserves_entry` is true.
- Redeemed tickets cannot transfer.

## Listing Lifecycle

| State | Meaning |
| --- | --- |
| `draft` | User preparing listing. |
| `open` | Visible and available. |
| `reserved` | Buyer checkout in progress. |
| `matched` | Payment success, transfer pending. |
| `settled` | Ownership transferred and seller payout state recorded. |
| `cancelled` | Seller or policy cancellation. |
| `expired` | Listing passed event/policy window. |

## Trade Lifecycle

| State | Meaning |
| --- | --- |
| `created` | Buyer started purchase. |
| `payment_pending` | Stripe PaymentIntent created. |
| `paid` | Payment succeeded. |
| `transfer_pending` | Ticket ownership update in progress. |
| `settled` | Buyer owns ticket. |
| `failed` | Payment/transfer failed safely. |
| `refunded` | Payment reversed according to policy. |

## WebSocket Updates

Channels:

- `market:event:{eventId}`
- `market:event:{eventId}:ticketType:{ticketTypeId}`
- `ticket:user:{userId}`
- `scanner:event:{eventId}` for ops-only monitoring later.

Events:

- Listing opened/cancelled/reserved/settled.
- Trade settled.
- Floor price changed.
- Recent sale added.
- Organizer cap changed.

Client should debounce updates and avoid flashing trading-board behavior.

## Market Chart Data

Use aggregated snapshots and redacted settled-sale history:

- Floor price over time.
- Recent verified sale median.
- Volume count.
- Organizer cap line.
- Up to 120 chronological settled-sale points containing only price and trade time. Do not return trade, order, ticket, seat, buyer, seller, user, or payment identifiers.

The consumer Market may bucket those verified points into restrained OHLC candles because the owner explicitly requested the K-line view on 2026-07-14. Never fabricate missing candles or present an empty market as active liquidity. Avoid speculative indicators, dense trading-terminal chrome, and high-frequency tick animation.

## Anti-Scalping Rules

- Organizer resale cap.
- Max transfer count.
- Listing window limits.
- Fan Access eligibility for specific ticket types.
- Velocity limits per user/device/payment method.
- Suspicious account monitoring.
- Manual organizer/admin review.

## Risk Monitoring

Signals:

- Multiple purchases across accounts with shared payment/device patterns.
- Rapid listing immediately after purchase.
- Repeated above-cap attempts.
- High cancellation/refund rates.
- Scanner duplicate attempts.
- Wallet/account linking anomalies.

Actions:

- Rate limit.
- Require review.
- Temporarily block listing.
- Notify organizer/admin.
- Write audit log.

## Backend Requirements

- Transactional reservation and settlement.
- Idempotent listing and trade actions.
- Webhook reconciliation before transfer completion.
- Immutable proof history for listing/trade lifecycle.
- Redacted public market data.

## Implemented Fulfillment And Race Rules - 2026-07-12

`Order.fulfillmentMode` makes buyer intent explicit:

| Mode | Allowed fulfillment |
| --- | --- |
| `ANY` | Backward-compatible primary or resale behavior. |
| `PRIMARY_ONLY` | Organizer inventory only; excluded from resale depth and matching. |
| `RESALE_ONLY` | Existing open SELL ask only; primary issuance is forbidden. |

All SELL orders are normalized to `RESALE_ONLY`. The iOS event checkout sends `PRIMARY_ONLY`, while Market's `Buy lowest resale` sends `RESALE_ONLY` using the current backend best ask.

For two buyers racing on one ticket, the database transaction conditionally claims three records: the buyer's open BUY order, the seller's open SELL order, and the seller-owned `LISTED_FOR_RESALE` ticket. If any update count is not exactly one, the transaction throws a claim-conflict error so PostgreSQL rolls back every partial update. The losing buyer remains unclaimed, is then rejected as unavailable, and gets an idempotent payment cancellation/refund compensation job.

Trade idempotency is keyed by the unique `buyOrderId`. Settlement never looks up a trade with `buyOrderId OR sellOrderId`, because that could return the winning buyer's trade to a different buyer during a race. Ownership finalization also checks that an existing trade has the exact expected buy order, sell order, and ticket.

Realtime update reasons now include `order_rejected`; clients refresh the same event/ticket-type snapshot after listing, cancellation, rejection, trade settlement, or primary issuance.

## Atomic Primary Inventory And Queue Holds - 2026-07-12

Primary inventory no longer relies on the catalog's displayed quantity. `PRIMARY_ONLY` order creation acquires the ticket-type row lock before inserting the order, checks the account's active/authorized/converted quantity, and creates an `inventory_holds` row in the same transaction. This lock order avoids the foreign-key deadlock created by inserting competing orders before locking their shared ticket type.

The hold owns inventory during checkout; the queue place alone does not. Ticket issuance converts the hold in the same database transaction as ticket creation. A delayed authorization cannot revive an expired queue hold. Payment rejection or failed settlement releases the hold and uses the existing idempotent payment compensation outbox.

Real PostgreSQL tests cover final-ticket contention, simultaneous account-limit requests, simultaneous same-card accounts, late authorization, and missing Stripe identity signals.
