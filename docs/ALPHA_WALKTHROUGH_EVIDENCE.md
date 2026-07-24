# FanPass Alpha Walkthrough Evidence

Status: optional evidence gate ready; walkthrough recording is owner-skipped for current Beta foundation.

This file defines the optional evidence contract for an Alpha walkthrough recording if recording work is deliberately reintroduced. The owner removed the human-reviewed recording requirement from current Beta foundation blockers on 2026-06-04; this contract remains as a guardrail so any future recording cannot imply public Beta readiness without proof.

## Local-only recording scope

- Do not use real personal data.
- Do not use production credentials.
- Do not use Stripe secrets.
- Do not use Privy secrets.
- Do not use wallet private keys, production wallet addresses, real event inventory, or production provider dashboards.
- Use only local seeded/demo users and local mock provider behavior.

## Seven-scene coverage

The recording artifact must follow `docs/ALPHA_DEMO_SCRIPT.md` in order:

- Scene 1 - Product Boundary
- Scene 2 - Fan Discovery And Wallet
- Scene 3 - Marketplace And Settlement
- Scene 4 - Fan Access
- Scene 5 - Console Operations
- Scene 6 - FanPass Ops Entry
- Scene 7 - Security Boundary Close

The closing scene must clearly state that the walkthrough proves only the local Alpha/Beta foundation flow, not external Beta readiness.

## Recording artifact path

- Future recording files must live under `outputs/alpha-walkthrough/`.
- The artifact set should include a dated manifest that names the recording file, relevant screenshots, verification command outputs, and the exact local-only scope used.
- Recording artifacts must not include shell environment variable dumps, bearer tokens, private keys, Stripe secrets, Privy secrets, production provider dashboards, or real user/event data.
- `npm run alpha:walkthrough:capture` creates a local artifact bundle under `outputs/alpha-walkthrough/<timestamp>/` with command logs, a Console screenshot, and a manifest. This capture bundle remains useful if recording work is reintroduced, but it is not a release blocker by itself.
- Saved human-review recording evidence must follow `docs/ALPHA_WALKTHROUGH_RECORDING_EVIDENCE.md` and pass `npm run alpha:walkthrough:recording:evidence -- <saved-json-output>` before any future recording artifact is claimed as reviewed.

## Verification evidence

The recording manifest must show these commands were run for the local walkthrough window:

```bash
# Use the complete /usr/bin/env -i plus absolute Node 22 command from README.md.
npm run beta:local:start
npm run beta:local:verify
npm run beta:local:stop
```

The complete `README.md` command invokes `scripts/beta-foundation-launcher.js` as the release-evidence foundation gate because it checks the reviewed launcher digest and removes Node preload variables before Node starts; the launcher then validates the exact runner and local PostgreSQL target guard plus all four package-script maps. The AST manifest parser remains a review/self-test tool and cannot choose the production execution list. A bare `node scripts/beta-foundation-verify.js` run is diagnostic-only. `npm run beta:local:verify` proves the local Prisma/API/Console/worker stack completes authorization, async ownership finalization, payment capture, and admin-only side-effect health without real Stripe or chain credentials.

For a repeatable local artifact bundle, run:

```bash
npm run alpha:walkthrough:capture
```

## Latest local capture bundle

Latest reviewed local capture bundle:

- `outputs/alpha-walkthrough/20260604T122652Z/manifest.md`
- `outputs/alpha-walkthrough/20260604T122652Z/fanpass-console.png`
- Command logs for demo script audit, walkthrough evidence audit, Beta foundation verifier, local start, local verify, Console visual check, and local stop are in the same bundle directory.

The bundle passed the capture command's forbidden-marker scan and `npm run security:evidence-redaction -- outputs/alpha-walkthrough/20260604T122652Z`, and keeps one-time invite tokens and raw email-shaped form values out of the Console screenshot.

Saved artifacts under `outputs/` must also pass:

```bash
npm run security:evidence-redaction
```

