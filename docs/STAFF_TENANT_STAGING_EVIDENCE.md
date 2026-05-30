# Staff Tenant Staging Evidence

FanPass has local staff invitation/linking policy checks, but production tenant and staff policy validation remains a Beta blocker until it is proven in a production-like staging environment with verified auth. Do not close this blocker with seeded local demo sessions, localhost evidence, raw invite tokens, raw Privy access tokens, or real personal data.

Run future saved evidence through:

```bash
npm run security:staff-tenant:staging-evidence -- <saved-json-output>
```

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
        "sha256": "955e81fae5436f0301a23e32d69e3c60c9741d1ca277736e43ffb7037b6efe5a"
      },
      {
        "file": "apps/api/src/modules/auth/auth.controller.ts",
        "sha256": "86f999aa9e25dc08d00579bce64758b07175f825b14e05a27bbf7b96ff157a26"
      },
      {
        "file": "apps/api/src/modules/auth/auth.service.ts",
        "sha256": "d25d2ddb7383d27acfe13b0ec78018fd1dd44e5c3cf4e62e70df5ce5d94956c7"
      },
      {
        "file": "apps/api/src/modules/alpha/alpha.controller.ts",
        "sha256": "79e13f9aef0ac0ca55f3a07a292fee56bc3c3df76361aa8a153a45b2c7109645"
      },
      {
        "file": "apps/api/src/modules/alpha/alpha-persistence.service.ts",
        "sha256": "73edcecf269c59a95ab3aae24e65aa56555bc2cc4a610252d8774c7b00a619c7"
      },
      {
        "file": "apps/api/src/modules/verification/verification.service.ts",
        "sha256": "0667ea136a339018dec12be1d01ca281db4bca33769f565e2a14240d772a3ad4"
      },
      {
        "file": "apps/dashboard/app/api/console/gate-assignments/route.ts",
        "sha256": "7ede2fb722d002920a4154522fea5773c426d9965c9e22b60c7fdc75f78b9acc"
      },
      {
        "file": "apps/dashboard/app/api/console/gate-assignments/[assignmentId]/invites/route.ts",
        "sha256": "24d54dbe4daa8afd4d0abdd6344bf60d1f72c844c1f5244d7c687c20827befc0"
      },
      {
        "file": "apps/dashboard/lib/gate-assignment-response.ts",
        "sha256": "f162afca8798a4ec28c8ecbb17a0e0da0efd7cbb26ee894b72621a6f4c83645d"
      },
      {
        "file": "apps/ios/FanPass/FanPass/Services/FanPassAPIClient.swift",
        "sha256": "238117d66529ec7c3bc9ec62cc47ff7d7b4de9110ee980b9e6c7b3ef646b9bb1"
      },
      {
        "file": "apps/ios/FanPass/FanPassOps/OpsShellView.swift",
        "sha256": "3d7b407bca3a7f70e6e2c323a39d5ff9b7ff7e1421c245f60ef1af944eeaf319"
      },
      {
        "file": "scripts/staff-invite-policy-audit.js",
        "sha256": "83ba19d5f86c1242182cdfe5ff25e47d0be993eab45625a51a62634834532be9"
      },
      {
        "file": "scripts/console-route-contract-audit.js",
        "sha256": "150945ff985e1f8cd3a149df0a28a8aa2847c2c634e35813f9ed8b66a13da226"
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
