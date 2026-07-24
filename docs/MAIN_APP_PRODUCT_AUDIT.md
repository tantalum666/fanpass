# FanPass Main App Product Audit

Product/runtime evidence last reviewed: 2026-07-25 (Asia/Shanghai).
Security RC status updated: 2026-07-25.

## Purpose

This is the living release audit for the consumer iOS app. It reviews the product as a real global ticketing service, not as a local prototype or a collection of individually working screens. Home, Explore, and Event Detail now form a staged V5 slice; unmigrated screens remain V4.

The audit uses four evidence layers:

1. the currently installed `fun.fanpass.app` runtime on `FanPass-iPhone-17`;
2. its embedded Staging configuration and the public Staging API;
3. the active staged V5/V4 Swift and API source;
4. existing release, security, payment, ticket, and infrastructure contracts.

The current simulator evidence uses the `Beta` configuration pointed at `https://fanpass-api-staging.onrender.com`, with Debug-only concrete mocks excluded. It is useful runtime evidence, but it is not TestFlight, physical-device, production-capacity, or real-user launch proof.

## Overall Verdict

The product has credible ticketing, controlled resale, payment, ownership, and entry foundations. Gate A's catalog, timestamp, market-fact, conditional Fan Access, and runtime-injection blockers are fixed and verified against deployed Staging. The first V5 Gate B slice now makes Home search/city/account behavior truthful, adds real event/category/city discovery, and moves Event Detail ticket choice and auth-gated purchase into the initial viewport.

The app is still not ready for external users. Gate B continues on Market and Account while Gate C must protect the full path:

- concept-only interactions must either become real or leave the release surface;
- Home, Explore, Event Detail, Market, and Account must form one honest discovery-to-purchase journey;
- automated iOS lifecycle tests, TestFlight, physical-device evidence, non-sleeping capacity, accessibility, localization, and recovery evidence must protect the core path.

## 2026-07-17 Gate A Closeout

This section preserves the exact Gate A deployment and test facts observed on 2026-07-17; it is not the current RC test total.

- API deploy `dep-d9ckdqsvikkc73d29km0` is live from commit `8f845a1`. `/health` returned 200; `/events` returned 11 records and every status was `PUBLISHED`; a previously exposed DRAFT id returned 404 while `evt_aurora` returned 200.
- The schema deploy is fail-closed: it refuses duplicate `(user_id, task_id)` pairs instead of using `--accept-data-loss`. Public catalog, Fan Access campaigns, and tasks are upserted atomically before the build can pass; application startup no longer mutates catalog data or swallows seed failures.
- The API has 22 passing suites and 132 passing tests, with 6 opt-in PostgreSQL concurrency tests skipped by default. The production dependency audit reports 0 vulnerabilities.
- The deployed runtime security check passed API/Console security headers, disabled demo sessions, unauthenticated admin/Console rejection, and allowed/disallowed WebSocket Origin behavior. The privileged outbox-health check was not repeated because no admin bearer was supplied.
- A `Beta` simulator build launched from the deployed HTTPS API with no localhost fallback. Runtime evidence showed `OCT 12` and `NOV 15`, `No asks`, `No verified sales`, and conditional Fan Access; Skyline Jazz rendered without Fan Access.
- At that Gate A run, `FanPassTests` had four mapper tests but the simulator host exited before execution. A later current-source Debug run superseded the zero-execution observation with 6/6 mapper/crypto-settlement tests. Coverage remains narrow: session, payment, ticket, resale, QR, redemption, recovery, and physical-device paths are still external-Beta blockers.

## 2026-07-23 Security RC Addendum

- Branch `codex/security-rc-20260720` is frozen and pushed at immutable commit `a25185d2747520303eac0fd2681017b5c35ac62b`; it has not been PR'd, merged, or deployed.
- The authoritative local gate passed 97/97, including API 32 suites/386 tests, contracts 30/30, and independent final review with 0 remaining P0/P1.
- Hosted attestation remains open because the current credential receives 403 from Actions/Checks/Status reads. Current-RC Staging, Stripe/Privy/Sepolia, TestFlight, and physical-device evidence remains open.

## 2026-07-25 V5 Gate B Slice

