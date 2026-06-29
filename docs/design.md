# FanPass iOS Design Guide

Last updated: 2026-06-29.

## Intent

FanPass should feel like a premium ticket app, not a dashboard. The default surface is image-first discovery, short status labels, compact rows, and calm dark chrome. Explanatory copy belongs only where it prevents a real mistake: checkout, entry, resale rules, privacy, and irreversible wallet/account actions.

## References Read

- DICE App Store listing and screenshots via Apple iTunes Lookup: image-led home feed, short category rail, concise event rows, upfront pricing language.
- SeatGeek App Store listing and screenshots via Apple iTunes Lookup: seat map and ticket rows, large price signal, minimal row copy, trust/value features.
- Eventbrite App Store listing via Apple iTunes Lookup: personalized discovery, saved tickets, account-managed social/following, practical event readiness.
- GitHub `VoltAgent/awesome-design-md` and `bergside/awesome-design-skills`: DESIGN.md as durable agent-readable design rules with tokens, component behavior, do/don't rules, responsive guidance, and quality gates.
- GitHub `bergside/design-md-chrome`: safe extraction idea only; no external scripts were executed. Useful structure: mission, brand, style foundations, accessibility, writing tone, do/don't rules, quality gates.

## Product Principles

1. Image and event identity first. Discovery screens should lead with poster/photo surfaces and event names, not explanatory cards.
2. One sentence is usually too much. Prefer labels, values, and terse state names.
3. Cards are for objects, not page sections. Do not wrap every paragraph or row in a card.
4. Account is a settings list. It should feel like iOS settings plus ticketing-specific controls, not a brochure.
5. Trust is shown through state and constraints. Use `Verified`, `Cap`, `Ready`, `2 transfers`, `Refunded`, and similar compact states.
6. Crypto/provider internals stay hidden unless a support or wallet action strictly needs them.

## Visual Rules

- Background: keep the dark app chrome, but reduce stacked dark rectangles. Prefer transparent sections, hairline dividers, and single-level surfaces.
- Surfaces: use heavy cards only for tickets, QR/entry panels, checkout summaries, modals, and destructive/security flows.
- Corners: keep cards at 8-16 pt. Use larger radii only for bottom tab chrome and major hero imagery.
- Borders: use low-opacity borders. Avoid repeated full-box outlines in consecutive rows.
- Shadows: reserve large shadows for hero/ticket imagery. Default list rows should have no shadow.
- Accent color: cyan/magenta gradients are reserved for primary actions and brand moments. Do not turn every status into neon.
- Typography: page titles can be large; row titles should be compact. Avoid hero-scale text inside settings, cards, and sheets.

## Copy Rules

- Home: event name, date, venue, price. No trust lectures.
- Explore: search, filters, concise category/state names. Avoid long trend paragraphs.
- Market: values and rules, not trading-terminal explanations.
- Tickets: entry state and ticket identity. Explain only expired, blocked, or risky states.
- Account: row title, optional one-line value. Avoid subtitles unless needed for disambiguation.
- Checkout/payment: clear state copy is allowed, especially for network confirmation and irreversible payment.

## Component Rules

- `FPSurfaceCard`: default should be light-weight. Use it sparingly and do not nest it.
- `FPConceptRowView`: row-first, divider-like, not mini-card-first.
- `FPSectionHeader`: title plus optional action. Subtitles should be rare.
- Event cards: poster plus 1-2 lines. Price and date are stronger than helper text.
- Settings groups: compact grouped lists with icons, values, and chevrons. Avoid footer notes unless they prevent misuse.

## AI/Agent Quality Gate

Before handing off iOS UI work:

1. Scan changed screens for card stacking: no card inside card, no more than one heavy surface per viewport unless the page is a ticket/checkout detail.
2. Count visible copy: if a row has title + subtitle + value + footer note, remove at least one.
3. Check Home first. It must not look less polished than Account.
4. Run the simulator and inspect screenshots for top/bottom empty space, scroll indicators, clipped text, overlapping tab bar, and repeated dark boxes.
5. Keep copied competitor insight abstract. Do not copy screenshots, proprietary art, exact layouts, or brand language.
