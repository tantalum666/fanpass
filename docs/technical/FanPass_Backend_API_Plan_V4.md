# FanPass Backend API Plan V4

Status: future API contract plan
Date: 2026-06-05

## API Conventions

- Base path: `/v1`.
- JSON over HTTPS only.
- Auth: bearer session token from auth/wallet provider.
- Staff/admin endpoints require role checks.
- Mutating endpoints require `Idempotency-Key`.
- Responses include `requestId`.
- Errors use `{ "error": { "code": "...", "message": "...", "recoverable": true } }`.
- Never return secrets, full QR payloads, private provider IDs, or raw wallet internals unless the endpoint explicitly requires a short-lived credential.

## Endpoint Matrix

| Domain | Method | Path | Purpose | Request | Response | Auth | Error cases |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Auth | `POST` | `/auth/session` | Exchange provider auth result for FanPass session. | `{provider, providerUserId, idToken}` | `{user, roles, accessToken, expiresAt}` | Public with provider proof | `invalid_provider_token`, `user_blocked` |
| Auth | `POST` | `/auth/logout` | Revoke current session. | `{}` | `{ok}` | User | `invalid_session` |
| Users | `GET` | `/users/me` | Current user profile. | None | `{user, wallet, roles}` | User | `not_authenticated` |
| Users | `PATCH` | `/users/me` | Update display preferences. | `{displayName?, locale?}` | `{user}` | User | `validation_error` |
| Organizers | `POST` | `/organizers` | Create organizer tenant. | `{name, region, contactEmail}` | `{organizer}` | Admin | `duplicate`, `validation_error` |
| Organizers | `GET` | `/organizers/{organizerId}` | Organizer profile. | None | `{organizer}` | Organizer/Admin | `not_found`, `forbidden` |
| Venues | `POST` | `/organizers/{organizerId}/venues` | Create venue. | `{name, city, country, timezone, gates[]}` | `{venue}` | Organizer | `validation_error` |
| Venues | `GET` | `/venues/{venueId}` | Public venue details. | None | `{venue}` | Public | `not_found` |
| Events | `GET` | `/events` | Browse events. | Query: `city, category, dateFrom, dateTo` | `{events[]}` | Public | `invalid_filter` |
| Events | `POST` | `/organizers/{organizerId}/events` | Create event. | `{title, venueId, startTime, category, status}` | `{event}` | Organizer | `validation_error` |
| Events | `GET` | `/events/{eventId}` | Event detail. | None | `{event, ticketTypes, marketSummary}` | Public | `not_found` |
| Ticket types | `POST` | `/events/{eventId}/ticket-types` | Create inventory tier. | `{name, faceValue, currency, supply, transferRule}` | `{ticketType}` | Organizer | `cap_invalid`, `validation_error` |
| Ticket types | `GET` | `/events/{eventId}/ticket-types` | List ticket types. | None | `{ticketTypes[]}` | Public | `not_found` |
| Tickets | `GET` | `/tickets` | User wallet tickets. | Query: `status?` | `{tickets[]}` | User | `not_authenticated` |
| Tickets | `GET` | `/tickets/{ticketId}` | Ticket detail. | None | `{ticket, proofHistory}` | Owner/Staff/Admin | `not_found`, `forbidden` |
| Tickets | `POST` | `/tickets/{ticketId}/transfer` | Start transfer to another fan. | `{recipientUserId}` | `{ticket, transferState}` | Owner | `not_transferable`, `already_redeemed`, `cap_reached` |
| Orders | `POST` | `/orders` | Create primary ticket reservation. | `{eventId, ticketTypeId, quantity}` | `{order, expiresAt}` | User | `sold_out`, `not_eligible`, `event_closed` |
| Orders | `GET` | `/orders/{orderId}` | Order status. | None | `{order, payment, tickets[]}` | Owner | `not_found`, `forbidden` |
| Payments | `POST` | `/orders/{orderId}/payment-intent` | Create Stripe PaymentIntent params. | `{paymentMethodPreference?}` | `{paymentIntentClientSecret, customerId?, ephemeralKey?, publishableKey}` | Owner | `order_expired`, `amount_changed` |
| Payments | `POST` | `/payments/webhooks/stripe` | Stripe webhook receiver. | Stripe signed payload | `{received}` | Stripe signature | `signature_invalid`, `event_unhandled` |
| Payments | `POST` | `/orders/{orderId}/refund` | Request/refund order. | `{reason}` | `{refund}` | Organizer/Admin | `not_refundable`, `payment_not_captured` |
| Wallet linking | `POST` | `/wallet/link` | Link embedded wallet/provider. | `{provider, walletAddress, proof}` | `{walletAccount}` | User | `wallet_already_linked`, `proof_invalid` |
| Wallet linking | `GET` | `/wallet/me` | Get masked wallet reference. | None | `{walletAccount}` | User | `not_linked` |
| Blockchain sync | `POST` | `/blockchain/jobs/tickets/{ticketId}` | Enqueue ticket sync. | `{reason}` | `{jobId}` | Service/Admin | `ticket_not_found` |
| Blockchain sync | `GET` | `/blockchain/transactions/{txId}` | Sync transaction status. | None | `{transaction}` | Owner/Admin | `not_found` |
| QR credentials | `POST` | `/tickets/{ticketId}/qr-credential` | Generate short-lived QR credential. | `{deviceId}` | `{credentialId, payload, expiresAt}` | Owner | `not_active`, `rate_limited`, `offline_unavailable` |
| NFC credentials | `POST` | `/verification/nfc/validate` | Validate and redeem NFC NDEF payload through the signed entry path. | `{eventId, gate, ndefPayload}` | `{checkInResult}` | Staff | `invalid_payload`, `expired`, `wrong_event`, `duplicate`, `not_active` |
| Check-in | `POST` | `/check-ins` | Redeem QR/NFC credential. | `{eventId, gate, credentialType, credentialId, payload}` | `{checkInResult}` | Staff | `duplicate`, `expired`, `invalid`, `wrong_event`, `cancelled` |
| Check-in | `GET` | `/events/{eventId}/check-ins` | Staff/admin check-in log. | Query: `gate?, since?` | `{checkIns[]}` | Staff/Admin | `forbidden` |
| Fan access | `GET` | `/events/{eventId}/fan-tasks` | List event tasks. | None | `{tasks[]}` | User | `not_found` |
| Fan access | `POST` | `/fan-tasks/{taskId}/submissions` | Submit task proof. | `{proofText?, attachmentRef?}` | `{submission}` | User | `duplicate_submission`, `validation_error` |
| Fan access | `POST` | `/fan-task-submissions/{submissionId}/review` | Approve/reject proof. | `{decision, reason?}` | `{submission, badge?}` | Organizer | `already_reviewed` |
| Access badges | `GET` | `/users/me/access-badges` | User badges. | None | `{badges[]}` | User | `not_authenticated` |
| Access badges | `GET` | `/access-badges/{badgeId}` | Badge detail. | None | `{badge, proofHistory}` | Owner/Organizer | `forbidden` |
| Resale listings | `POST` | `/resale/listings` | Create resale listing. | `{ticketId, price}` | `{listing}` | Owner | `not_transferable`, `above_cap`, `already_listed`, `not_active` |
| Resale listings | `GET` | `/events/{eventId}/resale/listings` | Event listings. | Query: `ticketTypeId?` | `{listings[]}` | Public | `not_found` |
| Resale listings | `POST` | `/resale/listings/{listingId}/cancel` | Cancel listing. | `{}` | `{listing}` | Seller | `already_matched`, `forbidden` |
| Trades | `POST` | `/resale/listings/{listingId}/buy` | Buy resale listing. | `{paymentMethodPreference?}` | `{order, payment}` | User | `listing_unavailable`, `cap_invalid`, `payment_failed` |
| Trades | `GET` | `/events/{eventId}/trades` | Recent verified sales. | Query: `ticketTypeId?` | `{trades[]}` | Public | `not_found` |
| Proof history | `GET` | `/tickets/{ticketId}/proof-history` | Ticket lifecycle timeline. | None | `{items[]}` | Owner/Staff/Admin | `forbidden`, `not_found` |
| Admin audit logs | `GET` | `/admin/audit-logs` | Search audit events. | Query: `actorId?, targetId?, action?, since?` | `{auditLogs[]}` | Admin | `forbidden` |

## Endpoint Notes

- `paymentIntentClientSecret` must be short-lived and returned only to the order owner.
- QR credential payloads must be short-lived and never logged.
- Check-in must be idempotent by credential nonce and ticket/event pair.
- Resale listing creation must reserve ticket entry eligibility according to organizer policy.
- Blockchain sync endpoints should be admin/service-only until public proof views are hardened.
