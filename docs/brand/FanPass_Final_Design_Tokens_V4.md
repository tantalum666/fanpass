# FanPass Final Design Tokens V4

Status: final Clean V4 token documentation for UI/UX implementation.
Date: 2026-06-05
Machine source: `FanPass_VI_Redesign_V4/docs/fanpass-brand-tokens-v4.json`

Clean V4 is the only visual source of truth for future FanPass UI implementation.

## Background Colors

| Token | Hex | Usage |
| --- | --- | --- |
| `background.night` | `#020617` | Root dark app background. |
| `background.gradientStart` | `#2E1065` | Limited radial brand depth. |
| `background.gradientMid` | `#07152A` | Dark gradient transition. |
| `background.light` | `#F8FAFC` | Light-mode root background. |
| `background.lightSubtle` | `#EEF2F7` | Light grouped background. |

## Surface Colors

| Token | Hex | Usage |
| --- | --- | --- |
| `surface.default` | `#0B1224` | Main cards, panels, grouped content. |
| `surface.elevated` | `#111827` | Ticket cards, modals, important content panels. |
| `surface.overlay` | `#111827D9` | Dark translucent overlays with readable content. |
| `surface.light` | `#FFFFFF` | Light-mode cards and sheets. |
| `surface.lightElevated` | `#F8FAFC` | Light-mode elevated panels. |

## Primary Colors

| Token | Hex | Usage |
| --- | --- | --- |
| `primary.pulseCyan` | `#46E8FF` | NFC, scan readiness, focus, signal accents. |
| `primary.electricViolet` | `#7C3AED` | Primary brand action and selected state. |
| `primary.neonMagenta` | `#F43FDA` | Rare premium accent and chart highlight. |

Primary brand gradient:

`linear-gradient(135deg, #46E8FF 0%, #7C3AED 45%, #F43FDA 100%)`

## Accent Colors

| Token | Hex | Usage |
| --- | --- | --- |
| `accent.verifiedGreen` | `#22C55E` | Verified Ticket, accepted scan, successful proof. |
| `accent.border` | `#23314A` | Dividers, outlines, quiet card strokes. |
| `accent.textSecondary` | `#AAB4C5` | Secondary labels and metadata. |

## Semantic Status Colors

| Token | Foreground | Background | Usage |
| --- | --- | --- | --- |
| `status.success` | `#22C55E` | `#22C55E1F` | Verified, accepted, reconciled. |
| `status.info` | `#46E8FF` | `#46E8FF1F` | NFC Ready, scanner ready, synced. |
| `status.primary` | `#7C3AED` | `#7C3AED24` | Selected, pending proof, brand state. |
| `status.accent` | `#F43FDA` | `#F43FDA1F` | Rare attention highlight. |
| `status.warning` | `#F59E0B` | `#F59E0B1F` | Organizer cap, limit, pending attention. |
| `status.danger` | `#EF4444` | `#EF44441F` | Rejected, invalid, destructive. |
| `status.neutral` | `#AAB4C5` | `#23314A66` | Redeemed, inactive, historical. |

## Ticket Status Colors

| Status | Foreground | Background | Border |
| --- | --- | --- | --- |
| `verifiedTicket` | `#46E8FF` | `#063746` | `#46E8FF` |
| `nfcReady` | `#D8C8FF` | `#2A135E` | `#7C3AED` |
| `secureResale` | `#22C55E` | `#09351D` | `#22C55E` |
| `proofHistory` | `#F8FAFC` | `#020617` | `#23314A` |
| `pending` | `#F59E0B` | `#3A2608` | `#F59E0B` |
| `rejected` | `#EF4444` | `#3B0B0B` | `#EF4444` |
| `redeemed` | `#AAB4C5` | `#172033` | `#23314A` |

## Typography Scale

Use Apple system font references only.

| Token | Size | Weight | Use |
| --- | ---: | --- | --- |
| `display` | 40 | Semibold | Large event/pass moments. |
| `largeTitle` | 34 | Semibold | Wallet status and screen titles. |
| `title1` | 28 | Semibold | Event titles. |
| `title2` | 24 | Semibold | Ticket and section headers. |
| `title3` | 20 | Semibold | Cards and panels. |
| `headline` | 17 | Semibold | Buttons, row titles, status headers. |
| `body` | 16 | Regular | Main readable copy. |
| `callout` | 15 | Regular | Supporting copy. |
| `caption` | 12 | Medium | Pills, labels, metadata. |
| `monoNumber` | 15 | Medium | Prices, counts, IDs, seat values. |

## Spacing Scale

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

Ticket card minimum padding:

- iPhone: 20 pt.
- Large iPhone/iPad: 24 pt.
- QR quiet zone: visually clear on all sides.

## Radius Scale

| Token | Value | Use |
| --- | ---: | --- |
| `radius.xs` | 6 | Tiny pills and badges. |
| `radius.sm` | 8 | Compact rows and controls. |
| `radius.md` | 12 | Buttons and status pills. |
| `radius.lg` | 16 | Panels and grouped cards. |
| `radius.xl` | 24 | Ticket cards and feature cards. |
| `radius.2xl` | 32 | Large pass surfaces. |

## Shadow Scale

| Token | Value | Usage |
| --- | --- | --- |
| `shadow.none` | none | Dense lists, tables, forms. |
| `shadow.card` | `0 10 30 #00000033` | Normal elevated cards. |
| `shadow.ticket` | `0 24 70 #00000066` | Premium ticket card surfaces. |
| `shadow.signal` | `0 0 24 #46E8FF26` | Active NFC/scan indicator only. |

Use shadows sparingly. Do not combine shadow and glow in a way that reduces text contrast.

## Chart Color Rules

| Role | Hex | Usage |
| --- | --- | --- |
| `chart.primary` | `#46E8FF` | Primary price/availability line. |
| `chart.secondary` | `#7C3AED` | Comparison series. |
| `chart.highlight` | `#F43FDA` | Rare highlighted point or trend. |
| `chart.success` | `#22C55E` | Healthy verified state. |
| `chart.warning` | `#F59E0B` | Organizer cap or limit. |
| `chart.danger` | `#EF4444` | Invalid or rejected state. |
| `chart.grid` | `#23314A` | Gridlines and axes. |
| `chart.label` | `#AAB4C5` | Axis and legend labels. |

Rules:

- Chart lines stay inside plot boundaries.
- Chart lines must not cross price labels or summary values.
- Avoid crypto-exchange visual language.
- Use `Transparent Prices` and `Secure Resale` framing.

## Button Style Rules

Primary button:

- Use V4 brand gradient for the main action only.
- Text must be white or near-white.
- Minimum height: 52 pt.
- Radius: 12 pt.

Secondary button:

- Use `surface.elevated` fill and `border` stroke.
- Use text primary or Pulse Cyan for important secondary action.

Destructive button:

- Use red semantic styling.
- Do not use brand gradient.

Disabled button:

- Use muted surface.
- Preserve readable label contrast.

## Implementation Rule

All future iOS, Console, docs, and presentation work must map to these V4 tokens before adding new visual styles.
