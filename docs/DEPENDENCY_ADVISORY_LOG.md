# FanPass Dependency Advisory Log

## 2026-06-06 - Console Next production-runtime exit completed

Commands:

```bash
scripts/with-node-22.sh npm install
scripts/with-node-22.sh npm run security:audit:prod -- --json
scripts/with-node-22.sh npm run security:dependency-advisories
scripts/with-node-22.sh npm run build -w apps/dashboard
```

Result:

- The primary FanPass Console at `apps/dashboard` no longer depends on Next.
- Console now builds as Vite React static assets and serves through `apps/dashboard/server/console-bff.ts`.
- Production audit is clean: `0` low, moderate, high, or critical production advisories.
- `npm run security:dependency-advisories` reports `releaseBlocker: null`.
- `next@latest` still declares `postcss: 8.4.31`; the blocker was closed by removing Next from the primary production runtime path rather than by waiting for a safe patched Next path.
- `apps/console-auth` remains an intentionally isolated Privy React SDK runtime outside root workspaces and outside the default production audit path.

Decision:

- The public/real-user dependency blocker for the root production path is closed.
- Do not re-add Next to `apps/dashboard` unless a new security review and production audit both pass.
- Keep `npm run security:dependency-advisories` and `npm run security:dependency-risk:evidence:self-test` in the Beta foundation verifier so future dependency drift is caught.

Date: 2026-05-29

Command:

```bash
npm run security:audit:prod
```

Current production dependency result:

- 2 moderate advisories.
- 0 low, high, or critical advisories.

Update after the FanPass iOS realtime orderbook pass:

- `npm audit --omit=dev --audit-level=low --json` still reports 2 moderate production advisories.
- The remaining advisories are unchanged: `next` through `postcss <8.5.10`.
- The only reported fix remains a destructive forced downgrade to `next@9.3.3`.
- Decision remains unchanged: do not run `npm audit fix --force`; re-check before external Beta or when Next publishes a safe patched path.

Update after the Console gate staff assignment pass:

- Added `@playwright/test` as a root dev dependency to make browser screenshot checks repeatable after local Console UI changes.
- Re-ran `npm audit --omit=dev --audit-level=low`; production runtime advisories are unchanged at 2 moderate Next/PostCSS findings.
- Re-ran full `npm audit --audit-level=low`; full dev/tooling audit reports 39 advisories, including existing Hardhat/contract-toolchain transitive findings. Several suggested fixes require breaking Hardhat or Next upgrades/downgrades.
- Decision: keep Playwright as dev-only QA tooling, do not run forced audit fixes during this pass, and continue treating production audit separately from dev contract/test tooling. Before external Beta, either isolate contract tooling from deployable app packages or upgrade the Hardhat toolchain in a dedicated migration with contract tests.

Update after the PostCSS remediation check:

- Added repeatable audit scripts:
  - `npm run security:audit:prod`
  - `npm run security:audit:all`
- Tested safe remediation paths for the remaining production advisory:
  - root `overrides.postcss = 8.5.15`;
  - nested `overrides.next.postcss = 8.5.15`;
  - versioned nested `overrides.next@15.5.18.postcss = 8.5.15`;
  - root direct `postcss@8.5.15` plus `npm dedupe`.
- Result: none of those remove Next's nested `next -> postcss@8.4.31` dependency. `npm ls postcss` still shows `next@15.5.18 -> postcss@8.4.31`, and `npm run security:audit:prod` still reports 2 moderate advisories.
- Latest checked `next@16.2.6` still declares `postcss: 8.4.31`, so upgrading to latest Next does not currently provide a safe patched path.
- Decision: no ineffective override or root direct `postcss` dependency is kept in `package.json`. The advisory remains an external-testing blocker unless it is explicitly risk-accepted or Next publishes a patched dependency path.

Update after the automated dependency advisory re-check:

- Added `npm run security:dependency-advisories`, which runs production `npm audit`, verifies that the only production advisories are the documented `next`/`postcss` chain, and queries `next@latest` from the npm registry.
- Added the advisory state check to `npm run beta:foundation:verify` so the local Beta foundation gate now fails if new production advisories appear, if npm's fix path changes, or if `next@latest` starts declaring a patched `postcss >=8.5.10` dependency.
- Current result on 2026-05-29: production audit still reports exactly 2 moderate advisories, `next@latest` is `16.2.6`, and it still declares `postcss: 8.4.31`.
- Decision remains unchanged: no safe non-forced upgrade path is available today. The advisory is documented and regression-checked, but not closed or risk-accepted for public or real-user testing.