- The owner approved continuing V5 as a staged migration. New semantic tokens and shared components are isolated from V4 so Market, Tickets, Account, Checkout, Fan Access, and Ops do not inherit an unreviewed global recolor.
- Home removed fake notification, favorite, concept-search, and inferred-location behavior. Its search opens the real Explore field, city choices derive from the loaded public catalog, Account opens the actual account tab, and saved-catalog recovery remains explicit.
- Explore now preserves Home search/city intent, searches only the fields it names, filters by real event category and catalog city, labels the result set as `Events` rather than `Recommended`, and collapses campaign-backed Fan Access to one contextual shortcut.
- Event Detail removes the repeated page title/hero and first-viewport market metrics, puts ticket categories and auth-gated checkout immediately after event context, hides the tab bar during the focused journey, and keeps resale context secondary.
- Same-state V4/V5 screenshots were compared at 368x800 for all three screens. Beta simulator builds passed, current Debug tests passed 6/6, and both iOS role/distribution boundary audits passed. This is local/runtime evidence only: it does not replace Hosted exact-HEAD, TestFlight, physical-device, accessibility, or deployed guest-to-checkout evidence.

## Release Severity

### P0 - Block External Beta

#### 1. Public event authority - Resolved at Gate A

At audit time, public Staging `/events` returned 20 events: 11 `PUBLISHED` and 9 `DRAFT`. The API now owns this boundary for both list and detail reads; the deployed negative check proves a former draft id is no longer reachable publicly.

Required boundary:

- public list and detail endpoints return only explicitly public, published, non-expired records;
- organizer/admin preview uses a separate authenticated endpoint;
- test evidence is isolated from the externally reachable Staging catalog;
- API tests prove draft, cancelled, tenant-private, and test records cannot cross the public boundary.

#### 2. Real event dates replaced with the current date - Resolved at Gate A

The original mapper rejected fractional-second timestamps such as `2026-10-12T12:00:00.000Z` and fell back to `Date()`. It now accepts fractional and non-fractional ISO-8601 input and throws a typed mapping error for malformed required dates. The Beta runtime rendered the future dates rather than the current day.

Required boundary:

- decode the API contract with a formatter that accepts fractional seconds;
- treat an invalid required timestamp as a typed data error, not “now”;
- add unit fixtures for fractional and non-fractional ISO-8601 values and time zones;
- reject or quarantine malformed catalog records instead of silently changing their meaning.

#### 3. Face value presented as market truth - Resolved at Gate A

The original fallback assigned face value to market floor and recent sale when no resale existed. Market facts are now nullable and sourced from the live orderbook/settled-sale path. Home, Event Detail, and Market consistently rendered `No asks` and no verified sales while keeping face value labelled as face value.

Required boundary:

- market facts are nullable and come only from the orderbook/settled-trade service;
- face value is labelled only as face value;
- no ask, no sale, and no chart history remain explicit empty states on every screen;
- Home, Event Detail, and Market share one market-summary contract.

#### 4. Silent prototype fallback - Resolved at Gate A

Release-facing construction now requires explicit dependencies, concrete mock services compile only under `DEBUG`, and missing or unsafe environment values fail closed. The checked-in Local default is the Staging HTTPS origin; localhost requires an ignored explicit override.

Required boundary:

- release-facing constructors require explicit real dependencies;
- preview fixtures live in Preview/test-only compilation paths;
- guest identity is a domain value, not a mock-data dependency;
- all Staging/Beta/Release configurations fail closed when the API origin is absent or unsafe;
- local API use requires an explicit opt-in scheme and cannot be the normal Debug fallback.

#### 5. Core iOS lifecycle automation - Partially addressed

The Xcode project now has a shared `FanPassTests` target. A later current-source Debug run executed 6/6 mapper and sponsored-crypto settlement tests, superseding the earlier zero-execution host failure. Critical session restore, payment settlement, ticket issuance, list/cancel, QR suppression, remote redemption, and multi-device reconciliation still need broader executable unit/UI coverage and physical-device evidence.

Required boundary before external Beta:

- add focused model/repository tests first;
- add UI tests for guest discovery, authentication gate, purchase outcome, Tickets, resale, and recovery states;
- run deployed Staging and physical-device release matrices;
- treat local compile/simulator checks as supporting evidence only.

### P1 - Complete The Core User Journey

#### Home

- `Tonight in {city}` uses the first featured event's city, not the user's location, selected market, or global preference.
- `Popular near you` and `Just announced` are array slices rather than location/popularity/announcement signals.
- Search renders three concept rows and “Apply search” only dismisses the sheet.
- Notifications are hard-coded product examples, including a price alert that is not backed by a user rule.
- The account button opens a guest concept sheet rather than the real account/auth journey.
- The hero heart looks actionable but has no favorite behavior.

Decision: keep Home small and truthful. Until recommendation, saved-artist, notification, favorite, and location systems exist, use transparent modules such as “Upcoming events”, “Newly published”, and an explicit region selector.

