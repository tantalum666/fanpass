**Source Visual Truth**
- `/Users/tantalum/.codex/generated_images/019ea0f2-4089-7f33-89de-bba07aeb3da4/reference-web-final-concept-source.png`

**Implementation Evidence**
- Discover: `/Users/tantalum/Documents/system and iot/apps/web/dist/final-concept-pass/discover.png`
- Market: `/Users/tantalum/Documents/system and iot/apps/web/dist/final-concept-pass/market.png`
- Tickets and order: `/Users/tantalum/Documents/system and iot/apps/web/dist/final-concept-pass/tickets.png`
- Mobile: `/Users/tantalum/Documents/system and iot/apps/web/dist/final-concept-pass/mobile-discover.png`
- Figma capture: `https://www.figma.com/design/RXUJWSHn3tzCerhB4c2JaS?node-id=2-2`
- Feature pages: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-pages-pass/`
- API-backed market: `/Users/tantalum/Documents/system and iot/apps/web/dist/api-backed-final/market-api.png`
- Live seeded orderbook: `/Users/tantalum/Documents/system and iot/apps/web/dist/live-orderbook-pass/market-live-orderbook.png`
- Backend order creation flow: `/Users/tantalum/Documents/system and iot/apps/web/dist/order-create-pass-2/`
- Viewport: 1672 x 941 desktop; mobile overflow also checked at 390 x 844.
- State: FanPass Web local app, Discover, Market, and My Tickets pages.

**Full-View Comparison Evidence**
- The source concept contains three primary product states: premium editorial marketplace, futuristic market terminal, and fan wallet/order surface.
- The implementation maps these states to real app pages: Discover, Market, and My Tickets instead of keeping them as theme variants.
- The key frame structure, left navigation, dark surface system, large artist imagery, ticket selection panel, orderbook, market depth chart, buy/sell controls, wallet drawer, and order summary are represented in the rendered app.

**Focused Region Comparison Evidence**
- Discover hero: source shows a large LISA tour image with serif display type and a right-side ticket picker. Implementation uses a generated editorial pop hero image, serif LISA display, ticket tiers, and checkout summary in the same spatial relationship.
- Market terminal: source shows an event strip, orderbook, market depth, trading ticket form, and wallet panel. Implementation includes the same regions with matching data density and dark cyan market palette.
- Tickets/order: source shows popular cards, My Tickets drawer, QR-like ticket surface, transfer/sell actions, and order total. Implementation includes the same high-level layout and actions.
- Sidebar: source uses icon-led nav. Implementation now uses lucide line icons for all primary nav rows.
- Responsive: mobile was checked for horizontal overflow after adapting the desktop frames into stacked product pages.

**Findings**
- No P0/P1/P2 rendering issues found in the current local reconstruction.
- Browser verification reported zero horizontal overflow and zero broken images.
- Feature page verification covered For You, Events, Venues, Artists, Wallet, Orders, and Alerts. Each rendered rows/actions, with zero horizontal overflow and zero broken images.
- API-backed verification covered `http://localhost:5175/` reading `http://localhost:4000/events` and `/orders/events/:eventId/ticket-types/:ticketTypeId/book`. The Market page rendered the backend event, `Orderbook / Live API`, dynamic event date, dynamic ticket type, and dynamic last-price label with zero console errors.
- Live orderbook verification confirmed the backend demo seed now returns asks, bids, and a last trade. The Market page rendered seeded levels `HK$1,490`, `HK$1,545`, `HK$1,320`, and last price `HK$1,360` from the API instead of the old fallback `HK$520` row.
- Review Order flow verification confirmed the Market page obtains a demo session, posts a backend BUY order to `/orders`, shows `Order open on API`, refreshes the orderbook, and shows the new Reserved buy order on the Orders page. The browser run reported zero console errors, zero broken images, and zero horizontal overflow.

**Follow-Up Polish**
- [P3] The exact artist imagery differs from the generated source concept. This is expected because the implementation uses generated/local-safe assets rather than a real celebrity image.
- [P3] Figma capture is a raw html-to-design capture, not a fully componentized Figma system. It is suitable as a visual reference; a later pass can rebuild it using Figma components.
- [P3] Some fine-grain details can still be tightened, including exact event names in the recommendation cards, market table micro-typography, and per-page topbar utility labels.

**Patches Made Since Previous QA**
- Rebuilt the app around compact black product frames instead of full-screen dashboard canvases.
- Reworked sidebar navigation per page mode: editorial marketplace, market terminal, and ticket wallet/order surface.
- Converted Discover recommendation cards into image-led poster cards.
- Added terminal-mode wallet activity and balance surfaces.
- Added a second ticket card and recommendation rail to the ticket wallet concept.
- Re-captured desktop and mobile screenshots after the reconstruction pass.
- Re-captured the current Discover implementation into Figma node `2-2`.
- Added real app views for For You, Events, Venues, Artists, Collections, Wallet, Orders, Analytics, Alerts, and Settings instead of routing those nav items back to the three showcase pages.
- Added screenshot verification for the expanded feature page set.
- Connected the web app to the public backend orderbook endpoint with fallback visual depth when the live orderbook is empty.
- Updated local API CORS defaults and `.env` values to allow Vite ports 5173, 5174, and 5175.
- Added runtime-only demo market depth to the API DemoStore so the local web Market page can show real backend-driven orderbook levels without changing unit-test defaults.
- Connected the Market `Review order` action to backend demo auth plus `POST /orders`, with local fallback if the API is unavailable.

**Final Result**
- passed for current high-fidelity local reconstruction pass

## 2026-06-07 Fidelity And Documentation Rule Pass

**Documentation Rules Added**
- Current corrected rule: `docs/CODEX_HANDOFF.md`, `docs/NEW_CHAT_PROMPT.md`, and `docs/QA_CHECKLIST.md` require every FanPass work session to read `docs/CODEX_HANDOFF.md` first, enumerate and read every Markdown file with `rg --files -g '*.md'`, avoid "shit-mountain" or spaghetti code, treat security as the highest priority, and update relevant Markdown docs immediately when work completes. `docs/NEW_CHAT_PROMPT.md` is the resume prompt to keep current at work end.

**Implementation Changes**
- Re-mapped the live API demo concert into the same premium concert visual treatment as the concept image while keeping backend event IDs and ticket type IDs intact for orderbook/order calls.
- Reworked the web shell so localhost fills the viewport instead of appearing as a short mockup on a gray canvas.
- Tightened the desktop layout to the concept proportions: narrow icon sidebar, left-aligned content, large editorial hero, right-side ticket picker, and compact recommendation cards.
- Extended the Market page from a sparse terminal into a fuller trading workspace with market tape, liquidity bands, and execution controls below the orderbook/depth/trade/wallet panels.
- Added final mobile overrides so the concept reconstruction collapses to a single-column mobile ticketing flow.

**Verification**
- `scripts/with-node-22.sh npm run typecheck:web` passed.
- `scripts/with-node-22.sh npm run build:web` passed.
- Playwright desktop Discover screenshot: `/Users/tantalum/Documents/system and iot/apps/web/dist/qa-desktop-discover-final.png`
- Playwright desktop Market screenshot: `/Users/tantalum/Documents/system and iot/apps/web/dist/qa-desktop-market-final.png`
- Playwright mobile Discover screenshot after final guard: `/Users/tantalum/Documents/system and iot/apps/web/dist/qa-mobile-after-guard.png`
- Browser QA reported zero console errors, zero broken images, and zero horizontal overflow at 1920 x 1080 and 390 x 844.

**Remaining Polish**
- The web app is closer to the supplied concept for Discover and Market, but exact 1:1 parity still needs another pass on micro-spacing, chart/table typography, and the ticket wallet/order surface.

## 2026-06-07 Ticket Wallet And Orders Surface Pass

**Implementation Changes**
- Added API-backed demo ticket and order read paths in `apps/web/src/services/fanpassApi.ts` through `/tickets/owner/:userId` and `/orders/users/:userId`, using the existing demo session boundary and falling back to local state when the API is unavailable.
- Reworked the `My Tickets`, `Wallet`, and `Orders` web views so they share the concept's fan wallet/order surface instead of the generic feature workspace.
- Upgraded the ticket drawer with Upcoming/Past tabs, seat metadata, QR-style ticket blocks, listed/ready status, and Transfer/Sell actions.
- Made the order card use the latest backend/local order state, dynamic currency totals, buyer guarantee copy, and secure checkout copy.
- Added a bottom order-history and pass-controls strip so the ticket surface reads as a complete product workspace instead of a sparse mockup.

**Verification**
- `scripts/with-node-22.sh npm run typecheck:web` passed.
- `scripts/with-node-22.sh npm run build:web` passed.
- Playwright ticket/order surface screenshot: `/Users/tantalum/Documents/system and iot/apps/web/dist/qa-ticket-surface-final.png`
- Playwright mobile ticket/order screenshot: `/Users/tantalum/Documents/system and iot/apps/web/dist/qa-ticket-surface-mobile-final.png`
- Sell action navigation screenshot: `/Users/tantalum/Documents/system and iot/apps/web/dist/qa-sell-to-market-final.png`
- Browser QA confirmed API-backed ticket/order copy appears, ticket drawer has two rendered cards, order trust stack has two items, Sell reaches the Market surface, and desktop/mobile had zero console errors, zero broken images, and zero horizontal overflow.

**Remaining Polish**
- Ticket/order surface still uses repeated local-safe LISA imagery for the first two cards. A later concept/asset pass should diversify artist imagery while keeping local-safe assets.
- The right drawer and order card are structurally close to the concept; exact 1:1 parity still needs micro-spacing, typography, and icon-detail tightening.

## 2026-06-07 Feature Surface And Maintainability Pass

**Implementation Changes**
- Split reusable web UI pieces out of the monolithic `apps/web/src/App.tsx` into:
  - `apps/web/src/components/FeatureWorkspace.tsx`
  - `apps/web/src/components/Metric.tsx`
  - `apps/web/src/lib/viewHelpers.ts`
- Removed unused legacy `TicketsView`, `MarketView`, local `Metric`, and duplicated formatting/helper functions from `App.tsx`.
- Rebuilt the non-core navigation destinations into a richer product surface instead of generic placeholder panels. Events, Venues, Artists, Collections, Analytics, Alerts, and Settings now share a concept-driven feature workspace with masthead copy, metric strip, spotlight rail, dense list/table area, action/status panel, and bottom system-flow panel.
- Preserved the documented product boundary: web remains QR-only/standard web UI, no Web NFC, no public Beta readiness claim, and no release-gate substitution for native iOS/TestFlight/Apple Wallet/physical scanner/chain custody evidence.

**Verification**
- `scripts/with-node-22.sh npm run typecheck:web` passed.
- `scripts/with-node-22.sh npm run build:web` passed.
- Playwright MCP loaded `http://localhost:5175/` with page title `FanPass Web | Verified tickets and resale` and reported zero console warnings/errors on initial load.
- Node REPL + Playwright fallback was used for screenshot and assertion QA because the Browser plugin's `agent.browser` interface was not exposed in this session.
- Desktop screenshots:
  - Discover: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-surface-pass/discover.png`
  - Events: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-surface-pass/events.png`
  - Market: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-surface-pass/market.png`
  - Analytics: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-surface-pass/analytics.png`
  - Settings: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-surface-pass/settings.png`
- Mobile screenshot:
  - Events at 390 x 844: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-surface-pass/mobile-events.png`
- QA assertions passed for Discover, Events, Market, Analytics, Settings, and mobile Events:
  - zero console errors;
  - zero broken images;
  - zero horizontal overflow;
  - Events rendered four feature panels and `CATALOG MODEL`;
  - Analytics rendered four feature panels and `TERMINAL MODEL`;
  - Settings rendered four feature panels and `SECURITY DEFAULTS`;
  - Market still rendered the orderbook surface.
- `view_image` inspected the supplied concept reference and the latest Discover, Events, Analytics, and mobile Events screenshots.

**Figma Status**
- Figma design-system search for file `RXUJWSHn3tzCerhB4c2JaS` returned no reusable components, variables, or styles for `button`.
- `generate_figma_design` was attempted against the existing Figma file but was blocked by the Figma Starter plan MCP tool-call limit. No new Figma capture was produced in this pass.

**Remaining Polish**
- The expanded feature surfaces are now product-specific and visually coherent, but they are not yet 1:1 with a dedicated concept image for every secondary page.
- `App.tsx` is reduced but still large at 1,223 lines. Continue extracting Discover, Market, Pulse/Tickets, Event, and Checkout into feature components before adding more behavior.
- `global.css` is still large at 4,437 lines. Future visual work should move toward component-scoped CSS sections or a clearer token/layer structure before adding more variants.

## 2026-06-07 Event Detail And Checkout Concept Pass

**Documentation Rules Confirmed**
- Confirmed the standing rules are now present in `docs/NEW_CHAT_PROMPT.md`, `docs/CODEX_HANDOFF.md`, and `docs/QA_CHECKLIST.md`.
- Added the same non-negotiable engineering rules to root `README.md` so maintainable code, start-of-work full Markdown reads, security-as-release-blocker, and same-change doc updates are visible from the main project entry.

**Implementation Changes**
- Extracted the Event Detail flow from `apps/web/src/App.tsx` into `apps/web/src/components/EventView.tsx`.
- Extracted the Checkout flow and checkout step renderer from `apps/web/src/App.tsx` into `apps/web/src/components/CheckoutView.tsx`.
- Rebuilt Event Detail toward the supplied concept: large dark editorial hero, premium artist treatment, right-side ticket stack, market pulse, value/resale cap comparison, and FanPass fairness/policy cards.
- Rebuilt Checkout toward a premium ticketing order surface: event strip, reserve/authorize/issue steps, test-mode payment boundary copy, rule/session assurance cards, ticket preview, and protected order summary.
- Preserved product/security boundaries: no Web NFC, no production payment readiness claim, no real personal data, and no release-gate substitution for native iOS/TestFlight/Apple Wallet/physical scanner/chain custody evidence.
- Reduced `apps/web/src/App.tsx` from 1,223 lines to 1,011 lines. `global.css` increased to 4,912 lines and remains a maintainability risk for future style work.

**Verification**
- `scripts/with-node-22.sh npm run typecheck:web` passed.
- `scripts/with-node-22.sh npm run build:web` passed.
- Playwright MCP loaded `http://localhost:5175/` with page title `FanPass Web | Verified tickets and resale` and reported zero console errors.
- Node REPL + Playwright exercised Discover -> Event Detail -> Checkout Select -> Checkout Confirm.
- Desktop screenshots:
  - Event Detail: `/Users/tantalum/Documents/system and iot/apps/web/dist/event-detail-concept-v2.png`
  - Checkout Select: `/Users/tantalum/Documents/system and iot/apps/web/dist/checkout-select-concept-v2.png`
  - Checkout Confirm: `/Users/tantalum/Documents/system and iot/apps/web/dist/checkout-confirm-concept-v2.png`
- Mobile screenshot:
  - Event Detail at 390 x 844: `/Users/tantalum/Documents/system and iot/apps/web/dist/event-detail-mobile-concept-v2.png`
- Browser QA assertions passed:
  - zero console errors;
  - zero horizontal overflow at 1728 x 1117 and 390 x 844;
  - checkout action advanced from authorization to confirm state;
  - final screenshot inspection confirmed product-styled Event Detail action buttons instead of browser-default controls.

**Remaining Polish**
- Event Detail and Checkout now match the concept direction more closely, but exact 1:1 parity still needs micro-spacing, ticket stack density, topbar sizing, and image crop tuning.
- `App.tsx` remains too large at 1,011 lines. Continue extracting Discover, Market/Orderbook, Pulse/Tickets, Header/Nav, and EventCard before adding larger behavior.
- `global.css` remains too large at 4,912 lines. Future work should split CSS by feature surface or introduce a clearer style layering strategy before adding new page variants.

## 2026-06-07 Web Component Boundary Pass

**Implementation Changes**
- Reworked `apps/web/src/App.tsx` into a state/routing composition layer instead of a monolithic page implementation.
- Extracted app shell navigation into `apps/web/src/components/AppHeader.tsx`.
- Extracted reusable event cards into `apps/web/src/components/EventCard.tsx`.
- Extracted Discover/home marketplace into `apps/web/src/components/DiscoverView.tsx`.
- Extracted Market/Orderbook terminal into `apps/web/src/components/TerminalConcept.tsx`.
- Extracted Tickets/Wallet/Orders pulse surface into `apps/web/src/components/PulseConcept.tsx`.
- Preserved the existing concept visual system and API-backed behaviors while reducing `App.tsx` from 1,011 lines to 445 lines.

**Verification**
- `scripts/with-node-22.sh npm run typecheck:web` passed.
- `scripts/with-node-22.sh npm run build:web` passed.
- Node REPL + Playwright fallback was used for browser QA because the Browser plugin's direct app-browser automation interface was not exposed in this session.
- Tested flow: Discover -> Listings/Market -> Review order -> Tickets -> Discover -> Event Detail -> Checkout.
- Market `Review order` still created an API-backed demo order and rendered `Order open on API`.
- Desktop screenshots:
  - Discover: `/Users/tantalum/Documents/system and iot/apps/web/dist/component-extraction-pass/discover.png`
  - Market: `/Users/tantalum/Documents/system and iot/apps/web/dist/component-extraction-pass/market.png`
  - Tickets: `/Users/tantalum/Documents/system and iot/apps/web/dist/component-extraction-pass/tickets.png`
  - Event Detail: `/Users/tantalum/Documents/system and iot/apps/web/dist/component-extraction-pass/event.png`
  - Checkout: `/Users/tantalum/Documents/system and iot/apps/web/dist/component-extraction-pass/checkout.png`
