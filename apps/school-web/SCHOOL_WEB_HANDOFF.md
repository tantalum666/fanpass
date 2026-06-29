# FanPass School Web Handoff

This document is only for the ITP4457 school web version under `apps/school-web`.
Do not use it as the main FanPass product handoff, iOS release evidence, TestFlight
evidence, blockchain custody evidence, or production readiness evidence.

## Current Scope

- School project fork of FanPass for a web technology assignment.
- Keeps the FanPass idea: verified tickets, controlled resale, order history, and
  ticket ownership.
- Presents tickets and event add-ons as normal purchasable products.
- Uses React/Vite for the client, Express REST API for the server, and MongoDB or
  JSON fallback for persistence.

## Standing Workflow For This School Web Version

- Before implementation, read the main workspace Markdown guidance and this
  school web handoff.
- Keep school web notes inside `apps/school-web/README.md` or this file.
- Do not mix school web status into the main FanPass handoff unless the user
  explicitly asks to promote a school web decision into the main product.
- After meaningful school web changes, update this file with what changed,
  what passed, and known gaps.

## Latest Update - 2026-06-17

- Rechecked the school web version against `WebTechnologyAssignment_2526.docx`.
- Confirmed coverage for the required three-tier architecture, REST-style API,
  Guest/Member/Admin roles, product listing, cart management, transaction
  checkout, comments, account management, MongoDB/JSON fallback persistence,
  input validation, and responsive UI.
- Fixed a coursework-critical flow: guest cart items now merge into the member
  cart after login or registration, so users can add products before signing in
  and still complete checkout after authentication.
- Added a checkout guard so sold/unavailable selected seats cannot be checked
  out as a duplicate seat transaction.
- Admin comment review now supports `includeDisabled=true`, so disabled comments
  remain visible in the admin management surface.
- Added browser-level required/min-length/type validation to the main auth,
  password, comment, and admin product forms.
- Removed the awkward blank gap on the account page Login form.
- Login and Register now keep the same form panel rhythm without inserting an
  invisible empty row between Email and Password.
- Login uses a compact protected-checkout note as the third stable row, while
  Register uses the Name, Email, and Password fields.
- Browser position checks confirmed Login and Register keep stable panel,
  heading, tab, field area, submit button, and footnote positions.

## Verification

- `scripts/with-node-22.sh npm run typecheck:school-web`
- `scripts/with-node-22.sh npm run build:school-web`
- API smoke test passed for health, product list, guest add-to-cart, registration
  cart merge, checkout transaction, member comment creation, admin login, admin
  comment disable, and admin disabled-comment visibility.
- Browser QA passed for desktop home, event detail seat map, cart, guest
  checkout-to-login prompt, registration, member checkout, orders, admin login,
  admin management tables, and mobile home/event detail with no horizontal
  overflow.
- Playwright desktop screenshots:
  - `/tmp/fanpass-school-auth-login-fixed.png`
  - `/tmp/fanpass-school-auth-register-fixed.png`
  - `/tmp/fanpass-school-browser-home.png`
  - `/tmp/fanpass-school-browser-checkout-login.png`
  - `/tmp/fanpass-school-browser-orders.png`
  - `/tmp/fanpass-school-browser-admin.png`
  - `/tmp/fanpass-school-browser-mobile-event.png`

## Known Gaps

- The school web version is still a coursework web implementation, not the
  production FanPass web app.
- Authentication is assignment-grade and local to the school web API.
- Payment, blockchain, wallet, QR/NFC, and App Store/TestFlight evidence from
  the main FanPass project do not apply to this school web fork.
- Admin user management currently supports list and disable in the UI. The API
  also supports updates, but richer inline user editing can be added later if a
  stronger admin manual/demo path is needed.
