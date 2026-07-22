# Privy Console React SDK Isolation Evidence

Status: isolated Console React SDK login complete for the local Beta foundation. Both the main `apps/dashboard` Console and the isolated `apps/console-auth` login runtime now use Vite React plus narrow Node servers; the root production audit is clean, while the isolated official Privy SDK tree has 10 moderate and zero high/critical advisories. External Beta still requires the remaining iOS/TestFlight, Wallet, scanner, and release-grade chain custody evidence.

This file defines the required evidence before FanPass changes `@privy-io/react-auth` placement in the Console login UI. The current approved shape is the isolated `apps/console-auth` runtime, which obtains a Privy access token client-side and posts it only in the body of `POST /api/console/privy-session`. Staging browser-SDK mode first starts a Console-owned login intent at `GET /api/console/privy-handoff`; the Console creates a five-minute 32-byte state, stores it in a host-only HttpOnly `SameSite=None; Secure` Cookie, and redirects only to the exact configured Auth origin. Auth returns that state in the top-level form body, the Console compares it in constant time and consumes it, then the Console origin sets its host-only HttpOnly session cookie as a first-party response before a `303 /` redirect. This state pair is the CSRF boundary when a browser reports an unavailable or opaque form Origin; JSON clients and production Privy HttpOnly-cookie mode still require the exact allowed Origin. The bridge syncs through the backend, requires organizer/admin role, and never places the Privy token in a URL, log, React state, or app-managed browser store.

## Why This Gate Exists

The Privy React SDK is a broad browser dependency surface. Earlier local tests showed that adding it directly to the Console dependency tree increased production audit findings. Before the SDK is integrated, FanPass must prove either:

- direct Console production dependency use keeps the root production audit clean; or
- the SDK is isolated behind a dedicated auth workspace/runtime boundary and is not part of the default FanPass Console production dependency audit path.

## Required Evidence

Saved evidence must be JSON or a text file containing one JSON object and must pass:

```bash
npm run security:privy-console-react-sdk:isolation -- <saved-json-output>
```

Generate a non-passing draft with the current Console session/dependency SHA-256 snapshot before filling in package metadata, audit counts, and the approved integration mode:

```bash
npm run privy:evidence:draft -- console --out outputs/privy-console-sdk/<draft-file>.json
```

The draft intentionally uses `ok: false` and dependency-review placeholders. It is not release evidence until Node 22 dependency checks, the SDK metadata review, boundary audits, and the completed validator all pass.

The evidence must prove:

- Node 22 was used with `scripts/with-node-22.sh`.
- `npm run security:audit:prod` and `npm run security:dependency-advisories` were run before and after the SDK integration or isolation check.
- `@privy-io/react-auth` package metadata was reviewed with `npm view @privy-io/react-auth@latest version dependencies peerDependencies --json`.
- Any direct Console dependency path introduces no new production advisory packages and no high or critical advisories.
- Any isolated-auth workspace keeps the SDK out of the default FanPass Console production dependency path and proves the runtime boundary.
- The SDK hands access tokens only to `/api/console/privy-session`.
- Browser-SDK handoff starts on the Console origin, uses a cryptographically random five-minute HttpOnly state Cookie, performs a constant-time Cookie/form-state comparison, and consumes the state before session issuance; missing or mismatched state never creates a session.
- Expired browser-SDK access tokens enter a bounded recovery state machine: one `getAccessToken` retry after short time-based backoff, one stale-session logout followed by explicit re-authentication, then a hard stop on another 401. Each retry rotates the handoff state Cookie and no rejected token may create a Console session.
- Console BFF traffic must not place every organizer in one low IP-only API rate-limit bucket. Dedicated Privy sync uses a non-plaintext credential fingerprint plus a separate higher origin flood ceiling; 429 is rendered as its own safe state and diagnostics must not include tokens or identity fields.
- The Console route stores server session state in an HttpOnly cookie.
- FanPass code does not create an additional browser token store, log tokens, or return them from route handlers. Current Render staging uses Privy's documented default browser SDK storage only for fictional staging access; production must use Privy HttpOnly cookie mode on a verified stable domain.
- The evidence includes a current SHA-256 snapshot for the Console SDK isolation boundary files so stale evidence cannot be reused after session bridge, login UI, server API helper, dependency manifest, or boundary-audit policy changes.
- `npm run security:console-routes` and `npm run security:provider-boundaries` passed after the integration shape was chosen.
- If the SDK is added directly to the workspace, the provider-boundary blocked-provider source and dependency-manifest rules were intentionally updated in the same reviewed change.
- Deployment/cloud credentials were unavailable to the evidence capture and redacted from saved output.

