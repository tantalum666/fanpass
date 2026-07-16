# FanPass Main App Product Audit

Last reviewed: 2026-07-17 (Asia/Shanghai).

## Purpose

This is the living release audit for the V4 consumer iOS app. It reviews the product as a real global ticketing service, not as a local prototype or a collection of individually working screens.

The audit uses four evidence layers:

1. the currently installed `fun.fanpass.app` runtime on `FanPass-iPhone-17`;
2. its embedded Staging configuration and the public Staging API;
3. the active V4 Swift and API source;
4. existing release, security, payment, ticket, and infrastructure contracts.

The installed app is a Debug build pointed at `https://fanpass-api-staging.onrender.com`. It is useful runtime evidence, but it is not TestFlight, physical-device, production-capacity, or real-user launch proof.

## Overall Verdict

The V4 visual system is coherent and the product already has credible ticketing, controlled resale, payment, ownership, and entry foundations. It is not ready for external users yet because several trusted facts can currently be false or internally inconsistent.

The next product phase is not another broad visual redesign. It is a **truth-and-completion pass**:

- the API must publish only public events;
- dates, prices, availability, market history, and Fan Access must never be inferred as facts;
- concept-only interactions must either become real or leave the release surface;
- a deployed Staging/TestFlight journey, automated iOS lifecycle tests, and physical-device evidence must protect the core path.

## Release Severity

### P0 - Block External Beta

#### 1. Public event authority is missing

The public Staging `/events` response returned 20 events: 11 `PUBLISHED` and 9 `DRAFT`. The draft set includes staff, cross-organizer, invite, and test-evidence titles. The iOS app hides some of them with keyword filtering in `isPublicDisplayEvent`, but a consumer must not enforce server publication policy.

Required boundary:

- public list and detail endpoints return only explicitly public, published, non-expired records;
- organizer/admin preview uses a separate authenticated endpoint;
- test evidence is isolated from the externally reachable Staging catalog;
- API tests prove draft, cancelled, tenant-private, and test records cannot cross the public boundary.

#### 2. Real event dates are replaced with the current date

The API returns timestamps such as `2026-10-12T12:00:00.000Z`. The current mapper uses a default `ISO8601DateFormatter` that rejects this fractional-second form, then falls back to `Date()`. Runtime evidence therefore rendered Aurora and other future events as `JUL 17`.

Required boundary:

- decode the API contract with a formatter that accepts fractional seconds;
- treat an invalid required timestamp as a typed data error, not “now”;
- add unit fixtures for fractional and non-fractional ISO-8601 values and time zones;
- reject or quarantine malformed catalog records instead of silently changing their meaning.

#### 3. Face value is presented as market truth

`defaultMarketSummary` currently assigns the first ticket type's face value to `floorPrice`, `recentSale`, and `suggestedResalePrice` even when no resale ask or settled trade exists. Event Detail can therefore show `Floor HK$1,280` and `Lowest resale` while Market correctly shows `No asks` and no verified sales.

Required boundary:

- market facts are nullable and come only from the orderbook/settled-trade service;
- face value is labelled only as face value;
- no ask, no sale, and no chart history remain explicit empty states on every screen;
- Home, Event Detail, and Market share one market-summary contract.

#### 4. Production code can silently fall back to prototype state

The active target still compiles mock services/data and several production-facing initializers default to `MockEventService`, `MockTicketService`, or `FanPassMockData`. Missing Debug API configuration silently points to `http://localhost:4000`.

Required boundary:

- release-facing constructors require explicit real dependencies;
- preview fixtures live in Preview/test-only compilation paths;
- guest identity is a domain value, not a mock-data dependency;
- all Staging/Beta/Release configurations fail closed when the API origin is absent or unsafe;
- local API use requires an explicit opt-in scheme and cannot be the normal Debug fallback.

#### 5. Core iOS lifecycle has no automated test target

The Xcode project has no consumer unit or UI test target. Critical session restore, payment settlement, ticket issuance, list/cancel, QR suppression, remote redemption, and multi-device reconciliation behavior is therefore protected mainly by manual checks.

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

#### Explore

