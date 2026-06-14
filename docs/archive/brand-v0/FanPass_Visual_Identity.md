# FanPass Visual Identity

> Superseded on 2026-06-05 by Clean V4. Use `FanPass_VI_Redesign_V4/`, `docs/brand/FanPass_VI_Clean_V4_Audit.md`, `docs/brand/FanPass_UI_Guardrails.md`, and `docs/brand/FanPass_Final_Design_Tokens_V4.md` as the source of truth for future UI/UX work. Do not redesign the V4 logo or app icon.

Status: proposed brand direction for the next UI/UX redesign.
Date: 2026-06-04

This archived document superseded the earlier `docs/archive/brand-v0/BRAND_VI.md` v0.2 direction before Clean V4 replaced both. It focuses only on visual identity, not app screen layouts.

## Brand Essence

FanPass is verified access for live events.

The product should feel like a premium ticket, a secure payment flow, and a trusted digital credential in one native iOS experience. Web3 infrastructure exists in the background, but the consumer promise is simple: the ticket is real, the resale rules are visible, and entry works.

## Mission Statement

Make live-event access safer, fairer, and more transparent by giving organizers verifiable ticket controls, fans secure ownership and resale clarity, and gate staff fast entry verification.

## Brand Personality

| Trait | Meaning |
| --- | --- |
| Premium | Feels worthy of major concerts, sports, festivals, and global venues. |
| Trustworthy | Communicates verification, payment safety, and operational control. |
| Energetic | Carries the anticipation of live events without becoming childish or noisy. |
| Clear | Makes ticket state, resale limits, ownership history, and entry readiness readable. |
| Native | Feels at home on iOS, Apple Wallet, Apple Pay, QR scanning, and NFC flows. |
| Invisible Web3 | Uses proof, ownership, and provenance language without consumer crypto friction. |

## Brand Keywords

- verified access
- live event credential
- secure resale
- ownership history
- fan-first market
- dynamic entry
- NFC wave
- ticket proof
- premium pass
- transparent limits
- mobile-native
- global venue

## Target Users

| User | Need | Brand Requirement |
| --- | --- | --- |
| Fans | Buy, hold, transfer, resell, and enter with confidence. | Must feel mainstream, safe, fast, and exciting. |
| Organizers | Issue tickets, set rules, monitor resale, assign staff, review audit data. | Must feel controlled, professional, and reliable. |
| Gate staff | Verify QR/NFC entry quickly under venue pressure. | Must feel high-contrast, immediate, and mistake-resistant. |
| Academic evaluators | Understand the concept, architecture, and product value quickly. | Must be legible, explainable, and visually mature. |
| Future partners | Evaluate whether FanPass could fit real venues and ticketing operations. | Must avoid speculative crypto signals and look credible. |

## Brand Promise

Fair access, verified tickets, transparent resale.

FanPass gives fans confidence that their pass is authentic, gives organizers enforceable ticket rules, and gives staff a clear decision at the gate.

## Visual Concept

The core visual idea is **verified motion**:

- A ticket is not just a static object; it moves through issue, ownership, resale, wallet, and entry.
- The brand should visualize that movement through subtle signal lines, NFC wave geometry, pass edges, check-state markers, and flowing but controlled gradients.
- The system should borrow the confidence of fintech, the polish of Apple Wallet, and the energy of live-event lighting.

Consumer-facing visuals should hide blockchain terms. Admin and academic contexts may mention blockchain-backed records, NFT/SBT-style identity, and ownership proof when needed.

## Logo Concept

The logo should combine three ideas:

1. **Pass** - a ticket or digital credential shape.
2. **Signal** - NFC/QR verification and live event movement.
3. **Proof** - ownership, authenticity, and successful entry.

Recommended mark direction:

- A compact rounded-rectangle pass silhouette.
- One notched or cut corner to suggest a ticket stub without looking retro.
- Two or three internal signal strokes that can read as NFC waves, stage-light beams, or verification bars.
- A small proof point/check cutout may appear in the negative space, but it should not look like a generic checkmark app.

Wordmark:

- Use `FanPass` with clear capitalization.
- Avoid bubbly, childish, or crypto-token wordmark shapes.
- Prefer a strong SF Pro-inspired geometric wordmark with subtle custom cuts in `F`, `P`, or `a`.

Logo usage:

- App icon can use the mark alone.
- Product headers should use mark + wordmark.
- Console can use a simplified monochrome lockup.
- Avoid putting QR codes, chains, coins, apes, cube networks, or literal blockchain nodes into the logo.

## Color System

Design dark mode first, with a light mode adaptation.

### Final Direction Palette

