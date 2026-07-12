---
version: alpha
name: FanPass V5 Backstage Pass
description: Young live-culture ticketing with premium pass-level trust. V5 is a from-scratch brand and app redesign, not a V4 visual extension.
status: unfinished_exploration_not_approved
last_updated: 2026-07-12
scope:
  - FanPass brand identity
  - FanPass iOS
  - FanPass Ops iOS
  - Web Beta Fallback when explicitly scoped
direction:
  live_culture: 65
  premium_pass: 35
colors:
  ink: "#121214"
  soft-black: "#1B1B1F"
  paper: "#F7F3EA"
  warm-white: "#FFFDF8"
  signal-red: "#D64032"
  cobalt: "#2457C5"
  brass: "#B8893A"
  verified-green: "#178C55"
  amber: "#D9911E"
  slate: "#6F737C"
  hairline: "#DDD6C8"
  danger: "#C7352D"
typography:
  display:
    fontFamily: "New York, Georgia, serif"
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: 0em
  title:
    fontFamily: "SF Pro Display, Inter, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 650
    lineHeight: 1.14
    letterSpacing: 0em
  headline:
    fontFamily: "SF Pro Text, Inter, system-ui, sans-serif"
    fontSize: 17px
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: 0em
  body:
    fontFamily: "SF Pro Text, Inter, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0em
  caption:
    fontFamily: "SF Pro Text, Inter, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 550
    lineHeight: 1.25
    letterSpacing: 0em
  mono:
    fontFamily: "SF Mono, JetBrains Mono, ui-monospace, monospace"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: 0em
spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  xxxl: 48px
rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
components:
  event-card:
    background: "{colors.warm-white}"
    text: "{colors.ink}"
    radius: "{rounded.md}"
    spacing: "{spacing.md}"
  ticket-pass:
    background: "{colors.paper}"
    text: "{colors.ink}"
    accent: "{colors.brass}"
    radius: "{rounded.lg}"
  primary-button:
    background: "{colors.signal-red}"
    text: "{colors.warm-white}"
    radius: "{rounded.md}"
  focus-ring:
    color: "{colors.cobalt}"
---

# FanPass DESIGN.md

This is an unfinished V5 exploration draft, not an active design contract. It records a possible from-scratch direction for logo, app icon, color, typography, imagery, component rhythm, and app screens. Nothing in this file may replace the production app without explicit owner approval.

V4 remains the active production baseline. This draft may intentionally explore a different visual language, but it must not be used as implementation guidance until V5 is completed and approved.

## Overview

FanPass V5 is **Backstage Pass**: a young live-culture ticketing product with premium pass-level trust.

The balance is fixed:

- 65% live culture: music, night-out planning, taste, discovery, artists, venues, city scenes, event posters.
- 35% premium pass: secure, calm, precise, high-trust, easy to scan at the door.

Core promise:

FanPass helps fans discover shows, buy verified tickets, understand resale rules, and get in without drama.

V5 must feel:

- current, simple, and premium;
- warm and editorial, not cold and technical;
- useful before it is decorative;
- safe without saying "blockchain";
- younger than Apple Wallet, calmer than a nightlife poster wall.

V5 must not feel:

- Solana-like;
- crypto, DeFi, NFT, or token-gated;
- gambling, betting, trading, or exchange-like;
- over-designed, neon, loud, or gimmicky;
- like a generic dashboard template.

## Required Reading Before Editing

Before editing this draft, read:

1. `docs/CODEX_HANDOFF.md`
2. `docs/design.md`
3. `docs/BETA_ROADMAP.md`
4. `apps/ios/FanPass/FanPass/DesignSystem/README.md`

Use V4 brand docs only for constraints and anti-patterns. Do not use them as visual targets.

## Project Idea

FanPass is a mainstream mobile ticketing product. The product uses backend trust, payment, proof, and chain infrastructure, but the user-facing story is:

- find relevant live events;
- buy official or verified resale tickets;
- see the real price and rules before paying;
- hold a secure entry pass;
- resell only within organizer limits;
- let staff verify entry quickly.

The product surfaces are:

- FanPass: consumer iOS app for discovery, purchase, ticket holding, entry, resale, account.
- FanPass Ops: staff iOS app for gate assignment, scanning, accepted/rejected decisions, scan-next loop.
- FanPass Console: future organizer/admin web surface for events, inventory, staff, rules, support, and risk.

