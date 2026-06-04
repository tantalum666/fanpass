# FanPass Console Next Exit Plan

Date: 2026-06-04

This plan exists because the current production dependency blocker is the known `next -> postcss <8.5.10` advisory chain. FanPass must not rely on an indefinite upstream fix before public or real-user Beta. Closed Beta can use a short owner risk acceptance, but public or real-user release must have a clean production audit or a completed Console path that removes Next from the production dependency surface.

## Current status

- `npm audit --omit=dev --json` reports exactly two production moderate advisories: `next` and transitive `postcss`.
- The advisory is `GHSA-qx2v-qp2m-jg93`, XSS via unescaped `</style>` in PostCSS stringify output.
- The npm fix path still points to a destructive `next@9.3.3` downgrade.
- Current `next@latest` checked on 2026-06-04 is `16.2.7` and still declares `postcss: 8.4.31`.
- FanPass Console is organizer/admin protected, has CSP enabled, and does not intentionally accept user-controlled CSS generation. These mitigations support closed-beta-only risk acceptance, not public launch.

## Release rule

Before public or real-user Beta, one of these must be true:

1. `npm audit --omit=dev --audit-level=low` is clean under Node 22.
2. Next publishes a safe upgrade path that removes the vulnerable nested PostCSS dependency, and FanPass upgrades with the full Beta foundation verifier passing.
3. FanPass Console is migrated off Next for the production runtime path, with the replacement production audit clean under Node 22.

Closed Beta may proceed only with owner-approved dependency risk evidence that passes `npm run security:dependency-risk:evidence`, expires within 30 days by local policy preference, and remains scoped to `closed-beta-only`.

## Current Console inventory

Next-bound files:

- `apps/dashboard/app/layout.tsx`
- `apps/dashboard/app/page.tsx`
- `apps/dashboard/app/api/console/privy-session/route.ts`
- `apps/dashboard/app/api/console/gate-assignments/route.ts`
- `apps/dashboard/app/api/console/gate-assignments/[assignmentId]/invites/route.ts`
- `apps/dashboard/next.config.ts`
- `apps/dashboard/lib/api.ts` because it reads `next/headers` cookies.

Portable React/UI candidates:

- `apps/dashboard/app/console-login-form.tsx`
- `apps/dashboard/app/gate-staff-invite-form.tsx`
- `apps/dashboard/app/orderbook-live-panel.tsx`, except for the approved `socket.io-client` boundary.
- `apps/dashboard/app/rotate-staff-invite-button.tsx`
- `apps/dashboard/lib/gate-assignment-response.ts`

Production BFF duties that must be preserved if Next route handlers are removed:

- Exchange a verified Privy access token through `POST /auth/privy/sync`.
- Require `ORGANIZER` or `ADMIN` before issuing a Console session.
- Store the Console API token only in an HttpOnly cookie or equivalent server-managed session.
- Enforce mutation origin checks and CORS for Console session and staff invite mutations.
- Proxy gate assignment creation and invite rotation with server-side bearer auth.
- Redact one-time staff invite tokens to the intended Console UI surface only.

## Preferred migration target

If Next remains unresolved, migrate Console in two steps:

1. Move all route-handler duties into a small BFF that does not depend on Next. Prefer the existing Nest API if it can keep Console session cookies, CORS, and staff invite proxy boundaries clean; otherwise use a minimal Hono or Express service with no CSS build pipeline.
2. Move the Console UI to a Vite React app served as static assets. Keep `socket.io-client` only in the live orderbook panel and keep Privy React SDK login isolated in `apps/console-auth` unless its audit impact is separately accepted or cleaned.

## Rules for new Console work

- Do not add new Next route handlers unless they are documented in this plan and `scripts/console-route-contract-audit.js`.
- Keep new Console data mappers, response redaction, and API payload shaping in framework-neutral files under `apps/dashboard/lib/`.
- Keep client components free of direct provider secrets, bearer-token storage, `localStorage`, `sessionStorage`, and `document.cookie`.
- Do not add user-controlled CSS input, CSS serialization, rich style editors, markdown-to-style features, or HTML style injection to Console while the Next/PostCSS advisory remains unresolved.
- Prefer plain React components and typed helper modules over Server Component-only patterns so Vite migration remains mechanical.
- Re-check `npm view next version dependencies.postcss --json` and `npm run security:dependency-advisories` before every external-testing decision.

## Migration sequence

1. Freeze new Next-only Console patterns through QA and roadmap rules.
2. Extract API client helpers and redaction mappers into framework-neutral modules.
3. Add replacement BFF endpoints for Console session, gate assignment creation, and invite rotation.
4. Port UI entry points to Vite React with the same API contracts.
5. Run `npm audit --omit=dev --audit-level=low` and `npm run beta:foundation:verify` under Node 22.
6. Remove `next` from the production dependency path only after replacement runtime checks pass.

