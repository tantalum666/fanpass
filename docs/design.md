# FanPass V4 iOS Design Guide

Status: active production design baseline.
Last updated: 2026-07-12.

V5 is an unfinished brand exploration under `FanPass_VI_Redesign_V5/`. It must not be shipped or used as the iOS implementation baseline until the owner explicitly approves it.

## Intent

FanPass should feel like a premium ticket app, not a dashboard. The default surface is image-first discovery, short status labels, compact rows, and calm dark chrome. Explanatory copy belongs only where it prevents a real mistake: checkout, entry, resale rules, privacy, and irreversible wallet/account actions.

## Product Principles

1. Image and event identity first. Discovery screens lead with poster/photo surfaces and event names, not explanatory cards.
2. Prefer labels, values, and terse state names over paragraphs.
3. Cards are for objects, not page sections. Do not wrap every paragraph or row in a card.
4. Account is a complete settings list. It should feel like iOS settings plus ticketing controls, not a brochure.
5. Trust is shown through state and constraints: `Verified`, `Cap`, `Ready`, `Used`, transfer count, and refund state.
6. Provider and chain internals stay hidden unless support or a wallet action strictly needs them.
7. Backend state is authoritative for payments, ownership, resale, and redemption. UI must not report local-only success.

## Visual Rules

- Keep the dark app chrome, but reduce stacked dark rectangles. Prefer transparent sections, hairline dividers, and single-level surfaces.
- Use heavy cards only for tickets, QR/entry panels, checkout summaries, modals, and destructive/security flows.
- Keep ordinary cards at 8-16 pt radius. Larger radii are reserved for bottom tab chrome and major hero imagery.
- Use low-opacity borders. Avoid repeated full-box outlines in consecutive rows.
- Reserve large shadows for hero/ticket imagery. Default list rows have no shadow.
- Cyan/magenta gradients are reserved for primary actions and brand moments. Do not turn every status into neon.
- Page titles can be large; row titles stay compact. Avoid hero-scale text inside settings, cards, and sheets.
- Every published event should use its assigned cover asset. A backend catalog refresh must not silently replace artwork with a generic gradient.

## Copy Rules

- Home: event name, date, venue, price. No trust lectures.
- Explore: search, filters, concise category/state names.
- Market: values and rules, not trading-terminal explanations.
- Tickets: entry state and ticket identity. Explain only expired, listed, used, blocked, or risky states.
- Account: row title and optional one-line value. Keep all supported destinations visible; unsupported actions must say `Unavailable`, never fake success.
- Checkout/payment: clear state copy is allowed, especially for authorization, network confirmation, lease expiry, and irreversible payment.

## Component Rules

- `FPSurfaceCard`: use sparingly and never nest it.
- `FPConceptRowView`: row-first and divider-like, not mini-card-first.
- `FPSectionHeader`: title plus optional action; subtitles should be rare.
- Event cards: poster plus 1-2 lines. Price and date are stronger than helper text.
- Settings groups: compact grouped lists with icons, values, and chevrons. Avoid footer notes unless they prevent misuse.

## Active Assets

- Approved V4 package: `FanPass_VI_Redesign_V4/`.
- Bundled iOS event covers: `apps/ios/FanPass/FanPass/Assets/event-cover-*.png`.
- SwiftUI design system: `apps/ios/FanPass/FanPass/DesignSystem/`.
- V5 draft only: `FanPass_VI_Redesign_V5/`.

## Quality Gate

Before handing off iOS UI work:

1. Scan changed screens for card stacking and repeated heavy surfaces.
2. Remove redundant title/subtitle/value/footer combinations.
3. Check Home first; it must not look less complete than Account.
4. Run the simulator and inspect Home, Account, Tickets, and any changed flow for empty space, clipped text, overlap, missing media, and incorrect signed-in state.
5. Verify backend-backed entities retain their V4 presentation metadata and never fall back to mock transactional state.
6. Keep competitor insight abstract; do not copy proprietary art, exact layouts, or brand language.