Update after the dependency advisory gate self-test:

- Added fixture mode to `scripts/dependency-advisory-check.js` so the advisory gate can read synthetic production audit and `next@latest` metadata JSON without invoking npm.
- Added `npm run security:dependency-advisories:self-test`, which proves the gate accepts the documented unresolved Next/PostCSS state and a clean-audit closeout warning while rejecting undocumented production advisories, severity drift above moderate, changed npm fix paths, newly available safe Next/PostCSS patch paths, missing latest-Next PostCSS metadata, and advisory-log drift that removes the external-testing gate.
- Added the self-test to `npm run beta:foundation:verify` immediately before the live advisory re-check.
- Current result on 2026-05-30: the self-test passes; the live advisory check still reports exactly 2 moderate production advisories, `next@latest` is `16.2.6`, and it still declares `postcss: 8.4.31`.
- Decision remains unchanged: the advisory is contained and regression-tested, but not closed or risk-accepted for public or real-user testing.

Update after the Node runtime policy gate:

- Added `.nvmrc` and `.node-version`, both pinned to `22`.
- Tightened root `engines.node` to `>=22 <23` so FanPass tooling targets Node 22 LTS instead of any future major.
- Added `npm run security:node-runtime-policy` and `npm run security:node-runtime-policy:self-test`.
- The audit verifies Node 22 LTS pins, package and lockfile engine ranges, Beta verifier wiring, and docs that keep the current Hardhat contract/security tooling expectation explicit.
- The local shell currently reports Node `25.2.1`; the audit emits a runtime warning unless strict mode is enabled. Use Node 22 LTS for authoritative Hardhat contract tests, dependency advisory evidence, and external-testing readiness decisions.

Update after the Node 22 evidence pass:

- Installed Homebrew `node@22` and added `scripts/with-node-22.sh` so commands can run against the keg-only Node 22 runtime without changing the global `node` symlink.
- Added package scripts:
  - `npm run tooling:node22 -- <command>`
  - `npm run tooling:node22:verify`
- Reran `npm run security:node-runtime-policy`, `npm run test -w packages/contracts`, `npm run security:dependency-advisories`, and `npm run beta:foundation:verify` through `scripts/with-node-22.sh`.
- Result: Node runtime policy reported `currentRuntime: "22.22.3"` with no warning; Hardhat contract tests passed without the unsupported Node warning; the dependency advisory gate still reports only the known unresolved Next/PostCSS blocker; the full Beta foundation verifier passed under Node 22.
- Note: Homebrew's linked `node` formula is currently Node `26.0.0`; use `scripts/with-node-22.sh` for authoritative contract/security/dependency evidence until the active shell is explicitly switched to Node 22.

Update after the CI Node 22 Beta foundation workflow pass:

- Added `.github/workflows/beta-foundation.yml` so hosted CI can install Node from `.nvmrc`, run `npm ci`, use a local `postgres:16-alpine` service, and execute `npm run beta:foundation:verify` with strict Node runtime enforcement.
- Added `npm run security:ci-node22-workflow` and `npm run security:ci-node22-workflow:self-test` to keep the workflow pinned to Node 22, local Postgres, no provider secrets, and the composite verifier.
- This does not resolve the known Next/PostCSS production advisories; it reduces runtime drift for future dependency and Hardhat evidence.

Update after the developer-shell Node 22 enforcement pass:

- Added `.npmrc` with `engine-strict=true` so npm install/ci commands fail on unsupported Node majors instead of accepting a newer global shell with only an advisory warning.
- Extended `npm run security:node-runtime-policy` and its self-test to verify the `.npmrc` engine-strict policy alongside `.nvmrc`, `.node-version`, package engine ranges, the Node 22 helper, and documentation markers.
- This does not resolve the known Next/PostCSS production advisories; it makes future dependency evidence less likely to be generated under an unsupported Node runtime.

Update after the dependency risk evidence pass:

- Added `docs/DEPENDENCY_RISK_EVIDENCE.md` as the saved-evidence contract for either clean production audit closeout or explicit unresolved-advisory risk acceptance before external testing.
- Added `npm run security:dependency-risk:evidence` and `npm run security:dependency-risk:evidence:self-test`.
- Wired the self-test into `npm run beta:foundation:verify` after the live dependency advisory state check.
- The validator requires unresolved-advisory evidence to prove Node 22 production-audit commands, exactly the known moderate `next`/`postcss` findings, no high or critical advisories, no safe patched Next/PostCSS path, closed-beta-only owner approval, expiry within 90 days, review cadence no longer than 30 days, mitigation coverage, and redaction.
- This does not accept the current advisory risk by itself. As of this log, the advisories remain unresolved and not risk-accepted for public or real-user testing.

