# FanPass Sepolia Dev Deployment Log V4

Status: dev-only deployment completed; not chain custody evidence
Date: 2026-06-06

## Deployment Summary

This is a temporary Sepolia development deployment for contract and ABI validation only.

It must not be used as:

- chain custody evidence;
- public Beta readiness evidence;
- real-user Beta readiness evidence;
- production signing evidence;
- multisig/timelock proof;
- durable outbox-backed backend proof-sync evidence.

## Redacted Result

```json
{
  "ok": true,
  "mode": "sepolia-dev-temporary-signer",
  "custodyEvidence": false,
  "chainCustodyBlockerClosed": false,
  "network": "sepoliaDev",
  "chainId": "11155111",
  "deployer": "0xFb07f6...85bD4E",
  "initialOwner": "0xFb07f6...85bD4E",
  "demoFan": "0xFb07f6...85bD4E",
  "contracts": {
    "fanPassTicket": "0xc6629B...9042e1",
    "fanPassSoulbound": "0xEbB3FA...6494d8",
    "redemptionRegistry": "0x752174...512623"
  },
  "demo": {
    "ticketTokenId": "1",
    "accessBadgeTokenId": "1",
    "redemptionRecorded": true
  }
}
```

Full local deployment details were written only to a gitignored local artifact under:

```text
.fanpass-local/chain-dev/
```

Do not copy full addresses, transaction hashes, private keys, RPC URLs, or provider details from that local artifact into docs, chat, screenshots, git, or saved `outputs/` evidence.

## What Was Proved

- The current contracts deploy on Sepolia.
- The current `FanPassTicket` build includes owner-only `syncTicketTransfer` for backend-authorized proof synchronization.
- `FanPassTicket` can mint a fictional ticket proof.
- `FanPassSoulbound` can mint a fictional Access Badge proof.
- `RedemptionRegistry` can record a fictional redemption context.
- The deployment script prints a redacted summary and marks itself `custodyEvidence: false`.

This log supersedes the earlier 2026-06-06 dev-only deployment made before `syncTicketTransfer` was added.

## What Remains Unproven

- Safe or multisig ownership.
- Timelock or admin delay.
- Delegated signer, Turnkey, vault, or KMS boundary.
- Raw private key unavailable to app.
- Redacted signer audit log.
- Durable side-effect outbox-backed backend chain write.
- Ownership transfer away from the temporary hot key.
- Passing `npm run security:chain-custody:evidence -- <saved-json-output>`.

## Next Engineering Use

Use this deployment only for ABI integration and prototype proof-history work. Before any public or real-user use, replace the temporary signer path with the release custody direction in `docs/technical/FanPass_Sepolia_Safe_Relayer_Setup_V4.md`.
