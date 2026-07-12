# FanPass SwiftUI Design System

Status: Clean V4 implementation foundation.
Date: 2026-06-05

The SwiftUI design system must use Clean V4 as the visual source of truth.

Primary source files:

- `FanPass_VI_Redesign_V4/assets/fanpass-mark-v4.svg`
- `FanPass_VI_Redesign_V4/assets/fanpass-app-icon-v4.svg`
- `FanPass_VI_Redesign_V4/assets/fanpass-horizontal-lockup-v4.svg`
- `FanPass_VI_Redesign_V4/assets/fanpass-ticket-card-v4.png`
- `FanPass_VI_Redesign_V4/docs/fanpass-brand-tokens-v4.json`
- `docs/brand/FanPass_UI_Guardrails.md`
- `docs/design.md`

## Implementation Rules

- Use `FPColors` and `FPGradients` values that mirror Clean V4.
- Use `FPPrimaryButton`, `FPSecondaryButton`, `FPGlassCard`, `FPStatusPill`, `FPVerifiedBadge`, `FPSectionHeader`, `FPMetricCard`, `FPDivider`, `FPNFCWaveView`, and `FPTicketStubShape` as primitives, not as finished screens.
- Ticket cards must have enough padding and clear QR quiet zones.
- NFC waves must remain contained in `FPNFCWaveView`, small icons, or low-opacity backgrounds below 8%.
- Do not draw decorative lines across content.
- Charts must not overlap prices, labels, or axis values.
- Keep consumer UI copy mainstream: `Verified Ticket`, `Secure Resale`, `Fan Access`, `Proof & History`, and `Transparent Prices`.
- Avoid primary labels such as `NFT`, `gas fee`, `seed phrase`, `mint`, `ape`, `degen`, `pump`, or `moon`.

## V4 Color Mapping

| SwiftUI Token | V4 Role | Hex |
| --- | --- | --- |
| `FPColors.backgroundNight` | Night | `#020617` |
| `FPColors.surfaceCard` | Surface | `#0B1224` |
| `FPColors.surfaceGlass` | Elevated Surface | `#111827` |
| `FPColors.pulseCyan` | Pulse Cyan | `#46E8FF` |
| `FPColors.electricViolet` | Electric Violet | `#7C3AED` |
| `FPColors.neonMagenta` | Neon Magenta | `#F43FDA` |
| `FPColors.verifiedGreen` | Verified Green | `#22C55E` |
| `FPColors.textPrimary` | Text Primary | `#F8FAFC` |
| `FPColors.textSecondary` | Text Secondary | `#AAB4C5` |
| `FPColors.borderDivider` | Border | `#23314A` |

## Next UI/UX Step

Use these foundations to redesign product surfaces in this order:

1. Ticket wallet and ticket detail.
2. Event detail and checkout.
3. Secure resale and transparent prices.
4. Fan Access rewards.
5. Ops scanner.
6. Console organizer surfaces.

Do not start by adding decoration. Start from content hierarchy, state clarity, and safe layout zones.
