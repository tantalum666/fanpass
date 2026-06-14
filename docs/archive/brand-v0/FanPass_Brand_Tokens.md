# FanPass Brand Tokens

> Superseded on 2026-06-05 by Clean V4. Use `docs/brand/FanPass_Final_Design_Tokens_V4.md` and `FanPass_VI_Redesign_V4/docs/fanpass-brand-tokens-v4.json` for future UI/UX implementation.

Status: foundation tokens for visual identity and UI redesign.
Date: 2026-06-04
Source VI: `docs/archive/brand-v0/FanPass_Visual_Identity.md`

FanPass tokens are dark-mode first and tuned for a mainstream ticketing product with Web3 proof hidden in the background. Use these values as the shared base for iOS, Console, docs, and presentation assets.

## Token Principles

- Use `Night` as the primary product atmosphere, not pure black.
- Keep violet, cyan, and magenta as signal colors; do not let every surface glow.
- Use green only for verified or accepted states.
- Use amber for limits, caps, pending action, or user attention.
- Use red only for invalid, failed, destructive, or rejected states.
- Favor iOS-native contrast, spacing, and readable controls over decorative branding.
- Web3 visuals should support proof, provenance, and ownership history without consumer crypto jargon.

## Brand Colors

| Token | Hex | Role |
| --- | --- | --- |
| `background.night` | `#07080C` | App background, app icon depth, dark foundation. |
| `surface.card` | `#121722` | Standard cards, grouped surfaces, ticket backs. |
| `surface.glass` | `#1A2130` | Elevated glass cards, modals, premium ticket surfaces. |
| `primary.electricViolet` | `#8B5CF6` | Primary brand accent, selected states, premium pass energy. |
| `secondary.pulseCyan` | `#33D6FF` | NFC, scan readiness, live signal, secondary accents. |
| `accent.neonMagenta` | `#FF4FA3` | Rare fan-energy accent and campaign highlights. |
| `trust.verifiedGreen` | `#27E0A3` | Verified ticket, accepted entry, proof success. |
| `warning.amber` | `#F4B23C` | Resale cap, limits, caution, pending review. |
| `danger.red` | `#FF5A52` | Rejected ticket, failed scan, destructive action. |
| `text.primary` | `#F7F8FB` | Main text on dark surfaces. |
| `text.secondary` | `#A7AFBD` | Metadata, labels, secondary copy. |
| `border.divider` | `#293241` | Hairlines, dividers, ticket outlines. |

## Semantic Colors

| Token | Dark | Light | Usage |
| --- | --- | --- | --- |
| `background.default` | `#07080C` | `#F7F8FB` | Root app background. |
| `background.subtle` | `#0D111A` | `#EEF2F7` | Grouped views and calm dashboard zones. |
| `surface.default` | `#121722` | `#FFFFFF` | Cards, lists, sheets. |
| `surface.elevated` | `#1A2130` | `#F9FBFE` | Modals, important ticket cards. |
| `surface.overlay` | `#202838CC` | `#FFFFFFD9` | Glass surfaces, blur overlays. |
| `content.primary` | `#F7F8FB` | `#101216` | Main text. |
| `content.secondary` | `#A7AFBD` | `#667085` | Secondary text and metadata. |
| `content.tertiary` | `#737D8F` | `#98A2B3` | Disabled or quiet metadata. |
| `action.primary` | `#8B5CF6` | `#6D4AFF` | Primary actions. |
| `action.secondary` | `#33D6FF` | `#0077B6` | NFC, scan, secondary action. |
| `state.success` | `#27E0A3` | `#009E73` | Verified, accepted, reconciled. |
| `state.warning` | `#F4B23C` | `#B76E00` | Limits, caps, attention. |
| `state.danger` | `#FF5A52` | `#D92D20` | Rejected, failed, destructive. |
| `border.default` | `#293241` | `#D7DCE5` | Default divider and outlines. |
| `border.focus` | `#33D6FF` | `#0057FF` | Focus ring and scanner emphasis. |

## Gradients

| Token | Stops | Usage |
| --- | --- | --- |
| `gradient.passAurora` | `#2F6BFF`, `#8B5CF6`, `#27E0A3` | Premium ticket art, app icon mark glow, launch visuals. |
| `gradient.iconNight` | `#07080C`, `#22163A`, `#0B3D59` | App icon background and hero credential depth. |
| `gradient.scanPulse` | `#33D6FF`, `#27E0A3` | NFC readiness, successful signal, scanner feedback. |
| `gradient.resaleSignal` | `#8B5CF6`, `#FF4FA3`, `#F4B23C` | Bounded resale insight visuals, not trading UI. |
| `gradient.glassEdge` | `#FFFFFF33`, `#33D6FF33`, `#8B5CF633` | Hairline edge on glass cards and tickets. |

## Typography

Use Apple system font references only.