| Token | Dark Mode | Light Mode | Usage |
| --- | --- | --- | --- |
| Event Black | `#07080C` | `#101216` | Primary dark background, app icon depth. |
| Venue Graphite | `#121722` | `#262B35` | Panels, elevated surfaces, Console sidebars. |
| Ticket White | `#F7F8FB` | `#FFFFFF` | Primary text on dark, cards on light. |
| Fog Gray | `#A7AFBD` | `#667085` | Secondary text and metadata. |
| Line Steel | `#293241` | `#D7DCE5` | Dividers, table lines, ticket outlines. |
| Pass Blue | `#2F6BFF` | `#0057FF` | Primary action, selected state, interactive focus. |
| Verified Mint | `#27E0A3` | `#009E73` | Verified ticket, accepted entry, successful proof. |
| Stage Violet | `#8B5CF6` | `#6D4AFF` | Premium event atmosphere, gradient accent only. |
| Cap Amber | `#F4B23C` | `#B76E00` | Resale cap, warning, limit state. |
| Deny Coral | `#FF5A52` | `#D92D20` | Rejected scan, invalid ticket, destructive action. |

### Gradient Use

Gradients are allowed, but only as controlled event atmosphere:

- Use dark radial or linear accents behind ticket art, app icon, onboarding, and hero credential moments.
- Do not use large decorative blobs.
- Do not make every screen a gradient.
- Never use gradients for data tables, warning states, or audit logs.

Recommended brand gradient:

`#2F6BFF -> #8B5CF6 -> #27E0A3`

Use it sparingly for pass artwork, live-event lighting, and premium fan moments.

## Typography System

Use Apple system font references only. Do not include or download font files.

| Context | Font Reference | Guidance |
| --- | --- | --- |
| iOS UI | SF Pro Text | Body, controls, lists, forms, scanner states. |
| iOS display | SF Pro Display | Event titles, pass headers, large wallet status. |
| Data | SF Mono or monospaced digits | Orderbook prices, ticket IDs, audit rows, scan codes. |
| Console web | System UI stack approximating SF/Inter | Keep dense, readable, and neutral. |

Type principles:

- Use tabular numerals for prices, caps, quantities, and counts.
- Use bold display type only for event/pass moments, not every card.
- Avoid rounded heavy display typography as the primary brand voice.
- Keep line height generous in mobile copy and tighter in tables.
- Do not use negative letter spacing.

## Icon Style

Icon system should feel like SF Symbols adapted for FanPass.

Rules:

- 2 px rounded stroke at standard size.
- Filled icons only for selected tab states or high-priority scanner states.
- Ticket, shield, waveform, QR, NFC, wallet, chart, staff, gate, and audit icons should share the same stroke logic.
- Verification icons should use mint sparingly and only for real successful states.
- Avoid crypto-specific icons such as chain links, token coins, nodes, or wallet seed metaphors in consumer UI.

## Illustration Style

Use minimal product illustrations, not cartoons.

Allowed:

- Abstract ticket/pass planes.
- Subtle stage-light beams.
- NFC wave arcs.
- Transparent ownership trails.
- Map/venue entry geometry.
- Pass stack depth in onboarding or empty states.

Avoid:

- Monkey/NFT cliches.
- Character mascots.
- Meme-like crypto art.
- Stock concert crowds with identifiable artists.
- Overly literal blockchain diagrams in consumer UI.

## Motion Style

Motion should express verification and live-entry confidence.

Recommended motion:

- Pass card shimmer only when loading verification, not as decoration.
- NFC wave pulse during tap/scan readiness.
- QR scan success lock-in: quick scale, mint flash, haptic-compatible state.
- Ticket ownership history can slide as a timeline.
- Price changes should animate gently with numeric transitions.

Motion rules:

- Fast and functional: 150-250 ms for most UI transitions.
- Avoid casino-like flashing, bouncing, or celebratory overload.
- Reduce motion support must be respected.
- Scanner success and failure states should be unmistakable without relying only on motion.

## Photography / Imagery Direction

Use imagery as atmosphere, not proof of real events.

Allowed:

- Abstract stage lighting.
- Venue entrances without identifiable branding.
- Cropped hands holding a phone pass, using generated or licensed imagery.
- Macro textures of tickets, wristbands, gates, light beams, and NFC tap gestures.
- Global city/night energy without copyrighted posters or artist names.

Avoid:

- Real concert posters.
- Artist names, faces, logos, or album artwork.
- Photos that imply a real partnership.
- Gambling, trading-floor, or speculative investment imagery.
- Generic crypto renders.

## UI Tone

Consumer app:

- Premium and energetic.
- Dark-mode first.
- Ticket card is the emotional center.
- Market data supports fair decisions, not speculation.
- Use labels like `Verified Ticket`, `Secure Resale`, `Ownership History`, and `Fan Access`.

