# Staff Tenant Staging Evidence

FanPass has local staff invitation/linking policy checks, and production tenant/staff staging evidence passed on 2026-06-04. After the 2026-06-06 Console migration from Next to Vite/Node BFF, regenerate this evidence before relying on it for any new external release decision. Do not close or refresh this blocker with seeded local demo sessions, localhost evidence, raw invite tokens, raw Privy access tokens, or real personal data.

Run future saved evidence through:

```bash
npm run security:staff-tenant:staging-evidence -- <saved-json-output>
```

Seed a non-passing draft with the current implementation SHA-256 snapshot before collecting real staging proof:

```bash
npm run release:evidence:draft -- staff-tenant --out outputs/staff-tenant/<draft-file>.json
```

The draft intentionally uses `ok: false` and placeholders. It cannot close this blocker until real staging facts replace every placeholder and the saved file passes the validator above.

The validator accepts progress-log text around the JSON object, but the saved file must not include bearer tokens, Privy tokens, one-time invite tokens, raw emails, wallet addresses, staff ids, organizer ids, ticket ids, provider secrets, deployment/cloud credentials, CI secret masking command literals, Stripe publishable keys, database URLs, private keys, or production credentials.

Required JSON shape:

```json
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "provider": "staff-tenant-staging",
  "environment": "staging",
  "localDryRun": false,
  "demoAuthUsed": false,
  "realUserDataUsed": false,
  "productionCredentialsUsed": false,
  "implementationSnapshot": {
    "source": "staff-tenant-staging-policy-boundaries",
    "files": [
      {
        "file": "apps/api/src/main.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/auth/auth.controller.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/auth/auth.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/alpha/alpha.controller.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/alpha/alpha-persistence.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/verification/verification.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/dashboard/server/console-bff.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/dashboard/lib/gate-assignment-response.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/staff-invite-policy-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/console-route-contract-audit.js",
        "sha256": "<current sha256>"
      }
    ]
  },
  "runtime": {
    "apiBaseUrl": "https://api.staging.fanpass.example",
    "consoleBaseUrl": "https://console.staging.fanpass.example",
    "productionLikeConfig": true,
    "seededDemoUsersDisabled": true,
    "stagingDatabaseIsolated": true,
    "adminBearerFromVerifiedAuth": true,
    "deploymentCredentialsAvailable": false
  },
  "tenantIsolation": {
    "stagingTenantCreated": true,
    "organizerScopedEventCreated": true,
    "secondOrganizerIsolationVerified": true,
    "crossOrganizerConsoleReadRejected": true,
    "crossOrganizerStaffAssignmentRejected": true,
    "adminCanAuditWithoutPiiLeakage": true,
    "noSeededDemoTenantUsed": true
  },
  "authSession": {
    "privyLoginUsed": true,
    "verifiedPrivyTokensUsed": true,
    "demoSessionRejected": true,
    "consoleHttpOnlyCookieVerified": true,
    "consoleLockedWhenUnauthenticated": true,
    "fanRoleRejectedFromConsole": true
  },
  "staffPolicy": {
    "inviteCreatedByOrganizerScopedConsole": true,
    "inviteTokenShownOnce": true,
    "inviteTokenNotPersistedInUrlOrSnapshot": true,
    "inviteAcceptedWithVerifiedPrivyToken": true,
    "inviteReplayRejected": true,
    "supersededInviteRejected": true,
    "deactivatedAssignmentRevokesAccess": true,
    "linkedStaffCannotRotateInvite": true,
    "crossOrganizerInviteRotationRejected": true
  },
  "opsGateAccess": {
    "opsLoginWithLinkedStaff": true,
    "assignedGateRedeemAllowed": true,
    "unassignedGateRedeemRejected": true,
    "clientSuppliedStaffRejected": true,
    "checkInSummaryScopedToAssignment": true,
    "assignmentDeactivationBlocksOpsAccess": true
  },
  "redaction": {
    "bearerTokensRedacted": true,
    "privyTokensRedacted": true,
    "inviteTokensRedacted": true,
    "emailsRedacted": true,
    "walletAddressesRedacted": true,
    "providerSecretsRedacted": true,
    "stripePublishableKeysRedacted": true,
    "databaseUrlsRedacted": true,
    "deploymentCredentialsRedacted": true,
    "ciSecretMaskingCommandsRedacted": true,
    "staffIdentifiersRedacted": true,
    "organizerIdentifiersRedacted": true,
    "ticketIdentifiersRedacted": true
  }
}
```

Release rule:

- `localDryRun` and `demoAuthUsed` must be `false`; local seeded sessions cannot close production tenant/staff policy blockers.
- API and Console URLs must be HTTPS and must point at an isolated staging database.
- `runtime.deploymentCredentialsAvailable` must be `false`, `redaction.deploymentCredentialsRedacted` must be `true`, and `redaction.ciSecretMaskingCommandsRedacted` must be `true`; saved staging tenant/staff evidence must not contain deployment/cloud credential assignments or JSON fields such as AWS keys, Vercel tokens, GitHub tokens, Netlify tokens, Cloudflare API credentials, or CI masking commands with literal values.
- Console auth must use verified Privy-backed sessions and HttpOnly cookies, with fan roles rejected from Console.
- Evidence must include `implementationSnapshot.source: "staff-tenant-staging-policy-boundaries"` with SHA-256 hashes for the current staff invite, Console proxy/redaction, Ops linking, gate-enforcement, and staff-policy audit files so stale evidence cannot be reused after those boundaries change.
- Tenant isolation must prove cross-organizer Console reads and staff assignment attempts are rejected.
- Staff invite policy must prove one-time display, verified Privy token acceptance, replay rejection, superseded invite rejection, deactivation revocation, and cross-organizer invite rotation rejection.
- FanPass Ops must prove a linked staff account can redeem only at assigned gates and that client-supplied staff identity is ignored.
