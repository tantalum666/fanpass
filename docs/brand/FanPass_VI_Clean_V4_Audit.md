# FanPass VI Clean V4 Audit

Status: approved visual identity source for next UI/UX implementation.
Date: 2026-06-05
Source of truth: `FanPass_VI_Redesign_V4/`

Clean V4 replaces earlier V3/V4 draft assets for implementation decisions. Do not redesign the FanPass logo, app icon, color direction, or brand style from scratch.

## Final Brand Positioning

FanPass is a premium native iOS ticketing and verified resale platform for global live events.

The product should feel closer to Apple Wallet, DICE, Ticketmaster, SeatGeek, and fintech products than a crypto exchange. Blockchain-backed records, proof, and ownership history are part of the infrastructure layer, not the consumer-facing personality.

Core positioning:

- Premium Concert Pass.
- Web3 Trust Layer.
- Mainstream verified ticketing.
- Fair resale and transparent prices.
- iOS-native, global, high-trust, fan-first.

Preferred consumer language:

- Verified Ticket.
- Secure Resale.
- Fan Access.
- Proof & History.
- Transparent Prices.
- NFC Ready.

Avoid primary consumer labels such as `NFT`, `gas fee`, `seed phrase`, `mint`, `ape`, `degen`, `pump`, or `moon`.

## Confirmed Logo Usage

Use the V4 mark and lockup only:

- `FanPass_VI_Redesign_V4/assets/fanpass-mark-v4.svg`
- `FanPass_VI_Redesign_V4/assets/fanpass-mark-v4.png`
- `FanPass_VI_Redesign_V4/assets/fanpass-horizontal-lockup-v4.svg`
- `FanPass_VI_Redesign_V4/assets/fanpass-horizontal-lockup-v4.png`

Rules:

- Do not redraw, re-proportion, rotate, stretch, outline, or add new metaphors to the mark.
- Do not add NFC waves, QR fragments, chains, coins, shields, or extra strokes around the logo.
- Do not place decorative lines behind or across the logo.
- Use the mark alone for app icon, compact navigation, and small identity moments.
- Use the horizontal lockup for docs, brand headers, slides, and product overview contexts.

## Confirmed Color System

Use the V4 palette from `FanPass_VI_Redesign_V4/docs/fanpass-brand-tokens-v4.json`.

| Role | Hex | Usage |
| --- | --- | --- |
| Night | `#020617` | Primary dark background. |
| Surface | `#0B1224` | Main cards and grouped content. |
| Elevated Surface | `#111827` | Ticket cards, overlays, high-priority panels. |
| Pulse Cyan | `#46E8FF` | NFC, focus, verified signal accents. |
| Electric Violet | `#7C3AED` | Primary brand action and premium energy. |
| Neon Magenta | `#F43FDA` | Rare accent, chart highlight, pass glow edge. |
| Verified Green | `#22C55E` | Verified, accepted, successful proof states. |
| Text Primary | `#F8FAFC` | Main text on dark backgrounds. |
| Text Secondary | `#AAB4C5` | Metadata and secondary labels. |
| Border | `#23314A` | Dividers, card boundaries, quiet outlines. |

Primary gradient:

`linear-gradient(135deg, #46E8FF 0%, #7C3AED 45%, #F43FDA 100%)`

Background gradient:

`radial-gradient(circle at 18% 8%, #2E1065 0%, #07152A 48%, #020617 100%)`

## Confirmed Typography Direction

Use Apple system typography only.

- Use SF Pro Display-style scale for event titles, pass titles, and major ticket state.
- Use SF Pro Text-style scale for body copy, forms, lists, controls, and metadata.
- Use monospaced digits for prices, ticket IDs, row/seat values, time windows, counters, and audit fragments.
- Keep type sharp, clear, and premium; avoid childish rounded display type.
- Do not use negative letter spacing.

## Confirmed Icon Style

Icons should feel compatible with SF Symbols:

- 24 pt grid.
- 2 pt rounded stroke.
- Rounded caps and joins.
- Filled icons only for selected states or strong verification states.
- NFC waves must be contained icons or component-level indicators.
- Avoid crypto-native icons such as coins, token nodes, seed phrases, or meme symbols.

## Confirmed Ticket Card Style

The V4 ticket card is the best reference for future ticket surfaces:

- Large premium rounded card.
- Strong dark surface with clear border.
- V4 gradient edge may be used on important ticket cards.
- Text stays inside the ticket boundary.
- QR code has a clean quiet zone.
- Proof & History sits inside a contained panel.
- NFC Ready is a pill or contained state, not a background decoration.
- Seating metadata is spacious and readable.

