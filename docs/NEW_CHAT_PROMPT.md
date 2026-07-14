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
- Render API and Console both follow `main`; the latest code-bearing commit is `be6c548`, and both services passed live smoke after deployment.
- School Web, Arduino/EP8280 hardware, bridge, and enclosure source are archived under `archive/school-project`.
- Documentation was consolidated and fully audited on 2026-07-12; use `docs/README.md` instead of recreating deleted V4 planning logs.

## Latest Verification

V4 event covers lost by API mapping and the five Account destinations removed by `a8ff8ed` are restored. Re-exposed pages use live orders or honest unavailable states, not mock listings or fake support/settings success.

Market now uses a compact current-market entry, a searchable full-screen event selector, and a searchable seat-category child page instead of horizontal chip rails. The active V4 screen again mounts a restrained K-line built only from public settled-sale `price` / `tradedAt` history; current staging has no settled resale trades and therefore shows the honest empty state.

A clean Debug build was installed on simulator `41D28602-FF01-4E4C-98AA-DA7F4FC93D27`. Runtime automation verified event search, seat search, selection, return-to-Market navigation, and the chart empty state. The full API run has 19 passing suites and 118 passing tests; API privacy, iOS role boundaries, API typecheck, and iOS build passed. Render deploys `dep-d9auhi6q1p3s73cqmmug` and `dep-d9auhi6q1p3s73cqmnog` are live with HTTP 200 smoke checks and no post-deploy error logs.