Consumer tabs stay:

1. Home
2. Explore
3. Market
4. Tickets
5. Account

Home and Explore carry the live-culture energy. Ticket Detail and Checkout carry the premium pass trust. Account stays compact and utility-led. Market stays clear and non-speculative.

## Reference Research

External references are product-pattern research only. Do not copy their brand assets, screenshots, layouts, exact words, or proprietary imagery.

International references:

- DICE: live-culture discovery, taste, artists, venues, friends, minimal noise.
- Ticketmaster: large-scale ticket ownership, transfer, sell, entry, secure mobile tickets.
- SeatGeek: value clarity, price confidence, buyer guarantee, marketplace simplification.
- Fever: curated city experiences and "what to do nearby" discovery.
- Apple Wallet: calm pass storage and context-aware pass utility.
- Google Wallet event passes: event hero image, action links, and contextual pass display.

China/HK references:

- Damai: broad entertainment categories, purchase speed, electronic ticket conversion, fan benefits.
- Maoyan: dense entertainment commerce and precise event information.
- Piaoxingqiu: younger ticketing language, official assurance, discounts.
- ShowStart: livehouse/independent music culture, calendar filtering, QR entry, artist/community context.

Research rules:

- Use references to understand hierarchy and flows.
- Do not import their visual identity.
- Do not let any one app dominate FanPass.
- Do not run third-party scripts.

## Colors

The palette is warm, editorial, and controlled. It removes V4's cyan-violet-magenta energy.

- **Ink (`#121214`):** Core text, dark pass backs, premium app chrome.
- **Soft Black (`#1B1B1F`):** Elevated dark surfaces and modal backgrounds.
- **Paper (`#F7F3EA`):** Ticket/pass backgrounds, editorial cards, calm page bands.
- **Warm White (`#FFFDF8`):** Primary light surface. Prefer this over pure white for consumer pages.
- **Signal Red (`#D64032`):** Brand accent and primary action. Use sparingly.
- **Cobalt (`#2457C5`):** Focus, links, selected state, trust accent.
- **Brass (`#B8893A`):** Premium pass detail, special access, dividers.
- **Verified Green (`#178C55`):** Verified, accepted, successful states only.
- **Amber (`#D9911E`):** Pending, cap, warning, attention.
- **Slate (`#6F737C`):** Metadata, secondary labels, quiet utility.
- **Hairline (`#DDD6C8`):** Dividers, borders, pass perforation lines.
- **Danger (`#C7352D`):** Destructive or rejected states.

Color rules:

- Primary UI should work without gradients.
- Avoid cyan, violet, and magenta as core brand colors.
- Use red as an editorial signal, not a full-page wash.
- Use brass in small amounts; too much becomes luxury cliche.
- Market must not use red/green price-board language.

## Typography

Implementation should use Apple system fonts by default. The brand direction may later select licensed typography, but code should remain system-compatible.

Typography roles:

- **Display:** Editorial event moments, Home hero, campaign/event title moments. Serif direction is allowed in generated design exploration, but implementation can map to New York/Georgia fallback.
- **Title:** Screen titles, event detail titles, ticket headings.
- **Headline:** Row titles, button text, compact section headers.
- **Body:** Event details, support text, checkout explanations.
- **Caption:** Metadata, date, venue, status support.
- **Mono:** Prices, dates, seat numbers, order refs, ticket fragments, countdowns.

Rules:

- Letter spacing is `0`. Do not use negative tracking.
- Use tabular numbers for prices, counters, seats, times, and order refs.
- Reserve editorial display scale for Home/Event Detail, not Account rows or sheets.
- Keep Account and Checkout typography tighter than Home.

## Layout

The layout is mobile-first and object-led.

Spacing:

- Use a 4/8/12/16/24/32/48 scale.
- Use 16px as default screen side padding on iPhone.
- Use 24px side padding for pass/ticket details when space allows.
- Use 8-12px gaps inside compact row groups.
- Avoid large empty bottom padding on short pages.

Page rhythm:

- Home: poster-led, scrollable, editorial rails.
- Explore: searchable, filterable, fast scan.
- Event Detail: hero image plus immediate ticket types.
- Checkout: compact summary plus precise total.
- Tickets: pass shelf and entry readiness.
- Account: grouped rows.
- Ops: task terminal.

