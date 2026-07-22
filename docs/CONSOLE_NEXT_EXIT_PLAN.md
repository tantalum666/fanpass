# FanPass Console Next Exit Plan

Date: 2026-06-04
Updated: 2026-06-06

This plan exists because the current production dependency blocker is the known `next -> postcss <8.5.10` advisory chain. FanPass must not rely on an indefinite upstream fix before public or real-user Beta. Closed Beta can use a short owner risk acceptance, but public or real-user release must have a clean production audit or a completed Console path that removes Next from the production dependency surface.

## Current status

- Status on 2026-06-06: the primary `apps/dashboard` Console production runtime has been migrated off Next to a Vite React static UI plus a Node built-in HTTP BFF.
- `npm audit --omit=dev --audit-level=low --json` is clean for the root production dependency path.
- `npm run security:dependency-advisories` now reports `releaseBlocker: null` and production audit total `0`.
- The old Next/PostCSS advisory is now historical for both Web runtimes: the isolated `apps/console-auth` runtime also migrated to Vite React plus a Node built-in static/config server on 2026-07-14. It remains outside root workspaces because the official Privy SDK still contributes 10 moderate wallet/provider transitive advisories, but Next and PostCSS are no longer present in that runtime.
- The latest Next metadata was still checked on 2026-06-06 and still declares `postcss: 8.4.31`, so the project closed this blocker by migration rather than by waiting for a safe Next patch path.

## Historical blocker

- Before the migration, `npm audit --omit=dev --json` reported exactly two production moderate advisories: `next` and transitive `postcss`.
- The advisory is `GHSA-qx2v-qp2m-jg93`, XSS via unescaped `</style>` in PostCSS stringify output.
- The npm fix path still points to a destructive `next@9.3.3` downgrade.
- The prior mitigations supported only closed-beta risk acceptance. They are no longer the main release basis because the root production audit is clean.

## Release rule

Before public or real-user Beta, one of these must be true:

1. `npm audit --omit=dev --audit-level=low` is clean under Node 22.
2. Next publishes a safe upgrade path that removes the vulnerable nested PostCSS dependency, and FanPass upgrades with the full Beta foundation verifier passing.
3. FanPass Console is migrated off Next for the production runtime path, with the replacement production audit clean under Node 22. This path is now complete for `apps/dashboard`; keep it guarded by the Beta verifier.

Closed Beta may proceed only with owner-approved dependency risk evidence that passes `npm run security:dependency-risk:evidence`, expires within 30 days by local policy preference, and remains scoped to `closed-beta-only`.

## Current Console inventory

Current `apps/dashboard` files:

- `apps/dashboard/src/ConsoleApp.tsx`: Vite React Console UI.
- `apps/dashboard/src/OrderbookLivePanel.tsx`: approved `socket.io-client` browser boundary.
- `apps/dashboard/src/styles.css`: Console UI styles.
- `apps/dashboard/server/console-bff.ts`: Node HTTP BFF, static asset server, security headers, session bridge, operations proxy, and gate-staff invite proxy.
- `apps/dashboard/lib/console-auth.ts`: framework-neutral Console auth, cookie, origin, CORS, and API helpers.
- `apps/dashboard/lib/gate-assignment-response.ts`: one-time invite response redaction.
- `apps/dashboard/vite.config.ts`, `apps/dashboard/index.html`, and `apps/dashboard/tsconfig.server.json`: replacement build/runtime configuration.

Production BFF duties that must be preserved if Next route handlers are removed:

- Exchange a verified Privy access token through `POST /auth/privy/sync`.
- Require `ORGANIZER` or `ADMIN` before issuing a Console session.
- Store the Console API token only in an HttpOnly cookie or equivalent server-managed session.
- Enforce mutation origin checks and CORS for Console session and staff invite mutations; the isolated top-level login form additionally requires the Console-issued short-lived handoff state Cookie so browsers with an unavailable/opaque Origin never require a broad origin bypass.
- Proxy gate assignment creation and invite rotation with server-side bearer auth.
- Redact one-time staff invite tokens to the intended Console UI surface only.

## Preferred migration target

Completed target:

1. Route-handler duties now live in `apps/dashboard/server/console-bff.ts`, which uses Node built-in HTTP primitives instead of Next, Express, or Hono.
2. The Console UI now builds with Vite React and is served from `dist/public`.
3. `socket.io-client` remains isolated to `apps/dashboard/src/OrderbookLivePanel.tsx`.
4. Privy React SDK login remains isolated in the Vite/Node `apps/console-auth` runtime unless its remaining SDK audit impact is separately resolved and fully reverified.

## Rules for new Console work

- Do not add Next back to `apps/dashboard` dependencies or add new `apps/dashboard/app/api` route handlers.
- Keep new Console data mappers, response redaction, and API payload shaping in framework-neutral files under `apps/dashboard/lib/`.
- Keep client components free of direct provider secrets, bearer-token storage, `localStorage`, `sessionStorage`, and `document.cookie`.
- Do not add user-controlled CSS input, CSS serialization, rich style editors, markdown-to-style features, or HTML style injection unless the security review explicitly approves it.
- Prefer plain React components and typed helper modules over framework-specific server rendering patterns.
- Re-run `npm run security:dependency-advisories` and the complete `/usr/bin/env -i` plus absolute Node 22 release-gate command in `README.md` before every external-testing decision; bare Node is diagnostic-only and not release evidence.

## Migration sequence

1. Freeze new Next-only Console patterns through QA and roadmap rules. Complete.
2. Extract API client helpers and redaction mappers into framework-neutral modules. Complete.
3. Add replacement BFF endpoints for Console session, gate assignment creation, invite rotation, operations, event creation, ticket type creation, and assignment deactivation. Complete.
4. Port UI entry points to Vite React with the same API contracts. Complete.
5. Run `npm audit --omit=dev --audit-level=low` and the complete `/usr/bin/env -i` plus absolute Node 22 release-gate command in `README.md`. Production audit is clean; keep the full verifier green.
6. Remove `next` from the primary production dependency path. Complete for `apps/dashboard`.
