# Chain Custody Evidence

FanPass local Beta uses mock ownership by default and blocks production-like `OWNERSHIP_ADAPTER=testnet` until real chain custody is operationally safe. Do not close ASR-014 or pilot chain blockers with localhost mocks, raw operator keys, unreviewed hot-wallet ownership, or screenshots containing copyable transaction/private-key material.

Selected future evidence path: Sepolia + Safe multisig owner + OpenZeppelin Relayer with Turnkey signer. The setup guide is `docs/technical/FanPass_Sepolia_Safe_Relayer_Setup_V4.md`.

Temporary Sepolia development deployments are allowed only under `docs/technical/FanPass_Sepolia_Dev_Hotkey_Runbook_V4.md`. A dev-only hot key deployment must remain labeled `custodyEvidence: false` and cannot close this evidence gate.

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
        "sha256": "a0963f62ee9ab00e521a4e87deab85abf96f17e5cf0edd79464b7d76b390b23d"
      },
      {
        "file": "apps/api/src/modules/side-effects/settlement-side-effects.service.ts",
        "sha256": "7e0ff131e13ad5fdf9f93a16f0d0b70cba08966c38bd371eefa3a1797bd9487f"
      },
      {
        "file": "apps/api/src/modules/side-effects/ticket-ownership-side-effects.service.ts",
        "sha256": "5cf85b058a0ebf6e154ad597ee376e09684052bd4f4a425396ea9067a20291b4"
      },
      {
        "file": "apps/api/src/modules/side-effects/side-effect-outbox.service.ts",
        "sha256": "e88e4f0d6ef70d791d28b98dc23928263d5f60b7739363fe384298e56f1aec70"
      },
      {
        "file": "apps/api/src/modules/side-effects/side-effect-worker.service.ts",
        "sha256": "f65b7d34d36e4c89cac98116e4f5ad36a846586bb067253244377b1778d7a53e"
      },
      {
        "file": "apps/api/src/modules/side-effects/side-effect-health.service.ts",
        "sha256": "0804138b2db924583c48869ad998a70b38dfdb077d3e0ac00c33d56235a20dfe"
      },
      {
        "file": "apps/api/src/config/security-config.ts",
        "sha256": "a61e7eec663335936a94f64baf6b15c15722dd22bb6a02b3750a4ac6c954a3a2"
      },
      {
        "file": "apps/api/prisma/schema.prisma",
        "sha256": "bc1844fd5439191118c752c015a89cd69799ec7b75a14432e8384cbcb9862704"
      },
      {
        "file": "scripts/chain-operator-key-boundary-audit.js",
        "sha256": "4766d773c0546e88795213ee6b4c2373698704f9236bc32ab931d3aa58ee1955"
      },
      {
        "file": "scripts/provider-boundary-audit.js",
        "sha256": "6eec3d873a45677f575ae79a3ee39ead0c8808abaa20e552de7a2750858d83ce"
      },
      {
        "file": "scripts/settlement-retry-idempotency-audit.js",
        "sha256": "ade8b3114601b81c9865f5866214a648bb4655af6bda03729e768d4297549a76"
      },
      {
        "file": "scripts/side-effects-worker-verify.sh",
        "sha256": "4d36d528ff902e2f57ae702af8a1afbc6e46f06ae9f53a2f41ba46df26ae9c37"
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