Avoid:

- cards inside cards;
- every section floating in its own panel;
- horizontal overflow;
- large dashboard grids on mobile;
- UI text colliding with nav or tab bars.

## Elevation & Depth

Depth should come from layering, imagery, and pass surfaces, not glow.

Use:

- flat paper surfaces;
- subtle hairline borders;
- modest shadows for pass cards and modal sheets;
- image crop depth on event cards.

Avoid:

- neon glows;
- glassmorphism as a default;
- floating bokeh/orbs;
- decorative diagonal beams;
- depth effects behind QR or payment content.

## Shapes

Corners:

- 4px: tiny marks, dividers, utility chips.
- 8px: row groups, compact controls, filter chips.
- 12px: buttons, event cards.
- 16px: sheets, pass surfaces, checkout summary.
- 24px: major ticket/pass hero only.

Ticket/pass shapes may use:

- subtle perforation;
- a single clipped corner;
- a notch motif;
- clean edge rules.

Avoid literal old-school ticket clip art. Use pass cues with modern restraint.

## Logo System

The logo starts from zero. After the first generated mark board was rejected, V5 logo work moved typography-first. Round 03 custom drawing was rejected as too cartoon-like. Round 04 compared commercially allowed OFL font candidates. The owner selected option 3 from that board: `Inter 700`. Active Round 06 pairs `Inter 700` with a restrained no-letter pass-notch mark.

Brand name: `FanPass`.

Desired qualities:

- readable at app-icon scale;
- strong in one color;
- culturally current;
- premium but not luxury-fashion;
- ticket/pass relevant without clip art;
- no gradient dependence;
- no crypto wallet or exchange cues.

Allowed mark territories:

- folded pass corner;
- stage aperture or doorway of light;
- abstract entry stamp;
- ticket notch;
- compact `F` or `FP` monogram only if it feels live-event, not fintech;
- venue threshold shape.

Avoid:

- chain links;
- shields;
- coins;
- token nodes;
- QR fragments;
- NFC waves;
- diagonal stacked bars;
- lightning tech marks;
- Solana-like striping;
- nightclub chaos;
- generic checkmarks.

Logo quality gate:

1. Works black on white.
2. Works white on black.
3. Works at 24px.
4. Works as a square app icon.
5. Has a recognizable silhouette.
6. Does not need a tagline.
7. Does not resemble crypto, gaming, betting, or stock-trading brands.

Current typography-first routes to compare:

1. **Humanist Premium:** `FanPass` in a warm, modern humanist sans. Current owner-preferred and strongest baseline.
2. **Lowercase Culture:** `fanpass` for a younger app-native voice. Watch authority loss.
3. **Editorial Pass:** `FanPass` in a restrained editorial serif. Watch fashion/magazine drift.
4. **Venue Ticket:** `FANPASS` in a condensed venue/ticket voice. Watch mechanical drift.
5. **Soft Humanist:** friendly and cultural. Watch weak payment/trust authority.
6. **Pass Label:** split `Fan` / `Pass` emphasis. Watch over-obvious product literalism.

Rejected Round 01 mark routes:

- `Folded Pass F`
- `Stage Aperture`
- `Entry Stamp`

They are not active logo recommendations after owner feedback. Their artifacts may remain as archive/reference only.

Generated logo text is directional only. The Round 02 board uses local system fonts only as visual references. Production wordmark work must use a properly licensed commercial font, an open-source font with logo/trademark-friendly terms, or a custom-drawn FanPass outline, followed by optical correction, small-size testing, and trademark review.

Rejected Round 03 custom wordmark:

- `FanPass_VI_Redesign_V5/assets/fanpass-wordmark-v5-custom-humanist-01.svg`
- `FanPass_VI_Redesign_V5/assets/logo-exploration/fanpass-v5-custom-wordmark-board-03.png`

This candidate is self-drawn path/shape work, not live logo text from a font file, but it is not the current brand direction because it felt too cartoon-like.

Active Round 06 Inter logo lockup:

- `FanPass_VI_Redesign_V5/assets/fanpass-wordmark-v5-inter-700.svg`
- `FanPass_VI_Redesign_V5/assets/fanpass-mark-v5-inter-pass-notch-minimal.svg`
- `FanPass_VI_Redesign_V5/assets/fanpass-app-icon-v5-inter-pass-notch-minimal.svg`
- `FanPass_VI_Redesign_V5/assets/logo-exploration/fanpass-v5-inter-logo-board-06.png`
- `FanPass_VI_Redesign_V5/docs/FanPass_V5_Font_Licenses.md`

