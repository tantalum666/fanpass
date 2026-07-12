# FanPass Chain Custody Runbook V4

Status: runbook ready; real custody evidence not collected
Date: 2026-06-05

## Purpose

This runbook defines the operational controls required before FanPass can enable real testnet or pilot chain writes. It supports the saved evidence contract in `docs/CHAIN_CUSTODY_EVIDENCE.md`.

This document does not authorize production or real-user chain writes. PostgreSQL remains the source of truth, and chain writes must run asynchronously through the durable side-effect outbox.

The selected future setup is Sepolia, Safe multisig ownership, and OpenZeppelin Relayer with a Turnkey signer. This runbook is the current operational source; superseded setup notes remain in Git history.

## Required Architecture

FanPass must use one of these signer models:

- Vault/KMS signer: the application requests signatures through a managed signing boundary and never receives private-key material.
- Delegated signer: a provider-controlled relayer/signer performs transactions under scoped policy, with audit logs and disable controls.

Raw private keys, seed phrases, locally pasted operator keys, and hot-wallet ownership are not acceptable for chain custody evidence.

Do not start new evidence collection on hosted OpenZeppelin Defender Relayer. Use OpenZeppelin Relayer instead so the evidence path does not depend on a soon-retired hosted product.

## Contract Control

Before any public testnet evidence is trusted:

- Each deployed contract owner must be a multisig or an equivalent controlled account, not a single hot key.
- Privileged owner calls must be protected by a timelock or documented admin delay.
- Emergency admin powers must be separated from day-to-day relayer signing.
- Ownership transfer to multisig/timelock must be tested on testnet using non-production data.
- Contract owner and signer addresses must be redacted or shortened in saved evidence.

## Least-Privilege Signer Policy

The signer policy should allow only the minimum contract calls required for Beta proof sync:

- `FanPassTicket.mintTicketWithProof`
- `FanPassTicket.updateProof`
- `FanPassTicket.redeem`
- `FanPassTicket.cancel`
- `FanPassTicket.refund`
- `FanPassSoulbound.mintLockedWithProof`
- `FanPassSoulbound.revoke`
- `RedemptionRegistry.markRedeemedWithContext`

The signer policy should deny:

- Contract ownership transfer.
- Multisig or timelock administration.
- Arbitrary contract calls.
- Native-token transfers except gas funding controlled by the signer provider.
- Calls from request handlers outside durable outbox workers.

## Rotation Procedure

1. Pause new chain side-effect dispatch by setting the chain sync feature flag off.
2. Verify the side-effect outbox has no `PROCESSING` jobs or intentionally drain it.
3. Create or select the replacement vault/KMS/delegated signer.
4. Apply the least-privilege signer policy to the replacement signer.
5. Run a redacted signer policy review and capture only non-secret proof.
6. Update staging environment references outside source control.
7. Run a testnet proof mint and redemption through the durable outbox.
8. Confirm side-effect health is healthy.
9. Disable the old signer.
10. Save redacted evidence and run:

```bash
npm run security:chain-custody:evidence -- <saved-json-output>
npm run security:evidence-redaction -- <saved-json-output>
```

## Signer Disable Procedure

Use this when a signer is exposed, suspected, over-permissioned, or no longer needed:

1. Pause chain side-effect dispatch.
2. Disable or revoke the signer in the vault/KMS/delegated signer provider.
3. Confirm new signing attempts fail at the signer boundary.
4. Verify API request paths still work without chain confirmation.
5. Keep ticket ownership, entry, resale, and refund state controlled by PostgreSQL.
6. Record incident timeline without secrets, transaction hashes, full wallet addresses, or provider identifiers.
7. Rotate to a replacement signer only after policy review.

## Incident Response

Severity triggers:

- Raw private-key or seed phrase exposure.
- Unexpected signer transaction.
- Contract owner still controlled by a hot key.
- Side-effect outbox jobs repeatedly fail or retry with provider errors.
- Evidence or logs contain RPC URLs, bearer tokens, provider secrets, private keys, or copyable transaction/private-key-looking values.

Response:

1. Stop chain side-effect dispatch.
2. Preserve backend source-of-truth state in PostgreSQL.
3. Disable affected signer.
4. Check outbox health and mark unsafe jobs for manual review.
5. Review contract ownership and timelock state.
6. Rotate signer if needed.
7. Produce a redacted incident note.
8. Do not resume chain writes until side-effect health, signer policy, and contract-control proof pass.

## Monitoring And Alerting

Minimum monitoring before testnet chain sync:

- Side-effect outbox health: no stale `PROCESSING`, stale runnable, terminal `FAILED`, or `DEAD` chain jobs.
- Signer audit log: transaction count, denied calls, policy changes, signer disable events.
- Contract admin events: ownership transfer, timelock role change, pause/unpause if added later.
- RPC/provider health: failures and latency, without logging RPC URLs or API keys.
- Evidence redaction: saved evidence must pass `npm run security:evidence-redaction`.

Alerts should page or block release when:

- Any chain job is `DEAD`.
- Any chain job is stale `PROCESSING`.
- Signer policy changes without review.
- Any signer transaction bypasses the durable outbox.
- Any evidence/log contains forbidden secret markers.

## Rollback Or Pause Plan

Chain sync must be optional for Beta:

1. Disable chain side-effect dispatch.
2. Keep existing operational ticket state in PostgreSQL.
3. Keep Proof & History showing a safe `Proof pending` or `Proof unavailable` state.
4. Do not block QR/NFC entry, refunds, resale, or ownership transfer on chain confirmation.
5. Resume only after the signer, contract control, and outbox health checks pass.

## Evidence Collection Checklist

Before marking chain custody complete, save a JSON evidence file with:

- `ok: true`
- `provider: "chain-custody"`
- `environment: "testnet"`
- `localMockOnly: false`
- vault/KMS or delegated signer proof
- raw private key unavailable proof
- signer policy review proof
- signer audit log proof
- multisig owner proof
- timelock/admin delay proof
- testnet owner change proof
- durable outbox-only chain call proof
- ownership transfer/finalization job proof
- stale recovery and idempotency proof
- healthy residual outbox proof
- rotation, incident, signer disable, monitoring, and rollback/pause runbook proof
- redaction proof

Then run:

```bash
npm run security:chain-custody:evidence -- <saved-json-output>
npm run security:evidence-redaction -- <saved-json-output>
```

## Current Blockers

- No vault/KMS or delegated signer evidence exists.
- No multisig/timelock contract ownership evidence exists.
- No public testnet deployment evidence exists.
- No backend proof-sync job has been run against a real signer.
- No redacted signer audit log exists.
- No saved evidence passes `npm run security:chain-custody:evidence`.
