# FanPass Brand VI

> Superseded on 2026-06-05 by Clean V4. Use `FanPass_VI_Redesign_V4/` and `docs/brand/FanPass_VI_Clean_V4_Audit.md` as the source of truth. Do not redesign the V4 logo or app icon.

Version: 0.2

Status: superseded by Clean V4 in `FanPass_VI_Redesign_V4/`.

Do not use this v0.2 document as the active visual direction for new UI work. It remains only as historical context for earlier prototype styling.

Figma:

https://www.figma.com/design/7ZSTtCLoLn3DMIGy4goKnX

Current page: `FanPass VI v0.2`

## Current Decision

Version 0.1 is deprecated. It was closer to a UI token sheet than a complete VI system.

Version 0.2 is no longer the working brand direction. The active visual identity direction is Clean V4 in `FanPass_VI_Redesign_V4/` and `docs/brand/FanPass_VI_Clean_V4_Audit.md`.

## Brand Idea

One pass. Verified access. Visible limits.

FanPass is a ticketing infrastructure product where fans can understand whether a ticket is real, what it costs, how it can be transferred, and whether it can be used at entry.

The identity must not feel like:

- a speculative crypto token
- a scalper resale marketplace
- a generic concert poster brand
- a dense trading terminal

It should feel like:

- a trustworthy pass
- verified entry
- fair market context
- venue-grade operations

## Logo System

Primary direction: wordmark plus ticket-signal mark.

The mark contains three ideas:

- Ticket/pass silhouette: physical admission and entry rights.
- Side cuts: familiar ticket geometry.
- Two signal bars: account action and verified entry.

### Logo Colors

Only these colors belong inside the logo:

| Role | Hex | Meaning |
| --- | --- | --- |
| Ink Pass | `#0B0D10` | Physical pass, wordmark, high trust |
| Signal Blue | `#0054FF` | Account action, primary interaction |
| Verify Mint | `#00B08C` | Verified entry, authenticity |
| White | `#FFFFFF` | Cutouts and negative space |

Do not put Amber, Coral, reward colors, gradients, coins, chains, cubes, QR patterns, or blockchain motifs inside the logo.

## Color Hierarchy

### Core Brand Colors

Core colors are allowed in brand moments, logo usage, primary actions, and selected states.

| Token | Hex | Usage |
| --- | --- | --- |
| Ink Pass | `#0B0D10` | Wordmark, logo base, primary text |
| Signal Blue | `#0054FF` | Primary action, selected state, account action |
| Verify Mint | `#00B08C` | Verified status, active ticket, entry success |

### Neutral Product Colors

Neutral colors build the product surface.

| Token | Hex | Usage |
| --- | --- | --- |
| Cloud | `#F4F5F6` | App background |
| Card | `#FFFFFF` | Cards, sheets, panels |
| Slate | `#3C414B` | Secondary text and operational UI |
| Muted | `#818996` | Metadata and supporting copy |
| Line | `#D8DDE4` | Dividers and subtle borders |

### Semantic Colors

Semantic colors are not brand colors. They should appear only when the product state requires them.

| Token | Hex | Usage |
| --- | --- | --- |
| Amber Cap | `#E89111` | Resale cap, limits, caution |
| Coral Risk | `#EC493C` | Price premium, risk, destructive state |

Do not use semantic colors as decorative palette fillers.

## Typography

iOS:

- Use SF Pro through SwiftUI system fonts.
- Brand display can use rounded black system weight.
- Body and dense UI should stay regular or medium.

Web and deck:

- Use Inter.
- Display: Inter Black.
- Headings: Inter Bold or Semi Bold.
- Body: Inter Regular.

Rules:

- Do not scale font size with viewport width.
- Do not use negative letter spacing.
- Keep large display type for brand moments and top-level screens only.
- Dashboards should be denser and quieter than the consumer app.

## Visual Language

Use:

- ticket/pass geometry
- verification bars
- clean product cards
- price and limit data presented as structured information
- high contrast typography

Avoid:

- crypto token imagery
- chains, cubes, coins, abstract blockchain networks
- decorative gradient blobs
- bokeh or poster-style backgrounds
- one-note blue/purple gradient palettes
- screenshots as VI evidence

## UI Principles

Consumer app:

- Opens to browsable event discovery for guests.
- Prompts auth only when a private or transactional action is attempted.
- Uses brand colors sparingly and intentionally.
- Market data supports fan decisions; it should not dominate the product as if it were a trading app.
- Must not expose scanner, organizer, or admin controls.

FanPass Ops:

- Separate app surface for gate staff and onsite operators.
- Visual priority: scan speed, status clarity, failure states.
- Brand expression should be minimal.
- Larger controls and higher-contrast statuses are acceptable when they improve entry speed.

FanPass Console:

- Quiet and operational.
- Uses the same tokens but avoids consumer-scale display treatment.
- Web-first for data tables, configuration, review, reporting, and risk operations.

## Copy Rules

Use in consumer flows:

- ticket
- pass
- verified entry
- resale cap
- transfer limit
- entry code
- wallet
- ownership history

Avoid in default consumer flows:

- NFT
- SBT
- mint
- gas
- smart contract
- chain
- whitelist farming

Technical terms can appear in investor, admin, developer, or documentation contexts.

## Implementation Sources

Local token source:

`packages/shared/src/brand.ts`

iOS theme:

`apps/ios/FanPass/FanPass/Shared/FanPassUI.swift`

Dashboard CSS tokens:

`apps/dashboard/app/styles.css`

Logo mark asset:

`assets/brand/fanpass-ticket-signal-mark.svg`
