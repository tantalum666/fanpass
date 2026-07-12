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

- Canonical branch is being consolidated to `main`; old hosted-CI/V5 branch names are historical, not separate products.
- Consumer app source is V4 SwiftUI under `apps/ios/FanPass/FanPass`; V5 has no Swift implementation.
- Render staging API is live with transparent high-demand on-sale behavior from commit `4e38d95`.
- School Web, Arduino/EP8280 hardware, bridge, and enclosure source are archived under `archive/school-project`.
- Documentation was consolidated on 2026-07-12; use `docs/README.md` instead of recreating deleted V4 planning logs.

## Latest Verification

The current work restored V4 event covers lost by API mapping and the five Account destinations removed by `a8ff8ed`. Re-exposed pages use live orders or honest unavailable states, not mock listings or fake support/settings success.

A clean Debug build was installed on simulator `41D28602-FF01-4E4C-98AA-DA7F4FC93D27`. Runtime snapshots and screenshots confirmed image-backed Home events plus all ten Account destinations without clipping. Remaining closeout is repository/security validation and fast-forwarding `main`; remove historical branches only after every commit is reachable from `main`.