FanPass Ops:

- Operational and high contrast.
- The scan decision is the primary visual event.
- Large status color, clear gate, clear failure reason.
- Minimal brand decoration during active scanning.

FanPass Console:

- Calm, dense, and professional.
- More light-mode friendly than the consumer app.
- Tables, filters, status chips, and audit trails take priority.
- Brand color should guide actions, not decorate the dashboard.

## Voice And Copywriting Style

Voice:

- Clear.
- Confident.
- Fan-first.
- Low jargon.
- Security-literate without sounding paranoid.

Preferred consumer terms:

| Prefer | Avoid In Consumer UI |
| --- | --- |
| Verified Ticket | NFT |
| Proof | Mint |
| Ownership History | On-chain history |
| Secure Resale | Marketplace speculation |
| Fan Access | Token gated farming |
| Entry Code | QR nonce |
| Transfer Limit | Smart contract restriction |
| Wallet | Seed phrase wallet |

Tagline options:

1. `Verified Access for Real Fans`
2. `Fair Access. Verified Tickets. Transparent Resale.`
3. `Your Ticket. Your Experience. Your Way.`
4. `Real Tickets. Fair Resale. Verified Entry.`
5. `Live Access, Proven.`

Recommended tagline:

`Real Tickets. Fair Resale. Verified Entry.`

Reason: it is clear, mainstream, and covers the three product promises without sounding academic or crypto-heavy.

## Do And Don't Rules

### Do

- Design dark mode first, then adapt to light mode.
- Use premium event atmosphere without using copyrighted event material.
- Make verification and entry readiness visually obvious.
- Keep resale data clear and bounded.
- Use Web3 transparency as proof and history, not consumer crypto branding.
- Keep iOS UI native, fast, readable, and familiar.
- Use high contrast for scanner and gate states.
- Use semantic colors consistently.
- Keep Console dense, operational, and table-first.

### Don't

- Do not use monkey/NFT cliche visuals.
- Do not make FanPass look like a gambling, betting, or trading app.
- Do not overuse crypto terms in consumer copy.
- Do not use real artist names, posters, app logos, or copyrighted photos.
- Do not use low-contrast neon text on dark backgrounds.
- Do not make every UI surface a glowing gradient card.
- Do not use childish rounded display type.
- Do not turn the logo into a QR code, coin, blockchain node graph, or generic shield.
- Do not hide warning or rejection states behind subtle colors only.

## VI Direction A: Premium Concert Pass

### Visual Mood

Dark, cinematic, and emotionally premium. This direction uses concert lighting, velvet black surfaces, luminous pass artwork, and high-end event energy.

### Logo Idea

A digital pass mark with a soft ticket notch and three stage-light signal cuts. The wordmark is confident and slightly condensed, optimized for app icon and event-ticket headers.

### Color Palette

| Role | Hex |
| --- | --- |
| Backstage Black | `#05060A` |
| Spotlight Blue | `#2F6BFF` |
| Encore Violet | `#8B5CF6` |
| Verified Mint | `#27E0A3` |
| Ticket White | `#F7F8FB` |
| Cap Amber | `#F4B23C` |

### Typography Feeling

SF Pro Display for event titles and pass moments; SF Pro Text for body. Large type can feel premium, but should stay controlled.

### Suitable UI Atmosphere

- Best for consumer app onboarding, ticket wallet, event discovery, and fan access.
- Strongest emotional impact.
- Works well in academic presentation because it looks like a real consumer brand.

### Pros

- Most fan-first and memorable.
- Strong premium live-event atmosphere.
- Makes tickets feel desirable and collectable without saying NFT.
- Works well for dark-mode first.

### Cons

- Can become too decorative if gradients are overused.
- Console may need a calmer adaptation.
- Must avoid looking like a nightlife poster app.

## VI Direction B: Web3 Trust Layer

### Visual Mood

Transparent, credential-based, and infrastructure-like. This direction borrows the clarity of wallets and verification layers but hides crypto complexity.

### Logo Idea

A pass-shaped proof layer: two overlapping credential planes with a small signal/check detail. It can animate as a verified layer locking over a ticket.

### Color Palette

| Role | Hex |
| --- | --- |
| Ledger Black | `#080A10` |
| Proof Blue | `#345DFF` |
| Trust Cyan | `#33D6FF` |
| Verified Mint | `#18D99E` |
| Glass Gray | `#1A2230` |
| Ticket White | `#F6F8FC` |

### Typography Feeling

More technical and precise. Use monospaced numerals more prominently for ownership history, proof IDs, and audit states.

### Suitable UI Atmosphere

- Best for ownership history, proof, verification, audit, and Console trust indicators.
- Good for explaining blockchain-backed records in academic work.
- Useful for admin/organizer confidence.