- Mobile screenshot:
  - Discover at 390 x 844: `/Users/tantalum/Documents/system and iot/apps/web/dist/component-extraction-pass/mobile-discover.png`
- Browser QA assertions passed:
  - zero console errors;
  - zero horizontal overflow at 1728 x 1117 and 390 x 844;
  - meaningful app content rendered after the component split;
  - the checked interaction path reached the expected Checkout state.
- `view_image` inspected the supplied concept reference and the latest Discover/Market screenshots after extraction.

**Remaining Polish**
- `App.tsx` is now a reasonable composition layer, but `FeatureWorkspace.tsx` is still large at 447 lines and `global.css` remains large at 4,912 lines.
- Exact 1:1 parity still needs more visual tuning, especially secondary feature pages, market micro-typography, wallet drawer spacing, and mobile nav/header density.

## 2026-06-07 Work-Start Rule Correction

**Documentation Rule Update**
- Corrected the standing startup order: every FanPass work session must read `docs/CODEX_HANDOFF.md` first, then enumerate and read every Markdown file with `rg --files -g '*.md'` before changing code, evidence, or product docs.
- Clarified that `docs/NEW_CHAT_PROMPT.md` is the generated resume prompt to update at the end of work when durable state, blockers, or standing instructions change. It is not the first startup source.

## 2026-06-07 Market Fidelity Tightening Pass

**Implementation Changes**
- Tightened Discover toward the supplied premium marketplace concept by adding the hero `Save` CTA beside `Get Tickets` and replacing recommendation status-only labels with compact date tiles plus small status chips.
- Rebuilt the Market/orderbook display anatomy toward the supplied futuristic terminal concept: orderbook now shows explicit price/quantity/total headers, five ask rows, a last-price divider, five bid rows, ask/bid legend marks, and a visible price-cap row in the trade panel.
- Added display-layer depth padding over sparse live API orderbook levels so the UI reads like a full concept orderbook while preserving API-backed source labeling and not mutating backend data.
- Hid the non-reference lower terminal modules from the Market first viewport so the page focuses on the concept's event strip, orderbook, depth chart, trade form, and wallet panel.
- Preserved web fallback boundaries: no Web NFC, no native evidence blocker claim, no real personal data, no production credentials, and no release-readiness claim.

**Verification**
- `scripts/with-node-22.sh npm run typecheck:web` passed.
- `scripts/with-node-22.sh npm run build:web` passed.
- Browser plugin runtime was attempted first, but the in-app browser object exposed the underlying Playwright browser instead of the documented `tabs` wrapper; Playwright fallback was used for rendered QA.
- Local services used for QA:
  - Web: `http://localhost:5175/`
  - API: `http://localhost:4000/health`
- Desktop screenshots:
  - Discover: `/Users/tantalum/Documents/system and iot/apps/web/dist/fidelity-tightening-pass/discover-final.png`
  - Market before order: `/Users/tantalum/Documents/system and iot/apps/web/dist/fidelity-tightening-pass/market-final-before-order.png`
  - Market after order: `/Users/tantalum/Documents/system and iot/apps/web/dist/fidelity-tightening-pass/market-final-after-order.png`
  - Tickets: `/Users/tantalum/Documents/system and iot/apps/web/dist/fidelity-tightening-pass/tickets-final.png`
- Mobile screenshot:
  - Discover at 390 x 844: `/Users/tantalum/Documents/system and iot/apps/web/dist/fidelity-tightening-pass/mobile-discover-final.png`
- QA assertions passed:
  - page title `FanPass Web | Verified tickets and resale`;
  - zero console warnings/errors on desktop and mobile;
  - zero horizontal overflow on desktop Discover, Market, Tickets, and mobile Discover;
  - Discover rendered four event cards, four date tiles, and the hero `Save` action;
  - Market rendered five ask rows, five bid rows, last-price divider, price-cap row, and no lower terminal grid in the first viewport;
  - `Review order` posted through the local API and rendered `Order open on API`;
  - Tickets rendered two ticket drawer cards, two order trust rows, and the order panel.

**Remaining Polish**
- Exact 1:1 parity still needs finer artist imagery, micro-typography, wallet activity density, and secondary page-specific concept work.
- `global.css` remains large and layered from multiple fidelity passes. Future visual work should split CSS by surface or consolidate old duplicate rules before adding large new page variants.

## 2026-06-08 Navigation Consistency And Wallet Polish Pass

**Implementation Changes**
- Replaced mode-dependent sidebar generation in `apps/web/src/components/AppHeader.tsx` with one stable app-wide navigation model. Clicking Market, My Tickets, Events, Analytics, or other destinations no longer swaps the whole label set between editorial, terminal, and pulse variants.
- Removed app-shell mode switching from `apps/web/src/App.tsx`; page-specific concepts now stay inside their content components while the outer product shell remains stable.
- Updated `apps/web/src/components/EventCard.tsx` so event cards use the same premium display helpers as the hero (`headlineFor`, `sublineFor`) instead of leaking backend demo titles such as generic demo event names into the concept UI.
- Tightened `apps/web/src/components/PulseConcept.tsx` toward the supplied wallet/order concept: drawer close action, clearer ticket date/time treatment, stronger QR block, status/price labels, gradient Sell/Buy actions, and icon-led order trust rows.
- Added final CSS cascade guards in `apps/web/src/styles/global.css` so desktop sidebar labels do not truncate and the app shell/sidebar stay visually stable across product pages.
- Preserved web fallback boundaries: no Web NFC, no native evidence blocker claim, no real personal data, no production credentials, and no release-readiness claim.

**Verification**
- `scripts/with-node-22.sh npm run typecheck:web` passed.
- `scripts/with-node-22.sh npm run build:web` passed.
- Browser/IAB runtime connected and documentation was read, but local navigation to `localhost` and `127.0.0.1` was blocked by the browser client with `net::ERR_BLOCKED_BY_CLIENT`; Playwright fallback was used for rendered QA.
- Local services used for clean QA:
  - Web: `http://localhost:5175/`
  - API: `http://localhost:4000/health`
- Desktop screenshots:
  - Home: `/Users/tantalum/Documents/system and iot/apps/web/dist/nav-consistency-pass/home.png`
  - Market: `/Users/tantalum/Documents/system and iot/apps/web/dist/nav-consistency-pass/market.png`
  - My Tickets: `/Users/tantalum/Documents/system and iot/apps/web/dist/nav-consistency-pass/my-tickets.png`
  - Events: `/Users/tantalum/Documents/system and iot/apps/web/dist/nav-consistency-pass/events.png`
  - Analytics: `/Users/tantalum/Documents/system and iot/apps/web/dist/nav-consistency-pass/analytics.png`
- Mobile screenshot:
  - My Tickets at 390 x 844: `/Users/tantalum/Documents/system and iot/apps/web/dist/nav-consistency-pass/mobile-tickets.png`
- QA assertions passed:
  - page title `FanPass Web | Verified tickets and resale`;
  - zero console warnings/errors on desktop and mobile with API running;
  - zero horizontal overflow on desktop Home, Market, My Tickets, Events, Analytics, and mobile My Tickets;
  - sidebar labels remained stable across Home -> Market -> My Tickets -> Events -> Analytics;
  - desktop sidebar labels were not truncated after the final width guard;
  - app shell class stayed `app-shell` and outer background stayed stable across the checked pages.
- `view_image` inspected the supplied concept reference earlier in the work session and inspected the latest Home, Market, My Tickets, and mobile My Tickets screenshots after the nav consistency fix.

**Remaining Polish**
- The app shell is now consistent, but `global.css` still contains legacy layered overrides from earlier fidelity passes. A future maintainability pass should consolidate sidebar/shell rules into one section before adding more page variants.
- Exact 1:1 parity still needs finer image selection/cropping, ticket wallet micro-spacing, market panel density, and secondary page-specific concept work.

## 2026-06-08 Feature Surface Unification Pass

**Implementation Changes**
- Removed the unused `DesignMode` export from `apps/web/src/components/AppHeader.tsx`; the sidebar now uses the fixed app-wide nav model only.
- Added a scoped FeatureWorkspace cascade guard in `apps/web/src/styles/global.css` so Events, Analytics, Settings, and the other secondary pages use compact app-scale headers, matching panel density, stable metric strips, and the same dark product shell instead of the old giant serif landing-style masthead.
- Preserved the existing API-backed Discover, Market/Orderbook, My Tickets/Wallet/Orders, Event Detail, and Checkout routes. No backend security boundary, provider behavior, Web NFC scope, or native evidence gate changed.

**Verification**
- `scripts/with-node-22.sh npm run typecheck:web` passed.
- `scripts/with-node-22.sh npm run build:web` passed.
- Playwright MCP loaded `http://localhost:5175/` with page title `FanPass Web | Verified tickets and resale`; Node REPL + Playwright was used for screenshots/assertions because Browser/IAB app-browser automation was not exposed in this session.
- Local services used for QA:
  - Web: `http://localhost:5175/`
  - API: `http://localhost:4000/health`
- Desktop screenshots:
  - Home: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-unification-pass/home-after.png`
  - Events: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-unification-pass/events-after.png`
  - Analytics: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-unification-pass/analytics-after.png`
  - Settings: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-unification-pass/settings-after.png`
  - Market: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-unification-pass/market-after.png`
  - My Tickets: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-unification-pass/tickets-after.png`
- Mobile screenshot:
  - Events at 390 x 844: `/Users/tantalum/Documents/system and iot/apps/web/dist/feature-unification-pass/mobile-events-after.png`
- QA assertions passed:
  - sidebar labels stayed identical across Home, Events, Analytics, Settings, Market, My Tickets, and mobile Events;
  - desktop shell width stayed stable with `166px` sidebar and `213px` shell left padding;
  - zero console warnings/errors on desktop and mobile with API running;
  - zero horizontal overflow on all checked desktop/mobile states;
  - Events, Analytics, and Settings each rendered four feature panels with compact app-scale headings (`42px` desktop, `28px` mobile) and non-serif typography;
  - Market still rendered `Orderbook / Live API`;
  - My Tickets still rendered the wallet/order surface.
- `view_image` inspected the supplied concept reference and the latest Events, Analytics, Settings, and mobile Events screenshots.

**Remaining Polish**
- The secondary pages are now unified with the app shell, but exact page-specific 1:1 concepts for Venues, Artists, Collections, Alerts, and Settings can still be designed and then implemented in a later pass.
- `global.css` remains highly layered from multiple concept iterations. The current scoped guard is intentionally narrow, but a future maintainability pass should consolidate duplicated sidebar, mobile, and feature-surface rules into clearer CSS layers before adding major new surfaces.

## 2026-06-08 Discover Editorial Marketplace Proportion Pass

**Implementation Changes**
- Tightened the desktop Discover/Home first viewport toward the supplied premium editorial marketplace concept: the hero now uses a compact 302px desktop height instead of a near half-screen canvas.
- Changed the right-side ticket picker into a desktop absolute side rail so it visually spans beside the recommendation area, matching the concept's right checkout column instead of pushing the recommendation row below the whole picker.
- Added a lightweight Discover filter chip row and a second recommendation rail under the primary event cards, using existing local-safe event data and `EventCard` rather than introducing new business state.
- Preserved the existing API-backed event reads, Market/orderbook route, My Tickets/wallet route, and Web Beta Fallback boundary. No Web NFC, production credential, real-user, native evidence, Wallet, scanner, or chain-custody claim changed.

**Verification**
- `scripts/with-node-22.sh npm run typecheck:web` passed.
- `scripts/with-node-22.sh npm run build:web` passed.
- Playwright was used for rendered QA because Browser/IAB app-browser automation was not exposed in this session.
- Local services used for QA:
  - Web: `http://localhost:5175/`
  - API: `http://localhost:4000/health`
- Desktop screenshots:
  - Discover final: `/Users/tantalum/Documents/system and iot/apps/web/dist/core-fidelity-next-pass/discover-final.png`
  - Market final: `/Users/tantalum/Documents/system and iot/apps/web/dist/core-fidelity-next-pass/market-final.png`
  - Tickets final: `/Users/tantalum/Documents/system and iot/apps/web/dist/core-fidelity-next-pass/tickets-final.png`
- Mobile screenshot:
  - Discover at 390 x 844: `/Users/tantalum/Documents/system and iot/apps/web/dist/core-fidelity-next-pass/mobile-discover-final.png`
- QA assertions passed:
  - page title `FanPass Web | Verified tickets and resale`;
  - zero console warnings/errors on desktop and mobile with API running;
  - zero horizontal overflow on desktop Discover, Market, Tickets, and mobile Discover;
  - Discover desktop hero height stayed at `302px`, with the first recommendation section starting at `391px`;
  - Discover rendered seven filter chips, four primary event cards, and four secondary recommendation cards;
  - Market still rendered `Orderbook`;
  - My Tickets still rendered the wallet/order surface.
- `view_image` inspected the supplied concept reference and the latest Discover, Market, Tickets, and mobile Discover screenshots.

**Remaining Polish**
- Discover is structurally closer to the concept, but exact image crop, right-side picker micro-density, and card typography still need more 1:1 tuning.
- `global.css` now uses narrow final guards to avoid older layered overrides. A future maintainability pass should consolidate these repeated CSS layers into feature-specific sections before large new visual work.

## 2026-06-08 Navigation And Surface Stability Regression Pass

**Implementation Changes**
- Updated `apps/web/src/components/AppHeader.tsx` so active nav items expose `aria-current="page"` and ticket count uses a dedicated `.nav-badge` with a stable aria label, preventing `My Tickets` from reading or behaving like a mutated `My Tickets1` label.
- Added a final scoped stability guard in `apps/web/src/styles/global.css` that overrides legacy page-mode navigation rules from earlier concept passes. Home, Market, My Tickets, Events, Analytics, and Settings now share the same sidebar label set, active color, active background, width, and shell padding.
- Tightened `FeatureWorkspace` desktop rhythm so Events, Analytics, Settings, and other secondary destinations use a compact 10px masthead-to-content gap and product-panel density instead of stretching into a separate landing-style page. Market terminal panel height was also bounded to reduce oversized empty first-viewport space.
- Preserved existing API-backed event reads, live/demo orderbook reads, demo order creation, ticket reads, and Web Beta Fallback boundary. No Web NFC, production credential, real-user, native evidence, Wallet, scanner, or chain-custody claim changed.

**Verification**
- `scripts/with-node-22.sh npm run typecheck:web` passed.
- `scripts/with-node-22.sh npm run build:web` passed.
- Playwright was used for rendered QA because Browser/IAB app-browser automation was not exposed in this session.
- Local services used for QA:
  - Web: `http://localhost:5175/`
  - API: `http://localhost:4000/health`
- Desktop screenshots:
  - Home: `/Users/tantalum/Documents/system and iot/apps/web/dist/nav-unification-pass/home.png`
  - Market: `/Users/tantalum/Documents/system and iot/apps/web/dist/nav-unification-pass/market.png`
  - My Tickets: `/Users/tantalum/Documents/system and iot/apps/web/dist/nav-unification-pass/my-tickets.png`
  - Events: `/Users/tantalum/Documents/system and iot/apps/web/dist/nav-unification-pass/events.png`
  - Analytics: `/Users/tantalum/Documents/system and iot/apps/web/dist/nav-unification-pass/analytics.png`
  - Settings: `/Users/tantalum/Documents/system and iot/apps/web/dist/nav-unification-pass/settings.png`
- Mobile screenshot:
  - Events at 390 x 844: `/Users/tantalum/Documents/system and iot/apps/web/dist/nav-unification-pass/mobile-events.png`
- QA assertions passed:
  - sidebar label list remained identical across Home, Market, My Tickets, Events, Analytics, and Settings;
  - exactly one active sidebar item rendered after each click;
  - active sidebar background stayed `rgba(255, 255, 255, 0.08)` and active text stayed white across all checked pages;
  - desktop sidebar width stayed `166px` and app shell left padding stayed `213px`;
  - `My Tickets` label stayed separate from the ticket-count badge, with aria label `My Tickets, 1 tickets`;
  - Events, Analytics, and Settings feature masthead-to-content gap stayed `10px`;
  - Market terminal first panel height stayed at or below `460px`;
  - zero console warnings/errors and zero horizontal overflow on checked desktop/mobile states.
- `view_image` inspected the supplied concept reference and the latest Events, Market, My Tickets, and mobile Events screenshots after the regression fix.

**Remaining Polish**
- The navigation/style regression is fixed for the checked pages, but `global.css` still contains multiple historical concept-pass layers and final guards. A later maintainability pass should split sidebar, app shell, Discover, Market, Pulse/Tickets, and FeatureWorkspace styles into clearer sections or files before adding another major page family.
- Exact 1:1 visual parity still needs continued work on image crops, Market/orderbook micro-density, ticket drawer proportions, and purpose-built concepts for the remaining secondary pages.

## 2026-06-08 Market Detail Density Pass