- Search covers only event title, venue, city, and category; the placeholder and Home copy imply broader artist discovery.
- “Recommended” is the full filtered event list, not a ranking or personalized recommendation.
- An empty Fan Access card occupies prime space even when the backend reports no open campaign.
- There is no artist entity, editorial story, genre/topic navigation, follow graph, content-rights state, or source attribution model in the active experience.

Decision: evolve Explore into a discovery hub in stages: real event search/filter first, then artist pages/follows, then rights-cleared editorial content. Empty Fan Access should collapse into a small contextual module instead of dominating the page.

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
- Fan Access is linked for every event even when `fanAccessAvailable` is false or missing.
- The persistent tab bar competes with a focused event/purchase journey.
- Availability and checkout gating are backend-backed, which is the correct authority boundary.

Decision: move event time/place/status and the first valid ticket action into the initial viewport, show Fan Access only for an open campaign, and keep market data truthful and secondary.

### P2 - Quality, Globalization, And Maintainability

- The global catalog still prices published events in Singapore, London, Berlin, Tokyo, Los Angeles, and Amsterdam in HKD. Currency and price must be organizer/event-owned, with localized display separated from settlement currency.
- Two public seeded tickets are HKD 5 and HKD 6. Public demo content needs editorial/data QA before it can represent the product.
- Home icon controls, carousel controls, dots, and some `See all` targets are smaller than the expected 44-point touch area.
- The accessibility overlay exposed stale Home elements while Event Detail was visible. This needs VoiceOver/Accessibility Inspector verification for modal/navigation focus containment.
- Market, Profile, Tickets, and shared component files remain oversized and should be split after lifecycle tests exist.
- The broad shared refresh revision and fragmented 401 behavior can cause unrelated reloads and inconsistent long-session recovery.
- English strings, Hong Kong defaults, fixed date/currency assumptions, and right-to-left/dynamic-type behavior are not yet a global localization system.
- No product analytics contract currently proves search success, event-to-checkout conversion, payment recovery, ticket retrieval, support demand, or Fan Access friction without collecting unnecessary personal data.

## Screen Review

### 1. Runtime And Data Provenance - At Risk

The installed build points to real Staging, but it is locally installed Debug evidence. The service-backed path is visible; release provenance, public catalog isolation, and fail-closed configuration are not complete.

### 2. Home - Visually Strong, Semantically Weak

The brand, hierarchy, and featured-event presentation are credible. The page currently overstates personalization, location awareness, search, notifications, and saved behavior.

Evidence: `outputs/product-audit/2026-07-17-main-app/01-home.png`.

### 3. Explore - Incomplete Discovery Product

The screen is usable as a small event list but does not yet support the global event/artist/editorial discovery promise. Empty Fan Access is over-weighted and “Recommended” has no recommendation contract.

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

### 7. Event Detail - Trust Contradiction Blocks Purchase Confidence

The page looks polished but currently surfaces the date and market contradictions most clearly. Purchase intent and real ticket availability need to lead the screen.

Evidence: `outputs/product-audit/2026-07-17-main-app/06-event-detail.png`.

## Accessibility Evidence Limits

This pass inspected the simulator accessibility overlay and source-level target sizes. It did not complete VoiceOver task flows, Accessibility Inspector audits, every Dynamic Type size, Reduce Motion, Increased Contrast, color-blind simulation, keyboard/switch control, right-to-left layout, or physical-device reachability. Those remain required release checks rather than assumed passes.

## Remediation Sequence

### Gate A - Truthful Catalog And Market

1. Enforce public event visibility on the API.
2. Fix strict timestamp decoding and remove `Date()` fallbacks.
3. Separate face value from nullable market facts.
4. Hide Fan Access unless the API reports an open campaign.
5. remove silent mock/local defaults from active runtime construction.

Exit evidence: API contract tests, iOS mapper tests, a deployed Staging build, public endpoint checks, and screenshots showing correct future dates plus consistent no-market-data states.

### Gate B - Real Discovery And Core Conversion

1. Replace Home concept search/notifications/favorite/location claims with real behavior or honest labels.
2. Implement event-first search, filters, and contextual continuity.
3. Reorder Event Detail around time/place/ticket availability/purchase.
4. Make Market actions reflect actual liquidity.
5. Remove or mark non-persistent Account controls.

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