Update after the Privy Console React SDK isolation gate:

- Re-checked `next@latest` under Node 22 before touching Console auth dependencies. Latest remains `16.2.6` and still declares `postcss: 8.4.31`, so there is still no safe Next/PostCSS closeout path.
- Re-checked `@privy-io/react-auth@latest` package metadata. Latest is `3.28.0` and includes a broad wallet/provider dependency surface, so the SDK was not installed into the main workspace.
- Added `docs/PRIVY_CONSOLE_REACT_SDK_ISOLATION.md`, `npm run security:privy-console-react-sdk:isolation`, and fixture-backed self-test coverage.
- The validator requires future Console SDK evidence to prove either clean direct production-audit impact or an isolated auth workspace/runtime boundary before the React SDK login task can be closed.
- This does not accept the existing Next/PostCSS risk and does not close the Console login blocker; it prevents a future SDK integration from bypassing dependency-audit containment.

Update after isolated Console React SDK login:

- Added `apps/console-auth` as a standalone, non-root-workspace Next runtime that pins `@privy-io/react-auth@3.28.0`, obtains a Privy access token, and posts it only to the existing `/api/console/privy-session` HttpOnly cookie bridge.
- Saved passing isolation evidence at `outputs/privy-console-sdk/privy-console-react-sdk-20260603.json`. Root `npm run security:audit:prod` remains at 2 moderate known Next/PostCSS advisories; `apps/console-auth` remains isolated because its own `npm audit --omit=dev` reports 25 moderate advisories from Next/PostCSS plus wallet/provider transitive packages.
- This closes the Console React SDK login/isolation blocker for the local Beta foundation, but it does not accept the root Next/PostCSS advisory risk for public or real-user testing.

Update after the dependency tooling audit gate:

- Re-ran the full dev/tooling audit under Node 22. It currently reports 40 advisories, including 4 high findings and 0 critical findings.
- The current high findings are `lodash`, `serialize-javascript`, `tmp`, and `undici`.
- Those high findings are confined to the Hardhat/contract-toolchain transitive dependency graph through Hardhat, Nomic Foundation Ignition/verify tooling, `solc`, and Mocha. They are not direct workspace dependencies and are not part of the deployable API or Console production audit path.
- Added `npm run security:dependency-tooling` to enforce the full-audit containment rule, and `npm run security:dependency-tooling:self-test` to prove the rule rejects critical advisories, unexpected high packages, direct high workspace dependencies, high findings outside the contract-tooling boundary, missing script wiring, missing composite verifier wiring, and missing advisory-log markers.
- Wired both commands into `npm run beta:foundation:verify` after the dependency risk evidence self-test.
- Decision: this contains and regression-checks the current Hardhat/contract-toolchain risk, but it does not close or risk-accept the advisories. Before external Beta, resolve the high dev/tooling findings through a dedicated migration with contract tests, or provide explicit owner-approved risk acceptance for the affected testing/tooling surface.

Update after the hosted CI evidence masking-command pass:

- Re-ran `scripts/with-node-22.sh npm run security:dependency-advisories` on 2026-05-30 before changing hosted CI evidence gates.
- Current production audit remains 2 moderate advisories through the documented `next`/`postcss` path, with `next@latest` still `16.2.6` and still declaring `postcss: 8.4.31`.
- Re-ran `scripts/with-node-22.sh npm run security:dependency-tooling`; the full audit remains 40 advisories, including 4 high findings confined to `lodash`, `serialize-javascript`, `tmp`, and `undici` through Hardhat/contract-toolchain transitive dependencies.
- Decision remains unchanged: there is still no safe non-forced Next/PostCSS patch path, no dependency risk is accepted, and external testing still requires cleanup or owner-approved risk evidence.

Update after the dependency risk evidence masking-command pass:

- Extended `npm run security:dependency-risk:evidence` so saved clean-audit closeout or unresolved-advisory risk acceptance evidence rejects CI secret masking command captures that still contain literal values.
- Required dependency-risk evidence to prove `redaction.ciSecretMaskingCommandsRedacted` is `true`.
- Extended the fixture self-test to prove GitHub and Azure masking command literals, plus missing masking-command redaction proof, are rejected before any owner-approved unresolved-advisory risk packet can be trusted.
- This does not close or accept the current Next/PostCSS advisory risk. It prevents a future risk-acceptance packet from retaining CI masking-command secrets while the dependency gate remains open.

Update after the dependency risk evidence publishable-key redaction pass:

- Extended `npm run security:dependency-risk:evidence` so saved clean-audit closeout or unresolved-advisory risk acceptance evidence rejects Stripe publishable keys, including `pk_test_` and `STRIPE_PUBLISHABLE_KEY=` markers.
- Extended the fixture self-test to prove publishable-key leakage is rejected and added `redaction.stripePublishableKeysRedacted` to the required evidence contract.

Update after the dependency risk evidence provider-key/database URL redaction pass:

- Extended `npm run security:dependency-risk:evidence` so saved clean-audit closeout or unresolved-advisory risk acceptance evidence rejects provider-secret markers and raw `postgres://`/`postgresql://` database URLs.

Update after the dependency risk evidence deployment credential redaction pass:

- Extended `npm run security:dependency-risk:evidence` so saved clean-audit closeout or unresolved-advisory risk acceptance evidence rejects raw deployment/cloud credential assignments and JSON fields such as Vercel tokens, AWS keys, GitHub tokens, Netlify tokens, and Cloudflare API credentials.
- Required dependency-risk evidence to prove `deploymentCredentialsAvailable` is `false` and `redaction.deploymentCredentialsRedacted` is `true` before clean closeout or owner-approved closed-beta risk acceptance evidence can be trusted.
- Extended the fixture self-test to prove deployment/cloud credential assignments, camel-case credential fields, environment-map credential fields, credential availability drift, and missing deployment credential redaction proof are rejected before any owner-approved unresolved-advisory risk packet can be trusted.
- This does not close or accept the current Next/PostCSS advisory risk. It prevents a future risk-acceptance packet from retaining raw deployment/cloud credentials while the dependency gate remains open.

Update after the dependency risk evidence snapshot binding pass:

- Extended `npm run security:dependency-risk:evidence` so saved clean-audit closeout or unresolved-advisory risk acceptance evidence must include SHA-256 proof for the current root `package.json`, root `package-lock.json`, API package manifest, Console package manifest, contracts package manifest, and shared package manifest.
- Extended the fixture self-test to reject stale dependency snapshot source, missing manifest or lockfile entries, unexpected files, and mismatched SHA-256 proof before clean closeout or owner-approved risk evidence can be trusted.
- This does not close or accept the current Next/PostCSS advisory risk. It prevents dependency-risk evidence from being reused after package manifest or lockfile changes without rerunning the Node 22 production audit and advisory gate.

Update after the dependency risk policy snapshot binding pass:

- Extended `npm run security:dependency-risk:evidence` so saved clean-audit closeout or unresolved-advisory risk acceptance evidence must include SHA-256 proof for the current dependency advisory gate, advisory gate self-test, dependency risk evidence validator/self-test, dependency tooling audit, dependency advisory log, dependency risk evidence contract, and provider-cost feasibility policy.
- Extended the fixture self-test to reject stale risk-policy snapshot source, missing policy files, unexpected files, and mismatched SHA-256 proof before clean closeout or owner-approved risk evidence can be trusted.
- This does not close or accept the current Next/PostCSS advisory risk. It prevents dependency-risk evidence from being reused after advisory gate, risk validator, tooling audit, or dependency policy documentation changes without rerunning the Node 22 production audit and advisory gate.

Update after closed-beta dependency risk acceptance on 2026-06-04:

- The project owner accepted the current unresolved production dependency risk for `closed-beta-only` testing, with a 30-day expiry and 14-day review cadence.
- Re-checked under Node 22 before evidence generation: production audit still reports exactly the known 2 moderate `next`/`postcss` advisories, `next@latest` is `16.2.7`, and it still declares `postcss: 8.4.31`.
- The acceptance does not permit public launch, real-user open Beta, live-money launch, or weakening Console auth/CSP/style-input mitigations.
- Public or real-user Beta still requires a clean production audit, a safe patched Next/PostCSS upgrade path, or a Console migration off Next's production runtime path according to `docs/CONSOLE_NEXT_EXIT_PLAN.md`.

## Current Status

### 2026-07-11 Production Audit Drift - Closed 2026-07-12

The previous Next/PostCSS-only policy stopped matching the live npm audit state. A Node 22 production audit on 2026-07-11 reported six high-severity findings and no critical findings:

- `@nestjs/platform-express` through `multer <2.2.0`: deeply nested field-name and aborted-upload cleanup denial-of-service advisories.
- `engine.io`, `engine.io-client`, and `socket.io-adapter` through `ws <8.21.0`: memory-exhaustion denial of service from tiny WebSocket fragments/data chunks.