**Implementation Changes**
- Tightened `apps/web/src/components/TerminalConcept.tsx` toward the supplied futuristic market terminal concept without changing backend order logic:
  - added a fifth event-strip metric, `Sales (24h)`;
  - changed the trade ticket type display from backend-style `CAT 2` to the concept-style featured seat band `Lower 200`;
  - added `Auto relist` and `Smart pricing` preference rows under the Review order action;
  - converted wallet rows and recent activity prices to the current event currency via `formatMoney`;
  - added compact recent-activity icons matching the concept's activity rail treatment;
  - expanded the market depth SVG with shaded ask/bid fill areas, horizontal gridlines, three price-axis labels, and a safer class-based line styling model.
- Added scoped CSS in `apps/web/src/styles/global.css` so the richer Market detail does not inherit old generic SVG `path:first-of-type` styling, keeps the five desktop metrics readable, and stacks mobile metrics as label/value rows so `Price cap` and `Sales (24h)` never truncate.
- Preserved existing API-backed event reads, live/demo orderbook reads, demo buy-order creation, ticket reads, and Web Beta Fallback boundary. No Web NFC, production credential, real-user, native evidence, Wallet, scanner, or chain-custody claim changed.

**Verification**
- `scripts/with-node-22.sh npm run typecheck:web` passed.
- `scripts/with-node-22.sh npm run build:web` passed.
- Playwright was used for rendered QA because Browser/IAB app-browser navigation and screenshot tooling was not exposed in this session.
- Local services used for QA:
  - Web: `http://localhost:5175/`
  - API: `http://localhost:4000/health`
- Desktop screenshots:
  - Market before order: `/Users/tantalum/Documents/system and iot/apps/web/dist/market-detail-density-pass/market-before-order.png`
  - Market after order: `/Users/tantalum/Documents/system and iot/apps/web/dist/market-detail-density-pass/market-after-order.png`
  - Home regression: `/Users/tantalum/Documents/system and iot/apps/web/dist/market-detail-density-pass/home-regression.png`
  - Tickets regression: `/Users/tantalum/Documents/system and iot/apps/web/dist/market-detail-density-pass/tickets-regression.png`
- Mobile screenshot:
  - Market at 390 x 844 after metric wrap fix: `/Users/tantalum/Documents/system and iot/apps/web/dist/market-detail-density-pass/mobile-market-fixed.png`
- QA assertions passed:
  - page title `FanPass Web | Verified tickets and resale`;
  - zero console warnings/errors;
  - zero horizontal overflow on desktop Market, after-order Market, Tickets regression, and mobile Market;
  - event strip rendered `Market status`, `Time to event`, `Price cap`, `Volume`, and `Sales (24h)`;
  - Market rendered `Lower 200`, `Auto relist`, `Smart pricing`, two SVG depth fills, three SVG price-axis labels, and three recent-activity icons;
  - Market terminal panel height stayed at or below `460px`, chart height stayed at or below `320px`;
  - `Review order` still created an API-backed demo order and rendered `Order open on API`;
  - Home and My Tickets navigation regression checks passed with the stable sidebar label set.
- `view_image` inspected the supplied concept reference and the latest Market before/after order, Tickets regression, and mobile Market screenshots.

**Remaining Polish**
- Market/orderbook is closer to the concept's data-rich terminal, but exact 1:1 parity still needs finer chart axis placement, orderbook/table typography, top event image cropping, and overall first-viewport height tuning.
- `global.css` continues to rely on final scoped guards over historical concept-pass layers. A follow-up maintainability pass should consolidate Market, Discover, Pulse/Tickets, and navigation CSS before adding another large surface.

## 2026-06-08 Pulse Wallet Orders Fidelity Pass

**Implementation Changes**
- Tightened the concept-style Tickets/Wallet/Orders surface in `apps/web/src/components/PulseConcept.tsx` without changing backend API calls:
  - added an explicit `surface` mode so `My Tickets`, `Wallet`, and `Orders` keep the same shell and proportions but show page-specific drawer titles, tab labels, activity headings, and summary copy;
  - removed duplicate premium-showcase recommendation cards by de-duplicating visually identical `LISA / Alter Ego World Tour` event treatments in `buildShowcaseEvents`;
  - replaced the rough `FP-*` proof placeholder with a deterministic QR-like proof tile generated from the ticket code, while keeping it as code-native demo UI and not claiming signed Wallet, physical QR, NFC, or release evidence;
  - added a compact status rail and an order timeline to bring the right-side order panel closer to the supplied concept's protected checkout/wallet stack.
- Added `apps/web/src/styles/pulse.css` and imported it after `global.css` so new Pulse-specific polish does not add another broad global cascade guard. This is a small maintainability improvement, not a full CSS consolidation.
- Preserved existing API-backed event reads, ticket reads, order reads, live/demo orderbook reads, demo buy-order creation, and Web Beta Fallback boundary. No Web NFC, production credential, real-user, native evidence, Wallet, scanner, or chain-custody claim changed.

**Verification**
- `scripts/with-node-22.sh npm run typecheck:web` passed.
- `scripts/with-node-22.sh npm run build:web` passed.
- Browser/IAB runtime connected and documentation was read. It successfully opened local pages for an initial screenshot, but the multi-state screenshot run timed out and reset the session; regular Playwright fallback was used for repeatable rendered QA.
- Local services used for QA:
  - Web: `http://localhost:5175/`
  - API: `http://localhost:4000/health`
- Desktop screenshots:
  - Tickets: `/Users/tantalum/Documents/system and iot/apps/web/dist/pulse-wallet-orders-pass/tickets-desktop.png`
  - Wallet: `/Users/tantalum/Documents/system and iot/apps/web/dist/pulse-wallet-orders-pass/wallet-desktop.png`
  - Orders: `/Users/tantalum/Documents/system and iot/apps/web/dist/pulse-wallet-orders-pass/orders-desktop.png`
- Mobile screenshot:
  - Tickets at 390 x 844: `/Users/tantalum/Documents/system and iot/apps/web/dist/pulse-wallet-orders-pass/tickets-mobile.png`
- QA assertions passed:
  - zero console warnings/errors after fixing a duplicate React key in the order timeline;
  - zero horizontal overflow on desktop Tickets, Wallet, Orders, and mobile Tickets;
  - sidebar labels remained stable across checked pages, and active nav switched correctly to `My Tickets`, `Wallet`, and `Orders`;
  - recommendation headlines rendered as `LISA`, `Afterhours Circuit`, `Orbit Finals`, and `Glasshouse Sessions` with no duplicate headline entries;
  - each checked Pulse surface rendered two proof tiles, matrix-sized proof cells, three status-rail items, and three order-timeline rows;
  - Market `Review order` smoke still created an API-backed demo order and rendered `Order open on API`.
- `view_image` inspected the supplied concept reference and the latest Tickets, Wallet, Orders, and mobile Tickets screenshots.

**Remaining Polish**
- Tickets/Wallet/Orders are closer to the supplied concept's lower marketplace frame, but exact 1:1 parity still needs tighter first-viewport vertical rhythm, drawer/card micro-spacing, more realistic event poster variety, and a fuller ticket detail/proof-history state.
- `global.css` is still historically layered. Continue moving new feature-specific polish into scoped CSS files before a larger consolidation of sidebar, app shell, Discover, Market, Pulse/Tickets, FeatureWorkspace, Event Detail, and Checkout styles.

## 2026-06-08 Event Detail Checkout Fidelity Pass

**Implementation Changes**
- Tightened `apps/web/src/components/EventView.tsx` toward the supplied concept while keeping the live API ticket band as the only actionable checkout source:
  - kept real `event.ticketTypes` as selectable/actionable rows;
  - added display-only price-context bands from `seatOptionsFor(event)` so sparse live/demo inventory still reads like a premium ticket marketplace without creating fake backend ticket IDs;
  - added face value, organizer cap, remaining inventory, Fan Access, and safe issue-flow panels;
  - kept proof/history copy redacted and did not claim signed Wallet, physical QR/NFC, native evidence, or chain-custody closure.
- Expanded `apps/web/src/components/CheckoutView.tsx` into a denser checkout terminal:
  - added a safe short checkout reference, reservation session rail, price-cap check, Fan Access check, issue preview, proof-safe marker, and order timeline;
  - preserved the test-mode payment boundary copy and avoided live payment/provider-readiness claims.
- Added scoped `apps/web/src/styles/event-checkout.css` and imported it after `global.css`/`pulse.css` so new Event/Checkout polish does not add another broad global cascade guard.
- Added `apps/web/src/styles/navigation.css` as the final runtime navigation stability layer:
  - locks sidebar width, nav button dimensions, active color/background, badge column, label truncation, and hover/focus behavior across routes;
  - disables legacy transition bleed so the previous nav item no longer briefly retains a background after clicking a new sidebar label.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB runtime connected earlier in this session but `Page.captureScreenshot` timed out for the local tab, so regular Playwright fallback was used for repeatable rendered QA.
- Local services used for QA:
  - Web: `http://localhost:5175/`
  - API: `http://localhost:4000/health`
- Desktop screenshots:
  - Event detail: `/Users/tantalum/Documents/system and iot/apps/web/dist/event-checkout-fidelity-pass/event-desktop.png`
  - Checkout select: `/Users/tantalum/Documents/system and iot/apps/web/dist/event-checkout-fidelity-pass/checkout-select-desktop.png`
  - Checkout confirm: `/Users/tantalum/Documents/system and iot/apps/web/dist/event-checkout-fidelity-pass/checkout-confirm-desktop.png`
- Mobile screenshots:
  - Event detail at 390 x 844: `/Users/tantalum/Documents/system and iot/apps/web/dist/event-checkout-fidelity-pass/event-mobile.png`
  - Checkout at 390 x 844: `/Users/tantalum/Documents/system and iot/apps/web/dist/event-checkout-fidelity-pass/checkout-mobile.png`
- QA assertions passed:
  - zero console warnings/errors;
  - zero horizontal overflow on desktop Event, desktop Checkout, mobile Event, and mobile Checkout;
  - Event detail renders the LISA premium hero, 1 real actionable live band, 5 display-only price-context rows, Fan Access panel, and issue-flow panel;
  - Checkout renders receipt/reservation rail, issue preview, proof-safe marker, and order timeline;
  - `Authorize payment` advances to `Confirm and issue`, and `Confirm and issue` returns to the ticket drawer with a new local ticket;
  - all 13 sidebar destinations keep one fixed nav geometry (`169x28` per button on the 1680px QA viewport), one active item, uniform `rgba(255, 255, 255, 0.08)` active background, and no non-active background residue after click.
- `view_image` inspected the supplied concept reference plus the latest Event, Checkout select, Checkout confirm, mobile Event, and mobile Checkout screenshots.

**Remaining Polish**
- Event Detail and Checkout are more complete and safer, but exact 1:1 parity still needs finer first-viewport height tuning, hero crop matching, right ticket-stack typography, and checkout panel micro-spacing.
- Remaining web surfaces still need fuller ticket detail/proof-history states and more purpose-built secondary page details.
- `global.css` is still historically layered; continue moving feature-specific rules into scoped files before another major visual pass.

## 2026-06-08 Ticket Detail Proof History Pass

**Implementation Changes**
- Added `apps/web/src/components/TicketDetailView.tsx` as the first dedicated Ticket Detail / Entry Code / Proof & History web surface:
  - shows the premium LISA ticket hero, safe ticket reference, date, section, active entry readiness, and transfer/resale rules;
  - renders a code-native QR-like Entry Code preview with a clean quiet zone and short-lived countdown styling;
  - displays four contained Proof & History rows for verified issue, holder boundary, transfer history, and dynamic code window;
  - keeps raw payloads, nonces, signatures, owner IDs, access tokens, provider IDs, and full wallet references out of the UI.
- Added `apps/web/src/styles/ticket-detail.css` and imported it after the existing scoped fidelity layers, continuing the move away from broad `global.css` edits.
- Wired the new surface into `apps/web/src/App.tsx`:
  - Checkout confirmation now lands on Ticket Detail instead of stopping at the wallet drawer;
  - My Tickets / Wallet drawer cards can open Ticket Detail through `Open ticket detail`;
  - sidebar active state remains `My Tickets` while viewing the nested detail route.
- Fixed `ticketsForDrawer` in `apps/web/src/lib/viewHelpers.ts` so current-event tickets are shown with Active tickets first while preserving real API returned listed/transferred states. Fallback demo tickets are now sorted together with live tickets before the drawer slices to two cards.
- Preserved Web Beta Fallback boundaries. This is a web UI entry-code preview, not signed Apple Wallet, not physical QR/NFC evidence, not Web NFC, not chain custody proof, and not public/real-user release evidence.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB was not used for screenshots in this pass because previous local Browser screenshot attempts timed out; regular Playwright fallback was used for repeatable rendered QA.
- Local services used for QA:
  - Web: `http://localhost:5175/`
  - API: `http://localhost:4000/health`
- Desktop screenshots:
  - Tickets before detail: `/Users/tantalum/Documents/system and iot/apps/web/dist/ticket-detail-proof-pass/tickets-before-detail.png`
  - Ticket Detail: `/Users/tantalum/Documents/system and iot/apps/web/dist/ticket-detail-proof-pass/ticket-detail-desktop.png`
  - After list to Market: `/Users/tantalum/Documents/system and iot/apps/web/dist/ticket-detail-proof-pass/after-list-market.png`
  - Post-checkout Ticket Detail: `/Users/tantalum/Documents/system and iot/apps/web/dist/ticket-detail-proof-pass/post-checkout-ticket-detail.png`
- Mobile screenshot:
  - Ticket Detail at 390 x 844: `/Users/tantalum/Documents/system and iot/apps/web/dist/ticket-detail-proof-pass/ticket-detail-mobile.png`
- QA assertions passed:
  - zero console warnings/errors;
  - zero horizontal overflow on desktop Ticket Detail, after-list Market, post-checkout Ticket Detail, and mobile Ticket Detail;
  - Ticket Detail stayed under the `My Tickets` active nav state;
  - Entry Code rendered `Ready`, 121 QR-like cells, and safe copy stating payload, nonce, and signature stay hidden;
  - Proof & History rendered four contained rows;
  - no `ownerId`, `accessToken`, `client_secret`, or bearer-token-like text appeared in the rendered body;
  - `List for resale` was enabled for the active ticket and moved the user to the Market terminal;
  - Checkout `Authorize payment` -> `Confirm and issue` landed on Ticket Detail with Entry Code `Ready`.
- `view_image` inspected the supplied concept reference and the latest Ticket Detail desktop, post-checkout Ticket Detail, and mobile Ticket Detail screenshots.

**Remaining Polish**
- Ticket Detail is now a real core page, but it still needs API-backed dynamic QR refresh and proof-history reads in a later phase.
- The web QR-like preview remains code-native and redacted; it intentionally does not prove physical scanner, Core NFC, Apple Wallet, or chain custody gates.
- Exact 1:1 parity can still improve around proof row density, ticket hero cropping, and richer listed/redeemed/cancelled detail states.

## 2026-06-08 Sidebar Navigation Contract And View Frame Pass

**Implementation Changes**
- Stabilized `apps/web/src/components/AppHeader.tsx` so the left navigation labels no longer mutate after route changes:
  - removed the dynamic ticket-count badge from the `My Tickets` nav row so its visible text and accessible label remain exactly `My Tickets`;
  - added stable `data-testid="nav-..."` and `data-view="..."` attributes to every sidebar destination for reliable QA and future interaction tests;
  - kept `aria-label` equal to the visible label to avoid collisions with unrelated topbar controls such as `Saved events`.
- Added `product-view` as the shared root class for Discover, Market/Orderbook, Event Detail, Checkout, My Tickets/Wallet/Orders, Ticket Detail, and FeatureWorkspace pages.
- Added `apps/web/src/styles/view-frame.css` as the final page-frame layer after `navigation.css`:
  - unifies product-view width, panel radius, border tone, label tracking, active sidebar shadow, and page rhythm across the different concept surfaces;
  - keeps Market as an orderbook surface while preventing it from feeling like a separate app shell;
  - avoids adding another broad edit to the historically layered `global.css`.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB was used first for local navigation/DOM inspection, but `Page.captureScreenshot` timed out on the local tab. Regular Playwright fallback was used for repeatable screenshots.
- Local services used for QA:
  - Web: `http://localhost:5175/`
  - API: `http://localhost:4000/health`
- Desktop screenshots:
  - Initial/Home: `/tmp/fanpass-nav-qa-after/initial.png`
  - Market: `/tmp/fanpass-nav-qa-after/market.png`
  - My Tickets: `/tmp/fanpass-nav-qa-after/tickets.png`
  - Settings: `/tmp/fanpass-nav-qa-after/settings.png`
- QA assertions passed:
  - zero console warnings/errors;
  - all 13 sidebar destinations were clicked through stable `data-testid` selectors;
  - visible sidebar labels and `aria-label` values stayed fixed as `Home`, `For You`, `Events`, `Venues`, `Artists`, `Collections`, `My Tickets`, `Wallet`, `Orders`, `Market`, `Analytics`, `Alerts`, `Settings`;
  - every checked route rendered exactly one `.product-view`;
  - sidebar nav button geometry stayed fixed at `169x28`;
  - no horizontal overflow on Home, Market, My Tickets, Wallet, Orders, Events, Analytics, or Settings.