Production release evidence must additionally pass:

```bash
npm run security:privy-console-react-sdk:isolation -- --require-production <saved-json-output>
```

That stricter mode requires dashboard-reviewed proof of a dedicated production Privy app whose app id differs from staging, a stable owner-controlled production domain with the required DNS records verified, Privy HttpOnly cookie mode enabled, exact production allowed origins without broad shared-host wildcards, an administrator allowlist, MFA or passkey enforcement for privileged access, explicit review of the remaining isolated moderate advisories, and a live production login/session-bridge E2E. Staging evidence deliberately retains those items as named blockers; setting environment flags is not accepted as dashboard proof.

## Forbidden Evidence

Evidence must not include:

- Privy app secrets, verification keys, access tokens, or JWTs.
- Stripe secrets, Stripe publishable keys, webhook secrets, client secrets, database URLs, private keys, provider secrets, deployment/cloud credentials, or bearer tokens.
- Real user identifiers, raw emails, wallet addresses, or production provider dashboard data.
- Claims that Privy webhooks are required for Beta before the selected Privy plan confirms support.

## Example Shape

```json
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "provider": "privy-console-react-sdk-isolation",
  "evidenceSource": "node22-dependency-isolation-review",
  "realUserDataUsed": false,
  "productionCredentialsUsed": false,
  "deploymentCredentialsAvailable": false,
  "implementationSnapshot": {
    "source": "privy-console-sdk-isolation-boundaries",
    "files": [
      {
        "file": "apps/dashboard/server/console-bff.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/dashboard/src/ConsoleApp.tsx",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/dashboard/lib/console-auth.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/dashboard/package.json",
        "sha256": "<current sha256>"
      },
      {
        "file": "package.json",
        "sha256": "<current sha256>"
      },
      {
        "file": "package-lock.json",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/console-route-contract-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/provider-boundary-audit.js",
        "sha256": "<current sha256>"
      }
    ]
  },
  "sdk": {
    "package": "@privy-io/react-auth",
    "version": "3.35.0",
    "metadataCommand": "npm view @privy-io/react-auth@latest version dependencies peerDependencies --json"
  },
  "integration": {
    "mode": "isolated-auth-workspace",
    "fanPassConsoleProductionDependency": false,
    "isolatedRuntimeBoundary": true,
    "sdkImportsLimitedTo": ["apps/console-auth/src/PrivyConsoleLogin.tsx"],
    "sessionBridgeRoute": "/api/console/privy-session",
    "serverRouteStoresHttpOnlyCookie": true,
    "fanPassCodeStoresAccessTokensInBrowserStorage": false,
    "stagingPrivySessionMode": "browser-sdk",
    "productionPrivySessionMode": "httponly-cookie",
    "privyDefaultStorageRiskDocumented": true,
    "serverSideApiReadsUseCookieOrConfiguredToken": true
  },
  "dependencyAudit": {
    "integrationMode": "isolated-auth-workspace",
    "nodeVersion": "22.22.3",
    "engineStrict": true,
    "withNode22HelperUsed": true,
    "safeNextPostcssPathChecked": true,
    "commands": [
      "npm run security:audit:prod",
      "npm run security:dependency-advisories"
    ],
    "productionAuditBefore": {
      "total": 2,
      "moderate": 2,
      "high": 0,
      "critical": 0,
      "knownNextPostcssOnly": true
    },
    "productionAuditAfter": {
      "total": 2,
      "moderate": 2,
      "high": 0,
      "critical": 0,
      "knownNextPostcssOnly": true,
      "newAdvisoryPackages": []
    }
  },
  "boundaries": {
    "consoleRouteAuditPassed": true,
    "providerBoundaryAuditPassed": true,
    "dependencyAdvisoryGatePassed": true,
    "noProviderSecretsInEnvOrBundle": true,
    "noRawPrivyTokenLogging": true,
    "noRawUpstreamSessionForwarding": true
  },
  "redaction": {
    "accessTokensRedacted": true,
    "appSecretRedacted": true,
    "verificationKeyRedacted": true,
    "providerSecretsRedacted": true,
    "stripePublishableKeysRedacted": true,
    "databaseUrlsRedacted": true,
    "deploymentCredentialsRedacted": true,
    "userIdentifiersRedacted": true,
    "dependencyLogsReviewed": true
  }
}
```

