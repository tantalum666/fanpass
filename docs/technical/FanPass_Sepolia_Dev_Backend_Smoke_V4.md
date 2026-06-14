# FanPass Sepolia Dev Backend Smoke V4

Status: dev-only backend ownership smoke passed; not chain custody evidence
Date: 2026-06-06

## Purpose

This smoke test verifies that the FanPass API ownership adapter can talk to the current Sepolia dev-only `FanPassTicket` contract ABI.

It is not release evidence. It uses a temporary Sepolia dev signer and fictional data only.

## Command

```bash
scripts/with-node-22.sh npm run chain:sepolia-dev:ownership-smoke
```

The script loads ignored local env values from `.env.local` and reads the latest full contract address from `.fanpass-local/chain-dev/`. It prints only a redacted summary and writes full local smoke details to gitignored `.fanpass-local/chain-dev/`.

## Redacted Result

```json
{
  "ok": true,
  "mode": "sepolia-dev-ownership-smoke",
  "custodyEvidence": false,
  "chainCustodyBlockerClosed": false,
  "contract": "0xc6629B...9042e1",
  "tokenId": "3",
  "issue": {
    "adapter": "testnet",
    "status": "CONFIRMED",
    "tokenId": "3",
    "ownershipRef": "0xc6629B...9042e1:3",
    "transactionHash": "0x1df2cdab...a152e194"
  },
  "transfer": {
    "adapter": "testnet",
    "status": "CONFIRMED",
    "tokenId": "3",
    "ownershipRef": "0xc6629B...9042e1:3",
    "transactionHash": "0xabab0f57...25eab805"
  },
  "redeem": {
    "adapter": "testnet",
    "status": "CONFIRMED",
    "tokenId": "3",
    "ownershipRef": "0xc6629B...9042e1:3",
    "transactionHash": "0xbad1c9c2...afc19a11"
  }
}
```

## 2026-06-13 Refresh

After rediscovering the existing ignored Sepolia config and deployment artifacts, a fresh dev-only ownership smoke was run:

```bash
scripts/with-node-22.sh npm run chain:sepolia-dev:ownership-smoke
```

Redacted result:

```json
{
  "ok": true,
  "mode": "sepolia-dev-ownership-smoke",
  "custodyEvidence": false,
  "chainCustodyBlockerClosed": false,
  "contract": "0xc6629B...9042e1",
  "tokenId": "6",
  "issue": {
    "adapter": "testnet",
    "status": "CONFIRMED",
    "tokenId": "6"
  },
  "transfer": {
    "adapter": "testnet",
    "status": "CONFIRMED",
    "tokenId": "6"
  },
  "redeem": {
    "adapter": "testnet",
    "status": "CONFIRMED",
    "tokenId": "6"
  }
}
```

Full local artifact remains gitignored at `.fanpass-local/chain-dev/sepolia-dev-ownership-smoke-20260613T135652Z.json`.

## What Was Proved

- `OwnershipService` dynamically loads `ethers` only when `OWNERSHIP_ADAPTER=testnet`.
- Testnet ticket issuance calls `mintTicketWithProof`.
- Proof fields are deterministic `bytes32` hashes, not raw ticket ids or ticket type ids.
- Testnet settlement transfer calls owner-only `syncTicketTransfer` instead of pretending the user wallet signed `transferFrom`.
- Testnet redemption calls `redeem`.
- The script keeps full addresses and transaction hashes in gitignored local artifacts only.

## What Remains Unproven

- Durable outbox-backed backend proof sync on deployed staging.
- Safe/multisig ownership.
- Timelock or admin delay.
- Delegated signer, Turnkey, vault, or KMS signing boundary.
- Signer audit log and disable controls.
- Passing chain custody evidence.

## Safety Decision

This smoke test intentionally keeps `custodyEvidence: false`. It supports ABI development and local/testnet engineering only. It must not be used to close public Beta, real-user Beta, or pilot chain custody blockers.