- `view_image` inspected latest Home, Market, My Tickets, and Settings screenshots.

**Remaining Polish**
- The route shells are now stable, but `global.css` still contains older concept-pass layers. Continue extracting Discover, Market, Pulse/Tickets, FeatureWorkspace, Event, Checkout, Ticket Detail, and navigation styles into scoped files before another large visual pass.
- Market, Tickets, and secondary feature pages are more unified, but exact 1:1 concept fidelity still needs deeper micro-spacing and content-density work.

## 2026-06-08 API-Backed Entry Credential And Navigation Stability Pass

**Implementation Changes**
- Added a fan/organizer/admin-safe `GET /tickets/:id/proof-history` API route backed by `TicketsService.getProofHistory`:
  - fans can only read their own ticket proof history;
  - organizers can read tickets for their own events;
  - admins can read all;
  - returned rows use safe ticket fragments and redacted descriptions only, with no raw holder, wallet, signing, scanner, credential, token, or provider identifiers.
- Wired web Ticket Detail to the API-backed entry credential path:
  - `POST /verification/tickets/:ticketId/qr` is called from the web only for backend ticket IDs;
  - React state stores only a safe credential reference, issue/expiry timestamps, and an irreversible seed for the code-native preview;
  - raw QR payload internals remain outside the web UI.
- Fixed ticket state consistency:
  - `Transferred` tickets now show entry code readiness and resale/listing affordances where the backend allows them;
  - the ticket drawer now prioritizes real API tickets before fallback demo tickets, so the first detail card opens the live API ticket when available.
- Tightened runtime navigation and page-frame consistency:
  - sidebar rows now use a fixed two-column icon/label grid with no unused badge column;
  - all 13 sidebar destinations keep stable visible labels, `data-testid` selectors, active styling, width, and height;
  - feature, pulse, terminal, event, checkout, and ticket-detail surfaces share a final `product-view` frame and neutral panel treatment in `apps/web/src/styles/view-frame.css`.

**Verification**
- `scripts/with-node-22.sh npm run test -w apps/api -- --runTestsByPath test/tickets.service.spec.ts test/route-security.spec.ts test/verification.service.spec.ts` passed: 3 suites / 11 tests.
- `scripts/with-node-22.sh npm run typecheck -w apps/api` passed.
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB was used for rendered QA against:
  - Web: `http://localhost:5175/`
  - API: `http://localhost:4000/health`
- Browser QA screenshots:
  - `/tmp/fanpass-nav-stability-browser.png`
  - `/tmp/fanpass-ticket-proof-browser.png`
  - `/tmp/fanpass-live-ticket-proof-browser.png`
  - `/tmp/fanpass-mobile-nav-browser.png`
- QA assertions passed:
  - page title was `FanPass Web | Verified tickets and resale`;
  - zero console warnings/errors in Browser/IAB;
  - all 13 sidebar destinations clicked via stable `data-testid` selectors;
  - every sidebar click produced exactly one active nav item;
  - sidebar labels remained `Home`, `For You`, `Events`, `Venues`, `Artists`, `Collections`, `My Tickets`, `Wallet`, `Orders`, `Market`, `Analytics`, `Alerts`, `Settings`;
  - desktop sidebar buttons stayed `169x28`, with fixed active background `rgba(255, 255, 255, 0.08)`;
  - mobile sidebar kept 13 entries, stable 34px row height, and did not overlap the search strip;
  - live API Ticket Detail rendered `Live API`, a short expiry window, redacted backend Proof & History rows, and active `My Tickets` sidebar state;
  - rendered Ticket Detail body did not expose raw owner/session/wallet/signature/nonce values.

**Remaining Polish**
- The API-backed web entry/proof path is now functional for demo tickets, but it is still web fallback evidence only. It does not close signed iOS/TestFlight, Apple Wallet `.pkpass`, physical QR/NFC, or chain-custody blockers.
- `global.css` remains historically layered. Continue moving Discover, Market, Pulse/Tickets, FeatureWorkspace, Event, Checkout, Ticket Detail, and navigation rules into scoped files before adding another major surface.
- Exact 1:1 visual parity still needs finer Ticket Detail/Event Detail/Checkout micro-spacing, richer listed/redeemed/cancelled states, and deeper secondary feature page design.

## 2026-06-08 API-Backed Resale Listing Composer Pass

**Implementation Changes**
- Added `apps/web/src/components/ResaleListingView.tsx` as a dedicated `List Ticket For Resale` seller flow instead of the previous one-click local listing shortcut:
  - shows event/ticket context, ticket status, listing price input, organizer resale cap, face value, service-fee estimate, estimated payout, and API-owned rule checks;
  - keeps `My Tickets` as the active sidebar parent while the nested listing route is open;
  - prevents above-cap submit in the web UI while still relying on the backend orderbook service for final ownership/status/cap validation.
- Added `apps/web/src/styles/resale-listing.css` and imported it after Ticket Detail styles, continuing the scoped CSS split instead of adding another broad `global.css` layer.
- Added `createDemoSellOrder` in `apps/web/src/services/fanpassApi.ts`:
  - reuses existing `POST /orders` with `side: "SELL"` and `ticketId`;
  - sends an idempotency key scoped to ticket and rounded price;
  - only calls the API for backend ticket IDs and falls back to local preview state for local demo tickets.
- Rewired Ticket Detail and Tickets/Wallet/Orders Sell actions to open the listing composer first.
- Mapped API orderbook results back into local web state:
  - open sell orders become `Listed` tickets plus a visible market listing;
  - immediately matched sell orders become confirmed sell orders without creating a stale listing row;
  - the Market/orderbook refreshes after listing and shows the new ask level.

**Verification**
- `scripts/with-node-22.sh npm run test -w apps/api -- --runTestsByPath test/orderbook.service.spec.ts test/route-security.spec.ts` passed: 2 suites / 6 tests.
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB was used for rendered QA against:
  - Web: `http://localhost:5175/`
  - API: `http://localhost:4000/health`
- Browser QA screenshots:
  - Desktop after API sell listing: `/tmp/fanpass-resale-listing-browser.png`
  - Mobile listing composer: `/tmp/fanpass-resale-listing-mobile-browser.png`
- QA assertions passed:
  - My Tickets -> Ticket Detail -> List for resale opened `product-view resale-listing-view`;
  - listing composer kept active sidebar parent `tickets`;
  - default suggested price rendered under the organizer cap;
  - changing price to `1480` and submitting called the API-backed sell order path;
  - Market rendered the new `HK$1,480` ask level and `Sell order open on API`;
  - rendered body did not expose raw owner/session/wallet/signature/nonce values;
  - zero Browser/IAB console warnings/errors;
  - mobile composer had no horizontal overflow at 390px viewport.
- `view_image` inspected the latest desktop Market result and mobile listing composer screenshots.

**Remaining Polish**
- The seller flow is now usable and API-backed for demo tickets, but cancel listing and buy-resale checkout still need a full web UI pass.
- Richer listed/redeemed/refunded/cancelled ticket-detail states should be added so the Ticket Detail page reflects every lifecycle state instead of only Active/Transferred/Listable.
- This remains Web Beta Fallback evidence only; it does not close signed iOS/TestFlight, Apple Wallet `.pkpass`, physical QR/NFC, or chain-custody blockers.

## 2026-06-08 Sidebar Route-Frame Stability Pass

**Implementation Changes**
- Stabilized `apps/web/src/components/AppHeader.tsx` navigation rows with a fixed marker/icon/label structure:
  - every item keeps the same visible label, `aria-label`, `data-testid`, and `data-view`;
  - active state now uses a left gradient marker instead of changing the whole row background or leaving a click/focus outline around the label;
  - the row keeps fixed width, height, padding, and grid columns across all sidebar destinations.
- Added `apps/web/src/styles/route-frame.css` and wrapped all app routes in `.route-frame`:
  - the search/filter strip and every `product-view` page now share one route-level width, margin, and spacing contract;
  - feature, pulse, terminal, event, checkout, ticket-detail, and listing surfaces can keep their internal layout without changing the outer app shell.
- Reordered style imports in `apps/web/src/main.tsx` so `view-frame.css`, `route-frame.css`, and `navigation.css` load after the older concept styles and act as the final runtime stability layer.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB was used against `http://localhost:5175/`.
- Desktop Browser QA clicked all 13 sidebar destinations:
  - labels stayed fixed as `Home`, `For You`, `Events`, `Venues`, `Artists`, `Collections`, `My Tickets`, `Wallet`, `Orders`, `Market`, `Analytics`, `Alerts`, `Settings`;
  - every click produced exactly one active item;
  - active rows stayed `169x28` with grid columns `3px 16px 120px`;
  - active rows had transparent background, no border, no box shadow, and marker opacity `1`;
  - every route rendered inside `.route-frame`;
  - no horizontal overflow and zero Browser/IAB console warnings/errors.
- Mobile Browser QA at `390x844` checked `discover`, `events`, `tickets`, `market`, and `settings`:
  - labels stayed fixed;
  - active item count stayed `1`;
  - nav row height stayed `34px`;
  - every checked route rendered inside `.route-frame`;
  - no horizontal page overflow and zero Browser/IAB console warnings/errors.
- Browser screenshots:
  - Desktop: `/tmp/fanpass-nav-stability-desktop-fixed.png`
  - Mobile: `/tmp/fanpass-nav-stability-mobile-fixed.png`
- `view_image` inspected both latest screenshots.

**Remaining Polish**
- The outer shell/nav regression is fixed, but `global.css` still contains historical concept-pass layers. Continue moving route-specific styling into scoped files before adding major new page families.
- Secondary feature pages are now shell-consistent, but still need deeper 1:1 concept-quality design for their internal content.

## 2026-06-08 Sidebar Contract And Cancel Listing Flow Pass

**Implementation Changes**
- Fixed `apps/web/src/components/AppHeader.tsx` so visible labels, route views, and QA selectors are separate stable fields:
  - `Home` still routes to `discover` but keeps `data-testid="nav-discover"`;
  - `For You` keeps `data-testid="nav-for-you"` instead of inheriting `nav-forYou`;
  - `My Tickets` keeps `data-testid="nav-my-tickets"` instead of inheriting `nav-tickets`;
  - `Market` keeps the existing market route while preserving the tested resale/market selector `data-testid="nav-listings"`.
- Added cancel-listing support to the web resale lifecycle:
  - `apps/web/src/services/fanpassApi.ts` now calls `POST /orders/:orderId/cancel` for backend order IDs and falls back safely for local demo IDs;
  - open sell orders retain `ticketId` in local state so cancellation can remove the market listing and restore the ticket from `Listed`;
  - `TerminalConcept` now shows `Your open listings` with compact `Cancel` controls in the wallet panel.
- Added `apps/web/src/styles/market.css` for the open-listings panel instead of expanding `global.css`.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `scripts/with-node-22.sh npm run test -w apps/api -- --runTestsByPath test/orderbook.service.spec.ts test/route-security.spec.ts` passed earlier in the same implementation pass: 2 suites / 6 tests.
- Browser/IAB desktop QA against `http://localhost:5175/` passed:
  - all 13 sidebar targets existed with the expected stable `data-testid` selectors;
  - labels stayed fixed as `Home`, `For You`, `Events`, `Venues`, `Artists`, `Collections`, `My Tickets`, `Wallet`, `Orders`, `Market`, `Analytics`, `Alerts`, `Settings`;
  - every route kept exactly one active nav item;
  - desktop rows stayed `169x28`;
  - active rows kept transparent background, no box shadow, and the left marker treatment;
  - every route rendered inside `.route-frame`;
  - no horizontal page overflow and zero Browser/IAB console warnings/errors.
- Browser/IAB resale QA passed:
  - My Tickets -> Sell opened `List your ticket`;
  - submitting the listing returned to Market and rendered `Your open listings`;
  - first cancel removed one local fallback listing and reduced visible cancel controls from 2 to 1;
  - second cancel called the API-backed path, removed the remaining open listing panel, and rendered `LISTING CANCELLED ON API`;
  - Market stayed active, `.route-frame` stayed present, no horizontal overflow occurred, and console warnings/errors stayed at zero.
- Browser screenshot evidence:
  - desktop Market after API cancel: captured in Browser/IAB and displayed in-chat during QA.

**Remaining Polish**
- Mobile nav labels and 34px row heights were confirmed in a 390px viewport, but later nav items live on the horizontal nav rail; this is acceptable for the current desktop sidebar bug but should get a deliberate mobile navigation pass before external review.
- Buy-resale checkout is covered by the later `Resale Checkout Buyer Flow Pass`; remaining work is payment/evidence hardening and richer lifecycle detail.
- Ticket Detail should render richer `Listed`, `Cancelled`, `Redeemed`, and `Refunded` lifecycle states.

## 2026-06-08 Resale Checkout Buyer Flow Pass

**Implementation Changes**
- Reworked the Market `Review order` flow so it opens a dedicated resale checkout review instead of immediately creating a buy order.
- Updated `TerminalConcept` so the buy panel's limit price uses the lowest available ask from the live/display orderbook, not the last trade price. This lets the demo buyer actually lift a resale listing when ask liquidity exists.
- Extended `CheckoutView` with a scoped resale mode:
  - copy changes from `Secure checkout` / `Issue pass` to `Secure resale checkout` / `Transfer pass`;
  - order summary changes to `Your resale order`;
  - receipt rail shows market price and cap context;
  - action status is rendered in a contained `checkout-api-status` row.
- Added `CheckoutIntent` state in `App.tsx` so primary checkout and resale checkout share the same component while keeping the active parent nav correct:
  - primary checkout remains under `Home` / event context;
  - resale checkout remains under `Market`.
- Added `confirmResaleOrder` in `App.tsx`:
  - creates a BUY order through the existing `POST /orders` adapter;
  - syncs API orders, tickets, and orderbook after confirmation;
  - removes the matched listing using typed `sellOrderId` / `ticketId` when a trade settles;
  - routes a successful matched resale purchase into Ticket Detail for the transferred ticket.
- Typed the web API `trade` response in `fanpassApi.ts` instead of leaving it as `unknown`.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `scripts/with-node-22.sh npm run test -w apps/api -- --runTestsByPath test/orderbook.service.spec.ts test/route-security.spec.ts` passed: 2 suites / 6 tests.
- Browser/IAB desktop QA against `http://localhost:5175/` passed:
  - Market active state stayed on `nav-listings`;
  - Market buy panel used a live ask limit price and showed no horizontal overflow;
  - `Review order` opened `data-checkout-mode="resale"`;
  - resale checkout rendered `Secure resale checkout`, `Your resale order`, `Transfer pass`, and `Ready to review resale order.`;
  - `Authorize payment` advanced to `Confirm resale order`;
  - `Confirm resale order` created the API BUY order, matched the available ask, synced tickets, and routed to Ticket Detail;
  - resulting Ticket Detail showed `Live API`, `Transferred`, and safe entry-code copy;
  - rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, or `client_secret`;
  - zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed:
  - resale checkout remained `data-checkout-mode="resale"`;
  - active nav parent stayed `nav-listings`;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Browser screenshot evidence was captured in-chat for:
  - desktop Ticket Detail after resale transfer;
  - mobile resale checkout surface.

**Remaining Polish**
- The buyer resale flow is now usable against the demo API, but it still uses test-mode/prototype payment semantics and does not claim production checkout readiness.
- Richer post-purchase proof rows for `TRADE_SETTLED`, seller payout state, and payment authorization state should be surfaced once the web payment evidence path is explicitly scoped.
- Ticket Detail still needs fuller `Cancelled`, `Redeemed`, `Refunded`, and open-buy-order states.

## 2026-06-08 Navigation Surface Decoupling Pass

**Implementation Changes**
- Removed the historical `discover-view` class from Market and Tickets-family route roots:
  - `TerminalConcept` now renders `product-view terminal-concept`;
  - `PulseConcept` now renders `product-view pulse-concept pulse-*`.
- Tightened `apps/web/src/styles/navigation.css` so route-level styles cannot change the sidebar active row:
  - active state is locked to transparent row background, no border, no box shadow, no outline, no transform;
  - the only active visual change is the contained left marker;
  - route-scoped selectors under `.app-shell[data-route]` now reinforce the same nav contract.