This repository-level scan covers walkthrough, staging runtime, CI, provider, iOS, scanner, Wallet, and chain evidence bundles and rejects obvious Stripe secret keys, Stripe publishable keys, webhook secrets, PaymentIntent client secrets, Privy secrets, app session/client/webhook secret assignments or fields, quoted secret assignments, quoted prefixed app secret assignments, snake_case secret assignments, npm registry auth tokens, source-control access token literals, chat/notification webhook URLs, CI secret masking command literals, observability service credential assignments, Apple/App Store automation credential assignments, generic token/API-key assignments, generic token/cookie JSON fields, secret-bearing snake_case JSON fields, secret-bearing YAML/colon fields, environment-style secret YAML/colon fields, environment name/value YAML or JSON secret fields, secret-bearing HTTP header JSON fields, secret-bearing URL query or fragment parameters, cloud storage signed URL credential parameters, Kubernetes kubeconfig credential literals, encoded deployment private key credential literals, provider secrets/API keys, provider API-key JSON fields, provider RPC URLs, chain provider API-key assignments, deployment/cloud credential assignments, lowercase deployment/cloud credential assignments, IaC sensitive output values, fields, JSON environment-map fields, or raw cloud credential literals, Azure storage credential literals, Docker/OCI registry credential literals, or encoded Docker/OCI registry credential literals, Apple signing material, provisioning profile markers, device identifier assignments, raw email addresses, raw wallet addresses, QR signing secrets, staff invite tokens, raw QR nonces, raw signed payloads, raw FanPass identity fields, raw ticket/event identifier fields, bearer tokens, Basic auth headers, sensitive cookie headers, secret-bearing HTTP headers, JWTs, database URL assignments, raw `postgres://`/`postgresql://` URLs, credentialed service URLs, private-key/certificate blocks, and staging/admin token assignments.

## Forbidden evidence

- Do not record shell environment variables, `.env` files, bearer tokens, private keys, Stripe secrets, Privy secrets, or production provider dashboards.
- Do not claim the recording proves production tenant/staff staging policy, signed Wallet passes, TestFlight, physical QR/NFC validation, chain custody, public dependency readiness, or public Beta readiness.
- Do not reintroduce a Beta recording requirement unless a real artifact set exists under `outputs/alpha-walkthrough/` and this evidence contract is updated intentionally.

## Historical pre-RC closed-beta evidence

These checks were completed against earlier deployed/local revisions. They do not attest commit `a25185d2747520303eac0fd2681017b5c35ac62b` and cannot close the current Hosted CI, Staging, provider, signed-device, physical-entry, or chain gates.

- Privy SDK login is implemented across FanPass, FanPass Ops, and the isolated FanPass Console auth runtime. Signed-device OTP remains a separate blocker.
- Stripe test-mode PaymentIntent, signed webhook, native iOS PaymentSheet authorization, capture, authorization cancellation, refund, reconciliation, duplicate webhook replay, and residual outbox-health evidence passed against Render staging.
- Deployed HTTPS staging runtime evidence passed for the current Render API and Vercel Console surfaces.
- Production tenant/staff staging evidence passed against Render/Vercel staging with verified Privy sessions and organizer isolation.
- The earlier Next/PostCSS `closed-beta-only` acceptance expired on 2026-07-04 and must not be reused for this RC. The root audit is now clean after the Console migration; current external evidence still has to bind the immutable RC.

## Remaining blockers

- Exact-SHA Hosted CI and current-RC Staging/provider evidence
- Signed iOS/TestFlight staging evidence
- Isolated Console Auth residual-risk/production-cookie review
- Signed Apple Wallet `.pkpass`
- Physical QR/NFC device validation

## Resolved historical compatibility marker

`Public/real-user dependency clean audit or Console migration` is retained as the legacy machine-audit marker. The Console migration and clean root production audit resolved that historical item; the marker is not current-RC Hosted, Staging, provider, signed-device, physical-entry, or chain evidence.
- Chain custody evidence
