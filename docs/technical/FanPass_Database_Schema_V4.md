# FanPass Database Schema V4

Status: PostgreSQL schema planning document
Date: 2026-06-05

## Schema Principles

- PostgreSQL is source of truth.
- Use UUID primary keys.
- Use `timestamptz` for all timestamps.
- Use `jsonb` only for provider metadata, safe snapshots, and audit context.
- Store payment/provider IDs as references, not secrets.
- Never store raw QR private signing keys, raw auth tokens, or full private wallet credentials.

## Tables

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid primary key` | Internal user ID. |
| `email_hash` | `text unique` | Hash normalized email; avoid raw email where possible. |
| `display_name` | `text` | User-facing name. |
| `status` | `text` | `active`, `blocked`, `deleted`. |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

Indexes: `email_hash`, `status`.
Privacy: raw email should live in auth provider or encrypted profile table if required.

### `user_roles`

Columns: `user_id uuid`, `role text`, `organizer_id uuid null`, `created_at timestamptz`.
Primary key: `(user_id, role, organizer_id)`.
Foreign keys: `user_id -> users.id`, `organizer_id -> organizers.id`.
Indexes: `role`, `organizer_id`.
Privacy: role changes must write audit logs.

### `organizers`

Columns: `id uuid primary key`, `name text`, `region text`, `status text`, `stripe_account_id text null`, `created_at timestamptz`.
Indexes: `status`, `stripe_account_id`.
Privacy: connected account IDs are provider references, not secrets.

### `venues`

Columns: `id uuid primary key`, `organizer_id uuid`, `name text`, `city text`, `country text`, `timezone text`, `gates text[]`, `created_at timestamptz`.
Foreign keys: `organizer_id -> organizers.id`.
Indexes: `organizer_id`, `(city, country)`.
Privacy: public venue data.

### `events`

Columns: `id uuid primary key`, `organizer_id uuid`, `venue_id uuid`, `title text`, `category text`, `start_time timestamptz`, `status text`, `fan_access_enabled boolean`, `metadata jsonb`, `created_at timestamptz`.
Foreign keys: `organizer_id`, `venue_id`.
Indexes: `status`, `start_time`, `category`, `venue_id`.
Privacy: no real artist/copyright assets without rights.

### `ticket_types`

Columns: `id uuid primary key`, `event_id uuid`, `name text`, `face_value_cents integer`, `currency text`, `supply integer`, `available_quantity integer`, `status text`.
Foreign keys: `event_id -> events.id`.
Indexes: `event_id`, `status`.
Privacy: inventory details may be partially public only.

### `ticket_transfer_rules`

Columns: `id uuid primary key`, `ticket_type_id uuid unique`, `transferable boolean`, `resale_cap_cents integer null`, `max_transfer_count integer`, `listing_reserves_entry boolean`, `refund_policy text`.
Foreign keys: `ticket_type_id -> ticket_types.id`.
Indexes: `transferable`, `resale_cap_cents`.
Privacy: public policy data.

### `tickets`

Columns: `id uuid primary key`, `ticket_code text unique`, `event_id uuid`, `ticket_type_id uuid`, `owner_user_id uuid`, `status text`, `section text`, `row_label text`, `seat_label text`, `entry_mode text`, `transfer_count integer`, `issued_at timestamptz`.
Foreign keys: `event_id`, `ticket_type_id`, `owner_user_id`.
Indexes: `owner_user_id`, `event_id`, `status`, `(event_id, status)`.
Privacy: expose safe ticket fragments only.

### `orders`

Columns: `id uuid primary key`, `user_id uuid`, `event_id uuid`, `ticket_type_id uuid`, `status text`, `quantity integer`, `amount_cents integer`, `currency text`, `expires_at timestamptz`, `created_at timestamptz`.
Foreign keys: `user_id`, `event_id`, `ticket_type_id`.
Indexes: `user_id`, `status`, `expires_at`.
Privacy: do not expose internal order IDs in public screenshots.

### `payments`

Columns: `id uuid primary key`, `order_id uuid`, `provider text`, `provider_payment_intent_id text unique`, `status text`, `amount_cents integer`, `currency text`, `captured_at timestamptz null`, `metadata jsonb`.
Foreign keys: `order_id -> orders.id`.
Indexes: `provider_payment_intent_id`, `status`, `order_id`.
Privacy: provider IDs are sensitive operational references.

### `refunds`

Columns: `id uuid primary key`, `payment_id uuid`, `provider_refund_id text unique`, `status text`, `amount_cents integer`, `reason text`, `created_at timestamptz`.
Foreign keys: `payment_id -> payments.id`.
Indexes: `provider_refund_id`, `status`.
Privacy: refund reason must not include unnecessary personal data.

### `resale_listings`

Columns: `id uuid primary key`, `ticket_id uuid`, `seller_user_id uuid`, `event_id uuid`, `ticket_type_id uuid`, `price_cents integer`, `currency text`, `status text`, `created_at timestamptz`, `cancelled_at timestamptz null`.
Foreign keys: `ticket_id`, `seller_user_id`, `event_id`, `ticket_type_id`.
Indexes: `(event_id, ticket_type_id, status, price_cents)`, `seller_user_id`.
Constraint: one open listing per ticket with partial unique index.
Privacy: seller display should be anonymous.

### `trades`

Columns: `id uuid primary key`, `listing_id uuid`, `ticket_id uuid`, `buyer_user_id uuid`, `seller_user_id uuid`, `price_cents integer`, `fee_cents integer`, `status text`, `settled_at timestamptz null`.
Foreign keys: listing, ticket, buyer, seller.
Indexes: `ticket_id`, `buyer_user_id`, `seller_user_id`, `(status, settled_at)`.
Privacy: public trade data must be aggregated/anonymized.

### `fan_tasks`

Columns: `id uuid primary key`, `event_id uuid`, `title text`, `description text`, `points integer`, `verification_method text`, `status text`.
Foreign keys: `event_id -> events.id`.
Indexes: `event_id`, `status`.
Privacy: task requirements must not request unnecessary personal data.

### `fan_task_submissions`

Columns: `id uuid primary key`, `task_id uuid`, `user_id uuid`, `status text`, `proof_text text null`, `attachment_ref text null`, `reviewed_by uuid null`, `created_at timestamptz`, `reviewed_at timestamptz null`.
Foreign keys: `task_id`, `user_id`, `reviewed_by`.
Indexes: `(task_id, user_id)`, `status`.
Privacy: proof may contain user data; minimize and redact.

### `access_badges`

Columns: `id uuid primary key`, `user_id uuid`, `event_id uuid`, `title text`, `status text`, `issued_at timestamptz`, `expires_at timestamptz null`, `proof_ref text null`.
Foreign keys: `user_id`, `event_id`.
Indexes: `user_id`, `event_id`, `status`.
Privacy: public label only; proof fragment safe.

### `wallet_accounts`

Columns: `id uuid primary key`, `user_id uuid`, `provider text`, `wallet_address_hash text`, `address_fragment text`, `status text`, `linked_at timestamptz`.
Foreign keys: `user_id -> users.id`.
Indexes: `user_id`, `wallet_address_hash`.
Privacy: never expose full address by default.

### `blockchain_transactions`

Columns: `id uuid primary key`, `ticket_id uuid null`, `access_badge_id uuid null`, `chain_id integer`, `tx_hash text unique`, `status text`, `operation text`, `submitted_at timestamptz`, `confirmed_at timestamptz null`, `metadata jsonb`.
Foreign keys: `ticket_id`, `access_badge_id`.
Indexes: `tx_hash`, `status`, `operation`.
Privacy: metadata must not contain PII.

### `qr_credentials`

Columns: `id uuid primary key`, `ticket_id uuid`, `event_id uuid`, `nonce_hash text unique`, `expires_at timestamptz`, `used_at timestamptz null`, `device_id_hash text`, `created_at timestamptz`.
Foreign keys: `ticket_id`, `event_id`.
Indexes: `ticket_id`, `expires_at`, `used_at`.
Privacy: store nonce hash, not raw nonce.

### `nfc_credentials`

Columns: `id uuid primary key`, `ticket_id uuid`, `tag_uid_hash text`, `payload_hash text`, `status text`, `issued_at timestamptz`, `expires_at timestamptz null`.
Foreign keys: `ticket_id -> tickets.id`.
Indexes: `tag_uid_hash`, `ticket_id`, `status`.
Privacy: tag UID must be hashed.

### `check_ins`

Columns: `id uuid primary key`, `ticket_id uuid`, `event_id uuid`, `credential_id uuid null`, `credential_type text`, `gate text`, `staff_user_id uuid`, `result text`, `reason text`, `checked_at timestamptz`.
Foreign keys: `ticket_id`, `event_id`, `staff_user_id`.
Indexes: `(ticket_id, event_id, result)`, `staff_user_id`, `checked_at`.
Constraint: one accepted check-in per ticket/event.
Privacy: staff identity is operational; redact in user UI.

### `proof_history`

Columns: `id uuid primary key`, `ticket_id uuid null`, `access_badge_id uuid null`, `type text`, `title text`, `description text`, `actor_label text`, `proof_ref text`, `status text`, `created_at timestamptz`.
Foreign keys: `ticket_id`, `access_badge_id`.
Indexes: `ticket_id`, `access_badge_id`, `type`, `created_at`.
Privacy: display safe fragments only.

### `audit_logs`

Columns: `id uuid primary key`, `actor_user_id uuid null`, `actor_role text`, `action text`, `target_type text`, `target_id uuid`, `request_id text`, `ip_hash text null`, `before_summary jsonb null`, `after_summary jsonb null`, `created_at timestamptz`.
Foreign keys: `actor_user_id -> users.id`.
Indexes: `actor_user_id`, `(target_type, target_id)`, `action`, `created_at`.
Privacy: immutable operational log; redact personal data.

## Implemented On-Sale Tables - 2026-07-12

The active Prisma schema now includes:

### `onsales`

One row per event with status, waiting-room/open/close times, queue limits, admission batch size, checkout window, account and payment-method limits, public allocation breakdown, fairness version, last assigned position, and admitted-through position.

### `queue_entries`

One row per `(onsale_id, user_id)` and one row per `(onsale_id, client_instance_hash)`. It stores a private position, prequeue/live phase, HMAC fairness key, attempt, status, admission/expiry/completion times, and a non-public risk decision. Index `(onsale_id, status, position)` supports admission scans.

### `inventory_holds`

One hold per primary order and, after issuance, one converted hold per ticket. It stores ticket type, account, optional queue entry, quantity, source, status, expiry, authorization/conversion/release times, and a safe release reason. Active and authorized holds count against supply.

### `payments.payment_method_fingerprint_hash`

Stores only an HMAC of the Stripe card fingerprint. The raw Stripe fingerprint is never persisted or returned. Event-scoped advisory locking prevents simultaneous transactions from bypassing the configured linked-account limit.

Primary inventory must satisfy `sold + active holds + authorized holds <= supply`. Ticket-type row locking, not a cached available counter, decides the winner for the final ticket.