- Added a small route-frame guard for `pulse-concept` and `terminal-concept` so those pages share the same outer width/margin contract after removing `discover-view`.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` passed after reload:
  - all 13 sidebar destinations were clicked through stable `data-testid` selectors;
  - labels stayed fixed as `Home`, `For You`, `Events`, `Venues`, `Artists`, `Collections`, `My Tickets`, `Wallet`, `Orders`, `Market`, `Analytics`, `Alerts`, `Settings`;
  - every click produced exactly one active item;
  - active rows stayed `169x28`, transparent, borderless, shadowless, and marker-only;
  - route-frame and product-view widths matched on every checked route;
  - Market now reports `product-view terminal-concept` rather than `product-view discover-view terminal-concept`;
  - My Tickets, Wallet, and Orders now report `product-view pulse-concept ...` rather than inheriting `discover-view`;
  - no horizontal overflow and zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed for `Home`, `My Tickets`, `Wallet`, `Orders`, `Market`, and `Settings`:
  - labels stayed fixed;
  - every checked route kept exactly one active item;
  - active rows stayed transparent, shadowless, and marker-only;
  - no horizontal overflow and zero Browser/IAB console warnings/errors.
- Browser screenshot capture timed out twice with `Page.captureScreenshot` on the local tab after DOM/CSS QA had passed. No Playwright fallback screenshot was used because Browser/IAB remains the required local-browser path for this session.

**Remaining Polish**
- This fixes the navigation/sidebar surface leak and the page-root class contamination. It does not make the internal content of every route equally high-fidelity yet.
- `global.css` still contains historical concept-pass layers. Continue extracting Discover, Market, Pulse/Tickets, FeatureWorkspace, Event, Checkout, Ticket Detail, and navigation rules into scoped files before adding another major surface.

## 2026-06-08 Ticket Lifecycle Rendering Pass

**Implementation Changes**
- Added `apps/web/src/lib/ticketLifecycle.ts` as the typed lifecycle copy/rule helper for `Active`, `Transferred`, `Transfer Pending`, `Listed`, `Redeemed`, `Cancelled`, `Refunded`, and `Expired`.
- Expanded the web `UserTicket.status` type and updated the API status adapter so backend `REDEEMED` maps to `Redeemed` instead of the old `Used` display path.
- Wired lifecycle helpers through Ticket Detail and the Pulse ticket drawer:
  - entry QR refresh and resale actions are enabled only for `Active` / `Transferred`;
  - `Listed` tickets render entry-paused copy and disabled resale controls;
  - blocked or closed statuses get state-specific Proof & History, holder-boundary, drawer, and tone copy.
- Added status-specific CSS in `ticket-detail.css` and `pulse.css` using `data-ticket-status`, keeping raw credential, owner, nonce, signature, wallet, and provider internals out of the UI.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB desktop QA used a real local API listing flow:
  - My Tickets -> transferred Ticket Detail -> List for resale -> List ticket -> Market;
  - Market rendered the API-backed open listing;
  - My Tickets then showed drawer ticket statuses `Transferred` and `Listed`;
  - opening the listed ticket rendered `data-ticket-status="listed"`, `Paused while listed`, disabled `Refresh code`, disabled `Resale closed`, and listed-state proof copy;
  - rendered DOM did not expose `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, or `client_secret`;
  - no horizontal overflow and zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` opened the listed Ticket Detail and passed with active `My Tickets` nav, no horizontal overflow, disabled entry refresh, disabled resale, and zero console warnings/errors.
- Browser screenshot capture again timed out with `Page.captureScreenshot`; this pass is documented with DOM/CSS/interaction evidence.

**Remaining Polish**
- Production-like fixtures or API test hooks are still needed for rendered QA of `Transfer Pending`, `Redeemed`, `Cancelled`, `Refunded`, and `Expired`.
- Trade settlement, seller payout, and payment authorization proof rows still need richer fan-readable presentation once payment-state evidence is explicitly scoped.

## 2026-06-08 Sidebar And Secondary Surface Consistency Pass

**Implementation Changes**
- Added `apps/web/src/styles/feature-workspace.css` as the scoped final style layer for secondary routes (`For You`, `Events`, `Venues`, `Artists`, `Collections`, `Analytics`, `Alerts`, and `Settings`) instead of adding another broad `global.css` guard.
- Moved `feature-workspace.css` to load after `view-frame.css` / `route-frame.css` and before `navigation.css`, so secondary pages share the same premium app surface while navigation remains the final cascade guard.
- Removed the lingering `view-frame.css` active-nav inset shadow and moved nav containment/pointer-event rules into `navigation.css`, making `navigation.css` the single final owner for sidebar row geometry and marker-only active state.
- Secondary pages now share one compact route shell:
  - `10px` grid rhythm;
  - dark `8px` panels;
  - compact Inter headings;
  - three-column desktop workspace;
  - single-column mobile workspace.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` clicked all 13 sidebar destinations:
  - labels remained fixed as `Home`, `For You`, `Events`, `Venues`, `Artists`, `Collections`, `My Tickets`, `Wallet`, `Orders`, `Market`, `Analytics`, `Alerts`, `Settings`;
  - each route had exactly one active nav row;
  - active rows stayed transparent, shadowless, transform-free, marker-only, and `169x28`;
  - `.route-frame` and `product-view` widths matched at `1023px`;
  - secondary routes rendered `feature-workspace` with `10px` gap, `8px` panels, and `623px 390px` masthead / three-column content grids;
  - no horizontal overflow and zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` checked Home, Events, My Tickets, Market, Analytics, and Settings:
  - labels stayed fixed;
  - active rows stayed transparent/shadowless/transform-free;
  - route/product width stayed `354px`;
  - secondary routes collapsed to single-column grids;
  - no horizontal overflow and zero Browser/IAB console warnings/errors.
- Browser screenshot capture still failed with `Page.captureScreenshot` timeout after DOM/CSS/interaction QA passed.

**Remaining Polish**
- The shell and secondary-route treatment are now consistent, but the internal content model for each secondary route can still be made more specific and closer to a full product concept.
- `global.css` still contains historical concept-pass layers. Continue extracting Discover, Market, Pulse/Tickets, Event, Checkout, Ticket Detail, and remaining legacy navigation rules into scoped files.

## 2026-06-08 Order Settlement Proof Presentation Pass

**Implementation Changes**
- Added `apps/web/src/lib/orderPresentation.ts` as the typed presentation helper for safe order references, payment state, settlement state, proof state, tone, and three-step order progress.
- Expanded the web `UserOrder.status` union and API adapter to safely map `Authorized`, `Failed`, `Expired`, and `Refunded` display states without rendering raw backend status strings in components.
- Wired related orders into `TicketDetailView` through `relatedOrderForTicket`:
  - Ticket Detail now shows an `Order settlement` panel with safe `ORD-******` reference, payment state, settlement state, and three contained progress rows;
  - Proof & History now appends `Order`, `Payment state`, and `Trade outcome` rows when a related order exists.
- Updated `PulseConcept` / Orders surfaces:
  - activity rows now include safe order references plus payment and settlement labels;
  - the right order card now has an `order-settlement-card` and order-presentation-driven timeline.
- Added scoped CSS in `ticket-detail.css` and `pulse.css` for order tones (`ready`, `pending`, `listed`, `settled`, `blocked`) without adding another broad `global.css` guard.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` passed:
  - page identity and nonblank app shell verified;
  - My Tickets -> Open ticket detail rendered `Order settlement`;
  - Ticket Detail Proof & History contained `Payment state` and `Trade outcome`;
  - order panel rendered three contained order steps with `7px` radius and no horizontal overflow;
  - Orders page rendered safe `ORD-******` reference, `Payment`, `Settlement`, and the three-step timeline;
  - active nav stayed `nav-orders` on Orders;
  - rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, or `client_secret`;
  - zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed:
  - Ticket Detail collapsed to a single `354px` grid column;
  - order panel remained present;
  - final Proof & History rows were `Listing cancelled`, `Payment state`, and `Trade outcome`;
  - Orders page rendered the settlement card and timeline with active `nav-orders`;
  - no horizontal overflow and zero Browser/IAB console warnings/errors.
- Browser screenshot capture succeeded for the desktop Orders settlement proof state and was displayed in-chat during QA.

**Remaining Polish**
- This is still safe presentation over demo/test-mode order state, not production payment readiness.
- Deeper payment evidence can add explicit webhook/capture/refund provenance once a web payment evidence path is scoped.
- Production-like fixtures are still needed for rendered QA of `Authorized`, `Failed`, `Expired`, and `Refunded` order states plus `Transfer Pending`, `Redeemed`, `Cancelled`, `Refunded`, and `Expired` ticket states.

## 2026-06-08 Pulse Workspace Fidelity Pass

**Implementation Changes**
- Reworked `apps/web/src/components/PulseConcept.tsx` so `My Tickets`, `Wallet`, and `Orders` no longer reuse the Home-style `Popular This Week` recommendation lead.
- Added page-specific workspace framing:
  - `My Tickets` renders `Your verified ticket control room`;
  - `Wallet` renders `Passes, proof, and resale controls`;
  - `Orders` renders `Payment and settlement ledger`.
- Added a concept-style command hero, pass/order ledger rows, and compact event context strip while preserving the existing ticket drawer and order settlement card.
- Kept order/ticket state derived from existing typed helpers (`ticketLifecycle.ts` and `orderPresentation.ts`), with no backend contract or provider-boundary changes.
- Added scoped styling in `apps/web/src/styles/pulse.css` for the command deck, hero, ledger rows, tone borders, and mobile collapse.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed after the final CSS change.
- Browser/IAB desktop QA against `http://localhost:5175/` passed for `My Tickets`, `Wallet`, and `Orders`:
  - old `Popular This Week` headings were absent from all three Pulse surfaces;
  - `My Tickets` rendered a `403x278` command hero and `403x192` pass ledger;
  - `Wallet` rendered its page-specific workspace title and pass ledger;
  - `Orders` rendered three safe order ledger rows with `ORD-******` refs and payment/settlement labels;
  - active nav labels stayed stable, no horizontal overflow, no console warnings/errors, and no rendered `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, or `client_secret`.
- Browser/IAB mobile QA at `390x844` passed for `My Tickets`, `Wallet`, and `Orders`:
  - product, drawer, and order-card widths were `354px`;
  - command hero rendered `354x232`;
  - old `Popular This Week` headings were absent;
  - no horizontal overflow and zero console warnings/errors.
- Browser screenshot capture succeeded for the desktop Orders workspace and was displayed in-chat during QA.

**Remaining Polish**
- The Pulse pages now have route-specific product intent, but exact 1:1 parity still needs tighter drawer/card typography, richer poster variety, and more realistic non-happy lifecycle fixtures.
- Continue avoiding broad `global.css` additions; future Pulse polish should stay in `pulse.css` or smaller route-owned files.

## 2026-06-08 Lifecycle Coverage Fixture Pass

**Implementation Changes**
- Added a Settings-only lifecycle coverage panel in `apps/web/src/components/FeatureWorkspace.tsx` for rendered QA of non-happy ticket and order states without changing backend contracts or live app data.
- Reused the existing typed helpers instead of ad hoc strings:
  - ticket copy and action eligibility come from `apps/web/src/lib/ticketLifecycle.ts`;
  - order refs, payment state, settlement state, proof state, tone, and progress come from `apps/web/src/lib/orderPresentation.ts`.
- Covered ticket states `Transfer Pending`, `Redeemed`, `Cancelled`, `Refunded`, and `Expired`.
- Covered order states `Authorized`, `Failed`, `Expired`, and `Refunded`, using stable safe refs such as `ORD-AUTH01`, `ORD-FAIL01`, `ORD-EXPR01`, and `ORD-RFND01`.
- Added scoped CSS in `apps/web/src/styles/feature-workspace.css` for the lifecycle grid, compact state rows, tone borders, and mobile single-column collapse.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` passed on Settings:
  - `data-testid="state-fixture-panel"` rendered;
  - all five ticket fixtures and all four order fixtures rendered;
  - desktop grid rendered as two columns;
  - safe order refs rendered without raw provider/payment identifiers;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed on Settings:
  - lifecycle panel width stayed within the `354px` product frame;
  - grid collapsed to one column;
  - all nine state rows remained within the panel;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`.

**Remaining Polish**
- This is presentation/QA coverage only. It does not claim production payment readiness or replace API/backend state-transition tests.
- Next product fidelity work should continue on Ticket Detail, Checkout, List Ticket, and deeper webhook/capture/refund provenance presentation rather than reopening accepted navigation work.

## 2026-06-08 Order Provenance Presentation Pass

**Implementation Changes**
- Extended `apps/web/src/lib/orderPresentation.ts` with typed safe provenance rows for each visible order status.
- Ticket Detail now renders a `ticket-order-provenance` rail inside `Order settlement`, covering payment signal, capture/refund/listing decision, and wallet outcome.
- Orders now renders the same provenance model inside the `order-settlement-card` via `order-provenance-list`.
- Added scoped styling in `apps/web/src/styles/ticket-detail.css` and `apps/web/src/styles/pulse.css` for provenance row density, state borders, and mobile-safe wrapping.
- Kept the boundary explicit: the provenance rail is display-safe status presentation over current web order state, not source-backed webhook/capture/refund evidence and not production payment readiness.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB desktop QA passed:
  - Ticket Detail rendered three `ticket-order-provenance` rows inside a `360px` order panel;
  - Orders rendered three `order-provenance-list` rows inside the order settlement card;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed:
  - Ticket Detail product width stayed `354px`, order panel width stayed `354px`, and provenance rows stayed within `316px`;
  - Orders product width stayed `354px`, order card width stayed `328px`, and provenance rows stayed within `302px`;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`.

**Remaining Polish**
- A later evidence pass can replace or augment the safe provenance labels with source-backed webhook/capture/refund evidence once the web payment evidence path is explicitly scoped and has validators.
- Continue product micro-fidelity on Ticket Detail, Checkout, List Ticket, and secondary pages without reopening accepted navigation work.

## 2026-06-08 List Ticket Fidelity Pass

**Implementation Changes**
- Tightened `apps/web/src/components/ResaleListingView.tsx` toward the supplied concept's market/order-panel density without changing the sell-order API contract.
- Added selectable seller price bands:
  - `Face value`;
  - `Suggested`;
  - `Organizer cap`.
- Added richer seller context:
  - face-value delta;
  - cap-room metric;
  - three-step execution path for ownership check, price guard, and entry pause;
  - extra rule rows for market posture and cancel-while-open seller control.