Use `Inter 700` as the selected wordmark base. It is under SIL Open Font License 1.1 in the local `assets/fonts/inter/OFL.txt` snapshot. Because Inter is intentionally neutral, the pass-notch mark should carry the FanPass-specific entry/pass identity.

## App Icon

The app icon should feel like a modern event pass.

Preferred:

- one strong mark;
- warm paper or ink base;
- subtle pass dimensionality;
- restrained red/brass/cobalt accent;
- no typography unless it remains legible at small size.

Avoid:

- full gradients;
- QR patterns;
- busy poster collage;
- floating particles;
- chain/network diagrams;
- neon glow.

## Components

### Event Card

Purpose: browse and choose events.

Anatomy:

- image/poster area;
- date;
- event title;
- venue/city;
- price or availability;
- optional compact status.

States:

- default;
- pressed;
- saved;
- sold out;
- loading skeleton;
- no image fallback.

Rules:

- Image leads; text stays to 1-2 lines.
- Price and date must be visible without opening detail.
- Do not use real copyrighted artist posters in demo.

### Ticket Pass

Purpose: hold and use a verified ticket.

Anatomy:

- event title;
- date/time;
- venue;
- ticket type or seat;
- entry readiness;
- ticket fragment;
- action area.

States:

- active;
- entry ready;
- listed;
- transfer pending;
- redeemed;
- cancelled;
- refunded;
- expired.

Rules:

- QR appears only after owner action.
- QR quiet zone is visually clean.
- Status uses text and color, not color alone.
- Pass should feel premium and calm, not promotional.

### Button

Primary:

- solid Signal Red or Ink depending on context;
- 44px minimum height;
- clear active/disabled/loading states.

Secondary:

- paper/transparent fill;
- hairline border;
- Ink or Cobalt text.

Destructive:

- semantic danger;
- confirmation required when irreversible.

### Row Group

Purpose: Account, orders, alerts, settings.

Rules:

- compact grouped rows;
- title plus value or title plus one short subtitle;
- never title + subtitle + value + footer in one row;
- use chevrons/toggles/pickers where expected.

### Pill

Purpose: status only.

Rules:

- use sparingly;
- text required;
- no pill clouds for ordinary metadata.

### Image

Rules:

- images need explicit dimensions in web implementation;
- above-fold hero images need priority/fetch priority;
- below-fold images lazy-load;
- every meaningful image needs alt text;
- decorative images use empty alt.

## Screen Rules

### Home

Home is the live-culture front door.

Required:

- poster-led first screen;
- city/taste context;
- search as quiet utility;
- compact rails for tonight, nearby, new, and recommended;
- next ticket preview only if relevant;
- no dashboard metrics in first viewport.

### Explore

Explore is search and scanning.

Required:

- category chips;
- date/city filters;
- event cards;
- venue and artist entry points;
- empty/no-result recovery.

### Event Detail

Event Detail is the purchase decision page.

Required:

- image/poster header;
- event title, date, venue;
- immediate ticket type list;
- all-in visible price where possible;
- resale cap and transfer rules;
- Fan Access if relevant.

Do not bury ticket types below long copy.

### Checkout

Checkout is premium-pass precision.

Required:

- compact event summary;
- price, fees, total;
- payment method;
- rules before pay;
- clear waiting and failure states.

Avoid provider IDs, client secrets, crypto execution language, and decorative checkout art.

### Tickets

Tickets is the pass shelf.

Required:

- upcoming/active pass first;
- listed/pending/redeemed/cancelled/refunded states;
- clear route to Ticket Detail;
- safe ticket fragments only.

No QR on list cards.

### Ticket Detail / Entry Pass

This is the strongest premium-pass surface.

Required:

- beautiful pass surface;
- event identity;
- section/row/seat or ticket type;
- entry state;
- owner-triggered entry code;
- countdown and refresh state;
- venue readiness actions.

Never show nonce, signature, raw payload, or full proof internals.

### Market

Market is resale clarity, not trading.

Required:

- lowest available resale;
- face value;
- price cap;
- recent verified sale;
- listing count;
- clear listing rules.

