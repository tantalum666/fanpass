# FanPass Chain Security Review V4

Status: current dev-only chain implementation reviewed; release custody still blocked
Date: 2026-06-06

## Scope Reviewed

- `FanPassTicket`
- `FanPassSoulbound`
- `RedemptionRegistry`
- API `OwnershipService`
- Side-effect ownership worker boundary
- Sepolia dev-only deployment and backend smoke scripts
- Chain custody evidence validator boundary

## Security Position

FanPass remains a mainstream ticketing app with hidden Web3 proof infrastructure. Chain data must not become the operational source of truth for payments, venue entry, refunds, resale, or identity.

PostgreSQL remains authoritative. Chain writes are proof-sync side effects.

## Key Design Decisions

### Proof Hashes Only

The testnet adapter now calls `mintTicketWithProof` and sends deterministic `bytes32` hashes for:

- ticket id;
- ticket type id;
- transfer policy;
- metadata reference.

The adapter does not put raw local ticket ids, raw user ids, email addresses, names, payment data, QR payloads, NFC payloads, scanner identity, or seat-level personal data on-chain.

### Backend-Authorized Transfer Sync

The previous adapter shape attempted `transferFrom(from, to, tokenId)` from the backend operator signer. That is not a valid user-consent model unless the fan wallet has approved the operator.

The contract now exposes owner-only `syncTicketTransfer(from, to, tokenId)` for backend-authorized proof synchronization. This keeps the trust model explicit:

- the database/settlement service authorizes the transfer first;
- the chain write mirrors that approved state;
- the function still uses the ERC721 internal transfer path;
- transferability, lifecycle state, and max transfer count checks still apply.

This is acceptable for dev-only proof sync. It still requires Safe/multisig and delegated signer controls before release-grade custody.

### Production-Like Testnet Guard Remains

`OWNERSHIP_ADAPTER=testnet` remains blocked in production-like environments. The current Sepolia path is local/dev-only and requires ignored local secrets.

### No Default Network Writes

Sepolia smoke tests are not part of `beta:foundation:verify` because they send real testnet transactions and require local ignored signer material.

### Durable Outbox Proof-Sync Prewire

`TicketOwnershipSideEffectsService` now supports opt-in outbox proof sync for ticket issue and ticket redemption via `FANPASS_CHAIN_PROOF_SYNC_OUTBOX=true`. Ownership transfer was already outbox-backed for Prisma order settlement.

This makes the future chain path structurally consistent:

- ticket issue enqueues `OWNERSHIP_ISSUE`;
- resale settlement enqueues `OWNERSHIP_TRANSFER` and then `OWNERSHIP_SETTLEMENT_FINALIZE`;
- scanner redemption enqueues `OWNERSHIP_REDEEM`;
- each job uses a deterministic idempotency key;
- local/default execution remains `OWNERSHIP_ADAPTER=mock`;
- production-like `OWNERSHIP_ADAPTER=testnet` remains blocked.

The prewire is not release custody evidence because it still lacks release-grade signer custody, multisig/timelock ownership, deployed testnet proof, signer audit logs, and saved evidence validation.

### Dev-Only Outbox Smoke

`npm run chain:sepolia-dev:outbox-smoke` now runs a manual Sepolia development smoke through `SideEffectWorkerService` instead of calling the ownership adapter directly. It exercises:

- `OWNERSHIP_ISSUE`;
- `OWNERSHIP_TRANSFER`;
- `OWNERSHIP_REDEEM`.

The command uses only fictional data, reads signer configuration from ignored local env, writes the full local artifact under `.fanpass-local/chain-dev/`, prints only shortened contract/transaction values, and reports `custodyEvidence: false`. It is useful ABI/worker validation, not release-grade custody proof.

## Threat Review

