# Privy Console React SDK Isolation Evidence

Status: isolated Console React SDK login complete for the local Beta foundation. The main `apps/dashboard` Console has since migrated off Next to Vite React plus a Node BFF with a clean root production audit. External Beta still requires the remaining iOS/TestFlight, Wallet, scanner, and release-grade chain custody evidence.

This file defines the required evidence before FanPass changes `@privy-io/react-auth` placement in the Console login UI. The current approved shape is the isolated `apps/console-auth` runtime, which obtains a Privy access token client-side and posts it only to `POST /api/console/privy-session`. The bridge syncs through the backend, requires organizer/admin role, and stores only the server session cookie in an HttpOnly cookie.

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
- The Console route stores server session state in an HttpOnly cookie.
- Privy access tokens are not stored in browser storage, logged, or returned from route handlers.
- The evidence includes a current SHA-256 snapshot for the Console SDK isolation boundary files so stale evidence cannot be reused after session bridge, login UI, server API helper, dependency manifest, or boundary-audit policy changes.
- `npm run security:console-routes` and `npm run security:provider-boundaries` passed after the integration shape was chosen.
- If the SDK is added directly to the workspace, the provider-boundary blocked-provider source and dependency-manifest rules were intentionally updated in the same reviewed change.
- Deployment/cloud credentials were unavailable to the evidence capture and redacted from saved output.

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
      "apps/dashboard/components/auth/PrivyConsoleLogin.tsx"
    ],
    "sessionBridgeRoute": "/api/console/privy-session",
    "serverRouteStoresHttpOnlyCookie": true,
    "accessTokensStoredInBrowserStorage": false,
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

`Integrate Privy React SDK into FanPass Console` is complete for the current isolated runtime shape after `outputs/privy-console-sdk/privy-console-react-sdk-20260603.json` passed this validator. The 2026-07-14 staging-login repair upgraded the isolated runtime to `@privy-io/react-auth@3.35.0`, restricted Console login to email, and pinned the patched `ws@8.21.0` transitively; the isolated production audit reports 12 moderate and zero high/critical advisories. Regenerate saved release evidence after any Console auth runtime, session bridge, login UI, server API helper, dependency manifest, lockfile, or boundary-audit policy change.
