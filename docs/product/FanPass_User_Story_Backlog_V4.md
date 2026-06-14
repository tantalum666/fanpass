# FanPass User Story Backlog V4

Status: internal backlog seed
Date: 2026-06-05

## Fan

- As a fan, I want to browse events before signing in, so that I can decide whether FanPass has events I care about.
- As a fan, I want to sign in without crypto knowledge, so that I can protect my tickets with a familiar account flow.
- As a fan, I want to see whether a ticket is verified, so that I know it is safe to buy or enter with.
- As a fan, I want to understand face value and resale cap before purchase, so that I know the rules upfront.
- As a fan, I want to pay with Apple Pay or card, so that checkout feels mainstream and fast.
- As a fan, I want a clear purchase success state, so that I know the ticket was assigned to me.
- As a fan, I want to keep upcoming and past tickets in one wallet, so that I can find the right pass quickly.
- As a fan, I want my ticket QR to refresh dynamically, so that stolen screenshots are less useful.
- As a fan, I want to see NFC Ready when available, so that I understand entry options.
- As a fan, I want to view Proof & History, so that I can see safe ownership and lifecycle records.
- As a fan, I want refunded or cancelled tickets to stay visible as history, so that I understand what happened.
- As a fan, I want Fan Access tasks and badges, so that real fan engagement can unlock benefits.

## Seller

- As a seller, I want to know whether my ticket is transferable, so that I do not attempt an invalid listing.
- As a seller, I want to see the organizer resale cap, so that I list within allowed rules.
- As a seller, I want to see suggested resale price and estimated payout, so that I can price fairly.
- As a seller, I want listed tickets to show a clear status, so that I know they are reserved for resale.
- As a seller, I want to cancel an open listing, so that I can keep my ticket if plans change.
- As a seller, I want sold tickets to update ownership history, so that the transfer is transparent.

## Gate Staff

- As gate staff, I want scanner mode to be staff-only, so that normal fans do not see operational tools.
- As gate staff, I want to select my assigned event and gate, so that check-ins are recorded correctly.
- As gate staff, I want QR scan results to be short and clear, so that I can keep the line moving.
- As gate staff, I want already redeemed tickets to be rejected, so that duplicate entry is prevented.
- As gate staff, I want wrong-event tickets to be identified, so that fans can open the correct pass.
- As gate staff, I want NFC scan fallback to QR, so that unreadable tags do not block operations.
- As gate staff, I want manual lookup as a fallback, so that edge cases can be escalated safely.

## Organizer/Admin-Lite

- As an organizer, I want to create events and ticket types, so that tickets can be issued with clear rules.
- As an organizer, I want to set transferability and resale caps, so that resale stays fair.
- As an organizer, I want to configure Fan Access tasks, so that engaged fans can be recognized.
- As an organizer, I want to assign gate staff, so that scanner access is role-controlled.
- As an organizer, I want to cancel or refund tickets under policy, so that operational exceptions are auditable.
- As an organizer, I want to review check-in logs, so that entry operations can be reconciled after the event.
- As an organizer, I want to view market activity, so that resale behavior can be monitored.

## Platform Admin

- As a platform admin, I want role-based access control, so that sensitive tools are restricted.
- As a platform admin, I want audit logs for payments, tickets, scanner actions, and policy changes, so that incidents can be investigated.
- As a platform admin, I want payment webhook reconciliation, so that tickets are not issued from client-only success.
- As a platform admin, I want QR replay protection, so that copied credentials cannot be reused.
- As a platform admin, I want dependency and security reviews, so that closed beta risk is explicit.
- As a platform admin, I want environment separation, so that staging and production data cannot mix.

## Future Production System

- As the production system, I want idempotency keys on mutating API calls, so that retries do not create duplicate orders or tickets.
- As the production system, I want PostgreSQL to be the source of truth, so that ticket state is consistent.
- As the production system, I want Redis nonce locks for QR credentials, so that replay attempts are blocked quickly.
- As the production system, I want payment webhooks to drive issuance, so that ticket ownership follows confirmed payment.
- As the production system, I want blockchain proof sync to be asynchronous, so that ticket wallet UX does not fail when chain sync is delayed.
- As the production system, I want wallet addresses masked and hashed where possible, so that user privacy is protected.
- As the production system, I want Core NFC behavior tested on signed physical devices, so that venue workflows are realistic.
