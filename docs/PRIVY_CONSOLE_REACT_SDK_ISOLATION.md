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
        "sha256": "63adf381290668936fac3d989e0755e56742348a01485d9cb59fbdac831bb2cc"
      },
      {
        "file": "package.json",
        "sha256": "e54de3073519981b7b648b1b03ad5e5fdcb81f5ffcded2aa61b69bb6cdcc53a6"
      },
      {
        "file": "package-lock.json",
        "sha256": "11162ede648d0e117bb20e1172797e972f84cb6646e629d447b5711a428f8fc7"
      },
      {
        "file": "scripts/console-route-contract-audit.js",
        "sha256": "150945ff985e1f8cd3a149df0a28a8aa2847c2c634e35813f9ed8b66a13da226"
      },
      {
        "file": "scripts/provider-boundary-audit.js",
        "sha256": "6eec3d873a45677f575ae79a3ee39ead0c8808abaa20e552de7a2750858d83ce"
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
    "sdkImportsLimitedTo": [
      "apps/console-auth/src/PrivyConsoleLogin.tsx"
    ],
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

`Integrate Privy React SDK into FanPass Console` is complete for the current staging-isolated runtime shape after `outputs/privy-console-sdk/privy-console-react-sdk-20260603.json` passed this validator. On 2026-07-14 the Auth runtime moved from Next to Vite plus a Node built-in static/config server, kept official `@privy-io/react-auth@3.35.0`, restricted login to email, validated redirect and bridge URLs at both server and client boundaries, enforced a Privy-compatible CSP, and pinned patched `ws@8.21.0`. Removing Next/PostCSS reduced its isolated production audit from 12 to 10 moderate with zero high/critical findings. On 2026-07-15 the browser-SDK bridge first changed from a cross-origin credentialed fetch to a first-party top-level form. Owner-browser evidence then showed that a real form submission could still expose an unavailable/opaque Origin and be rejected by the exact-Origin-only guard. The current boundary therefore starts on the Console origin and binds the form to a short-lived HttpOnly state Cookie while retaining strict Origin checks for JSON/Privy-cookie clients. The permanent HTTP integration test proves missing-state rejection, opaque-Origin success only with the matching state pair, state consumption, exact-origin JSON compatibility, and no sensitive output. The refreshed isolation snapshot covers 21 files, including that integration test. Code release `e8e47dd08ba0cd90e94fbc68e5958b76b27f0ba4` is live on both staging services: HTTP checks passed the exact Auth redirect, state Cookie policy, rejection/consumption paths, and JSON Origin boundary; Chrome reused the existing Privy session, returned to Console, and loaded the authenticated `Overview` workspace. The saved evidence remains `staging-only`; a real-user production release is blocked until the stricter production evidence mode proves the dedicated app, stable verified domain, Privy HttpOnly cookie mode, exact origins, administrator allowlist, MFA/passkey policy, residual-risk review, and live production E2E. Regenerate saved evidence after any Console auth runtime, session bridge, login UI, server API helper, dependency manifest, lockfile, deployment contract, integration test, or boundary-audit policy change.
