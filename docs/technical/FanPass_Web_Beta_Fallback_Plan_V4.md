# FanPass Web Beta Fallback Plan V4

Date: 2026-06-07

## Decision

FanPass may add a web-based Beta fallback while Apple Developer enrollment, signed TestFlight builds, and signed Apple Wallet pass work are blocked. This is a fallback delivery path only. It does not replace the native iOS product direction and must not be used to close native Apple, physical-device, Wallet, Core NFC, or release-custody evidence gates.

2026-06-15 owner instruction: Web work is preparing to resume, but implementation must not start until the owner provides additional requirements. Before coding resumes, run the full Markdown startup protocol again and re-read this plan, `docs/product/FanPass_Web_Beta_Fallback_Workplan_V4.md`, and the active UX/product docs. After each completed Web work session, update the relevant Markdown docs immediately.

Web NFC is explicitly out of scope for the fallback path. The web fallback should use QR-based entry only.

## Product Boundary

| Surface | Main product role | Web fallback relationship |
| --- | --- | --- |
| FanPass iOS | Primary fan app | Remains source of truth for native product direction. |
| FanPass Ops iOS | Primary gate staff app for QR and Core NFC | Remains required for Core NFC and physical-device scanner evidence. |
| FanPass Console | Organizer/admin web dashboard | Remains organizer/admin surface. |
| FanPass Web Fallback | Backup fan and QR staff review path | Optional fallback if Apple distribution remains blocked. Must be documented and implemented separately. |

## Fallback Scope

The web fallback can cover:

- Consumer event discovery and event detail.
- Privy web login through a narrow access-token sync boundary.
- Stripe test-mode card checkout or Stripe-hosted web checkout when explicitly scoped.
- Ticket wallet, ticket detail, and dynamic QR display.
- QR-based gate staff scanner using browser camera access where supported.
- Secure resale listing and purchase flows.
- Market overview and fan-readable orderbook summaries.
- Proof & History display.
- Fan Access tasks and Access Badge display.

The web fallback must not cover:

- Web NFC.
- iOS Core NFC evidence.
- Signed iOS/TestFlight evidence.
- Signed Apple Wallet `.pkpass` evidence.
- Apple Pay on Web unless Apple Developer and merchant-domain setup are available.
- Real user data, production credentials, live Stripe mode, or production chain writes.
- Any claim that web QR scanner proof closes native FanPass Ops physical QR/NFC evidence.

## Proposed Implementation Shape

If implemented, keep the fallback separate from existing product surfaces:

- Use a dedicated `apps/web` package for the fan-facing web fallback.
- Keep organizer/admin workflows in `apps/dashboard` / FanPass Console.
- Use a staff-only route or separate package only for QR scanner fallback if it is explicitly needed.
- Reuse the existing `apps/api` contracts instead of forking business logic.
- Keep all provider calls behind typed services/adapters.
- Keep Clean V4 brand tokens and guardrails, but use web-specific components rather than copying SwiftUI structure directly.
- Avoid Next.js unless a fresh security review proves a clean production dependency path. Prefer Vite React for consistency with the migrated Console runtime.

Detailed workplan:

- `docs/product/FanPass_Web_Beta_Fallback_Workplan_V4.md`
- `docs/ux/FanPass_Web_Landing_Page_Plan_V4.md`

## Cross-Platform Sync Boundary

The web fallback and iOS app must be two clients for the same backend truth, not separate products.

Shared state must live in the API/database layer:

- Privy-linked FanPass user identity.
- User role and tenant/staff assignment.
- Event, venue, ticket type, and organizer rule data.
- Ticket ownership, lifecycle state, and proof history.
- Order, payment, refund, resale listing, trade, and market state.
- Dynamic QR credential issue, refresh, expiry, and redemption state.
- Chain proof-sync outbox state when enabled.

Client apps may cache or optimistically render safe local state, but every security-sensitive transition must reconcile against the API.

The first implementation should start with the landing page because it is useful without Apple Developer access, signing material, payments, live credentials, Web NFC, or native scanner evidence.

## Landing Positioning Boundary

The Web Beta Fallback landing page should be a real long-scroll website with low information density. Do not interpret `less is more` as a short one-screen page or a presentation slide. Each viewport should make one clear claim and support it with one strong visual or proof point.

Primary homepage story:

- Why a FanPass ticket is trustworthy: `Verified Ticket`, `Ownership History`, and `Proof & History`.
- Why resale does not become chaotic: organizer-defined `Resale Cap`, transfer rules, and secure resale state stay attached to the ticket.
- Why prices are easier to understand: face value, cap, recent verified sales, and fan-readable price context.

Do not make QR, NFC, scanner mechanics, Web3 terminology, or web/iOS synchronization the homepage value proposition. QR is an entry transport, Web NFC is out of scope, and cross-client synchronization is an architecture requirement rather than a marketing claim.

## Evidence Boundary

Web fallback evidence can prove only web fallback behavior:

- Web build/runtime health.
- Web login session boundary.
- Web checkout test-mode flow.
- Web ticket display and dynamic QR refresh.
- Web QR scanner fallback behavior.

It cannot close:

- `ios-build` signed iOS/TestFlight release evidence.
- `apple-wallet` signed `.pkpass` evidence.
- `ops-scanner` physical QR/NFC evidence for FanPass Ops.
- `chain-custody` release-grade signer/custody evidence.

If a web fallback is implemented, add a new dedicated validator or review document rather than reusing native evidence validators incorrectly.

## UX Rules

- Keep the product mainstream: use `Verified Ticket`, `Secure Resale`, `Fan Access`, `Proof & History`, and `Transparent Prices`.
- Do not make the web fallback look like a crypto trading app.
- Do not introduce Web3-heavy primary copy.
- Do not redesign the Clean V4 logo or app icon.
- Do not add decorative lines crossing text, QR codes, charts, prices, ticket metadata, buttons, or navigation.
- QR quiet zones must remain clear.
- Market charts must not overlap price numbers or labels.
- Staff scanner mode must be clearly role-gated and separated from normal fan navigation.

## Security Rules

- Browser camera QR scanning is a client capture path only. The backend remains authoritative for redemption, staff identity, gate assignment, replay rejection, ticket status, event scope, and audit logging.
- The web client must never store raw secrets, QR signing secrets, Privy secrets, Stripe secrets, chain keys, webhook secrets, or production credentials.
- Access tokens must not be written to screenshots, docs, persistent local storage, or evidence.
- Dynamic QR payloads must be short-lived and validated server-side.
- The fallback must preserve existing role separation: fans cannot access staff scanner operations, and staff cannot access organizer/admin Console operations unless their role explicitly allows it.

## Documentation Rule

Any future Web fallback work must use `Web Beta Fallback` naming in docs, evidence, commit messages, and task notes. Do not describe it as the primary FanPass iOS app, FanPass Ops app, Apple Wallet path, or Core NFC path.
