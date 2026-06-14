# FanPass Web Landing Page Plan V4

Date: 2026-06-07
Status: planning
Parent plan: `docs/product/FanPass_Web_Beta_Fallback_Workplan_V4.md`

## Goal

Create the first web-facing FanPass surface as a polished landing page for the Web Beta Fallback. The page should make FanPass understandable through three platform advantages: why the ticket is trustworthy, why resale does not become chaotic, and why pricing is easier to understand.

This is the entry point for the fallback web product, not a replacement for the native iOS app.

## Refined Design Direction

Update on 2026-06-07:

The landing page should be less dense and more premium than earlier concept explorations. It should not lead with QR code, scanner mechanics, or technical proof language. QR is an entry transport, not FanPass's strategic advantage.

The page should lead with the user-visible platform advantage:

- Verified ticket identity and ownership history make the ticket trustworthy.
- Organizer rules stay attached to the ticket after purchase, so resale remains controlled.
- Transparent resale data shows face value, caps, and recent verified sales without turning FanPass into a trading app.
- A mainstream ticketing experience with trust infrastructure hidden in the background.

Design principle:

`Less is more` means a long-scroll page with low information density, not a short one-screen page. Use generous space, one major idea per viewport, one beautiful product object at a time, and a few carefully paced trust signals.

Stripe/MoonPay/Apple-inspired lessons to apply without copying:

- Use a short category-defining headline instead of explaining every feature.
- Let one high-quality product object carry the first viewport.
- Use motion later as subtle material behavior, not decorative spectacle.
- Show trust through restrained proof points, status, and operational confidence.
- Keep the page readable and spacious; avoid card grids, dense dashboards, and feature checklists.

Do not make QR code or cross-device sync the hero. QR is an entry transport, and web/iOS sync is an architecture requirement. The main story is trust, controlled resale, and transparent prices.

Update on 2026-06-09:

The current Home/product-entry concept should apply the same long-scroll principle to the web app Home surface. The desktop Home must not be a one-screen dashboard. It should be a single continuous page with a fixed/top navigation area and clear vertical sections:

1. Hero/search/featured event in the first viewport only.
2. Discovery sections such as `Popular near you` and `Just announced`.
3. Trust explanation sections for ticket identity, controlled resale, and transparent prices.
4. Fan Access as a later section, not a top-level nav replacement for Tickets.
5. Footer/help links.

The current desktop concept source is `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-home-desktop-long-scroll.png`.

The current mobile Home concept is directionally acceptable because it stays simpler than desktop: bottom five-tab navigation, larger readable text, fewer first-screen modules, and scroll sections for discovery/trust/Fan Access. The current mobile concept source is `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-home-mobile-v3.png`.

Home-owned secondary windows should stay narrow in scope. They are overlays, drawers, sheets, and page states rather than nested content pages:

1. Desktop search overlay.
2. Desktop notifications drawer.
3. Desktop location and currency popover.
4. Guest Home state.
5. Empty or low-data Home state.
6. Mobile search sheet.

The current Home secondary windows concept board is `/Users/tantalum/.codex/generated_images/019eaaab-aece-7d43-900a-29d8309612c4/confirmed-home-secondary-windows.png`.

Do not create Home-owned pages for `Popular near you`, `Just announced`, `Trust`, `Fan Access`, Event Detail, Explore, Market, Tickets, or Account. Those interactions should route into their own top-level or detail concepts.

## Audience

Primary:

- Academic reviewers and internal product reviewers.
- Potential early users who need to understand the concept without installing TestFlight.
- Organizers evaluating the ticketing/resale trust model.

Secondary:

- Developers and stakeholders reviewing the web fallback path.

## Positioning

Headline direction:

`Verified Access for Real Fans`

Supporting direction:

`FanPass helps organizers issue verified tickets, keep resale within clear rules, and give fans a clearer way to understand ticket value.`

Tone:

- Premium.
- Trustworthy.
- Mainstream.
- Event-focused.
- Web3-hidden.
- Not speculative or trading-first.

## Page Structure

The landing page should feel like a real premium website, not a single-slide pitch deck. It can be long, but each section must stay sparse. Do not stack every product module into one viewport. Let the story unfold through a clear sequence:

1. Why the ticket itself is trustworthy.
2. Why resale does not become chaotic.
3. Why prices are easier to understand.
4. Why organizers and fans can rely on the same rules.
5. How the web fallback lets reviewers explore the concept while native signing is blocked.

### 1. Hero

Purpose:

- Establish brand, category, and product promise.
- Show the actual product concept in the first viewport.

Content:

- FanPass V4 lockup.
- H1 option A: `Verified Access for Real Fans`
- H1 option B: `Every ticket keeps its proof.`
- H1 option C: `Fair access, from first sale to resale.`
- H1 option D: `Tickets you can trust. Resale you can understand.`
- Supporting copy focused on verified ownership, organizer rules, and transparent resale.
- Primary CTA: `Explore demo`
- Secondary CTA: `See how it works`
- Product visual: one Clean V4 pass/ticket object with verified status, ownership/proof status, resale-rule state, face value, and organizer cap. QR should be minimized or omitted in the landing hero.

Visual rules:

- Dark-first Clean V4.
- No hero eyebrow/kicker unless a generated concept explicitly requires it and it is approved.
- No decorative line across logo, ticket, QR, buttons, or text.
- The next section should be hinted below the fold.

### 2. Trusted Ticket Identity

Purpose:

- Explain why a FanPass ticket can be trusted without exposing blockchain-heavy mechanics.

Content:

- One focused product visual showing a `Verified Ticket` with `Ownership History` and `Proof & History`.
- A concise explanation that the ticket keeps a verifiable record from issue to entry.
- One or two trust chips, not a grid of features.

Copy rules:

- Use `Verified Ticket`, `Secure Resale`, `Transparent Prices`, `Ownership History`, `Organizer Rules`, and `Proof & History`.
- Avoid `NFT`, `gas`, `mint`, `seed phrase`, and speculative language.

### 3. Controlled Resale

Purpose:

- Explain why FanPass resale stays inside organizer-defined boundaries instead of becoming an uncontrolled marketplace.

Content:

- Resale cap.
- Transfer rule.
- Organizer rule label.
- Short seller/buyer state example using fictional data.

Visual rules:

- Keep the visual calm and rule-led.
- Do not make the page look like a crypto exchange, stock app, or trading terminal.
- Avoid dense orderbook tables on the landing page.

### 4. Transparent Prices

Purpose:

- Show that fans can understand value without trading jargon.

Content:

- Face value.
- Organizer resale cap.
- Recent verified sales.
- Fan-readable price context.
- Optional bounded price line, only if it does not compete with the headline or numbers.

Visual rules:

- Chart stays calm and bounded.
- No candlesticks.
- No chart line crossing prices or labels.
- Use `Transparent Prices`, not trading jargon.

### 5. Organizer And Fan Confidence

Purpose:

- Connect the fan-facing promise to organizer trust without turning the landing page into Console documentation.

Content:

- Organizer rules.
- Refund/cancel states.
- Staff verification boundary.
- Audit history as background infrastructure.

Visual rules:

- Use quiet operational UI snippets only.
- Do not expose admin-heavy tables in the landing first pass.
- Fan Access can be mentioned as a future/secondary benefit, but it should not be the core homepage story.

### 6. Fallback Availability Notice

Purpose:

- Be honest about the current fallback boundary.

Content:

- `Web fallback supports browser review, ticket flow demos, and QR-based entry concepts while native signing is pending.`
- `Core NFC, TestFlight, and Apple Wallet signing remain native release tracks.`

Visual rules:

- This should be a clear product note, not an alarming warning banner.

### 7. Final CTA

Purpose:

- Route users into the demo/product flow when it exists.

Content:

- Primary CTA: `Explore demo`
- Secondary CTA: `Read proof model`

For the first implementation, CTAs may route to placeholder sections or local mock routes, but they must not imply real ticket purchase availability.

## Long Page, Low-Density Rhythm

The page should scroll like a mature fintech or infrastructure website, but each section should be visually simple:

1. Near-full-height hero with one premium product object.
2. One section for trusted ticket identity.
3. One section for controlled resale.
4. One section for transparent prices.
5. One section for organizer/fan confidence.
6. One clear fallback boundary and final CTA.

Long-scroll is expected. The constraint is not page length; the constraint is density. Avoid feature checklists, dashboard grids, decorative clutter, and repeated cards. Each viewport should have one clear claim, one supporting visual or proof point, and enough negative space for the page to feel premium.

Motion can be added after the static design is accepted:

- Pass object gently floats or tilts on scroll.
- Proof/rule/price chips fade in sequentially.
- Price range line animates inside a bounded plot area.
- Section transitions should be subtle fade/translate behavior, not spectacle.
- Respect `prefers-reduced-motion`.

## Responsive Plan

Desktop:

- Header with horizontal navigation and two CTAs.
- Hero with strong ticket/product visual.
- Section rhythm should alternate text-led and product-visual-led blocks.

Mobile:

- Compact header with logo and primary CTA.
- Hero text first, ticket visual second.
- Avoid dense market data above the fold.
- Ticket card and chart previews must use fixed responsive dimensions to avoid overflow.

## Asset Use

Allowed:

- Clean V4 logo mark and lockup.
- Clean V4 app icon only as brand reference, not as a new logo.
- Clean V4 ticket-card visual as inspiration.
- Fictional events from existing mock data.
- Generated abstract concert/pass imagery if it does not use real artists, venues, posters, or copyrighted references.

Not allowed:

- New FanPass logo redesign.
- Real concert posters or artist names.
- Web3 meme/NFT visuals.
- NFC wave decoration in the web fallback landing.
- Apple Wallet pass claim or TestFlight claim.

## Initial Copy Bank

Approved terms:

- Verified Ticket
- Secure Resale
- Fan Access
- Access Badge
- Proof & History
- Transparent Prices
- Organizer Rules
- Resale Cap
- Ownership History
- Face Value
- Recent Verified Sales

Avoid:

- NFT
- Gas fee
- Seed phrase
- Mint
- Ape
- Degen
- Pump
- Moon
- Trading terminal
- Live beta
- Real-money purchase
- Scan-first product language
- QR as the main product promise
- Cross-device sync as the main product promise

## Implementation Notes

When coding begins:

- Create `apps/web`.
- Use Vite React TypeScript.
- Keep page sections as reusable components.
- Store landing content in typed data objects, not scattered strings.
- Use CSS custom properties from Clean V4 tokens.
- Keep CTA routes ready for future `/demo`, `/events`, `/tickets`, and `/market`.
- Add browser QA for desktop and mobile.

## Acceptance Criteria

- Landing page clearly communicates FanPass in under one minute.
- Page visually follows Clean V4.
- First viewport has a clear product signal, not only text.
- No decorative line crosses important content.
- No NFC feature is promised for web.
- No native evidence blocker is implied as closed.
- Page works on desktop and mobile.
- Page is ready to become the entry point for later web app routes.