- Kept the implementation scoped to `apps/web/src/styles/resale-listing.css`, preserving route-level frame/nav contracts and avoiding more `global.css` layering.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` passed:
  - page identity matched `FanPass Web | Verified tickets and resale`;
  - app snapshot contained meaningful FanPass content and no framework overlay;
  - flow tested: `My Tickets` -> `Open ticket detail` -> `List for resale`;
  - List Ticket rendered three price context buttons, three execution rows, six rule rows, and the existing status line;
  - selecting `Organizer cap` updated `#listing-price` to the cap value and kept `aria-invalid="false"`;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed:
  - product and grid width stayed `354px`;
  - price context collapsed to one `316px` column;
  - action buttons, execution rows, and price-context buttons stayed `316px`;
  - all six rule rows rendered;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`.
- Browser screenshot capture timed out twice with `Page.captureScreenshot`, including a clipped retry. DOM/CSS/interaction/console evidence passed.

**Remaining Polish**
- List Ticket is now denser and closer to the concept's right-side execution panels, but exact micro-spacing and visual screenshot evidence still need a successful screenshot path.
- Next non-navigation work should move to Ticket Detail, Checkout, Event Detail, or secondary page specificity rather than repeating the same seller price-context pass.

## 2026-06-08 Checkout Control Strip Pass

**Implementation Changes**
- Tightened `apps/web/src/components/CheckoutView.tsx` toward the supplied concept's right-side order/control panels without changing the checkout API or payment boundary.
- Added `data-testid="checkout-control-strip"` with four safe cards:
  - `Order ref`;
  - `Price guard`;
  - `Payment`;
  - `Wallet outcome`.
- Added a `Checkout settlement ledger` inside the order summary with three rows:
  - `Authorization`;
  - `Issue decision` for primary checkout or `Transfer decision` for resale checkout;
  - `Refund path`.
- Kept all new copy provider-safe: the UI names server-owned payment state and safe session references, but never renders client secrets, provider ids, wallet addresses, signatures, nonces, access tokens, or PaymentIntent internals.
- Added scoped responsive styling in `apps/web/src/styles/event-checkout.css` for the control strip and settlement ledger, including single-column mobile collapse.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `git diff --check -- apps/web/src/components/CheckoutView.tsx apps/web/src/styles/event-checkout.css` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` passed for primary checkout:
  - flow tested: Discover -> Event Detail -> Checkout;
  - `data-checkout-mode="primary"` rendered;
  - four control rows rendered;
  - three settlement rows rendered;
  - post-authorization state changed `Payment` from `Pending` to `Authorized` and `Authorization` from `Waiting` to `Held`;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Browser/IAB desktop QA passed for resale checkout:
  - flow tested: Market -> Review order -> resale Checkout;
  - `data-checkout-mode="resale"` rendered;
  - four control rows rendered;
  - three settlement rows rendered;
  - resale ledger used `Transfer decision` copy;
  - the over-cap market input rendered `Price guard / Blocked` instead of hiding the cap issue;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed for both primary and resale checkout:
  - product width stayed `354px`;
  - control strip and ledger width stayed `316px`;
  - all four control cards collapsed into a single column;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`.
- Browser screenshot capture succeeded for the mobile checkout viewport and was displayed in-chat during QA.

**Remaining Polish**
- Checkout now has a concept-style safe control/settlement layer. Future Checkout work should be fine visual micro-spacing only unless a real QA regression appears.
- Source-backed webhook/capture/refund evidence remains a separate scoped evidence task and should not be implied by this UI presentation pass.

## 2026-06-08 Event Detail Decision Layer Pass

**Implementation Changes**
- Tightened `apps/web/src/components/EventView.tsx` toward the supplied concept's premium ticket-selection and market-decision language without changing backend contracts.
- Added `data-testid="event-control-strip"` with four safe cards:
  - `Verified supply`;
  - `Market floor`;
  - `Cap room`;
  - `Transfer window`.
- Added a code-native `Price intelligence` rail that maps the existing display seat bands into horizontal price bars and keeps the organizer cap visible.
- Added an `Access ledger` with primary access, resale guard, and checkout-boundary rows.
- Kept the implementation scoped to `apps/web/src/styles/event-checkout.css` and reused existing `WebEvent`, `TicketType`, `MarketListing`, and `viewHelpers` data rather than adding duplicated state or provider-specific strings.
- The new layer is safe presentation over event/ticket/listing state only. It does not claim source-backed payment, identity, wallet, or chain evidence.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `git diff --check -- apps/web/src/components/EventView.tsx apps/web/src/styles/event-checkout.css` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` passed:
  - flow tested: Home -> Get Tickets -> Event Detail;
  - page title was `FanPass Web | Verified tickets and resale`;
  - `h1` rendered `LISA`;
  - four event-control rows rendered;
  - five price-intelligence rows rendered;
  - three access-ledger rows rendered;
  - one active ticket tier rendered;
  - no framework overlay;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Browser/IAB interaction QA passed:
  - `View orderbook` on Event Detail routed into the Market destination;
  - the Market nav item became active with no horizontal overflow and zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed:
  - product width stayed `354px`;
  - hero, control strip, price intelligence, and access ledger widths stayed `354px`;
  - control cards stayed `332px`;
  - price-intelligence and access-ledger rows stayed `316px`;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`.
- Browser screenshot evidence was captured and inspected:
  - `/tmp/fanpass-event-detail-mobile-lower-20260608.png`;
  - `/tmp/fanpass-event-detail-mobile-control-20260608.png`;
  - `/tmp/fanpass-event-detail-mobile-ledger-20260608.png`.
- `view_image` inspected the accepted concept reference and the mobile control/ledger implementation screenshots. No text overflow or visible mobile-width regression was found in the inspected areas.

**Remaining Polish**
- Event Detail now has the concept-style decision layer. Future Event Detail work should be fine micro-spacing, image crop, or source-backed evidence only if explicitly scoped.
- The best next web fidelity target is Ticket Detail or remaining secondary feature-page specificity, not repeating Event Detail control/radar/ledger work.

## 2026-06-08 Ticket Detail Control Strip Pass

**Implementation Changes**
- Tightened `apps/web/src/components/TicketDetailView.tsx` toward the supplied ticket wallet/order concept without changing backend, credential, listing, or payment contracts.
- Added `data-testid="ticket-control-strip"` with four safe cards:
  - `Holder state`;
  - `Entry window`;
  - `Resale guard`;
  - `Order ref`.
- Added a `Ticket custody ledger` with three safe rows:
  - `Credential boundary`;
  - `Lifecycle action`;
  - `Evidence scope`.
- Kept the implementation scoped to `apps/web/src/styles/ticket-detail.css`, reusing `ticketLifecycle.ts`, `orderPresentation.ts`, existing `UserTicket`, `TicketType`, `UserOrder`, proof-history, and entry-credential summary data rather than adding duplicated state.
- The new layer is safe presentation over current ticket/lifecycle/order state only. It does not claim source-backed credential, payment, wallet, or chain evidence.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `git diff --check -- apps/web/src/components/TicketDetailView.tsx apps/web/src/styles/ticket-detail.css` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` passed:
  - flow tested: `My Tickets` -> `Open ticket detail`;
  - four ticket-control cards rendered;
  - three custody-ledger rows rendered;
  - entry code frame rendered with 121 QR-like preview cells;
  - three safe order-provenance rows and seven Proof & History rows rendered;
  - `Refresh code` stayed enabled and refreshed without console warnings/errors;
  - `View market` routed into Market with `nav-listings` active;
  - no framework overlay;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed:
  - product width stayed `354px`;
  - control strip width stayed `354px`;
  - four control cards stayed `332px`;
  - custody ledger width stayed `354px`;
  - custody rows stayed `316px`;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`.
- Browser screenshot evidence was captured and inspected:
  - `/tmp/fanpass-ticket-detail-mobile-control-20260608.png`;
  - `/tmp/fanpass-ticket-detail-mobile-custody-ledger-20260608.png`.
- `view_image` inspected the accepted concept reference and the mobile control/custody implementation screenshots. No text overflow or visible mobile-width regression was found in the inspected areas.

**Remaining Polish**
- Ticket Detail now has the concept-style control/custody layer. Future Ticket Detail work should be fine micro-spacing only unless QA finds a real regression.
- The best next web fidelity target is secondary feature-page specificity and maintainability cleanup, not repeating Ticket Detail control/custody work.

## 2026-06-08 Secondary Feature Command Workspace Pass

**Implementation Changes**
- Tightened `apps/web/src/components/FeatureWorkspace.tsx` toward the supplied terminal/workspace concept without changing route contracts, backend data, navigation, or provider boundaries.
- Added icon-led masthead treatment using the existing route config icon instead of keeping the secondary pages as text-only generic panels.
- Added `data-testid="feature-command-strip"` with four safe command cards over current app state:
  - `Surface mode`;
  - route-specific live/signal card;
  - route-specific ticket/market/preference card;
  - `Safety boundary`.
- Added `data-testid="feature-evidence-rail"` with three safe rows derived from existing events, tickets, orders, listings, `ticketLifecycle.ts`, and `orderPresentation.ts`.
- Kept the implementation scoped to `apps/web/src/styles/feature-workspace.css`, preserving route-owned CSS and avoiding new `global.css` layering.
- The new layer is safe presentation over current app state only. It does not claim source-backed payment, credential, wallet, provider, or chain evidence.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `git diff --check -- apps/web/src/components/FeatureWorkspace.tsx apps/web/src/styles/feature-workspace.css` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` passed for `Events`, `Analytics`, and `Settings`:
  - each route rendered four command cards;
  - each route rendered three evidence rows;
  - each route rendered one icon badge;
  - active nav labels stayed stable;
  - no framework overlay;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed for `Events`, `Analytics`, and `Settings`:
  - product width stayed `354px`;
  - command strip width stayed `354px`;
  - command cards stayed `332px`;
  - evidence rail stayed `326px`;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`.
- Browser screenshot evidence was captured and inspected:
  - `/tmp/fanpass-secondary-analytics-command-20260608.png`;
  - `/tmp/fanpass-secondary-settings-command-20260608.png`.
- `view_image` inspected the accepted concept reference and the latest desktop/mobile secondary implementation screenshots. No text overflow or visible mobile-width regression was found in the inspected areas.

**Remaining Polish**
- The secondary routes now read more like product workspaces, but Venues, Artists, Collections, and Alerts still share some generic row anatomy. Future secondary work should add deeper route-specific rows/modules rather than repeating the command strip.
- Continue moving feature-specific styles into route-owned files and avoid broad `global.css` additions.

## 2026-06-08 Secondary Feature Route Depth Pass

**Implementation Changes**
- Tightened `apps/web/src/components/FeatureWorkspace.tsx` so Venues, Artists, Collections, and Alerts no longer rely only on the generic command/evidence shell.
- Added typed `data-testid="feature-depth-panel"` rendering with route-specific `data-feature-depth-kind` values:
  - `venues`: city and venue readiness rows, show count, next event, floor price, and QR-review web boundary;
  - `artists`: demand ladder rows over current event/category/date context;
  - `collections`: editorial, under-cap resale, and wallet-ready shelf composition;
  - `alerts`: price, supply, wallet, and order rule stack.
- Kept all depth copy and state derived from existing events, tickets, orders, listings, `ticketLifecycle.ts`, `orderPresentation.ts`, and `viewHelpers` rather than adding provider-specific or raw identifier data.
- Added scoped responsive styling in `apps/web/src/styles/feature-workspace.css` for depth headers, route rows, compact evidence cards, desktop grids, tablet collapse, and mobile single-column rows.
- The new depth layer is safe product presentation only. It does not claim source-backed payment, credential, wallet, provider, native scanner, or chain evidence.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `git diff --check -- apps/web/src/components/FeatureWorkspace.tsx apps/web/src/styles/feature-workspace.css` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` passed for `Venues`, `Artists`, `Collections`, and `Alerts`:
  - each route rendered one `feature-depth-panel`;
  - `data-feature-depth-kind` matched the active route;
  - Venues, Artists, and Alerts rendered four depth rows; Collections rendered three depth rows;
  - each route rendered three depth cards, four command cards, and three evidence rows;
  - each route had exactly one active primary nav item;
  - `.route-frame` was present;
  - no framework overlay;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Browser/IAB interaction QA passed:
  - clicking the first Venues depth row opened Event Detail;
  - the resulting product root was `product-view event-view event-detail-concept`;
  - `h1` rendered `LISA`;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed for `Venues`, `Artists`, `Collections`, and `Alerts`:
  - product width stayed `354px`;
  - depth panel width stayed `354px`;
  - depth row width stayed `336px`;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`.
- Browser screenshot evidence was captured and inspected:
  - `/tmp/fanpass-secondary-venues-depth-20260608.png`;
  - `/tmp/fanpass-secondary-alerts-depth-mobile-20260608.png`;
  - `/tmp/fanpass-secondary-alerts-depth-panel-mobile-20260608-2.png`;
  - `/tmp/fanpass-secondary-alerts-depth-full-mobile-20260608.png`.
- `view_image` inspected the accepted concept reference and the latest desktop/mobile secondary depth screenshots. No text overflow or visible mobile-width regression was found in the inspected depth areas.

**Remaining Polish**
- Venues, Artists, Collections, and Alerts now have route-specific depth. Do not repeat this pass unless QA finds a regression.
- Future secondary work should focus on maintainability, such as extracting the growing depth model helpers if `FeatureWorkspace.tsx` becomes harder to review, or on truly new product-specific modules for routes that still need them.

## 2026-06-08 Secondary Feature Depth Maintainability Split

**Implementation Changes**
- Split the accepted Venues, Artists, Collections, and Alerts route-depth logic out of `apps/web/src/components/FeatureWorkspace.tsx` without changing route contracts, backend reads, navigation behavior, or provider boundaries.
- Added `apps/web/src/lib/featureDepthModel.ts` for typed depth model construction from existing events, tickets, orders, listings, `ticketLifecycle.ts`, `orderPresentation.ts`, and `viewHelpers`.
- Added `apps/web/src/components/FeatureDepthPanel.tsx` as the pure renderer for `data-testid="feature-depth-panel"` rows/cards and existing row-to-event navigation.
- Reduced `FeatureWorkspace.tsx` from 1054 lines to 764 lines so future secondary route work has a smaller review surface.
- The refactor preserves the existing safe presentation boundary: no provider, payment, credential, wallet, raw owner, signing, nonce, access-token, or PaymentIntent internals are rendered.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `git diff --check -- apps/web/src/components/FeatureWorkspace.tsx apps/web/src/components/FeatureDepthPanel.tsx apps/web/src/lib/featureDepthModel.ts` passed.
- Browser/IAB was attempted against `http://localhost:5175/` and `http://127.0.0.1:5175/`, but both navigations failed with `net::ERR_BLOCKED_BY_CLIENT`.
- Local Playwright fallback QA against the running Vite app at `http://127.0.0.1:5175/` passed for desktop Venues and Alerts plus mobile Alerts:
  - Venues rendered `data-feature-depth-kind="venues"`, four depth rows, three depth cards, four command cards, three evidence rows, one active `Venues` nav label, matching `1471px` product/depth widths, no overflow, no overlay, and no forbidden provider/credential/payment strings.
  - Alerts rendered `data-feature-depth-kind="alerts"`, four depth rows, three depth cards, four command cards, three evidence rows, one active `Alerts` nav label, matching `1471px` product/depth widths, no overflow, no overlay, and no forbidden provider/credential/payment strings.
  - Mobile Alerts at `390x844` rendered `354px` product/depth widths, `336px` depth rows, one active `Alerts` nav label, and no horizontal overflow.
- Console resource errors were limited to `net::ERR_CONNECTION_REFUSED` for API requests because the API server was not running on port 4000; the web app rendered through its existing demo fallback.
- Screenshot evidence was captured and inspected:
  - `/tmp/fanpass-secondary-depth-refactor-venues-20260608.png`;
  - `/tmp/fanpass-secondary-depth-refactor-alerts-mobile-20260608.png`.
- Playwright JSON details were saved at `/tmp/fanpass-secondary-depth-refactor-qa-20260608.json`.

**Remaining Polish**
- Route-depth extraction is complete for Venues, Artists, Collections, and Alerts. Do not repeat this split unless QA finds a regression.
- Future maintainability work should target other growing surfaces, such as command/evidence helper extraction or scoped CSS cleanup.

## 2026-06-08 Secondary Feature Shell Model Extraction

**Implementation Changes**
- Split the remaining secondary feature shell model logic out of `apps/web/src/components/FeatureWorkspace.tsx` without changing route contracts, backend data, navigation behavior, scoped CSS, or rendered product behavior.
- Added `apps/web/src/lib/featureWorkspaceModel.ts` for:
  - route config and icon/action/copy metadata;
  - route row model construction;
  - `feature-command-strip` card models;
  - `feature-evidence-rail` row models.
- Kept `FeatureWorkspace.tsx` focused on rendering, navigation callbacks, and the Settings-only lifecycle fixture panel.
- `FeatureWorkspace.tsx` decreased from 764 lines to 320 lines after this pass. Together with the prior route-depth extraction, secondary feature rendering/model ownership is now split across `FeatureWorkspace.tsx`, `FeatureDepthPanel.tsx`, `featureDepthModel.ts`, and `featureWorkspaceModel.ts`.
- The extraction preserves the existing safe presentation boundary. No provider, payment, credential, wallet, raw owner, signing, nonce, access-token, or PaymentIntent internals are rendered.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `git diff --check -- apps/web/src/components/FeatureWorkspace.tsx apps/web/src/lib/featureWorkspaceModel.ts apps/web/src/lib/featureDepthModel.ts apps/web/src/components/FeatureDepthPanel.tsx` passed.
- Browser/IAB QA against `http://127.0.0.1:5175/` passed on desktop:
  - Events rendered four command cards, three evidence rows, one active `Events` nav label, `1471px` product/command widths, no overflow, no overlay, and no forbidden provider/credential/payment strings.
  - Analytics rendered four command cards, three evidence rows, one active `Analytics` nav label, `1471px` product/command widths, no overflow, no overlay, and no forbidden provider/credential/payment strings.
  - Settings rendered four command cards, three evidence rows, one active `Settings` nav label, `1471px` product/command widths, no overflow, no overlay, and no forbidden provider/credential/payment strings.
  - Alerts was rechecked through scoped Primary navigation because a top quick-action button also uses the label `Alerts`; it rendered four command cards, three evidence rows, `data-feature-depth-kind="alerts"`, four depth rows, three depth cards, one active nav label, no overflow, and no forbidden strings.
  - Venues rendered `data-feature-depth-kind="venues"`, four depth rows, three depth cards, one active nav label, no overflow, and no forbidden strings.
- Browser/IAB mobile QA at `390x844` passed:
  - Settings rendered `354px` product width, `354px` command width, `326px` evidence width, nine lifecycle fixture rows, one active `Settings` nav label, no overflow, and zero console warnings/errors.
  - Alerts rendered `354px` product/command/depth widths, `326px` evidence width, four `336px` depth rows, three depth cards, one active `Alerts` nav label, no overflow, and zero console warnings/errors.
- Browser/IAB console logs after QA were empty for warnings/errors.
- Screenshot evidence was captured and displayed:
  - `/tmp/fanpass-secondary-model-refactor-analytics-20260608.png`;
  - `/tmp/fanpass-secondary-model-refactor-alerts-mobile-20260608.png`.

**Remaining Polish**
- Command/evidence/rows/config extraction is complete. Do not repeat this split unless QA finds a regression.
- Future secondary maintainability should focus on scoped CSS reduction or genuinely new source-backed route data, not moving the same model code again.

## 2026-06-08 Secondary Feature CSS Ownership Split

**Implementation Changes**
- Split secondary feature CSS ownership to match the component/model split without changing DOM, route contracts, backend reads, navigation behavior, or provider boundaries.
- Added `apps/web/src/styles/feature-depth.css` for `FeatureDepthPanel` styling and responsive behavior across Venues, Artists, Collections, and Alerts.
- Added `apps/web/src/styles/feature-lifecycle.css` for the Settings-only lifecycle fixture panel and state-row tone styling.
- Kept `apps/web/src/styles/feature-workspace.css` as the secondary shell stylesheet for masthead, command strip, canvas grid, system flow, evidence rail, spotlight/list/action panels, and general responsive workspace layout.
- Updated `apps/web/src/main.tsx` to import the new scoped CSS files after `feature-workspace.css`.
- `feature-workspace.css` decreased from 747 lines to 427 lines; the split files are 235 lines for depth and 131 lines for lifecycle.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `git diff --check -- apps/web/src/main.tsx apps/web/src/styles/feature-workspace.css apps/web/src/styles/feature-depth.css apps/web/src/styles/feature-lifecycle.css` passed.
- Browser/IAB QA against `http://127.0.0.1:5175/` passed on desktop:
  - Venues rendered four command cards, three evidence rows, `data-feature-depth-kind="venues"`, four depth rows, three depth cards, one active `Venues` nav label, no overflow, no overlay, zero console warnings/errors, and no forbidden provider/credential/payment strings.
  - Alerts rendered four command cards, three evidence rows, `data-feature-depth-kind="alerts"`, four depth rows, three depth cards, one active `Alerts` nav label, no overflow, no overlay, zero console warnings/errors, and no forbidden strings.
  - Settings rendered four command cards, three evidence rows, nine lifecycle fixture rows, one active `Settings` nav label, no overflow, no overlay, zero console warnings/errors, and no forbidden strings.
