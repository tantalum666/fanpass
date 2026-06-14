# FanPass Contract Deployment Runbook V4

Status: local dry-run ready; Sepolia dev-only path prepared; release custody still blocked
Date: 2026-06-06

## Scope

This runbook covers the current local smart-contract foundation for FanPass:

- `FanPassTicket`
- `FanPassSoulbound`
- `RedemptionRegistry`

The contracts are for proof references and lifecycle audit experiments. PostgreSQL remains the operational source of truth for ticket ownership, payments, resale, check-in, refunds, and organizer policy.

## Local Verification

Use Node 22 for authoritative Hardhat evidence:

```bash
scripts/with-node-22.sh npm run test -w packages/contracts
scripts/with-node-22.sh npm run deploy:local -w packages/contracts
```

`deploy:local` uses the ephemeral Hardhat network. It deploys all contracts, mints one fictional ticket proof, mints one fictional Access Badge, and records one redemption context. It does not use real RPC URLs, real private keys, real wallet addresses, real event data, or production credentials.

## Sepolia Development Deployment

FanPass may use a temporary Sepolia-only test wallet for development speed. This is a dev-only path and cannot close chain custody or public/real-user Beta blockers.

Use:

```bash
scripts/with-node-22.sh npm run deploy:sepolia-dev -w packages/contracts
```

Required local env vars:

```bash
export FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY=true
export FANPASS_SEPOLIA_RPC_URL="<sepolia-https-rpc-url>"
export FANPASS_SEPOLIA_DEV_PRIVATE_KEY="<temporary-sepolia-only-private-key>"
```

The script writes full deployment details only to `.fanpass-local/chain-dev/`, which is gitignored, and prints a redacted summary with `custodyEvidence: false`.

Use the dev-only path only with fictional data and small Sepolia ETH balances. Do not copy raw RPC URLs, private keys, seed phrases, full wallet addresses, or transaction hashes into docs, chat, git, screenshots, or `outputs/` evidence.

The dedicated runbook is `docs/technical/FanPass_Sepolia_Dev_Hotkey_Runbook_V4.md`.

The first redacted Sepolia dev-only deployment log is `docs/technical/FanPass_Sepolia_Dev_Deployment_Log_V4.md`.

The redacted backend ownership adapter smoke log is `docs/technical/FanPass_Sepolia_Dev_Backend_Smoke_V4.md`.

## Current Contract Responsibilities

| Contract | Responsibility |
| --- | --- |
| `FanPassTicket` | Stores ticket proof hashes, metadata URI reference, transfer policy, lifecycle state, transfer count, and owner-controlled proof updates. |
| `FanPassSoulbound` | Stores non-transferable Access Badge proof hashes and revocation state. |
| `RedemptionRegistry` | Stores duplicate-protected redemption context hashes for event, gate, credential, and redemption proof. |

## Privacy Boundary

Allowed on-chain:

- Hashed local ticket ids.
- Hashed ticket type ids.
- Hashed organizer policy versions.
- Hashed metadata references.
- Hashed event/gate/credential/redemption references.
- Public metadata URI only when it contains no personal data.

Not allowed on-chain:

- Names, emails, phone numbers, payment details, or real personal identifiers.
- Raw QR or NFC payloads.
- Full wallet addresses in product UI.
- Real seat metadata if it can identify an attendee.
- Provider secrets, RPC URLs, private keys, or seed phrases.

## Testnet Deployment Boundary

Do not use a raw-private-key deployment to close chain custody, public Beta, real-user Beta, or pilot readiness blockers.

A temporary Sepolia hot-key deployment is allowed only for development validation under `docs/technical/FanPass_Sepolia_Dev_Hotkey_Runbook_V4.md`. It must remain labeled dev-only and must not be saved as passing release evidence.

The selected future deployment path is Sepolia + Safe multisig owner + OpenZeppelin Relayer with Turnkey signer. See `docs/technical/FanPass_Sepolia_Safe_Relayer_Setup_V4.md`.

Before any real testnet deployment evidence is trusted, FanPass must have:

- Vault/KMS or delegated signer custody.
- Proof the app cannot access raw private-key material.
- Multisig contract ownership.
- Timelock or admin delay for privileged operations.
- Durable side-effect outbox-only chain calls.
- Rotation, signer-disable, incident, monitoring, and pause/rollback runbooks in `docs/technical/FanPass_Chain_Custody_Runbook_V4.md`.
- Saved redacted chain custody evidence that passes `npm run security:chain-custody:evidence -- <saved-json-output>`.

## Backend Integration Order

1. Keep `OWNERSHIP_ADAPTER=mock` for local Beta.
2. Add chain transaction and proof status tables.
3. Add side-effect jobs for ticket proof mint, transfer proof, redemption proof, refund/cancel proof, and Access Badge proof.
4. Update `OwnershipService` ABI only after contract interfaces are intentionally adopted.
5. Show only shortened safe proof fragments in V4 Proof & History.
6. Keep chain sync asynchronous; never block venue entry on chain confirmation.

## Current Limitations

- No EventRegistry, RoleRegistry, or standalone TransferPolicy contract yet.
- No proxy/upgrade strategy selected.
- No multisig/timelock setup.
- No release-grade Sepolia deployment.
- No indexer or proof-history backend sync.
- No chain custody evidence.