### Pros

- Strongest connection to Web3 transparency without overt crypto visuals.
- Excellent for proof, provenance, and audit.
- Differentiates FanPass from ordinary ticketing apps.

### Cons

- Risk of feeling too technical for mainstream fans.
- Less emotionally tied to live events.
- Needs warmer event imagery to avoid cold infrastructure feeling.

## VI Direction C: Fan-first Marketplace

### Visual Mood

Mobile-native, energetic, and accessible. This direction focuses on fans making fair decisions: verified ticket, market context, resale cap, and transfer safety.

### Logo Idea

A friendly but premium pass mark with an embedded movement arrow or access beam. The wordmark is clean, open, and approachable.

### Color Palette

| Role | Hex |
| --- | --- |
| Night Navy | `#07111F` |
| Fan Blue | `#006DFF` |
| Access Mint | `#1ED6A3` |
| Pulse Pink | `#FF4FA3` |
| Market Amber | `#F5A524` |
| Clean White | `#FAFBFF` |

### Typography Feeling

Native iOS and readable. Less editorial, more app-store friendly. Use SF Pro with clear hierarchy and approachable labels.

### Suitable UI Atmosphere

- Best for event discovery, marketplace education, and fan access rewards.
- Makes resale data less intimidating.
- Good for onboarding mainstream users into hidden Web3 ownership.

### Pros

- Most accessible to ordinary fans.
- Good balance of ticketing app and wallet app.
- Strong for mobile-first consumer flows.

### Cons

- Can feel less premium if not tightly controlled.
- Pulse Pink can become too playful.
- Console and Ops need stricter variants to stay professional.

## Selected Direction

The strongest direction for FanPass is:

**Premium Concert Pass with Web3 Trust Layer as the structural system.**

This means the primary brand should use Direction A for emotion and memorability, but borrow Direction B's proof, transparency, and infrastructure logic. Direction C contributes copy clarity and fan-first accessibility, but should not drive the visual system by itself.

Why this is strongest:

- FanPass needs to look like a real live-event product first.
- The app must feel exciting enough for fans, but trustworthy enough for payments and verified resale.
- Web3 should appear as proof, ownership history, and transparency, not as speculative crypto branding.
- Dark-mode first gives the product a premium event atmosphere and fits ticket/wallet use cases.
- iOS-native patterns make the product feel mainstream instead of experimental.
- The identity can adapt from expressive consumer moments to disciplined Ops and Console surfaces.

## Final VI Decision

### Final Brand Position

FanPass is a premium iOS-native ticketing platform for verified access, fair resale, and transparent ownership history.

### Final Tagline

`Real Tickets. Fair Resale. Verified Entry.`

### Final Visual Direction

Use a dark-mode-first premium concert identity with fintech-level trust and hidden Web3 transparency.

Core visual ingredients:

- Dark event atmosphere.
- Luminous but controlled pass gradients.
- Ticket/pass geometry.
- NFC signal wave details.
- Proof and ownership-history labels.
- Native iOS surfaces.
- High-contrast scanner states.
- Calm, dense Console tables.

### Final Logo Direction

Create a pass-shaped mark with:

- A modern ticket notch.
- Internal NFC/signal cuts.
- A subtle proof/check detail in negative space.
- A confident `FanPass` wordmark using Apple-system-inspired geometry.

The logo should work in:

- dark app icon
- light presentation slide
- monochrome Console header
- small tab/app icon contexts

### Final Color Direction

Primary:

- Event Black `#07080C`
- Pass Blue `#2F6BFF`
- Verified Mint `#27E0A3`
- Ticket White `#F7F8FB`

Secondary:

- Venue Graphite `#121722`
- Fog Gray `#A7AFBD`
- Stage Violet `#8B5CF6`

Semantic:

- Cap Amber `#F4B23C`
- Deny Coral `#FF5A52`

### Final UI Tone

Consumer app:

- emotional, premium, native, fan-first
- verified ticket and wallet as the hero object
- market data shown as fairness context, not trading stimulation

FanPass Ops:

- dark, high contrast, scan-first
- mint success and coral rejection are immediate and unmistakable
- no decorative gradients during active scanning

FanPass Console:

- professional, dense, table-first
- light or graphite surfaces
- clear audit, inventory, staff, settlement, and resale controls

### Final Copy Direction

Use:

- Verified Ticket
- Proof
- Ownership History
- Secure Resale
- Fan Access
- Entry Code
- Transfer Limit

Avoid consumer-facing:

- NFT
- SBT
- gas
- seed phrase
- mint
- smart contract

Technical contexts may explain blockchain-backed records, but consumer UI should stay mainstream.

This Final VI Decision is the base for the next UI/UX redesign pass.
