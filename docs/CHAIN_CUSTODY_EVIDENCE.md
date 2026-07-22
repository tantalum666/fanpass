# Chain Custody Evidence

FanPass local Beta uses mock ownership by default and blocks production-like `OWNERSHIP_ADAPTER=testnet` until real chain custody is operationally safe. Do not close ASR-014 or pilot chain blockers with localhost mocks, raw operator keys, unreviewed hot-wallet ownership, or screenshots containing copyable transaction/private-key material.

Selected future evidence path: Sepolia + Safe multisig owner + OpenZeppelin Relayer with Turnkey signer. The active operational source is `docs/technical/FanPass_Chain_Custody_Runbook_V4.md`.

Temporary Sepolia development deployments must remain labeled `custodyEvidence: false` and cannot close this evidence gate. Historical dev-hotkey instructions remain in Git history and are not an active release runbook.

Run future saved evidence through:

```bash
npm run security:chain-custody:evidence -- <saved-json-output>
```

Seed a non-passing draft with the current ownership/outbox SHA-256 snapshot before collecting real testnet custody proof:

```bash
npm run release:evidence:draft -- chain-custody --out outputs/chain-custody/<draft-file>.json
```

The draft intentionally uses `ok: false` and placeholders. It cannot close this blocker until real vault/KMS or delegated signer, multisig/timelock, durable outbox, testnet run, and operational readiness facts replace every placeholder and the saved file passes the validator above.

The validator accepts progress-log text around the JSON object, but the saved file must not include bearer tokens, Privy secrets, Stripe secrets, Stripe publishable keys, provider API keys, provider RPC URLs, deployment/cloud credentials, CI secret masking command literals, database URLs, private keys, seed phrases, copyable `0x` 64-hex values, or real user data.

Required JSON shape:

```json
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "provider": "chain-custody",
  "environment": "testnet",
  "localMockOnly": false,
  "realUserDataUsed": false,
  "productionCredentialsUsed": false,
  "deploymentCredentialsAvailable": false,
  "implementationSnapshot": {
    "source": "chain-custody-ownership-outbox-boundaries",
    "files": [
      {
        "file": "apps/api/src/modules/ownership/ownership.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/side-effects/settlement-side-effects.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/side-effects/ticket-ownership-side-effects.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/side-effects/side-effect-outbox.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/modules/side-effects/side-effect-health.service.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/src/config/security-config.ts",
        "sha256": "<current sha256>"
      },
      {
        "file": "apps/api/prisma/schema.prisma",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/chain-operator-key-boundary-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/provider-boundary-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/settlement-retry-idempotency-audit.js",
        "sha256": "<current sha256>"
      },
      {
        "file": "scripts/side-effects-worker-verify.sh",
        "sha256": "<current sha256>"
      }
    ]
  },
  "custody": {
    "signerProvider": "vault-kms",
    "usesVaultKmsOrDelegatedSigner": true,
    "rawPrivateKeyUnavailableToApp": true,
    "operatorKeyNotCommitted": true,
    "signerAccessPolicyReviewed": true,
    "leastPrivilegeSignerPolicyVerified": true,
    "signingAuditLogCaptured": true
  },
  "contractControl": {
    "multisigOwnerConfigured": true,
    "timelockOrAdminDelayConfigured": true,
    "singleHotKeyIsNotOwner": true,
    "ownerChangeTestedOnTestnet": true,
    "emergencyAdminSeparationReviewed": true
  },
  "sideEffects": {
    "chainCallsThroughDurableOutboxOnly": true,
    "noDirectRequestPathChainCalls": true,
    "ownershipTransferJobTested": true,
    "ownershipFinalizationJobTested": true,
    "staleJobRecoveryVerified": true,
    "idempotentRetryVerified": true,
    "outboxHealthAfterRun": "healthy"
  },
  "operationalReadiness": {
    "rotationProcedureDocumented": true,
    "incidentResponseDocumented": true,
    "signerDisableProcedureDocumented": true,
    "monitoringAndAlertingConfigured": true,
    "rollbackOrPausePlanDocumented": true
  },
  "redaction": {
    "privateKeysRedacted": true,
    "seedPhrasesRedacted": true,
    "bearerTokensRedacted": true,
    "signerProviderSecretsRedacted": true,
    "providerSecretsRedacted": true,
    "databaseUrlsRedacted": true,
    "rpcUrlsRedacted": true,
    "stripePublishableKeysRedacted": true,
    "deploymentCredentialsRedacted": true,
    "ciSecretMaskingCommandsRedacted": true,
    "transactionHashesRedactedOrShortened": true,
    "walletAddressesRedactedOrTestOnly": true,
    "vaultIdentifiersRedactedOrNonSensitive": true
  }
}
```