2026-07-25 status: implemented for the active Home. Real catalog city selection, real Explore routing, and real Account routing replace the listed concept claims. Recommendation/saved-artist/notification systems remain absent rather than simulated.

#### Explore

- Search covers only event title, venue, city, and category; the placeholder and Home copy imply broader artist discovery.
- “Recommended” is the full filtered event list, not a ranking or personalized recommendation.
- Fan Access is now campaign-conditional, but compact Explore cards still show visually noisy poster/status layers at 368-point width.
- There is no artist entity, editorial story, genre/topic navigation, follow graph, content-rights state, or source attribution model in the active experience.

Decision: evolve Explore into a discovery hub in stages: real event search/filter first, then artist pages/follows, then rights-cleared editorial content. Empty Fan Access should collapse into a small contextual module instead of dominating the page.

2026-07-25 status: the first stage is implemented. Artist entities/follows and rights-cleared editorial content remain future product work.

#### Market

- The active Market uses the real public orderbook and truthful settled-sale history; this is a strong foundation.
- The green primary `Buy` action remains visually dominant when the selected category has no ask. Only the next sheet explains that purchase is unavailable.
- Market defaults can differ from the event the user was just viewing, weakening continuity.

Decision: make the primary action state-aware (`Buy lowest ask`, `No resale available`, or a future real bid/watch action) and preserve event/ticket context across Home, Event Detail, and Market.

#### Tickets

- The guest state has clear sign-in and browse actions and does not fabricate tickets.
- The release-critical risk is below the guest screen: session recovery, post-payment issuance, stale QR suppression, remote `USED` reconciliation, list/cancel state, and offline recovery still lack iOS automation and current physical-device evidence.

Decision: keep the simple guest state; invest next in lifecycle correctness and recovery rather than adding wallet decoration.

#### Account

- The menu is complete and authenticated routes are structured, but several destinations openly end in unavailable product states.
- Notification, region, currency, analytics, security, and profile controls are partly local `@State`; they can appear editable without account-synced persistence.
- Payout setup, promo redemption, and in-app support do not yet exist.
- The default region/currency remains Hong Kong/HKD despite the global product direction.

Decision: keep only settings that are either real, read-only and accurately labelled, or essential signposts. Do not present local toggles as saved account preferences. Prioritize support/contact, notification preferences, region/currency, and payout readiness based on actual launch scope.

#### Event Detail And Purchase

- The first viewport repeats artwork and derived market metrics while the ticket category and purchase action sit below the fold.
- Fan Access is now shown only for an open backend campaign; expiry/closure transitions still need automated coverage.
- The persistent tab bar competes with a focused event/purchase journey.
- Availability and checkout gating are backend-backed, which is the correct authority boundary.

Decision: move event time/place/status and the first valid ticket action into the initial viewport, show Fan Access only for an open campaign, and keep market data truthful and secondary.

2026-07-25 status: implemented in the active Event Detail while preserving backend inventory, on-sale, role, authentication, and checkout gates.

### P2 - Quality, Globalization, And Maintainability

- The global catalog still prices published events in Singapore, London, Berlin, Tokyo, Los Angeles, and Amsterdam in HKD. Currency and price must be organizer/event-owned, with localized display separated from settlement currency.
- Two public seeded tickets are HKD 5 and HKD 6. Public demo content needs editorial/data QA before it can represent the product.
- V5 Home search/account/carousel controls now use practical 44-point targets. Remaining screens still need a complete touch-target audit.
- The earlier V4 accessibility overlay exposed stale Home elements while Event Detail was visible. V5 hides the tab bar inside Event Detail, but VoiceOver/Accessibility Inspector verification is still required for navigation and sheet focus containment.
- Market, Profile, Tickets, and shared component files remain oversized and should be split after lifecycle tests exist.
- The broad shared refresh revision and fragmented 401 behavior can cause unrelated reloads and inconsistent long-session recovery.
- English strings, Hong Kong defaults, fixed date/currency assumptions, and right-to-left/dynamic-type behavior are not yet a global localization system.
- No product analytics contract currently proves search success, event-to-checkout conversion, payment recovery, ticket retrieval, support demand, or Fan Access friction without collecting unnecessary personal data.

## Screen Review

### 1. Runtime And Data Provenance - Gate A Closed, Release Provenance Pending

The installed Beta-configured build points to real Staging, public catalog isolation is server-owned, and runtime configuration fails closed. TestFlight, physical-device, production-capacity, and real-user provenance remain incomplete.