- Browser/IAB mobile QA at `390x844` passed:
  - Alerts rendered `354px` product/command/depth widths, `326px` evidence width, four `336px` depth rows, three depth cards, one active `Alerts` nav label, no overflow, and zero console warnings/errors.
  - Settings rendered `354px` product/command widths, `326px` evidence width, nine lifecycle fixture rows with `324px` state rows, one active `Settings` nav label, no overflow, and zero console warnings/errors.
- Screenshot evidence was captured and displayed:
  - `/tmp/fanpass-feature-css-split-venues-20260608.png`;
  - `/tmp/fanpass-feature-css-split-settings-mobile-20260608.png`.

**Remaining Polish**
- Depth and lifecycle CSS extraction is complete. Do not repeat this split unless QA finds a regression.
- Future CSS maintainability should target other large route-owned files or broad shared styling outside the accepted secondary feature baseline.

## 2026-06-08 Event Checkout CSS Ownership Split

**Implementation Changes**
- Split the accepted combined Event Detail / Checkout fidelity layer into route-owned styles without changing DOM, route contracts, backend reads, navigation labels, or provider boundaries.
- `apps/web/src/styles/event-detail.css` now owns Event Detail-specific hero, ticket stack, ticket bands, price context, `event-control-strip`, price radar, access ledger, Fan Access panel, lifecycle panel, and responsive collapse styling.
- Added `apps/web/src/styles/checkout.css` for Checkout-specific terminal grid, command surface, event strip, steps, `checkout-control-strip`, assurance cards, receipt rail, issue preview/proof marker, order panel, settlement ledger, order timeline, status message, and responsive collapse styling.
- Updated `apps/web/src/main.tsx` to import `event-detail.css` and `checkout.css` instead of the stale combined `event-checkout.css`.
- Added a narrow view-change scroll reset in `apps/web/src/App.tsx` so Event Detail -> Checkout no longer inherits lower-page scroll position, including mobile clicks on offscreen CTAs.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `git diff --check -- apps/web/src/App.tsx apps/web/src/main.tsx apps/web/src/styles/event-detail.css apps/web/src/styles/checkout.css apps/web/src/styles/event-checkout.css` passed.
- Browser/IAB desktop QA against `http://127.0.0.1:5175/` passed:
  - flow tested: Discover -> `Get Tickets` -> Event Detail -> `Continue` -> Checkout;
  - Event Detail rendered four control cards, five price-radar rows, and three decision-ledger rows;
  - Checkout rendered four control cards, three settlement-ledger rows, 25 issue proof-marker cells, and `data-checkout-mode="primary"`;
  - Checkout route reset to the top of the view after navigation instead of preserving the lower Event Detail scroll position;
  - no horizontal overflow;
  - no framework overlay;
  - zero Browser/IAB console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed:
  - Event Detail product, hero, control, price-radar, and decision-ledger widths stayed `354px`;
  - Checkout product, terminal, command, and order-panel widths stayed `354px`;
  - Checkout control strip and review grid stayed `316px`;
  - final Checkout routing had `scrollY=0`;
  - no horizontal overflow;
  - zero Browser/IAB console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, `paymentIntent`, `NFC`, or `Web NFC`.
- Browser screenshot evidence was captured and displayed:
  - `/tmp/fanpass-event-checkout-css-split-event-20260608.png`;
  - `/tmp/fanpass-event-checkout-css-split-checkout-20260608.png`;
  - `/tmp/fanpass-event-checkout-css-split-event-mobile-20260608.png`;
  - `/tmp/fanpass-event-checkout-css-split-checkout-mobile-20260608.png`.

**Remaining Polish**
- Event Detail / Checkout CSS ownership is complete. Do not repeat this split unless QA or code review finds a real regression.
- Future maintainability should target other large route-owned CSS files or broad shared styling; Event Detail and Checkout should only receive fine visual micro-spacing or source-backed evidence work when explicitly scoped.

## 2026-06-08 Pulse Drawer CSS Ownership Split

**Implementation Changes**
- Split Pulse/Tickets-family drawer, proof, order, settlement, and provenance styling out of `apps/web/src/styles/pulse.css` without changing DOM, route contracts, backend reads, navigation behavior, or provider boundaries.
- Added `apps/web/src/styles/pulse-drawer.css` for `tickets-drawer`, drawer tabs, ticket rows, QR-like proof tiles, `order-card`, `order-settlement-card`, `order-provenance-list`, wallet/orders drawer border treatment, and mobile drawer/order collapse.
- Kept `apps/web/src/styles/pulse.css` focused on the My Tickets, Wallet, and Orders command/status/context shell.
- Updated `apps/web/src/main.tsx` to import `pulse-drawer.css` immediately after `pulse.css`.
- `pulse.css` decreased from 736 lines to 400 lines; `pulse-drawer.css` is 341 lines.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `git diff --check -- apps/web/src/main.tsx apps/web/src/styles/pulse.css apps/web/src/styles/pulse-drawer.css` passed.
- Browser/IAB desktop QA against `http://127.0.0.1:5175/` passed for `My Tickets`, `Wallet`, and `Orders`:
  - active nav labels matched the selected route;
  - route titles stayed page-specific;
  - drawer, order card, settlement card, provenance list, ledger rows, proof tiles, and order rows rendered with expected counts;
  - no horizontal overflow;
  - no framework overlay;
  - zero console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed for `My Tickets`, `Wallet`, and `Orders`:
  - product, drawer, and order-card widths stayed `354px`;
  - order settlement width stayed `328px`;
  - provenance list width stayed `302px`;
  - no horizontal overflow;
  - zero console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, or `paymentIntent`.
- Browser screenshot evidence was captured and displayed:
  - `/tmp/fanpass-pulse-css-split-orders-20260608.png`;
  - `/tmp/fanpass-pulse-css-split-orders-mobile-20260608.png`.

**Remaining Polish**
- Pulse drawer/order/proof CSS ownership is complete. Do not repeat this split unless QA or code review finds a real regression.
- Future maintainability should target other route-owned CSS or broad shared styling outside the accepted secondary feature, Event/Checkout, and Pulse baselines.

## 2026-06-08 Ticket Detail Ledger CSS Ownership Split

**Implementation Changes**
- Split Ticket Detail control, rules, order, custody, and Proof & History styling out of `apps/web/src/styles/ticket-detail.css` without changing DOM, route contracts, backend reads, navigation behavior, provider boundaries, or rendered product behavior.
- Added `apps/web/src/styles/ticket-detail-ledger.css` for `ticket-control-strip`, `ticket-order-panel`, order provenance, order steps, `ticket-rule-panel`, `ticket-custody-ledger`, `proof-history-panel`, and responsive ledger collapse.
- Kept `apps/web/src/styles/ticket-detail.css` focused on the Ticket Detail route shell, pass hero, entry-code panel, QR-like entry preview, and Pulse ticket-open link.
- Updated `apps/web/src/main.tsx` to import `ticket-detail-ledger.css` immediately after `ticket-detail.css`.
- Extended the existing `App.tsx` route-position reset to run when `selectedTicketId` changes and added later reset passes so My Tickets -> Ticket Detail opens at the detail top on mobile instead of inheriting the wallet/list scroll position.
- `ticket-detail.css` decreased from 685 lines to 303 lines; `ticket-detail-ledger.css` is 423 lines.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `git diff --check -- apps/web/src/App.tsx apps/web/src/main.tsx apps/web/src/styles/ticket-detail.css apps/web/src/styles/ticket-detail-ledger.css` passed.
- Browser/IAB desktop QA against `http://127.0.0.1:5175/` passed for My Tickets -> Ticket Detail:
  - `scrollY=0`;
  - Ticket Detail rendered the LISA pass hero, entry code panel, four control cards, two order-state cells, three order-provenance rows, three order steps, three custody rows, four Proof & History rows, and 121 QR-like entry cells;
  - product width stayed `1023px`, pass width `649px`, entry/order width `360px`, proof width `1023px`;
  - no horizontal overflow;
  - no framework overlay;
  - zero fresh console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed for My Tickets -> Ticket Detail:
  - `scrollY=0`;
  - product, pass, entry, control, order, custody, and proof widths stayed `354px`;
  - same control/order/provenance/custody/proof/entry-cell counts rendered;
  - no horizontal overflow;
  - no framework overlay;
  - zero fresh console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, `paymentIntent`, or `Web NFC`.
- Browser screenshot evidence was captured and displayed:
  - `/tmp/fanpass-ticket-detail-css-ledger-split-desktop-final-20260608.png`;
  - `/tmp/fanpass-ticket-detail-css-ledger-split-mobile-final-20260608.png`.

**Remaining Polish**
- Ticket Detail pass/ledger CSS ownership and mobile entry-position reset are complete. Do not repeat this split unless QA or code review finds a real regression.
- Future maintainability should target other route-owned CSS or broad shared styling outside the accepted secondary feature, Event/Checkout, Pulse, and Ticket Detail baselines.

## 2026-06-08 Resale Listing CSS Ownership Split

**Implementation Changes**
- Split List Ticket For Resale summary, payout, execution, and rule styling out of `apps/web/src/styles/resale-listing.css` without changing DOM, route contracts, backend reads, navigation behavior, provider boundaries, or rendered product behavior.
- Kept `apps/web/src/styles/resale-listing.css` focused on the route shell, editor panel, hero, price input, range track, price bands, warnings, action row, status line, and mobile editor collapse.
- Added `apps/web/src/styles/resale-listing-summary.css` for the listing summary, ticket strip, payout table, execution path, rule stack, and mobile summary collapse.
- Updated `apps/web/src/main.tsx` to import `resale-listing-summary.css` immediately after `resale-listing.css`.
- Final line counts are 283 lines for `resale-listing.css` and 164 lines for `resale-listing-summary.css`.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Touched-file trailing whitespace scan passed for `apps/web/src/main.tsx`, `apps/web/src/styles/resale-listing.css`, and `apps/web/src/styles/resale-listing-summary.css`.
- Browser/IAB desktop QA against `http://127.0.0.1:5175/` passed for My Tickets -> Ticket Detail -> List for resale:
  - organizer-cap price band click set the listing price to `1425`;
  - route root stayed `product-view resale-listing-view`;
  - three price bands, five payout rows, three execution steps, and six rule rows rendered;
  - no horizontal overflow;
  - no framework overlay;
  - zero fresh console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed for the same flow:
  - active nav label stayed `My Tickets`;
  - route root stayed `product-view resale-listing-view`;
  - product, grid, editor, and summary widths stayed `354px`;
  - price bands stayed `316px`, with the `Organizer cap` band active;
  - listing price stayed `1425` with `aria-invalid="false"`;
  - five payout rows, three execution steps, and six rule rows rendered;
  - no horizontal overflow;
  - no framework overlay;
  - zero fresh console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, `paymentIntent`, or `NFC`.
- Browser screenshot evidence was captured and displayed:
  - `/tmp/fanpass-resale-css-split-desktop-20260608.png`;
  - `/tmp/fanpass-resale-css-split-mobile-20260608.png`.

**Remaining Polish**
- Resale Listing editor/summary CSS ownership is complete. Do not repeat this split unless QA or code review finds a real regression.
- Future maintainability should target other route-owned CSS or broad shared styling outside the accepted secondary feature, Event/Checkout, Pulse, Ticket Detail, and Resale Listing baselines.

## 2026-06-09 Discover CSS Ownership Split

**Implementation Changes**
- Split the Discover/Home final editorial marketplace sizing layer out of `apps/web/src/styles/global.css` without changing JSX, route contracts, backend reads, navigation behavior, provider boundaries, or rendered product behavior.
- Added `apps/web/src/styles/discover.css` for Discover-only desktop marketplace proportions, hero/ticket-picker sizing, recommendation rail widths, filter chips, secondary rail sizing, and mobile chip collapse.
- Updated `apps/web/src/main.tsx` to import `discover.css` immediately after `global.css`.
- `global.css` decreased from 6112 lines to 5966 lines; `discover.css` is 146 lines.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB setup was attempted, but the in-app browser blocked the local `127.0.0.1:5175` target with `net::ERR_BLOCKED_BY_CLIENT`; local Playwright fallback was used for rendered QA.
- Vite ran on `http://127.0.0.1:5175/`, and the built API ran on `http://localhost:4000`.
- Playwright desktop QA against `http://localhost:5175/` passed:
  - route root stayed `product-view discover-view`;
  - active nav label stayed `Home`;
  - product width stayed `1183px`;
  - marketplace and hero height stayed `302px`;
  - hero width stayed `857px`;
  - hero copy stayed `360px`;
  - ticket picker stayed `316px`;
  - recommendation, chip, and secondary rail widths stayed `858px`;
  - eight primary event cards, four secondary cards, seven filter chips, and five ticket-picker price buttons rendered;
  - no horizontal overflow;
  - no framework overlay;
  - zero console warnings/errors.
- Playwright mobile QA at `390x844` against `http://localhost:5175/` passed:
  - route root stayed `product-view discover-view`;
  - active nav label stayed `Home`;
  - product, hero, ticket picker, recommendation grid, chip row, and secondary grid widths stayed `354px`;
  - eight primary event cards, four secondary cards, seven chips, and five ticket-picker price buttons rendered;
  - no horizontal overflow;
  - no framework overlay;
  - zero console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, `paymentIntent`, or `Web NFC`.
- Screenshot evidence was captured and displayed:
  - `/tmp/fanpass-discover-css-split-desktop-localhost-20260609.png`;
  - `/tmp/fanpass-discover-css-split-mobile-localhost-20260609.png`.

**Remaining Polish**
- Discover final marketplace sizing and recommendation rail CSS ownership is complete. Do not repeat this split unless QA or code review finds a real regression.
- Future CSS maintainability should target other broad `global.css` areas outside the accepted Discover, secondary feature, Event/Checkout, Pulse, Ticket Detail, and Resale Listing baselines.

## 2026-06-09 Market CSS Ownership Split

**Implementation Changes**
- Split Market/Orderbook terminal-only final polish out of `apps/web/src/styles/global.css` without changing route contracts, backend reads, market models, provider boundaries, desktop navigation geometry, or rendered product behavior.
- Kept `apps/web/src/styles/market.css` as the route-owned Market stylesheet for open listings, hidden lower terminal panels, tape/liquidity/control panels, depth legend/chart polish, price-cap row, trade preferences, recent activity icons, terminal event-strip metric wrapping, and responsive terminal guards.
- `global.css` decreased from 5966 lines to 5626 lines; `market.css` is now 407 lines.
- Rendered mobile QA found a real compressed-navigation visibility issue after clicking a horizontally scrolled nav item: active state was `Market`, but the previous scroll offset could keep another label first. Added a narrow `AppHeader` effect to scroll the active nav button into view on route changes and a mobile-only `navigation.css` guard that orders the active button first.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB local navigation remains blocked by `net::ERR_BLOCKED_BY_CLIENT`; local Playwright fallback was used with Vite on `http://localhost:5175/` and the built API on `http://localhost:4000`.
- Playwright desktop Market QA at `1440x1100` passed:
  - route root stayed `product-view terminal-concept`;
  - active nav label stayed `Market`;
  - event strip and terminal grid widths stayed `1183px`;
  - four terminal sections rendered;
  - five metrics, five ask rows, five bid rows, two depth fills, two depth lines, three depth-axis labels, price-cap row, two trade preference rows, and three recent-activity rows rendered;
  - no horizontal overflow;
  - zero console warnings/errors.
- Playwright mobile Market QA at `390x844` passed:
  - active nav label stayed `Market`;
  - first visible compressed-nav item was `Market`;
  - active nav button was visible at `x=20`, `width=116`;
  - event strip and terminal grid widths stayed `354px`;
  - five readable metrics and stacked orderbook/depth/trade/wallet panels rendered;
  - no horizontal overflow;
  - zero console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, `paymentIntent`, `NFC`, `TestFlight`, `signed Wallet`, or `chain custody`.
- Screenshot evidence was captured and displayed:
  - `/tmp/fanpass-market-css-split-desktop-20260609.png`;
  - `/tmp/fanpass-market-css-split-mobile-20260609.png`.

**Remaining Polish**
- Market terminal CSS ownership and mobile active-nav visibility are complete. Do not repeat this split or the narrow active-nav scroll fix unless QA or code review finds a real regression.
- Future maintainability should target other broad `global.css` areas outside the accepted Discover, Market/Orderbook, secondary feature, Event/Checkout, Pulse, Ticket Detail, and Resale Listing baselines.

## 2026-06-09 Shared EventCard CSS Ownership Split