Release rule:

- `localMockOnly` must be `false`; local mock ownership evidence cannot close real chain custody blockers.
- `implementationSnapshot.source` must be `chain-custody-ownership-outbox-boundaries`, and `implementationSnapshot.files` must match the current SHA-256 snapshot for the ownership adapter, production-like testnet guard, side-effect outbox, worker, health gate, Prisma outbox schema, chain operator audit, provider boundary audit, settlement idempotency audit, and side-effect verifier. Regenerate chain custody evidence after any of those files changes.
- The signer must be a vault/KMS or delegated signer, and the app must not receive raw private-key material.
- Contract ownership must not remain with a single hot key. Multisig ownership and a timelock or admin delay must be configured before pilot chain enablement.
- Chain calls must run through the durable side-effect outbox, with ticket issue, ownership transfer, ticket redemption, settlement finalization, stale recovery, idempotent retry, and healthy residual outbox proof.
- Rotation, signer disablement, incident response, monitoring, and pause/rollback procedures must be documented before enabling real chain ownership side effects.
- The current operational runbook is `docs/technical/FanPass_Chain_Custody_Runbook_V4.md`; update it before collecting evidence if signer/provider assumptions change.
- `deploymentCredentialsAvailable` must be `false`, `redaction.deploymentCredentialsRedacted` must be `true`, and `redaction.ciSecretMaskingCommandsRedacted` must be `true`; saved chain custody evidence must not contain deployment/cloud credential assignments, JSON fields such as AWS keys, Vercel tokens, GitHub tokens, Netlify tokens, or Cloudflare API credentials, or CI masking commands with literal values.

## 2026-06-16 Chain Activity UI Note

- Ticket-detail chain activity now resolves transaction display through the exact `contract + tokenId` path when the backend audit transaction is missing or not successful.
- The fallback uses ERC-721 `Transfer` logs with topic3 equal to the token id. For mint display it filters to `from == 0x0000000000000000000000000000000000000000`; otherwise it selects the latest transfer log for that token id.
- This is a display reconciliation improvement only. It does not prove release-grade chain custody, signer custody, multisig ownership, outbox health, or incident/rotation readiness.

## 2026-06-16 Privy Sponsorship Note

- `OWNERSHIP_ADAPTER=privy` is a dev/staging gas-sponsorship path. It submits owner-only ticket contract calls through a backend-controlled Privy wallet RPC request with sponsorship enabled.
- The API now checks the configured sponsor wallet address against `FanPassTicket.owner()` before submitting a Privy-sponsored write when RPC config is available. A mismatch blocks the request before chain submission.
- `npm run chain:privy-sponsorship:readiness` is the pre-deploy readiness check for this dev/staging path; it is not release custody evidence by itself.
- The temporary `npm run privy:import-owner-wallet` flow may be used only for dev/staging test ownership continuity. Importing an already-exposed test private key into Privy does not satisfy release signer custody requirements.
- This path is not release-grade custody evidence. Before using it for pilot custody claims, FanPass must prove sponsor wallet ownership/permissions, multisig or equivalent admin control, rotation/disablement procedures, outbox routing, retry health, and redacted transaction evidence.
- Do not save Privy app secrets, wallet authorization signatures, RPC URLs with provider keys, full private transaction payloads, or personal user data in evidence.