| Threat                          | Current control                                                                                                                                                                                  | Remaining risk                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Private key committed or logged | `.env.local` and `.fanpass-local/` are gitignored; redacted scripts print shortened values only; chain operator audit scans committed files.                                                     | Temporary key still exists locally and should be rotated/discarded after dev work. |
| Raw user data on-chain          | Adapter hashes proof fields and uses fictional smoke data.                                                                                                                                       | Future registry/context expansion must preserve hash-only rules.                   |
| Backend bypasses user consent   | Transfer sync is explicitly owner-only backend proof sync, not fake user-signed `transferFrom`.                                                                                                  | Requires strong backend authorization and audit logs before real users.            |
| Hot key controls contract       | Documented as dev-only, `custodyEvidence: false`; chain custody validator rejects hot-key ownership.                                                                                             | Formal Safe/Relayer/Turnkey setup is still required.                               |
| Direct request-path chain calls | Ticket issue, transfer, and redemption can run through the durable outbox when `FANPASS_CHAIN_PROOF_SYNC_OUTBOX=true`; production-like testnet remains blocked; smoke script is manual dev-only. | Deployed staging/testnet proof with real custody is still not collected.           |
| Replay or duplicate redemption  | PostgreSQL scanner path remains authoritative; `RedemptionRegistry` rejects duplicate token redemption context.                                                                                  | Backend-to-registry context sync is not yet wired.                                 |
| Public RPC instability          | PublicNode is dev-only; production-like use requires managed RPC and monitoring.                                                                                                                 | Public RPC can rate-limit or lag during development.                               |

## Review Findings

No release-blocking regression was intentionally accepted in the dev-only scope.

Important non-release limitations remain:

- temporary hot-key ownership;
- no multisig/timelock;
- no delegated signer/vault/KMS;
- no release-grade deployed outbox-backed Sepolia proof sync;
- no signer audit log;
- no formal chain custody evidence.

## Required Before Public Or Real-User Beta

1. Transfer contract ownership to Safe/multisig or equivalent controlled account.
2. Add timelock or documented admin delay for privileged calls.
3. Replace local hot key with OpenZeppelin Relayer + Turnkey signer or another accepted delegated signer/vault/KMS.
4. Route backend chain calls through the durable side-effect outbox only.
5. Capture redacted signer audit logs and outbox health proof.
6. Save evidence that passes:

```bash
npm run security:chain-custody:evidence -- <saved-json-output>
npm run security:evidence-redaction -- <saved-json-output>
```

## Commands Reviewed

```bash
scripts/with-node-22.sh npm run test -w packages/contracts
scripts/with-node-22.sh npm run deploy:local -w packages/contracts
scripts/with-node-22.sh npm run test -w apps/api -- --runTestsByPath test/ownership.service.spec.ts test/tickets.service.spec.ts test/side-effect-worker.service.spec.ts
scripts/with-node-22.sh npm run test -w apps/api -- --runTestsByPath test/ticket-ownership-side-effects.service.spec.ts test/side-effect-worker.service.spec.ts test/tickets.service.spec.ts test/verification.service.spec.ts
scripts/with-node-22.sh npm run typecheck -w apps/api
scripts/with-node-22.sh npm run chain:sepolia-dev:ownership-smoke
scripts/with-node-22.sh npm run chain:sepolia-dev:outbox-smoke
scripts/with-node-22.sh npm run security:chain-operator-key
scripts/with-node-22.sh npm run security:chain-operator-key:self-test
scripts/with-node-22.sh npm run security:chain-custody:evidence:self-test
scripts/with-node-22.sh npm run security:provider-boundaries
scripts/with-node-22.sh npm run security:settlement-retry-idempotency
scripts/with-node-22.sh npm run security:evidence-redaction
scripts/with-node-22.sh npm run beta:foundation:verify
git diff --check
```

`beta:foundation:verify` stays on mock ownership and does not send Sepolia transactions. The Sepolia ownership smoke is a separate manual dev-only command because it requires ignored signer material and spends testnet funds.