| Token | Size | Line Height | Weight | Use |
| --- | ---: | ---: | --- | --- |
| `display` | 40 | 46 | Semibold | Event pass hero, presentation title. |
| `largeTitle` | 32 | 38 | Semibold | Screen title and wallet status. |
| `title1` | 28 | 34 | Semibold | Event title, ticket title. |
| `title2` | 24 | 30 | Semibold | Section-leading headings. |
| `title3` | 20 | 26 | Semibold | Card titles and status panels. |
| `headline` | 17 | 22 | Semibold | Buttons, row titles, labels. |
| `body` | 16 | 22 | Regular | Primary body text. |
| `bodyStrong` | 16 | 22 | Semibold | Important row values. |
| `callout` | 15 | 20 | Regular | Secondary controls and descriptions. |
| `caption` | 12 | 16 | Medium | Pills, small labels, metadata. |
| `monoNumber` | 15 | 20 | Medium | Prices, counts, audit IDs, ticket fragments. |

## Spacing

| Token | Value |
| --- | ---: |
| `space.2xs` | 2 |
| `space.xs` | 4 |
| `space.sm` | 8 |
| `space.md` | 12 |
| `space.lg` | 16 |
| `space.xl` | 20 |
| `space.2xl` | 24 |
| `space.3xl` | 32 |
| `space.4xl` | 40 |
| `space.5xl` | 48 |
| `space.6xl` | 64 |

## Radius

| Token | Value | Use |
| --- | ---: | --- |
| `radius.xs` | 6 | Small pills and compact controls. |
| `radius.sm` | 8 | Tight cards and table rows. |
| `radius.md` | 12 | Buttons, status pills, list groups. |
| `radius.lg` | 16 | Ticket cards and modal surfaces. |
| `radius.xl` | 22 | Premium pass artwork. |
| `radius.2xl` | 28 | Large wallet card and sheet headers. |

## Elevation

| Token | Shadow | Usage |
| --- | --- | --- |
| `elevation.none` | none | Base surfaces and dense lists. |
| `elevation.hairline` | `0 1 0 #FFFFFF0D` | Subtle edge on dark cards. |
| `elevation.raised` | `0 10 30 #00000040` | Floating cards, sheets, ticket previews. |
| `elevation.floating` | `0 18 50 #00000059`, `0 0 28 #33D6FF1F` | Premium ticket and NFC active surfaces. |

## Borders

| Token | Width | Color | Usage |
| --- | ---: | --- | --- |
| `border.hairline` | 0.5 | `#293241` | Dividers and grouped list boundaries. |
| `border.default` | 1 | `#293241` | Cards and controls. |
| `border.focus` | 1.5 | `#33D6FF` | Focus, scanner readiness, selected input. |
| `border.trust` | 1 | `#27E0A3` | Verified surfaces. |
| `border.danger` | 1 | `#FF5A52` | Failed or rejected surfaces. |

## Motion

| Token | Duration | Curve | Usage |
| --- | ---: | --- | --- |
| `motion.instant` | 0.10s | easeOut | Press feedback and state snaps. |
| `motion.fast` | 0.18s | easeOut | Buttons, pills, row insertions. |
| `motion.base` | 0.24s | easeInOut | Sheet transitions and card state changes. |
| `motion.calm` | 0.36s | easeInOut | Ticket reveal and proof timeline. |
| `motion.scanPulse` | 1.20s | easeInOut repeat | NFC/QR readiness pulse. |

## Icon Stroke

| Token | Value |
| --- | --- |
| `icon.strokeWidth` | 2 |
| `icon.strokeCap` | round |
| `icon.strokeJoin` | round |
| `icon.grid` | 24 |
| `icon.selectedFill` | `#8B5CF6` |

## Chart Colors

| Token | Hex | Use |
| --- | --- | --- |
| `chart.primary` | `#33D6FF` | Primary trend line. |
| `chart.secondary` | `#8B5CF6` | Comparison series. |
| `chart.positive` | `#27E0A3` | Healthy resale, accepted scans. |
| `chart.warning` | `#F4B23C` | Caps and limits. |
| `chart.negative` | `#FF5A52` | Rejections and failed checks. |
| `chart.neutral` | `#A7AFBD` | Baselines and inactive series. |
| `chart.volume` | `#2F6BFF` | Volume bars and capacity context. |
| `chart.accent` | `#FF4FA3` | Rare highlight series. |

## Ticket Status Colors

| Status | Background | Foreground | Border |
| --- | --- | --- | --- |
| `active` | `#27E0A326` | `#27E0A3` | `#27E0A380` |
| `listed` | `#F4B23C26` | `#F4B23C` | `#F4B23C80` |
| `transferred` | `#33D6FF26` | `#33D6FF` | `#33D6FF80` |
| `redeemed` | `#737D8F2E` | `#A7AFBD` | `#737D8F80` |
| `rejected` | `#FF5A5226` | `#FF5A52` | `#FF5A5280` |
| `pending` | `#8B5CF626` | `#BCA7FF` | `#8B5CF680` |
| `expired` | `#293241` | `#A7AFBD` | `#404B5F` |

## Implementation Notes

- Use `docs/brand/fanpass-brand-tokens.json` as the canonical machine-readable token source.
- SwiftUI values are mirrored in `apps/ios/FanPass/FanPass/DesignSystem/`.
- Console web tokens should map semantic names instead of hard-coding role names directly.
- Any future Figma or presentation work should import this palette before creating new visual directions.
