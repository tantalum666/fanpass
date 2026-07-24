# FanPass Alpha Plan

Status: historical Alpha planning baseline. It is retained for product/domain rationale and is not the current release or deployment state. For the active security RC, immutable commit, verification results, and open external evidence, use `docs/CODEX_HANDOFF.md`.

## Alpha Objective

Alpha is the first realistic product build after the Technical Prototype. It should feel like a coherent ticketing infrastructure product, not a collection of demo screens.

The Alpha target is:

- a fan can browse events as a guest, sign in only when needed, hold a verified ticket, view entry status, submit fan access tasks, and place simple resale orders;
- a gate staff user can use `FanPass Ops` to select an event and gate, scan or paste an entry payload, and see clear accepted/rejected states;
- an organizer or admin can use `FanPass Console` to manage event inventory, inspect orderbook and redemption state, and review fan access submissions;
- the API owns persistent ticket, order, redemption, fan access, and audit state through a PostgreSQL-compatible data layer;
- the blockchain layer is represented through an ownership adapter so Alpha can run locally while still being ready for testnet calls.

## Product Principles

1. Fan-first by default. The consumer app opens to event discovery, not auth, trading, scanner, or admin tools.
2. Role separation is a security and UX requirement. Fan, gate staff, organizer, and admin flows live in the correct product surface.
3. Web3 is infrastructure, not consumer copy. Fans see tickets, verified entry, ownership history, transfer limits, and resale caps. They do not need to see NFT, SBT, gas, mint, or chain language in normal flows.
4. Market data should help fans make decisions without turning the product into a trading terminal.
5. Every important lifecycle change should be auditable.
6. Prototype demo data must continue to work while Alpha persistence is introduced.

## Non-Goals

Alpha does not include:

- production Stripe payments;
- Privy production wallet onboarding;
- App Store or TestFlight distribution;
- real venue hardware integration;
- unrestricted iPhone NFC card emulation;
- production queueing or anti-bot at major concert scale;
- legal/compliance approval for real secondary-market operation.

These remain Beta, pilot, or post-pilot work.

## Product Surfaces

### FanPass

Primary users: fans and attendees.

Alpha journeys:

- browse published events as a guest;
- open event detail with ticket types, availability, resale cap, and transfer policy;
- register or sign in when trying to buy, list, transfer, submit a task, or open private profile data;
- view owned tickets in wallet;
- generate a short-lived entry code for an active ticket;
- see ticket lifecycle state and simple ownership history;
- place a one-ticket buy or sell order;
- submit fan access tasks and see score/eligibility status.

Hard boundary:

- no scanner;
- no gate tools;
- no organizer controls;
- no admin review UI.

### FanPass Ops

Primary users: gate staff and onsite operators.

Alpha journeys:

- sign in or use seeded gate staff session;
- select event and gate;
- scan QR payload with camera or paste fallback in simulator;
- see accepted, duplicate, expired, invalid, owner mismatch, and already-cancelled states;
- see basic check-in count and connection status;
- keep the scanner optimized for large touch targets and quick recovery after each scan.

Hard boundary:

- no fan marketplace;
- no ticket purchasing;
- no organizer inventory management.

### FanPass Console

Primary users: organizers, admin reviewers, operations team.

Alpha journeys:

- create and publish demo events;
- create ticket types with supply, face value, transferability, and resale caps;
- issue seeded or mock tickets;
- view orderbook and recent trades;
- view ticket redemption/check-in state;
- review fan access submissions;
- inspect audit log events.

Hard boundary:

- not a mobile gate scanner replacement;
- not a consumer shopping experience.

## Domain States

### Ticket

Allowed Alpha states:

- `CREATED` - inventory exists but is not active for a fan;
- `ACTIVE` - ticket is owned and can generate entry payloads;
- `LISTED_FOR_RESALE` - ticket is reserved by an open sell order;
- `TRANSFER_PENDING` - transfer or matched trade is settling;
- `TRANSFERRED` - ticket has moved to a new owner and is active again;
- `REDEEMED` - ticket has been accepted at entry;
- `CANCELLED` - organizer/admin invalidated the ticket;
- `REFUNDED` - payment or event operation returned value to fan;
- `EXPIRED` - entry right is no longer valid after event policy.

Rules:

- only `ACTIVE` tickets can generate entry payloads;
- only transferable, unredeemed, uncancelled tickets can be listed;
- redeemed tickets cannot be transferred, listed, or redeemed again;
- listing a ticket should reserve it from simultaneous sale or transfer;
- every state change writes an audit log entry.

### Order

Allowed Alpha states:

- `OPEN` - resting in the orderbook;
- `MATCHED` - paired with a counterparty and settlement is running;
- `SETTLED` - ticket owner changed and trade is recorded;
- `CANCELLED` - user or admin cancelled before match;
- `REJECTED` - failed policy, ownership, or risk checks.

Rules:

- Alpha matching is one-ticket, price-time priority;
- buy orders match the lowest eligible sell at or below buy price;
- sell orders match the highest eligible buy at or above sell price;
- sell orders must reference an owned active ticket;
- matched sell tickets move through `TRANSFER_PENDING` before becoming active under the buyer;
- all matches create a `Trade` and audit log entry.

### Redemption

Allowed Alpha results:

- `ACCEPTED`;
- `DUPLICATE`;
- `EXPIRED`;
- `INVALID_SIGNATURE`;
- `INVALID_TICKET`;
- `OWNER_MISMATCH`;
- `NOT_ACTIVE`;
- `CANCELLED`;
- `ERROR`.

Rules:

- entry payloads are short-lived and signed by the backend;
- payload nonces are single-use;
- redeeming an accepted payload sets the ticket to `REDEEMED`;
- duplicate or rejected scans do not mutate ticket ownership;
- gate, scanner user, nonce, result, and time are persisted.

### Fan Access

Allowed submission states:

- `PENDING`;
- `APPROVED`;
- `REJECTED`.

Rules:

- fans can submit proof for configured tasks;
- admin/organizer review changes submission status;
- approved submissions contribute to the event score;
- score can create purchase eligibility, discount eligibility, or waitlist priority in later versions;
- Alpha only needs deterministic score calculation and clear review history.

## Roles And Permissions

Roles:

- `FAN`;
- `ORGANIZER`;
- `GATE_STAFF`;
- `ADMIN`.

Alpha can use seeded sessions or simple headers while auth remains lightweight. The API boundary still needs explicit role checks so the product does not grow around implicit trust.

Permission summary:

| Capability | FAN | ORGANIZER | GATE_STAFF | ADMIN |
| --- | --- | --- | --- | --- |
| Browse published events | Yes | Yes | Yes | Yes |
| Buy/list own tickets | Yes | No | No | Admin override only |
| Generate own entry payload | Yes | No | No | Admin support only |
| Redeem entry payloads | No | No | Yes | Yes |
| Manage event inventory | No | Yes | No | Yes |
| Review fan tasks | No | Yes | No | Yes |
| View audit/risk state | Own limited history | Own events | Gate scans only | Yes |

## API And Data Foundation

Alpha API should move from direct in-memory logic to service and repository boundaries:

- `EventsService`;
- `TicketsService`;
- `OrderbookService`;
- `VerificationService`;
- `FanAccessService`;
- `AuditService`;
- `OwnershipService`.

Repository strategy:

- keep the existing in-memory demo store available for Technical Prototype compatibility until Prisma paths are verified;
- introduce Prisma-backed repositories behind service methods;
- add deterministic seed/reset scripts for Alpha;
- keep endpoint responses stable for current iOS and Console clients wherever possible.

Ownership adapter strategy:

- `MockOwnershipAdapter` for local Alpha and fast tests;
- `TestnetOwnershipAdapter` for contract calls once the API state model is stable;
- API remains the source of personal data, payment intent state, risk decisions, and operational audit.

## Acceptance Gates

Alpha is complete only when all gates pass:

- `FanPass` opens to guest event discovery and has no staff/admin controls in default navigation;
- `FanPass Ops` is the only scanner product surface and can accept/reject real signed payloads;
- `FanPass Console` can create event inventory and inspect lifecycle state without manual database edits;
- seeded end-to-end flow covers event -> ticket -> order match -> wallet -> QR -> redemption -> duplicate rejection;
- orderbook matching is deterministic and covered by tests;
- ticket, order, redemption, and fan task state changes are persisted and auditable;
- workspace build/typecheck passes;
- contract tests pass after contract-related changes;
- iOS FanPass and FanPassOps build after Swift/project changes;
- docs and handoff are updated before the milestone is called done.

## Alpha Work Slices

### Alpha 0 - Data Foundation

- finalize domain states and schema deltas;
- add Prisma client/service wiring;
- add seed/reset flow for Alpha;
- add repository boundaries while keeping prototype endpoints alive;
- add tests for ticket/order/redemption state transitions.

### Alpha 1 - Console Operations

- rename and position dashboard UI as `FanPass Console`;
- add event/ticket-type management that writes persistent data;
- add ticket inventory table;
- add orderbook/trade and redemption views;
- add fan access review screen;
- add audit log view.

### Alpha 2 - Fan App Core

- apply VI v0.2 consistently;
- complete event detail and ticket wallet;
- add private-action auth gates;
- add one-ticket buy/list/cancel flows;
- add fan access task submission and score status;
- keep all staff/admin controls out of the C-side app.

### Alpha 3 - Ops Verification

- improve scanner reset speed and status clarity;
- persist check-in state;
- add manual payload fallback and failure reason display;
- add check-in count and gate context;
- keep NFC as a Beta prototype unless time remains after QR flow is solid.

### Alpha 4 - Testnet Adapter And Demo Packaging

- wire contract adapter behind ownership service;
- support local mock adapter and testnet adapter through config;
- keep local demo reproducible without testnet dependency;
- update runbook and capture demo screenshots.