## Release Rule

`Integrate Privy React SDK into FanPass Console` is complete for the current staging-isolated runtime shape after `outputs/privy-console-sdk/privy-console-react-sdk-20260603.json` passed this validator. On 2026-07-14 the Auth runtime moved from Next to Vite plus a Node built-in static/config server, kept official `@privy-io/react-auth@3.35.0`, restricted login to email, validated redirect and bridge URLs at both server and client boundaries, enforced a Privy-compatible CSP, and pinned patched `ws@8.21.0`. Removing Next/PostCSS reduced its isolated production audit from 12 to 10 moderate with zero high/critical findings. On 2026-07-15 the browser-SDK bridge first changed from a cross-origin credentialed fetch to a first-party top-level form. Owner-browser evidence then showed that a real form submission could still expose an unavailable/opaque Origin and be rejected by the exact-Origin-only guard. The current boundary therefore starts on the Console origin and binds the form to a short-lived HttpOnly state Cookie while retaining strict Origin checks for JSON/Privy-cookie clients. A later owner screenshot exposed a different failure class: the authenticated browser held a stale Privy token and automatically resubmitted it forever. Code release `108f4e65fc8c1ecb584aa2e6a29f8f2478bb0307` adds bounded recovery: one delayed access-token refresh, then stale-session logout and explicit re-authentication, then a hard stop. The permanent HTTP integration test now proves missing-state rejection, opaque-Origin success only with the matching state pair, state consumption, exact-origin JSON compatibility, state rotation across recovery, no session from rejected tokens, and no sensitive output. The refreshed isolation snapshot covers 21 files, including that integration test. Both staging services are live on `108f4e6`; Auth `/health` reports the exact release and live HTTP proved the deployed `refresh -> reauth -> stop` contract. The owner-visible current-release login was subsequently completed and opened the protected workspace; the amendment below records its token-free accepted-session evidence. The saved evidence remains `staging-only`; a real-user production release is blocked until the stricter production evidence mode proves the dedicated app, stable verified domain, Privy HttpOnly cookie mode, exact origins, administrator allowlist, MFA/passkey policy, residual-risk review, and live production E2E. Regenerate saved evidence after any Console auth runtime, session bridge, login UI, server API helper, dependency manifest, lockfile, deployment contract, integration test, or boundary-audit policy change.

Current 2026-07-16 amendment: live aggregates proved all four organizer/admin identities were already Privy-linked, the API/Auth app ids matched, and the configured P-256 key matched Privy's current JWKS. The remaining pre-audit `auth=failed` path was the shared Render egress exhausting one low IP-only bucket across recovery requests and unrelated organizers. Release `ce5b4f29d3ff319a53816ff378fb673a2938c4c9` separates dedicated Privy routes from the general auth bucket, keys the 12-per-minute sync limiter by a non-plaintext credential fingerprint, retains a higher 300-per-minute origin flood ceiling, maps 429 to `auth=rate`, and emits only token-free structured status diagnostics. API deploy `dep-d9cdicc2m8qs73f0r3i0` and Console deploy `dep-d9cdicc2m8qs73f0r3c0` are live; the integration regression now also proves safe 429 classification and no token output. The owner subsequently completed the real staging login and confirmed the protected workspace opened. At `2026-07-16 13:30:38 UTC`, the live Console recorded an accepted session exchange with upstream HTTP `201` and `recoveryMode=initial`, closing the staging owner-visible E2E for this release without logging an access token, state value, raw identity, or session Cookie.
