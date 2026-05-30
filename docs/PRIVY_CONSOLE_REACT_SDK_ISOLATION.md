# Privy Console React SDK Isolation Evidence

Status: evidence gate ready; Console React SDK login remains open.

This file defines the required evidence before FanPass adds `@privy-io/react-auth` to the Console login UI. The current safe Console boundary is still `POST /api/console/privy-session`, which accepts a Privy access token, syncs through the backend, requires organizer/admin role, and stores only the server session cookie in an HttpOnly cookie.

## Why This Gate Exists

The Privy React SDK is a broad browser dependency surface. Earlier local tests showed that adding it directly to the Console dependency tree increased production audit findings. Before the SDK is integrated, FanPass must prove either:

- direct Console production dependency use does not increase production audit findings beyond the currently documented Next/PostCSS advisory state; or
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
        "file": "apps/dashboard/app/api/console/privy-session/route.ts",
        "sha256": "5bdc707f2af7f4ebf8f0e2e5da10062f89334c42a148dde6af805bc82cf7772d"
      },
      {
        "file": "apps/dashboard/app/console-login-form.tsx",
        "sha256": "520ccb7bb457cea588d9278ea8fba4aaaeca73f99379aad3e36bb4f387ae29f3"
      },
      {
        "file": "apps/dashboard/lib/api.ts",
        "sha256": "ca57a802999aacd6ca4a63ba4b5006e00ae5ef60a2f0b4f8b11bc7244bfec2e0"
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
    "version": "3.28.0",
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

Do not mark `Integrate Privy React SDK into FanPass Console` complete until this evidence passes with the current Console SDK isolation SHA-256 snapshot, the actual Console login UI is implemented through the existing session bridge, the provider-boundary blocked-provider source and dependency-manifest rules are intentionally updated for the approved integration shape, and the full Beta foundation verifier passes. Regenerate evidence after any Console session bridge, login UI, server API helper, dependency manifest, or boundary-audit policy change.