This drift was fixed without expanding the allowlist. The API now uses Nest `11.1.28`, Multer `2.2.0`, Engine.IO `6.6.9`, Engine.IO client `6.6.6`, Socket.IO adapter `2.5.8`, and `ws` `8.21.0`.

Verification on 2026-07-12:

- `npm audit --omit=dev --audit-level=low` reports zero production vulnerabilities.
- `npm run security:dependency-advisories:self-test` passes.
- `npm run security:dependency-advisories` reports `releaseBlocker: null` and zero findings at every severity.
- At remediation commit `667b567`, API typecheck/build and all 19 API suites with the then-current 115 tests passed.
- Render deploy `dep-d996v2mcjfls73fqlq5g` for commit `667b567ec6a86ab0a90a5d9228c9a39bf8021f46` is live; `/health`, events, and public orderbook smoke checks pass.

There are currently no production dependency advisories in the npm audit. The table below is historical and must not be treated as the current production result.

### 2026-07-12 Contract Tooling Advisory Refresh

A fresh Node 22 full dev/tooling audit initially reported 42 advisories, including 7 high findings and no critical findings. Three newly reported high packages were confined to the Hardhat/contract-toolchain graph and had compatible fixes inside the versions already allowed by the workspace:

- `form-data` moved from `4.0.5` to `4.0.6` through `hardhat-gas-reporter` and Axios.
- `viem` moved from `2.50.4` to `2.55.1` through `hardhat-gas-reporter`.
- `ethers` moved from `6.16.0` to `6.17.0`; both `ethers` and `viem` now resolve `ws` `8.21.0`.

After the lockfile refresh, the full dev/tooling audit currently reports 38 advisories, including 4 high findings and no critical findings. The remaining high packages are `lodash`, `serialize-javascript`, `tmp`, and `undici`. They remain indirect dependencies confined to the Hardhat/contract-toolchain graph and do not enter the deployable API or Console production path.

The dependency tooling gate now compares the documented advisory counts with live audit metadata and rejects a stale summary. Its allowlist and boundary checks remain fail-closed. The production audit reports zero vulnerabilities, the tooling gate self-test passes, and all 6 contract tests pass. The final 2026-07-12 foundation run also passed 19 API suites with 117 tests. Resolve the remaining four findings through a dedicated migration with contract tests; do not force a Hardhat 3 migration into unrelated product work.

## Historical Advisories

| Package           | Severity | Path                        | Advisory                                                                                                 | Current safe action                                                                                               |
| ----------------- | -------- | --------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `postcss <8.5.10` | Moderate | pulled through `next`       | `GHSA-qx2v-qp2m-jg93`, XSS via unescaped `</style>` in CSS stringify output                              | Do not use user-controlled CSS generation in FanPass Console; re-check when Next ships a patched dependency path. |
| `next`            | Moderate | direct dashboard dependency | npm maps the fix to `next@9.3.3`, which is a breaking downgrade from the current App Router architecture | Do not run `npm audit fix --force`; it would downgrade Next and likely break FanPass Console.                     |

## Historical Decision

Do not force-fix the current advisories. The suggested remediation is a destructive Next downgrade, not a safe patch. The current containment decision is:

- keep FanPass Console behind organizer/admin authentication;
- avoid user-supplied CSS or rich style serialization in Console;
- keep Content Security Policy enabled;
- re-run `npm run security:audit:prod` before any external tester build;
- run `npm run security:dependency-advisories` before any external tester build to catch new advisories or a newly available safe Next/PostCSS upgrade path;
- run `scripts/with-node-22.sh npm run security:node-runtime-policy` and use `scripts/with-node-22.sh <command>` for Hardhat or security/dependency output when the global shell is not Node 22;
- upgrade Next only when there is a safe patched release path that preserves the current App Router implementation.
- keep `docs/CONSOLE_NEXT_EXIT_PLAN.md` current so FanPass can migrate Console off Next if no safe patched Next/PostCSS path exists before public or real-user Beta.

## External Testing Gate

Before closed external Beta, one of these must be true:

- `npm audit --omit=dev --audit-level=low` passes without production advisories; or
- the remaining advisories are explicitly risk-accepted in `docs/ALPHA_SECURITY_REVIEW.md` with mitigation, affected surface, and review owner.

Before public or real-user Beta, risk acceptance is not enough: FanPass must either have a clean production audit, upgrade to a safe patched Next/PostCSS path, or remove Next from the Console production runtime path according to `docs/CONSOLE_NEXT_EXIT_PLAN.md`.

The historical risk acceptance does not override the current clean-audit requirement. Re-run the production audit and fail-closed advisory gate before every external tester build.
