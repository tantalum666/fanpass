# FanPass V5 Backstage Pass

Status: owner-approved staged implementation; not yet a complete production-baseline replacement.
Created: 2026-06-29. Implementation started: 2026-07-25.

The owner approved continuing V5 on 2026-07-25. The first maintained slice now powers consumer Home, Explore, and Event Detail while Market, Tickets, Account, Checkout, Fan Access, and Ops retain their existing V4 presentation until each flow receives its own migration and QA pass.

## Preserved Work

- `FanPass_V5_Design_Draft.md`: unapproved V5 design contract draft moved out of active `docs/design.md`.
- `FanPass_V5_Logo_Brief.md`: logo exploration decisions and rejected routes.
- `FanPass_V5_Font_Licenses.md`: OFL font sources and constraints.
- `assets/fanpass-wordmark-v5-inter-700.svg`: selected wordmark candidate.
- `assets/fanpass-mark-v5-inter-pass-notch-minimal.svg`: selected mark candidate.
- `assets/fanpass-app-icon-v5-inter-pass-notch-minimal.svg`: selected app-icon candidate.
- `assets/logo-exploration/`: comparison boards and rejected rounds.
- `assets/fonts/`: local exploration fonts and their license files.

## Implemented Slice

- V5 semantic tokens live in `apps/ios/FanPass/FanPass/DesignSystem/FPV5Tokens.swift`; they are isolated from V4 tokens so a partial migration cannot silently recolor transactional screens.
- Shared V5 discovery/conversion components live in `apps/ios/FanPass/FanPass/Views/Components/FanPassV5Components.swift`.
- Home exposes real catalog-city selection, real Explore search handoff, Account routing, published event cards, and the next owned pass when available. Concept notification/favorite/search sheets were removed.
- Explore has real catalog search plus city/category filters, compact campaign-backed Fan Access, result recovery, and maintained discovery intent across the tab handoff.
- Event Detail puts event context and ticket choices before sale transparency and resale context, preserves inventory/auth/checkout gates, and hides the tab bar during the focused purchase path.
- The selected Round 06 mark is used at header scale. The selected app icon now has a square source background for correct iOS masking and generated opaque PNG renditions for every declared icon size.
- Same-state 368x800 simulator comparisons were reviewed for Home, Explore, and Event Detail. Beta builds pass; the six current Debug unit tests and both iOS distribution-boundary audits pass.

Copied V4 assets and duplicate V4 Markdown were removed from this directory during repository cleanup. Compare against the canonical sibling package `FanPass_VI_Redesign_V4/` instead.

## Remaining Approval And Release Gate

1. Migrate and visually verify Market, Tickets, Ticket Detail, Checkout, Account, Fan Access, and FanPass Ops screen by screen; do not globally recolor them.
2. Complete VoiceOver, Dynamic Type, Reduce Motion, and physical-device small-size checks.
3. Refresh candidate-bound TestFlight and physical-iPhone evidence after Apple agreement/signing blockers are cleared. Historical TestFlight/QR evidence remains valid only for its dated builds.
4. Complete trademark review before treating the selected logo as commercially cleared.
5. Obtain owner approval before declaring V5 the full production baseline or submitting it publicly.
