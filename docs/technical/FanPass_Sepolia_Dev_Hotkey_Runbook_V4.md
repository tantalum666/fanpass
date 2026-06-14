# FanPass Sepolia Dev Hotkey Runbook V4

Status: development-only path prepared; not chain custody evidence
Date: 2026-06-06

## Purpose

This runbook allows FanPass to keep contract development moving before the final Safe/Relayer/Turnkey custody setup is ready.

It is intentionally limited to Sepolia development work with fictional data. It must not be used to close chain custody, public Beta, real-user Beta, production signing, or pilot readiness blockers.

## Decision

For short-term development only, FanPass may deploy the current contracts to Sepolia with one temporary test wallet:

- `FanPassTicket`
- `FanPassSoulbound`
- `RedemptionRegistry`

The temporary signer can be controlled by the project owner for speed, but it is not acceptable as long-term custody because:

- the app/operator can access raw private-key material;
- contract ownership remains with a single hot key unless explicitly overridden;
- no multisig/timelock control is proven;
- no delegated signer or vault/KMS audit log exists;
- no durable outbox-backed backend chain write has been proven.

## Hard Safety Boundary

Allowed:

- Sepolia only.
- Fictional events, tickets, gates, credentials, and metadata.
- Temporary wallet with only a small amount of Sepolia ETH.
- Local terminal env vars that are not committed and not echoed.
- Gitignored local deployment artifacts under `.fanpass-local/chain-dev/`.
- Redacted summaries with shortened addresses only.

Not allowed:

- Mainnet or production networks.
- Real users, real attendees, real payment data, or real organizer data.
- Production RPC URLs, production credentials, production Privy secrets, or live Stripe keys.
- Private keys, seed phrases, RPC URLs, API keys, or bearer tokens in chat, git, docs, screenshots, or `outputs/` evidence.
- Treating this as passing `docs/CHAIN_CUSTODY_EVIDENCE.md`.

## Required Local Environment

Use a new wallet dedicated to Sepolia development. Do not use a primary wallet.

Recommended no-key RPC for dev-only deployment:

```text
https://ethereum-sepolia-rpc.publicnode.com
```

This endpoint is suitable for temporary development deployment and simple contract checks. It is shared public infrastructure and should be replaced with a managed provider endpoint before production-like staging, reconciliation, monitoring, or release-grade custody evidence.

Required env vars:

```bash
export FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY=true
export FANPASS_SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
export FANPASS_SEPOLIA_DEV_PRIVATE_KEY="<temporary-sepolia-only-private-key>"
```

Optional env var:

```bash
export FANPASS_SEPOLIA_DEV_INITIAL_OWNER="<testnet-owner-address>"
```

If `FANPASS_SEPOLIA_DEV_INITIAL_OWNER` is omitted, the temporary deployer wallet is the owner. That is acceptable only for dev-only validation.

Hardhat also loads ignored local env files from:

- `.env.local`
- `packages/contracts/.env.local`

Prefer `.env.local` if the values need to persist across terminal sessions. Keep private keys out of chat, screenshots, docs, and git.

## Deploy Command

From the repository root:

```bash
scripts/with-node-22.sh npm run deploy:sepolia-dev -w packages/contracts
```

The script refuses to run unless:

- the Hardhat network is `sepoliaDev`;
- `FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY=true`;
- the RPC URL is HTTPS;
- the private key has valid EVM private-key format;
- the connected chain is Sepolia chain id `11155111`;
- the temporary deployer has Sepolia ETH.

## Output Handling

The script prints only a redacted summary:

- shortened deployer address;
- shortened owner address;
- shortened contract addresses;
- mode: `sepolia-dev-temporary-signer`;
- `custodyEvidence: false`;
- `chainCustodyBlockerClosed: false`.

The full deployment artifact is written locally under:

```text
.fanpass-local/chain-dev/
```

That directory is gitignored. Do not copy that artifact into `outputs/` or docs without redacting addresses, transaction hashes, RPC URLs, and any environment details.

## How To Use The Dev Deployment

Use this path to:

- validate contract deployment on Sepolia;
- estimate gas and deployment friction;
- test proof minting with fictional data;
- test Access Badge minting with fictional data;
- test redemption registry writes with fictional data;
- prepare backend ABI integration work.

Do not use this path to:

- claim real custody readiness;
- enable production-like `OWNERSHIP_ADAPTER=testnet`;
- connect real staging users;
- collect public/real-user Beta evidence;
- bypass the durable side-effect outbox.

## Exit Criteria For Moving Beyond Dev

Before FanPass can close chain custody or use chain writes for public/real-user Beta:

1. Create Sepolia Safe ownership or equivalent multisig/timelock control.
2. Transfer contract ownership away from the temporary hot key.
3. Replace direct local signing with OpenZeppelin Relayer and Turnkey signer, or another vault/KMS/delegated signer that meets the validator requirements.
4. Route backend chain writes through the durable side-effect outbox only.
5. Capture redacted signer audit logs.
6. Save evidence that passes:

```bash
npm run security:chain-custody:evidence -- <saved-json-output>
npm run security:evidence-redaction -- <saved-json-output>
```

## Current Status

- Local Hardhat deployment is ready.
- Sepolia dev-only deployment script is ready.
- Real chain custody evidence remains incomplete by design.