**Implementation Changes**
- Split shared event poster-card styling out of `apps/web/src/styles/global.css` without changing JSX, route contracts, backend reads, navigation behavior, provider boundaries, or rendered product behavior.
- Added `apps/web/src/styles/event-card.css` for `.event-grid`, `.event-card`, `.event-card-image`, `.event-date-tile`, `.event-status-chip`, `.event-card-body`, and `.event-card-footer`, including desktop and mobile grid behavior.
- Updated `apps/web/src/main.tsx` to import `event-card.css` immediately after `global.css`, before route-owned files such as `discover.css`, so route-specific card sizing still wins.
- `global.css` decreased from 5626 lines to 5357 lines; `event-card.css` is 205 lines.
- Mixed historical media-query lists that also mention `.event-grid` remain in `global.css` because they are coupled to Pulse/feature grid rules and should be split with their neighboring surfaces later.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB QA against `http://localhost:5175/` passed on desktop/default viewport:
  - route root stayed `product-view discover-view`;
  - active nav label stayed `Home`;
  - eight event cards rendered;
  - the first card stayed `169x192`;
  - the first card title was `LISA`;
  - the date tile display was `grid`;
  - the status chip display was `block`;
  - no horizontal overflow;
  - zero console warnings/errors.
- Browser/IAB interaction proof passed:
  - clicking the first `.event-grid .event-card` opened `product-view event-view event-detail-concept`;
  - Event Detail rendered `LISA`;
  - no horizontal overflow;
  - zero console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed:
  - route root stayed `product-view discover-view`;
  - active nav label stayed `Home`;
  - first visible compressed-nav item was `Home`;
  - eight event cards rendered;
  - event grid width stayed `354px`;
  - first card stayed `173x214`;
  - no horizontal overflow;
  - zero console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, `paymentIntent`, `NFC`, `TestFlight`, `signed Wallet`, or `chain custody`.
- `view_image` inspection compared the source concept image with the latest desktop and mobile screenshots.
- Screenshot evidence:
  - `/tmp/fanpass-event-card-css-split-desktop-20260609.png`;
  - `/tmp/fanpass-event-card-css-split-mobile-full-20260609.png`.

**Remaining Polish**
- Shared EventCard poster-card CSS ownership is complete. Do not repeat this split unless QA or code review finds a real regression.
- Future CSS maintainability should target the remaining broad `global.css` areas outside the accepted Discover, shared EventCard, Market/Orderbook, secondary feature, Event/Checkout, Pulse, Ticket Detail, and Resale Listing baselines.

## 2026-06-09 Shared Command Strip CSS Ownership Split

**Implementation Changes**
- Split the shared top search/filter command chrome out of `apps/web/src/styles/global.css` without changing JSX, route contracts, backend reads, navigation behavior, provider boundaries, or rendered product behavior.
- Added `apps/web/src/styles/command-strip.css` for `.command-strip`, `.search-box`, `.topbar-controls`, and `.utility-actions`, including desktop two-column sizing and mobile single-column collapse.
- Updated `apps/web/src/main.tsx` to import `command-strip.css` immediately after `global.css`, before route-owned styles.
- Kept `route-frame.css` as the owner for stable route-frame width and margin overrides.
- `global.css` decreased from 5357 lines to 5197 lines; `command-strip.css` is 97 lines.
- Remaining `.command-strip` references in `global.css` are mixed page-level z-index/width lists or older broad responsive lists and should only move with their neighboring layout surfaces.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB QA against `http://localhost:5175/` passed on desktop/default viewport:
  - route root stayed `product-view discover-view`;
  - active nav label stayed `Home`;
  - command strip stayed `1023px` wide;
  - search box stayed `580px` wide;
  - topbar controls stayed `429px` wide;
  - three utility action buttons rendered;
  - topbar labels stayed `USD`, `New York`, and `All shows`;
  - no horizontal overflow;
  - zero console warnings/errors.
- Browser/IAB interaction proof passed:
  - filling the search input with `orbit` changed the visible hero state to `Orbit Finals`;
  - no horizontal overflow after the filter interaction;
  - zero console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed:
  - active nav label stayed `Home` and remained visible;
  - command strip, search box, and topbar controls stayed `354px` wide;
  - command gap stayed `8px`;
  - three utility action buttons and eight event cards rendered;
  - no horizontal overflow;
  - zero console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, `paymentIntent`, or `NFC`.
- `view_image` inspection compared the source concept image with the latest default desktop, filtered desktop, and mobile screenshots.
- Screenshot evidence:
  - `/tmp/fanpass-command-strip-css-split-desktop-default-20260609.png`;
  - `/tmp/fanpass-command-strip-css-split-desktop-20260609.png`;
  - `/tmp/fanpass-command-strip-css-split-mobile-20260609.png`.

**Remaining Polish**
- Shared Command Strip CSS ownership is complete. Do not repeat this split unless QA or code review finds a real regression.
- Future CSS maintainability should target the remaining broad `global.css` areas outside the accepted Discover, shared Command Strip, shared EventCard, Market/Orderbook, secondary feature, Event/Checkout, Pulse, Ticket Detail, and Resale Listing baselines.

## 2026-06-09 Market Base CSS Ownership Extension

**Implementation Changes**
- Extended the Market/Orderbook route-owned stylesheet without changing JSX, route contracts, backend reads, navigation behavior, provider boundaries, or intended rendered product behavior.
- Moved Market terminal base styling from `apps/web/src/styles/global.css` into `apps/web/src/styles/market.css`.
- `market.css` now owns `.terminal-concept`, `.terminal-event-strip`, `.date-tile`, `.mini-tags`, `.range-tabs`, `.terminal-grid`, `.book-table`, `.depth-panel`, `.trade-panel`, `.wallet-panel`, `.buy-sell`, `.trade-total`, `.wallet-line`, and `.recent-activity` in addition to the prior Market polish layer.
- `global.css` decreased from 5197 lines to 4857 lines.
- Browser/IAB mobile QA found a real Market-only layout issue after the move: the product route was `354px` wide at `390x844`, but `.terminal-event-strip` and `.terminal-grid` still measured `720px`. `market.css` now explicitly gives Market terminal containers `min-width: 0`, `width: 100%`, `max-width: 100%`, and stacks `.terminal-grid` to one column at `max-width: 720px`.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB desktop Market QA against `http://localhost:5175/` passed:
  - route root stayed `product-view terminal-concept`;
  - active nav label stayed `Market`;
  - event strip and terminal grid stayed `1023px` wide;
  - terminal grid kept four desktop columns;
  - ten orderbook rows, five range tabs, three wallet rows, and three recent-activity rows rendered;
  - no horizontal overflow;
  - zero console warnings/errors.
- Browser/IAB interaction proof passed:
  - clicking `Review order` opened `product-view checkout-view checkout-concept`;
  - checkout transition had no horizontal overflow;
  - zero console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed after the fix:
  - route root stayed `product-view terminal-concept`;
  - active nav label stayed `Market` and remained visible;
  - product, event strip, and terminal grid stayed `354px` wide;
  - orderbook, depth, trade, and wallet panels stacked at `354px` width;
  - five metrics, five ask rows, and five bid rows rendered;
  - no horizontal overflow;
  - zero console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, `paymentIntent`, `NFC`, `TestFlight`, `signed Wallet`, or `chain custody`.
- `view_image` inspection compared the source concept image with the latest desktop and mobile Market screenshots.
- Screenshot evidence:
  - `/tmp/fanpass-market-base-css-split-desktop-fixed-20260609.png`;
  - `/tmp/fanpass-market-base-css-split-mobile-fixed-20260609.png`.

**Remaining Polish**
- Market base CSS ownership and mobile terminal-width fix are complete. Do not repeat this split unless QA or code review finds a real regression.
- Future CSS maintainability should target remaining broad `global.css` areas outside the accepted Discover, shared Command Strip, shared EventCard, Market/Orderbook base/polish, secondary feature, Event/Checkout, Pulse, Ticket Detail, and Resale Listing baselines.

## 2026-06-09 Pulse Base CSS Ownership Extension

**Implementation Changes**
- Extended Pulse/Tickets-family route-owned CSS without changing JSX, route contracts, backend reads, navigation behavior, provider boundaries, or intended rendered product behavior.
- `apps/web/src/styles/pulse.css` now owns the Pulse shell/base layer: `.pulse-concept`, `.pulse-main`, `.pulse-cards`, `.pulse-chips`, `.mini-recs`, `.pulse-activity-strip`, and responsive Pulse grid collapse.
- `apps/web/src/styles/pulse-drawer.css` now owns the drawer/order base layer: `.tickets-drawer`, `.drawer-heading`, `.drawer-tabs`, ticket rows, `.ticket-date-badge`, `.ticket-seat-grid`, `.qr-box`, `.proof-tile`, `.drawer-actions`, `.order-mini`, `.order-card`, `.order-trust-stack`, order timeline/provenance, and `.ticket-open-link`.
- `apps/web/src/styles/ticket-detail.css` no longer owns the Pulse-only `ticket-open-link`.
- `apps/web/src/styles/global.css` decreased from 4857 lines to 4037 lines.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` passed for My Tickets, Wallet, and Orders:
  - route root stayed `product-view pulse-concept pulse-*`;
  - active nav matched the selected route;
  - product width stayed `1471px`;
  - drawer/order widths stayed `330px` and `270px`;
  - two ticket rows, two proof tiles, 81 proof cells per tile, two drawer tabs, two order-trust rows, and two order rows rendered;
  - no horizontal overflow;
  - zero console warnings/errors.
- Browser/IAB interaction proof passed:
  - clicking `Buy now` from Orders opened `product-view event-view event-detail-concept`;
  - Event Detail had no horizontal overflow.
- Browser/IAB mobile QA at `390x844` passed for My Tickets, Wallet, and Orders:
  - product, drawer, order card, and activity strip widths stayed `354px`;
  - two ticket rows, two proof tiles, two drawer tabs, and two order-trust rows rendered;
  - no horizontal overflow;
  - zero console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, `paymentIntent`, `NFC`, `TestFlight`, `signed Wallet`, or `chain custody`.
- `view_image` inspection compared the source concept image with the latest desktop and mobile Pulse screenshots.
- Screenshot evidence:
  - `/tmp/fanpass-pulse-css-ownership-desktop-tickets-20260609.png`;
  - `/tmp/fanpass-pulse-css-ownership-mobile-tickets-20260609.png`.

**Remaining Polish**
- Pulse base CSS ownership is complete. Do not repeat this extension unless QA or code review finds a real regression.
- Future maintainability should target remaining broad `global.css` areas outside the accepted Discover, shared Command Strip, shared EventCard, Market/Orderbook base/polish, Pulse base/drawer, secondary feature, Event/Checkout, Ticket Detail, and Resale Listing baselines.

## 2026-06-09 FeatureWorkspace Global Residual CSS Cleanup

**Implementation Changes**
- Moved the remaining secondary FeatureWorkspace shell/base styling out of `apps/web/src/styles/global.css` and into scoped `apps/web/src/styles/feature-workspace.css`.
- `feature-workspace.css` now owns masthead pseudo-element base, action button base, metric cards, canvas grid rows, spotlight/list/action panel layout, feature rows, signal card, pass stack, mini table, checks, evidence/system flow, and the desktop density guard.
- Removed unused legacy feature selectors from `global.css`: `.feature-hero-panel`, `.feature-grid`, `.feature-insight-panel`, `.feature-action-buttons`, and `.feature-stat-grid`.
- Changed the Venues evidence copy so the web app no longer renders `NFC` while preserving the safe QR-only review boundary.
- `global.css` decreased from 4037 lines to 3102 lines; `feature-workspace.css` increased from 427 lines to 593 lines as the scoped owner.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- `git diff --check -- apps/web/src/styles/global.css apps/web/src/styles/feature-workspace.css` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` passed for Events, Analytics, Settings, and Venues:
  - route root stayed `product-view feature-workspace feature-*`;
  - active nav matched the selected route;
  - four command cards and three evidence rows rendered;
  - product and command widths stayed `1471px`;
  - no framework overlay;
  - no horizontal overflow;
  - zero console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed for Settings and Alerts:
  - product and command widths stayed `354px`;
  - evidence rail stayed `326px`;
  - Settings kept lifecycle fixtures;
  - Alerts kept the route depth panel;
  - no horizontal overflow;
  - zero console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, `paymentIntent`, `NFC`, `TestFlight`, `signed Wallet`, or `chain custody`.
- `view_image` inspection compared the source concept image with latest desktop/mobile secondary feature screenshots.
- Screenshot evidence:
  - `/tmp/fanpass-feature-global-residual-cleanup-desktop-venues-20260609.png`;
  - `/tmp/fanpass-feature-global-residual-cleanup-mobile-alerts-20260609.png`.

**Remaining Polish**
- FeatureWorkspace global residual cleanup is complete. Do not repeat this cleanup unless QA or code review finds a real regression.
- Future CSS maintainability should target broad `global.css` areas outside the accepted secondary feature shell/depth/lifecycle/global-residual ownership and other completed route-owned baselines.

## 2026-06-09 Command Strip Component Ownership

**Implementation Changes**
- Extracted the shared top search/filter/utility chrome from `apps/web/src/App.tsx` into `apps/web/src/components/CommandStrip.tsx`.
- The new component owns the code-native search input, USD/location/category buttons, and three utility action icon buttons while continuing to use existing `command-strip.css` styling.
- `App.tsx` now passes existing `query`, `city`, `category`, and `setQuery` state into the component instead of carrying the JSX inline.
- `App.tsx` decreased from 798 lines to 784 lines; `CommandStrip.tsx` is 39 lines.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` passed:
  - the search input was unique;
  - typing `orbit` changed the Discover hero to `Orbit Finals`;
  - command strip/search/control widths stayed `1471px` / `580px` / `877px`;
  - three utility buttons rendered;
  - Market still rendered `product-view terminal-concept` with active `Market` and a `1471px` command strip;
  - Settings still rendered `product-view feature-workspace feature-settings` with active `Settings`, a `1471px` command strip, and nine lifecycle fixture rows;
  - no framework overlay;
  - no horizontal overflow;
  - zero console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed:
  - the search input was unique;
  - typing `orbit` changed the Discover hero to `Orbit Finals`;
  - command/search/control widths stayed `354px`;
  - three utility buttons rendered;
  - no horizontal overflow;
  - zero console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, `paymentIntent`, `NFC`, `TestFlight`, `signed Wallet`, or `chain custody`.
- `view_image` inspection compared the source concept image with latest desktop/mobile command strip screenshots.
- Screenshot evidence:
  - `/tmp/fanpass-command-strip-component-desktop-settings-20260609.png`;
  - `/tmp/fanpass-command-strip-component-mobile-20260609.png`.

**Remaining Polish**
- Command Strip component ownership is complete. Do not repeat this extraction unless QA or code review finds a real regression.
- Future component maintainability should target other large composition surfaces, not the accepted shared top search/filter chrome.

## 2026-06-09 Ticket Detail Evidence Hook Ownership

**Implementation Changes**
- Extracted Ticket Detail evidence loading out of `apps/web/src/App.tsx` into `apps/web/src/hooks/useTicketDetailEvidence.ts`.
- The hook now owns safe proof-history loading, short-lived entry credential refresh, loading flags, safe credential cache, and the `Refresh code` callback wiring.
- `App.tsx` remains the route/state composition layer and no longer imports Ticket Detail proof-history or entry-credential service calls directly.
- `App.tsx` decreased from 784 lines to 730 lines; `useTicketDetailEvidence.ts` is 81 lines.
- No CSS, route contract, backend endpoint, navigation, provider boundary, or intended rendered behavior changed.

**Verification**
- `scripts/with-node-22.sh npm run typecheck -w apps/web` passed.
- `scripts/with-node-22.sh npm run build -w apps/web` passed.
- Browser/IAB desktop QA against `http://localhost:5175/` passed through `My Tickets -> Open pass -> Ticket Detail -> Refresh code`:
  - route root stayed `product-view ticket-detail-view`;
  - active nav stayed `My Tickets`;
  - product width stayed `1471px`;
  - entry panel width stayed `360px`;
  - 121 QR-like entry cells and 81 active cells rendered;
  - four ticket-control cards, three custody rows, four Proof & History rows, three safe order-provenance rows, and three order-step rows rendered;
  - no framework overlay;
  - no horizontal overflow;
  - zero console warnings/errors.
- Browser/IAB mobile QA at `390x844` passed through the same flow:
  - product, entry panel, control strip, custody ledger, and proof panel widths stayed `354px`;
  - 121 QR-like entry cells and 80 active cells rendered after refresh;
  - four ticket-control cards, three custody rows, and four Proof & History rows rendered;
  - no horizontal overflow;
  - zero console warnings/errors.
- Rendered DOM did not include `signature`, `nonce`, `walletAddress`, `ownerId`, `accessToken`, `Bearer `, `privy`, `client_secret`, `clientSecret`, `paymentIntent`, `NFC`, `TestFlight`, `signed Wallet`, or `chain custody`.
- `view_image` inspection checked the latest desktop and mobile Ticket Detail screenshots after the hook extraction.
- Screenshot evidence:
  - `/tmp/fanpass-ticket-evidence-hook-desktop-20260609.png`;
  - `/tmp/fanpass-ticket-evidence-hook-mobile-20260609.png`.

**Remaining Polish**
- Ticket Detail evidence hook ownership is complete. Do not repeat this extraction unless QA or code review finds a real regression.
- Future maintainability should target other route composition/state surfaces outside the accepted Ticket Detail proof-history and short-lived entry credential hook boundary.
