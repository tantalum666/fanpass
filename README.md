# FanPass

FanPass is a native iOS ticketing product for verified primary sales, controlled resale, transparent high-demand on-sales, dynamic QR entry, and auditable ownership state.

## Current Baseline

- Shipping UI baseline: **V4**.
- V5 status: unfinished brand exploration only; it is not implemented in SwiftUI and must not be shipped.
- Consumer app: `apps/ios/FanPass/FanPass` (`fun.fanpass.app`).
- Staff app: `apps/ios/FanPass/FanPassOps` (`com.fanpass.ops`).
- API: NestJS + Prisma/PostgreSQL under `apps/api`.
- Organizer Console: `apps/dashboard`.
- Completed school Web/hardware work: `archive/school-project`.

The staging API is backend-authoritative for orders, payments, ownership, resale, QR credentials, and redemption. UI previews may use fixtures, but active Beta/Release flows must not report a local-only transaction as successful.

Current security RC: branch `codex/security-rc-20260720` is frozen and pushed at immutable commit `a25185d2747520303eac0fd2681017b5c35ac62b`. The authoritative local V4 gate passed 97/97, including API 32 suites/386 tests and contracts 30/30; independent final review reported 0 remaining P0/P1. This commit has not been merged, deployed, or released. Hosted CI attestation is still open because the current GitHub credential receives 403 from the Actions/Checks/Status APIs. Historical TestFlight distribution/install and physical-iPhone QR validation were completed before this RC; what remains is fresh version-bound evidence for the next reviewed candidate, plus current Staging, provider, chain, and App Attest proof.

The current uncommitted working tree also contains a focused post-RC `qr-first-release-v1` iOS capability/evidence repair. It is not part of the immutable RC, so the historical TestFlight/iPhone QR result must be refreshed against a new reviewed build rather than treated as evidence for these exact bytes. Future NFC evidence remains separate.

## Engineering Rules

1. Read `docs/CODEX_HANDOFF.md` first before normal work.
2. Then read all workspace Markdown excluding `.git`. After automatic context compaction, read the Handoff first and only non-ignored Markdown with `rg --files -g '*.md'`.
3. Keep code typed, focused, and consistent with existing module boundaries. Do not build spaghetti code.
4. Security is release-blocking. Never commit or print provider secrets, bearer tokens, private keys, database URLs, raw QR payloads, or real personal data.
5. Backend changes must be deployed to the staging backend before asking the owner to test them.
6. Update the relevant Markdown and especially `docs/CODEX_HANDOFF.md` after meaningful work.
7. Active consumer/runtime paths must use explicit deployed Staging or Production services. Mock data belongs only to Preview, isolated tests, deterministic fault injection, or clearly labelled internal demos.
8. Local builds and simulators are supporting compile/debug/regression evidence, not proof of availability, authentication, payment, data integrity, or release readiness. Close those claims with deployed HTTPS, TestFlight/physical-device, and real user-path evidence as appropriate.
9. After a material change passes the required gates, continue automatically through reviewed candidate creation, hosted checks, controlled Staging deployment, and internal TestFlight preparation when the configured credentials and safety boundaries allow it. Ask the owner for a missing API/key or an irreversible paid/public-release decision instead of stopping at local success.
10. When changing a user journey, inspect adjacent entry, loading, empty, failure, recovery, authenticated, and cross-device states proactively instead of waiting for the owner to report each regression.

## Product Surfaces

- **FanPass:** discovery, primary/resale purchase, tickets, entry QR, listings, wallet/account.
- **FanPass Ops:** authenticated gate selection, QR validation, duplicate rejection, live check-in state.
- **FanPass Console:** event, inventory, staff, risk, audit, and support operations.

The fan app never contains staff scanner or organizer controls. QR is the universal entry path; NFC is optional and must use platform-supported hardware/workflows.

## Repository

```text
apps/api/                         NestJS API and Prisma data layer
apps/dashboard/                   FanPass Console
apps/ios/FanPass/                 FanPass and FanPass Ops Xcode project
apps/web/                         Optional consumer Web fallback
packages/contracts/               Solidity contracts and chain tooling
packages/shared/                  Shared TypeScript contracts
docs/                             Current product, security, QA, and evidence docs
FanPass_VI_Redesign_V4/           Approved V4 brand package
FanPass_VI_Redesign_V5/           Unfinished V5 exploration only
archive/school-project/           Completed coursework Web/hardware source archive
```

Use `docs/README.md` as the documentation index. Historical planning documents removed during the 2026-07-12 cleanup remain recoverable from Git history.

## Local Setup

Use Node 22:

```bash
scripts/with-node-22.sh npm install
```

Start or verify the local backend:

```bash
npm run beta:local:start
npm run beta:local:verify
npm run beta:local:stop
```

Run the authoritative foundation gate directly with Node 22. On this macOS
workspace:

```bash
/usr/bin/env -i \
  HOME=/tmp \
  TMPDIR=/tmp \
  PATH=/opt/homebrew/opt/node@22/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  DATABASE_URL=postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass \
  /opt/homebrew/opt/node@22/bin/node -e 'const crypto=require("node:crypto"),fs=require("node:fs"),Module=require("node:module"),path=require("node:path");try{const relative=process.argv[1],expected=process.argv[2],requestedRoot=process.argv[3],root=fs.realpathSync(requestedRoot),cwd=fs.realpathSync(process.cwd());if(root!==cwd)throw new Error("Canonical workspace does not match the current directory");const file=path.join(root,relative),real=fs.realpathSync(file);if(real!==file)throw new Error("Launcher path contains a symlink or escapes the canonical workspace");const descriptor=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));let source;try{const stat=fs.fstatSync(descriptor);if(!stat.isFile())throw new Error("Launcher must be a regular file");source=fs.readFileSync(descriptor)}finally{fs.closeSync(descriptor)}const actual=crypto.createHash("sha256").update(source).digest("hex");if(actual!==expected)throw new Error("Launcher digest does not match the reviewed bytes");const loaded=new Module(file);loaded.filename=file;loaded.paths=Module._nodeModulePaths(path.dirname(file));loaded._compile(source.toString("utf8"),file);if(typeof loaded.exports.main!=="function")throw new Error("Launcher must export main");loaded.exports.main()}catch(error){console.error(`Beta foundation bootstrap failed: ${error instanceof Error?error.message:"unknown error"}`);process.exit(1)}' scripts/beta-foundation-launcher.js 377af7200bfffe357620315caf2c158d13a81de0ee3f2bad0e767731f8b4e47f "$(/bin/pwd -P)"
```

The external `/usr/bin/env -i` boundary is part of the authoritative command:
it removes `NODE_OPTIONS`, `NODE_PATH`, npm preload configuration, and other
caller state before Node can evaluate any project code. The reviewed launcher
digest anchors the local release gate, and the same clean Node process compiles
the exact launcher bytes it hashes. The launcher injects the exact reviewed
runner and PostgreSQL target-guard bytes, validates the dependency inputs and
all four execution-script maps, and rechecks them around every gate. npm is
limited to deterministic installs with lifecycle scripts disabled; audited
JavaScript, shell, and tool entrypoints run directly without npm's mutable
`.bin` PATH. The AST parser remains a regression/review tool and does not
control the production execution list. Direct runner execution, npm aliases,
and the removed shell wrapper are diagnostic-only and are not release-evidence
entry points.
Hosted CI resolves the Node installed by `actions/setup-node`, verifies its
real path is inside the GitHub Actions Node 22 tool cache, and then applies the
same launcher-digest and allowlisted-environment boundary. Repository-side
self-checks do not replace external change control: a release candidate still
requires review of the immutable commit plus protected-branch/CODEOWNERS policy
and a matching hosted-CI attestation before deployment. Pushes to the reviewed
`codex/security-rc-*` branch pattern run this workflow against the exact RC head;
the resulting run is evidence only after the GitHub API validator binds it to
the same clean commit.

## iOS

Open the project:

```bash
open apps/ios/FanPass/FanPass.xcodeproj
```

Build the consumer app for Simulator:

```bash
xcodebuild \
  -project apps/ios/FanPass/FanPass.xcodeproj \
  -scheme FanPass \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  build CODE_SIGNING_ALLOWED=NO
```

Build FanPass Ops by replacing `-scheme FanPass` with `-scheme FanPassOps`.

Local provider values belong only in the ignored file:

```bash
cp apps/ios/FanPass/Config/LocalSecrets.xcconfig.example \
  apps/ios/FanPass/Config/LocalSecrets.xcconfig
```

Configure only the required local values. Never add them to `project.pbxproj` or documentation.

## Current Product Gaps

- Add iOS unit/UI coverage for session restore, Stripe outcome, list/cancel QR state, redemption sync, and duplicate redemption.
- Replace the remaining broad refresh revision with domain-scoped realtime/adaptive refresh and one centralized 401 policy.
- Split the oversized Market, Profile, and Tickets files without changing lifecycle behavior.
- Complete production notification preferences, payouts, credits/promos, and in-app support APIs before enabling those mutations.
- Complete release-grade chain custody, signed Apple Wallet passes, legal/compliance operations, and physical-device release QA.
- Put a managed edge waiting room and attestation/risk layer in front of concert-scale on-sales; Render/Neon remains the final inventory authority.