### 2. Home - V5 Truthful Discovery Front Door

The active V5 Home is poster-led and uses real catalog-city context, Explore search routing, Account routing, saved-catalog recovery, event navigation, and owned-ticket data. It no longer claims personalization, notifications, favorites, or device location that do not exist.

Historical V4 evidence: `outputs/product-audit/2026-07-17-main-app/01-home.png`. Current evidence is the 2026-07-25 same-viewport simulator comparison captured during the V5 pass; it is not release evidence.

### 3. Explore - Real Event Discovery, Broader Content Pending

The active V5 screen has truthful catalog search, city/category filters, result recovery, compact campaign-backed Fan Access, and readable 368-point event rows. It does not yet support artist entities/follows or rights-cleared editorial discovery.

Evidence: `outputs/product-audit/2026-07-17-main-app/02-explore.png`.

### 4. Market - Honest Data Core, Misleading Action Hierarchy

The searchable event/category architecture and verified-history empty state are good. The purchase CTA and cross-screen market summary still need one truthful state model.

Evidence: `outputs/product-audit/2026-07-17-main-app/03-market.png`.

### 5. Tickets - Good Guest Boundary, Untested Critical Lifecycle

The guest state is honest and clear. The signed-in lifecycle is release-critical and needs automation plus deployed/physical evidence.

Evidence: `outputs/product-audit/2026-07-17-main-app/04-tickets.png`.

### 6. Account - Complete Navigation, Incomplete Services

The information architecture is understandable. The product should not confuse a visible menu or local toggle with a service that actually exists and persists.

Evidence: `outputs/product-audit/2026-07-17-main-app/05-account.png`.

### 7. Event Detail - V5 Conversion Hierarchy Implemented

The active V5 page shows event identity once, then ticket price/inventory/rules and the real auth/checkout action. Sale transparency follows the ticket choice, resale context is secondary, and the tab bar is hidden inside the focused path. Full guest-to-checkout deployment analytics and recovery evidence remain open.

Evidence: `outputs/product-audit/2026-07-17-main-app/06-event-detail.png`.

## Accessibility Evidence Limits

This pass inspected the simulator accessibility overlay and source-level target sizes. It did not complete VoiceOver task flows, Accessibility Inspector audits, every Dynamic Type size, Reduce Motion, Increased Contrast, color-blind simulation, keyboard/switch control, right-to-left layout, or physical-device reachability. Those remain required release checks rather than assumed passes.

## Remediation Sequence

### Gate A - Truthful Catalog And Market - Closed in Staging

1. [x] Enforce public event visibility on the API.
2. [x] Fix strict timestamp decoding and remove `Date()` fallbacks.
3. [x] Separate face value from nullable market facts.
4. [x] Hide Fan Access unless the API reports an open campaign.
5. [x] Remove silent mock/local defaults from active runtime construction.

Exit evidence: deployed API contract checks, current-source iOS tests executing 6/6, a Beta-configured Staging runtime, public endpoint positive/negative checks, and visual/runtime evidence showing correct future dates plus consistent no-market-data states. The narrow lifecycle-test scope remains in Gate C.

### Gate B - Real Discovery And Core Conversion

1. [x] Replace Home concept search/notifications/favorite/location claims with real behavior or honest labels.
2. [x] Implement event-first search, filters, and contextual continuity.
3. [x] Reorder Event Detail around time/place/ticket availability/purchase.
4. [ ] Make Market actions reflect actual liquidity.
5. [ ] Remove or mark non-persistent Account controls.

Exit evidence: deployed guest-to-event-to-auth-gate-to-checkout path with analytics and failure recovery.

### Gate C - Release Reliability

1. Add iOS unit/UI targets and lifecycle regression coverage.
2. Centralize typed 401/session refresh and domain-scoped refresh.
3. Verify payment, issuance, resale, QR, and redemption on physical devices.
4. Move externally relied-on services to non-sleeping capacity with monitoring, backup, and restore evidence.
5. Run accessibility, localization, privacy, legal, content-rights, and App Store release gates.

Exit evidence: TestFlight provenance, physical-device matrix, deployed Staging E2E, monitored restore exercise, and signed release scorecard.

## Standing Implementation Rule

- Mock data is permitted only for Preview, isolated tests, deterministic fault injection, or clearly labelled internal demos.
- Local builds and simulators are permitted for compile/debug/regression work, but they cannot close availability, auth, payment, data, or release claims.
- Every meaningful implementation pass must inspect adjacent real-user states and update this audit, Development Tasks, Handoff, and Journey when its conclusions change.