Avoid candlesticks, flashing red/green boards, exchange depth drama, leverage metaphors, and crypto words.

### Account

Account is compact utility.

Required:

- grouped list rows;
- masked identity;
- orders;
- payment labels;
- alerts;
- privacy/security;
- support.

Avoid promotional cards, long paragraphs, QR, and provider internals.

### FanPass Ops

Ops is an onsite terminal.

Required:

- large scan action;
- gate/event assignment;
- unmistakable accepted/rejected states;
- fast scan-next loop;
- high contrast;
- minimal decoration.

## Content Standards

Preferred terms:

- Verified ticket
- Official ticket
- Secure resale
- Entry pass
- Ready for entry
- Price cap
- Recent sale
- Fan Access
- Ticket history
- Transfer limit

Avoid primary UI terms:

- NFT
- token
- mint
- gas
- chain
- blockchain
- wallet address
- smart contract
- orderbook
- degen
- pump
- moon

Copy rules:

- Short labels first.
- Use one-sentence explanation only for payment, entry, resale rules, privacy, security, and failure recovery.
- Error messages include a next step.
- Loading states end with an ellipsis in web UI.
- Use local currency/date formatting with `Intl.*` in web code.

## Privacy

Never render in normal UI:

- raw QR payload;
- nonce;
- signature;
- full wallet address;
- owner ID;
- access token;
- bearer token;
- client secret;
- private key;
- seed phrase;
- full payment provider ID;
- real personal data;
- unlicensed real artist/event imagery.

Allowed masked examples:

- `TKT-7F3A`
- `ORD-91C2`
- `Ticket identity ...8A2F`
- `Visa ...4242`

## Accessibility & Implementation

Use Vercel Web Interface Guidelines and native platform equivalents as implementation gates.

Required:

- 44px/44pt minimum practical tap target.
- Icon-only buttons need labels.
- Form fields need labels.
- Focus-visible state must be visible.
- Status must not rely on color alone.
- QR quiet zone must stay clean.
- Respect Reduce Motion.
- Avoid `transition: all`.
- Use semantic elements on web.
- Use `Intl.DateTimeFormat` and `Intl.NumberFormat`.
- Prevent horizontal overflow.
- Do not disable zoom.

## Do's And Don'ts

Do:

- lead with event identity and imagery;
- keep tickets/pass surfaces premium and precise;
- make resale rules obvious;
- use warm editorial neutrals;
- use Signal Red sparingly;
- keep Account compact;
- hide infrastructure behind user language.

Don't:

- use V4 cyan/violet/magenta as the brand;
- use crypto symbols or vocabulary;
- make Home a dashboard;
- make Market a trading terminal;
- place QR in list contexts;
- use unlicensed real event imagery;
- use decorative effects behind payment, QR, or entry content.

## V5 Quality Gate

Before handoff:

1. Does the UI still smell like crypto/Solana? If yes, redesign.
2. Does Home feel like live culture first? If no, redesign.
3. Does Ticket Detail feel like a premium pass? If no, redesign.
4. Does Market avoid trading visuals? If no, redesign.
5. Is Account compact and list-first? If no, redesign.
6. Is the logo usable in one color at 24px? If no, redesign.
7. Are all demo images licensed/generated and not real copyrighted posters? If no, replace.
8. Are privacy/proof/payment internals hidden? If no, fix.
9. Are components responsive and accessible? If no, fix.
10. Did simulator/browser QA pass for changed screens? If no, do not hand off.

## Next Logo Step

Current logo task:

1. Continue from `FanPass_VI_Redesign_V5/assets/fanpass-wordmark-v5-inter-700.svg` and `FanPass_VI_Redesign_V5/assets/fanpass-mark-v5-inter-pass-notch-minimal.svg`.
2. Tune tracking and icon geometry without making the mark cartoon-like.
3. Test black-on-white, white-on-black, header scale, app launch scale, ticket/pass surface scale, and 24px small size.
4. If the mark stripes blur at 24px, simplify to silhouette plus red entry bar.

The next board should show shortlisted wordmarks in:

- black on white;
- white on black;
- navigation/header scale;
- app launch scale;
- ticket/pass surface scale;
- paired with a very simple mark placeholder.

Do not treat generated logo boards as final trademark-cleared vector assets.