## Confirmed UI Atmosphere

The UI should feel:

- Premium.
- Trustworthy.
- iOS-native.
- Global.
- Calm enough for payments and resale.
- Energetic enough for live-event anticipation.
- Mainstream enough that Web3 infrastructure is not the dominant visual signal.

Avoid:

- Crypto exchange dashboards.
- Gambling/betting energy.
- Trading-floor visuals.
- Meme NFT aesthetics.
- Decorative line art that competes with content.

## Visual Rules For Gradients

- Gradients may be used for the logo, app icon, selected premium ticket edges, primary action moments, and rare brand highlights.
- Gradients must not reduce text contrast.
- Do not use full-screen decorative streaks.
- Do not place glow strokes across content.
- Use flat dark surfaces for lists, forms, scanner states, checkout, and operational views.
- In charts, gradients are allowed only inside the chart plot area and must not cross labels or numeric values.

## Visual Rules For NFC Graphics

- NFC waves may only be used as contained icons, small indicators, or background shapes below 8% opacity.
- NFC waves must not appear behind important text.
- NFC waves must not cross QR codes, ticket IDs, prices, buttons, navigation, charts, or logos.
- Use NFC graphics primarily for scan readiness, Proof & History, and scanner animations.
- If an NFC wave risks cluttering a surface, replace it with a simple `NFC Ready` pill.

## Visual Rules For Ticket Cards

- Ticket cards need strong internal padding: minimum 20 pt on iPhone, 24 pt on larger surfaces.
- Keep title, date, venue, seat metadata, QR, and proof states in separate readable zones.
- QR quiet zone must be visually clean and uncluttered.
- Decorative edges must stay on the card boundary only.
- Ticket metadata must never touch notches, cutouts, or rounded edges.
- Proof & History belongs in its own contained panel.
- Do not let market charts overlap the ticket card unless explicitly in a separate market panel.

## Visual Rules For Market Charts

- FanPass market data supports transparent resale, not speculation.
- Charts must be calm and bounded.
- Chart lines must stay inside chart plot areas.
- Do not let chart lines cross price labels, floor prices, buttons, tabs, axis labels, or summary values.
- Use readable numeric values before decorative chart motion.
- Avoid red/green trading-candle language unless the context is operational and explicitly needed.
- Prefer labels like `Transparent Prices`, `Resale Range`, `Organizer Cap`, and `Recent Sales`.

## Visual Rules For Dark Mode

Dark mode is the primary consumer app mode.

- Use `Night` as the root background.
- Use `Surface` and `Elevated Surface` for grouped cards and tickets.
- Keep text high contrast.
- Use cyan/violet/magenta as accents, not page-wide decoration.
- Use green only for actual verified or accepted states.
- Scanner decisions must be obvious with text, icon, and color.

## Visual Rules For Light Mode

Light mode is secondary and should support Console, documents, academic review, and dense operational views.

- Use dark text on clean neutral surfaces.
- Preserve V4 color semantics with darker variants when needed for contrast.
- Reduce glow and gradient intensity.
- Keep tables, forms, and charts quieter than the consumer ticket wallet.
- Do not simply invert dark-mode glass effects.

## Accessibility Notes

- Main text must meet WCAG AA contrast at minimum.
- Do not use cyan, violet, or magenta as low-contrast body text on dark surfaces.
- Status must not rely on color alone; pair labels and icons.
- QR code quiet zone must remain clear.
- NFC/scan animation must respect Reduce Motion.
- Market prices and seat values need monospaced digits and sufficient size.
- Minimum practical iOS tap target is 44 pt.
- Glassmorphism must not reduce text or QR readability.

## Do And Don't

### Do

- Use V4 assets as the only visual identity source.
- Use `FanPass_VI_Redesign_V4/docs/fanpass-brand-tokens-v4.json` for colors.
- Keep cards clean, padded, and readable.
- Use contained pills for Verified Ticket, NFC Ready, and Secure Resale.
- Keep market data readable and clearly bounded.
- Use Proof & History as a trust layer, not a crypto gimmick.
- Keep future UI iOS-native and premium.

### Don't

- Do not redesign the logo.
- Do not create a new app icon.
- Do not add decorative lines that cross content.
- Do not place NFC waves behind important text.
- Do not place glow strokes across the interface.
- Do not make the app look like a crypto, stock trading, gambling, or betting product.
- Do not use real artist names, posters, venues, or copyrighted imagery.
- Do not use crypto-heavy primary labels.
- Do not let ticket text overflow outside card boundaries.
- Do not let charts cover prices or labels.
