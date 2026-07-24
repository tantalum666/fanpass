# FanPass UI Guardrails

Status: strict implementation rules for the currently shipped V4 UI/token/component system. The owner-selected V5 logo route remains pre-production and does not supersede these rules until an approved migration is implemented and verified.
Date: 2026-06-05
Source of truth for implemented UI: Clean V4 assets in `FanPass_VI_Redesign_V4/`

These rules are intentionally strict. If a visual idea conflicts with this document, remove the visual idea.

## Non-Negotiable Rules

1. No decorative line may overlap text, QR code, barcode, logo, button, input field, chart label, price, ticket metadata, navigation bar, tab bar, scanner decision, or payment state.
2. NFC wave graphics may only be used as contained icons, small indicators, scanner animation elements, or background shapes with opacity below 8%.
3. Background effects must stay behind safe content areas and must not reduce legibility.
4. All ticket cards must have enough padding for title, metadata, status pills, QR, proof panels, and legal notes.
5. QR codes must have a clear quiet zone with no gradients, waves, strokes, shadows, logos, badges, or text intruding.
6. Price and market data must be readable before any chart styling is considered.
7. Charts must not cross over numeric values, axis labels, legends, price captions, or call-to-action controls.
8. Glassmorphism must be subtle and must not reduce contrast.
9. Text contrast must remain readable in dark mode.
10. Current implementation work must follow V4. The selected V5 logo may enter only through an explicit, QA-backed brand migration; earlier experiments remain historical references.

## Decorative Line Policy

Allowed:

- Borders around cards.
- Ticket edge strokes.
- Dividers between rows.
- Chart lines inside bounded chart plot areas.
- Contained NFC icon strokes.

Not allowed:

- Diagonal lines across page backgrounds.
- Glow strokes crossing text or controls.
- Decorative curves behind QR codes.
- Lines that pass behind the logo or app icon.
- Chart lines extending outside the chart area.
- Proof graphics that act like full-page decoration.

## NFC Graphic Policy

Use NFC graphics only for:

- `NFC Ready` indicators.
- Scanner readiness.
- Proof & History panels.
- Small status icons.
- Low-opacity background motifs below 8% opacity, outside content-critical zones.

NFC graphics must not touch:

- Event titles.
- Seat metadata.
- QR quiet zones.
- Buttons.
- Price values.
- Market charts.
- Navigation.
- Login forms.
- Checkout controls.

## Background Effects

- Background gradients must stay behind layout-safe areas.
- Use the V4 background gradient sparingly.
- Keep dark surfaces flat where content density is high.
- Do not add bokeh/orb decorations.
- Do not create full-screen diagonal light beams.
- If text sits on an effect, add a solid or nearly solid surface behind the text.

## Ticket Cards

Minimum structure:

- Event title and metadata zone.
- Verified/NFC status zone.
- QR zone with quiet zone.
- Seat/section metadata zone.
- Proof & History contained panel.
- Ticket ID and resale rule metadata.

Rules:

- Minimum inner padding is 20 pt on iPhone and 24 pt on larger surfaces.
- QR quiet zone should visually read as empty space around the code.
- Status pills must not collide with title or QR.
- Ticket ID and resale rules must remain inside the card.
- Decorative edge strokes must stay on the card boundary.
- Do not place NFC waves behind the ticket title or QR.

## Market Charts

FanPass charts explain transparent resale. They should never feel like speculative trading.

Rules:

- Keep charts inside chart containers.
- Keep the price value outside the chart plot path.
- Keep axes and labels readable.
- Use no more than three active chart colors in one small mobile chart.
- Use magenta only for a meaningful highlight, not every line.
- Use amber for organizer caps or warnings.
- A restrained candlestick view is allowed in consumer Market only for verified settled resale history after explicit owner approval. Never synthesize candles, imply continuous liquidity, or add speculative indicators/high-frequency animation.

## Buttons And Inputs

- Primary buttons use the V4 brand gradient only when the action is high-value and singular.
- Secondary buttons use surface fill plus border.
- Destructive actions use red semantic styling, not brand gradient.
- Inputs use clear border/focus state; focus rings may use Pulse Cyan.
- Text inside buttons must not shrink below readable size.
- Buttons must not sit on busy gradients without a contrast-safe surface.

## Dark Mode Contrast

- `#F8FAFC` is the default primary text on dark backgrounds.
- `#AAB4C5` is acceptable for secondary text when size is sufficient.
- Avoid magenta or cyan body copy on `Night`.
- Use a solid surface behind text when background gradients are visible.
- Do not place small gray text on glass without contrast verification.

## Light Mode Contrast

- Use light mode mostly for Console and dense operational views.
- Use dark text, restrained accents, and flat surfaces.
- Do not copy dark-mode glow effects directly into light mode.
- Ensure cyan/violet controls meet contrast requirements on white or pale backgrounds.

## Review Checklist

Before any UI handoff, verify:

- Brand looks premium, trustworthy, global, and iOS-native.
- Brand does not look like gambling, stock trading, or crypto speculation.
- Logo works at small sizes.
- App icon has no obstructing lines.
- Ticket card text stays inside boundaries.
- QR has a clear quiet zone.
- Charts do not cover prices.
- NFC graphics do not block content.
- Glass surfaces preserve contrast.
- Current shipped UI work follows V4 until an explicit V5 brand migration is approved and verified.
