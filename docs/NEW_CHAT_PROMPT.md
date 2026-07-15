# New Chat Resume Prompt

Work in `/Users/tantalum/Documents/system and iot`.

## Required Start

1. Read `docs/CODEX_HANDOFF.md` first and in full.
2. On a normal new turn, enumerate/read all Markdown including hidden/ignored/generated files except `.git`.
3. After automatic context compaction, read the Handoff first, then only non-ignored Markdown from `rg --files -g '*.md'`.
4. Read task-specific contracts from `docs/README.md`.

## Standing Rules

- V4 is the active app design. V5 is unfinished exploration only.
- Do not build spaghetti code or fake transactional success.
- Security is release-blocking.
- Never expose provider secrets, bearer tokens, private keys, database URLs, raw QR payloads, or real personal data.
- Deploy backend changes to Render staging before asking the owner to test them.
- Keep school Web/hardware archived unless explicitly reopened.
- Update relevant Markdown and `docs/CODEX_HANDOFF.md` after meaningful work.

## Current State

- `main` is the only local and remote branch and the only active source line.
- Consumer app source is V4 SwiftUI under `apps/ios/FanPass/FanPass`; V5 has no Swift implementation.
- Render API, Console, and isolated Console Auth all follow `main`; the latest Console/Auth code-bearing commit is `108f4e6`. Auth `/health`, the deployed Console asset, and the live recovery handoff contract prove that release is live. A later `[skip render]` documentation follow-up may be the `main` head.
- School Web, Arduino/EP8280 hardware, bridge, and enclosure source are archived under `archive/school-project`.
- Documentation was consolidated and fully audited on 2026-07-12; use `docs/README.md` instead of recreating deleted V4 planning logs.

## Latest Verification

V4 event covers lost by API mapping and the five Account destinations removed by `a8ff8ed` are restored. Re-exposed pages use live orders or honest unavailable states, not mock listings or fake support/settings success.

Market now uses a compact current-market entry, a searchable full-screen event selector, and a searchable seat-category child page instead of horizontal chip rails. The active V4 screen again mounts a restrained K-line built only from public settled-sale `price` / `tradedAt` history; current staging has no settled resale trades and therefore shows the honest empty state.

A clean Debug build was installed on simulator `41D28602-FF01-4E4C-98AA-DA7F4FC93D27`. Runtime automation verified event search, seat search, selection, return-to-Market navigation, and the chart empty state.

Console is now an event-first operational workspace with persistent navigation and focused Overview, Events & inventory, Sales & market, Entry, Team, and Risk & audit pages. Searchable event selection is URL-addressable; Sales has ticket-type selection, public depth/history, and isolated live updates. Feature modules, typed data utilities, the shell, and CSS layers are separated instead of living in a monolithic component. Desktop/mobile browser automation passed event selection, VIP market selection, staff assignment, invite rotation, token clearing, and zero console errors. Refund/review/transfer/report mutations remain disabled until backend-owned contracts exist.

Console staging sign-in validates the Auth URL and links to the separate email-only Privy runtime instead of looping back to itself. The Auth runtime has migrated from Next to Vite React plus a Node built-in server with fail-closed health/runtime config, exact URL and static-path boundaries, and a Privy-compatible CSP. The isolated audit is now 10 moderate and zero high/critical after removing Next/PostCSS; root production remains zero vulnerabilities.

The browser-SDK staging handoff starts on Console with a five-minute 32-byte state stored in a host-only HttpOnly Cookie, redirects only to the exact Auth origin, and returns the state with the token in a top-level POST body. Console compares the Cookie/form state in constant time and consumes it before setting its own HttpOnly session Cookie and returning `303 /`. This replaces the unreliable cross-origin cookie fetch and handles browsers that report an unavailable or opaque form Origin without weakening JSON or production Privy-cookie Origin checks. Tokens remain out of URLs, logs, React state, and app-managed browser storage.

An expired Privy browser session no longer loops through the same rejected token. Console rotates the handoff state and requests one `getAccessToken` retry after a short backoff, then Auth logs out the stale session and asks for an explicit fresh login, and a further 401 stops at `auth=session`. Upstream service failure has its own `auth=service` message. Missing/rejected tokens never create a Console session.

FanPass adds no browser token store. Render staging explicitly uses Privy's documented default browser SDK storage; real-user production must use a separate production Privy app on a stable DNS-verified owner domain with Privy HttpOnly cookie mode, exact allowed origins, administrator allowlist, MFA/passkey enforcement, residual-risk review, and live production E2E. The Console BFF cookie-mode bridge is implemented, but the saved evidence remains `staging-only` and intentionally fails `--require-production`.

The full Node 22 Beta verifier passed on the current session recovery: 19 API suites / 118 tests, all 16 Auth tests, both builds/typechecks, the permanent state/Cookie/form/JSON/blocked-origin plus bounded expired-session integration regression, route/runtime/header/provider/privacy and evidence-redaction gates, clean root production audit, and refreshed 21-file isolation evidence. Live HTTP on `108f4e6` proved `refresh -> reauth -> stop`, state rotation, and no rejected-token session. The prior `e8e47dd` release completed authenticated Chrome E2E into `Overview`; current owner-visible confirmation remains a one-click follow-up because the Chrome extension timed out while claiming the existing tab and therefore did not interact with it.
