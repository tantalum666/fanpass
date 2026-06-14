# FanPass Asset Usage Guide

> Superseded on 2026-06-05 by Clean V4. Use `docs/brand/FanPass_VI_Clean_V4_Audit.md`, `docs/brand/FanPass_UI_Guardrails.md`, and `assets/brand/README.md` for current asset usage.

Status: asset and token usage guidance for VI foundation.
Date: 2026-06-04
Related files:

- `docs/archive/brand-v0/FanPass_Visual_Identity.md`
- `docs/archive/brand-v0/FanPass_Brand_Tokens.md`
- `docs/brand/fanpass-brand-tokens.json`
- `assets/archive/brand-v0/`
- `apps/ios/FanPass/FanPass/DesignSystem/`

## Core Assets

| Asset | Use |
| --- | --- |
| `fanpass-logo-mark.svg` | App headers, compact product identity, favicons, presentation badges. |
| `fanpass-wordmark.svg` | Brand title moments where the mark is already nearby or unnecessary. |
| `fanpass-horizontal-lockup.svg` | Docs, slides, product headers, partnership-safe contexts. |
| `fanpass-app-icon.svg` | iOS app icon concept source and presentation icon. |
| `fanpass-ticket-illustration.svg` | Ticket wallet, onboarding, empty states, academic presentation visuals. |
| `fanpass-nfc-wave.svg` | NFC readiness, scanning, dynamic entry, tap-to-verify moments. |
| `fanpass-verified-badge.svg` | Verified ticket, accepted entry, proof, and trust explanations. |

## Logo Spacing

Use the logo mark's internal F stem width as the spacing unit `x`.

| Context | Minimum Clear Space |
| --- | --- |
| Logo mark alone | `1x` on all sides. |
| Horizontal lockup | `1x` above/below, `1.5x` left/right. |
| App icon | Keep the mark inside the iOS safe area; no text inside the icon. |
| Dense UI header | Keep at least 12 pt around the mark. |
| Presentation slide | Keep at least 24 px around the lockup. |

Do not place the mark closer than the clear-space rule to buttons, QR codes, partner logos, venue marks, or status labels.

## Correct Logo Usage

- Use the full-color mark on dark night backgrounds.
- Use the horizontal lockup in docs, slides, web headers, and product overview pages.
- Use the mark alone in app icon, tab bar identity, compact scanner surfaces, and small badges.
- Use a monochrome white version only when the full-color gradient would reduce legibility.
- Keep the mark upright and centered when used as an icon.

## Incorrect Logo Usage

- Do not stretch, skew, rotate, or add perspective.
- Do not place the logo over busy photos or real concert posters.
- Do not put the logo inside another shield, coin, QR code, chain, or blockchain-node graphic.
- Do not add extra glow effects beyond the approved gradient/shadow system.
- Do not recolor the mark into warning or danger colors unless it is a deliberately monochrome emergency fallback.
- Do not add small text inside the app icon.
- Do not use competitor colors, layouts, logos, or proprietary styles as direct references.

## Gradient Usage

Use gradients as controlled event atmosphere.

| Gradient | Use |
| --- | --- |
| `passAurora` | Premium ticket art, primary brand moments, selected pass surfaces. |
| `iconNight` | App icon, launch visuals, deep night backgrounds. |
| `scanPulse` | NFC readiness, scanning, verified signal. |
| `resaleSignal` | Bounded resale data highlights, not speculative trading moments. |
| `glassEdge` | Thin edge treatment on glass cards and elevated pass surfaces. |

Rules:

- Use one primary gradient per surface.
- Keep most UI surfaces flat or subtly tinted.
- Avoid large decorative blobs or floating orbs.
- Do not use gradients for warning, rejection, audit logs, or dense data tables.
- Do not make price charts look like crypto trading dashboards.

## Dark Mode Usage

Dark mode is the default FanPass consumer atmosphere.

- Use `background.night` as the page base.
- Use `surface.card` for grouped content and `surface.glass` for elevated ticket surfaces.
- Keep primary text at `text.primary`; avoid neon text for body copy.
- Use `verifiedGreen` only when a ticket, scan, or proof state is actually successful.
- Use cyan for live signal states, NFC readiness, and focus.
- Use violet for primary brand action and premium event moments.

## Light Mode Usage

Light mode should feel operational and trustworthy, not washed out.

- Use light mode mainly for Console, docs, academic review, and dense admin workflows.
- Keep backgrounds soft neutral, with white surfaces and dark text.
- Reduce gradient intensity by using it for edges, icons, or small moments.
- Preserve status color semantics from dark mode.
- Check contrast for violet and cyan actions on white backgrounds; prefer darker light-mode variants when needed.

## Accessibility Notes

- Body text should target at least WCAG AA contrast.
- Do not rely on color alone for ticket status; pair color with labels and icons.
- Scanner success/failure must include clear text, haptic-compatible timing, and high-contrast color.
- Dynamic QR/NFC readiness should respect Reduce Motion.
- Use monospaced digits for prices, counts, proof fragments, and audit IDs.
- Keep tap targets at or above iOS guidance, with 44 pt as the practical minimum.
- Avoid low-contrast cyan or violet text on dark glass surfaces.

## Web3 Visual Elements

Use Web3-inspired visuals when they explain trust without creating crypto friction.

Use them for:

- Ownership History.
- Proof and verification detail.
- Secure Resale constraints.
- Ticket lifecycle and chain-of-custody explanations.
- Academic or organizer-facing architecture views.
- Subtle credential layers and provenance trails.

Do not use them for:

- Consumer purchase calls to action.
- App icon symbolism beyond the approved pass/NFC/proof mark.
- Checkout, Stripe, Apple Pay, or refund surfaces.
- Scanner accept/reject decisions where speed matters.
- Marketing copy that should sound mainstream.
- Any visual that resembles tokens, coins, speculation, wallets seeds, gas fees, or trading.

Preferred consumer language:

| Prefer | Avoid |
| --- | --- |
| Verified Ticket | NFT |
| Proof | Mint |
| Ownership History | On-chain history |
| Secure Resale | Marketplace speculation |
| Fan Access | Token gated farming |
| Entry Code | QR nonce |
| Transfer Limit | Smart contract restriction |

## SwiftUI Usage

The SwiftUI design foundation lives at `apps/ios/FanPass/FanPass/DesignSystem/`.

Use:

- `FPColors` for color roles.
- `FPTypography` for Apple system font scales.
- `FPSpacing` and `FPRadius` for layout constants.
- `FPGradients` for approved gradient treatments.
- `FPShadows` for consistent elevation.
- `FPPrimaryButton`, `FPSecondaryButton`, `FPGlassCard`, `FPStatusPill`, `FPVerifiedBadge`, `FPSectionHeader`, `FPMetricCard`, `FPDivider`, `FPNFCWaveView`, and `FPTicketStubShape` as primitives for future UI redesign work.

These files are foundations only. They should not force one finished screen layout. Future UI/UX passes should compose them into the wallet, marketplace, event detail, scanner, and Console surfaces.

## Next UI/UX Direction

The next redesign should start from product structure, not decoration:

- Ticket wallet: make the verified pass the emotional center.
- Marketplace: show fair resale and caps without trading-app energy.
- Scanner/Ops: prioritize decision clarity over brand visuals.
- Console: keep dense operations readable and calm.
- Academic presentation: use the visual identity to explain verification, resale transparency, and security posture clearly.
