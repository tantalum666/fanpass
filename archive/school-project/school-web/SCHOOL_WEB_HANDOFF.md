# FanPass Web Handoff

This document is only for the archived ITP4457 coursework web version under `archive/school-project/school-web`.
Do not use it as the main FanPass product handoff, iOS release evidence, TestFlight
evidence, blockchain custody evidence, or production readiness evidence.

## Current Scope

- Coursework fork of FanPass for a web technology assignment.
- Keeps the FanPass idea: verified tickets, controlled resale, order history, and
  ticket ownership.
- Presents tickets and event add-ons as normal purchasable products.
- Uses React/Vite for the client, Express REST API for the server, and MongoDB or
  JSON fallback for persistence.

## Standing Workflow For This Coursework Web Version

- Before implementation, read the main workspace Markdown guidance and this
  coursework handoff.
- Keep coursework web notes inside `archive/school-project/school-web/README.md` or this file.
- Do not mix coursework web status into the main FanPass handoff unless the user
  explicitly asks to promote a coursework web decision into the main product.
- After meaningful coursework web changes, update this file with what changed,
  what passed, and known gaps.

## Latest Update - 2026-06-17

- Rechecked the coursework web version against `WebTechnologyAssignment_2526.docx`.
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

- `scripts/with-node-22.sh npm run typecheck --prefix archive/school-project/school-web`
- `scripts/with-node-22.sh npm run build --prefix archive/school-project/school-web`
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

## Latest Update - 2026-07-05

- Added admin UI editing for member records through the Admin console. The Users
  table now has an Edit action that fills an Update member form for changing
  name, role, and status.
- Added admin UI editing for order records through the Admin console. The
  Transactions table now has an Edit action that fills an Update order form for
  changing order status.
- Reworked the Admin console layout so the member/order update controls and
  Events table sit tightly in the right rail instead of leaving large empty
  card gaps.
- Replaced the raw event image path field and bundled image choices with a
  direct local image upload control and live preview.
- Added `PUT /api/transactions/:id` so administrators can update transaction
  status through the REST API, matching the existing user update API.
- Fixed login form validation so the required admin account `tuser / tpass`
  can pass browser validation while registration still requires 6+ character
  passwords.
- Removed visible coursework labels from the app UI, presentation deck, speaker
  script, demo flow, README, and current local demo data. The demo now presents
  as FanPass Web instead of exposing assignment labels on screen.
- Updated Admin table Edit actions so Events, Users, and Transactions visibly
  switch the upper forms into Update mode and scroll focus back to the editor.
- Restricted event reviews to paid purchased events in both the Orders UI and
  `POST /api/comments`, so direct API requests cannot review unpurchased events.
- Added a dismiss button to the top notification banner and made notices
  auto-dismiss after 30 seconds.
- Rechecked the coursework web version against `WebTechnologyAssignment_2526.docx`.
  The main coursework surface now covers administrator product, user, order,
  and comment review/management paths.
- Verification passed:
  - `scripts/with-node-22.sh npm run typecheck --prefix archive/school-project/school-web`
  - `scripts/with-node-22.sh npm run build --prefix archive/school-project/school-web`
  - API smoke test for admin login and transaction status update.
  - API smoke test for rejecting an unpurchased event review with HTTP 403.
  - Browser check for Admin console, Update event/member/order panels, image
    upload-only control, removed visible assignment labels, and no desktop
    horizontal overflow.
  - Browser check for paid-purchase review options, manual notification
    dismissal, 30-second notification auto-dismiss, and clean console logs.

## Known Gaps

- The coursework web version is still a coursework implementation, not the
  production FanPass web app.
- Authentication is assignment-grade and local to the coursework web API.
- Payment, blockchain, wallet, QR/NFC, and App Store/TestFlight evidence from
  the main FanPass project do not apply to this coursework fork.
- Admin order editing is intentionally limited to status updates for the
  demo. It does not implement payment refunds or production order operations.
