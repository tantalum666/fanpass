# FanPass Blockchain Integration Plan V4

Status: EVM-compatible integration planning with local and Sepolia dev/staging run-through foundation
Date: 2026-06-13

## Current Local Contract Foundation

Implemented on 2026-06-05:

- `FanPassTicket` supports NFT-style ticket proof records with safe hashes for ticket id, ticket type, policy, and metadata.
- `FanPassTicket` stores transferability, resale cap, transfer count limit, lifecycle state, metadata URI, and transfer count.
- `FanPassTicket` supports minted, redeemed, cancelled, and refunded lifecycle states; cancelled, refunded, and redeemed tickets cannot be transferred.
- `FanPassSoulbound` supports ERC5192-style locked Access Badges with safe event, badge type, subject, and metadata hashes.
- `FanPassSoulbound` supports owner-only badge revocation for future Fan Access policy changes.
- `RedemptionRegistry` records duplicate-protected redemption context with safe event, gate, credential, and redemption hashes.
- `packages/contracts/scripts/deploy-local.ts` deploys all three contracts on the local Hardhat network and performs a proof mint, badge mint, and redemption record dry-run.

Verified local commands:

```bash
scripts/with-node-22.sh npm run test -w packages/contracts
scripts/with-node-22.sh npm run deploy:local -w packages/contracts
```

This is not Sepolia deployment evidence and does not close chain custody. Real testnet or pilot chain enablement still requires the saved evidence contract in `docs/CHAIN_CUSTODY_EVIDENCE.md`.

Sepolia dev-only deployment is now prepared through `npm run deploy:sepolia-dev -w packages/contracts`. This path uses a temporary Sepolia-only signer and is documented in `docs/technical/FanPass_Sepolia_Dev_Hotkey_Runbook_V4.md`. It is useful for contract and ABI development, but it does not close chain custody because it lacks vault/KMS or delegated signer proof, multisig/timelock ownership, durable outbox-backed backend writes, and redacted signer audit logs.

The first Sepolia dev-only deployment completed on 2026-06-06. The redacted deployment log is `docs/technical/FanPass_Sepolia_Dev_Deployment_Log_V4.md`; full local artifacts remain gitignored under `.fanpass-local/chain-dev/`.

The first backend adapter smoke against the Sepolia dev-only `FanPassTicket` contract also passed on 2026-06-06. The redacted smoke log is `docs/technical/FanPass_Sepolia_Dev_Backend_Smoke_V4.md`. The chain security review is `docs/technical/FanPass_Chain_Security_Review_V4.md`.

The API now has an opt-in `FANPASS_CHAIN_PROOF_SYNC_OUTBOX=true` path for ticket issue, ownership transfer, and ticket redemption proof-sync jobs. This prewires the durable side-effect outbox boundary for future chain custody work while keeping `OWNERSHIP_ADAPTER=mock` as the default.

For owner-approved dev/staging run-throughs only, `FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES=true` now permits `OWNERSHIP_ADAPTER=testnet` outside `FANPASS_ENV=production`. This intentionally supports temporary private-account Sepolia testing so buying, issuing, redeeming, and proof lookup can be exercised end to end. It is not release custody evidence.

On 2026-06-06, `npm run chain:sepolia-dev:outbox-smoke` also passed against the Sepolia dev-only contract using the side-effect worker dispatch path for issue, transfer, and redemption. The full artifact remains gitignored under `.fanpass-local/chain-dev/`; the command prints only redacted values and reports `custodyEvidence: false`. This proves the development ABI/worker path, not release custody.

On 2026-06-13, the existing ignored Sepolia setup was rediscovered and rechecked. `.env.local` still contains the dev-only RPC and temporary signer, `.fanpass-local/chain-dev/sepolia-dev-deployment-20260606T133736Z.json` remains the latest deployment artifact, and a read-only RPC check confirmed Sepolia chain id `11155111` plus contract bytecode at `FanPassTicket` short ref `0xc6629B...9042e1`. A fresh `npm run chain:sepolia-dev:ownership-smoke` also passed with token id `6` for issue, transfer sync, and redeem. This remains `custodyEvidence: false`.

## Testnet Choice

Use an EVM-compatible testnet with reliable tooling, explorer support, faucet availability, and low operational complexity. Sepolia is a reasonable default for Ethereum-aligned prototyping. If deployment cost or throughput becomes a problem, evaluate an L2 testnet with strong ecosystem support.

## Architecture Principle

PostgreSQL remains the operational source of truth. Blockchain records provide verifiable proof references and policy enforcement experiments, not the full payment/ticketing database.

## Solidity Contract Modules

| Module               | Purpose                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `EventRegistry`      | Registers organizer/event identifiers and metadata roots.                                                  |
| `TicketRecord`       | Implemented locally through `FanPassTicket`; stores NFT-style ticket proof references and lifecycle state. |
| `AccessBadge`        | Implemented locally through `FanPassSoulbound`; stores non-transferable Access Badge proof references.     |
| `TransferPolicy`     | Resale cap, transfer count, and transferability reference.                                                 |
| `RedemptionRegistry` | Implemented locally; records duplicate-protected redemption context.                                       |
| `RoleRegistry`       | Organizer/operator roles for backend-controlled writes.                                                    |

Standalone `EventRegistry`, standalone `TransferPolicy`, and `RoleRegistry` are still planned. Current Beta foundation uses backend authorization and the durable side-effect outbox as the operational control layer.

## Ticket NFT-Style Record

- Represents a ticket proof record, not consumer-facing speculation.
- Should not expose attendee personal data.
- Token metadata should reference safe metadata URI or content hash.
- Backend controls mint/update flow after payment/ticket database state is valid.

Consumer wording remains `Verified Ticket`.

## SBT-Style Access Badge

- Non-transferable credential for Fan Access.
- Represents access eligibility or reward status.
- Primary UI wording remains `Access Badge`.
- Technical `SBT-style` wording belongs only in Proof & History or developer docs.

## Transfer Control

Transfer control can be represented by:

- Contract-level transfer restrictions for token records.
- Backend policy enforcement before transfer/listing.
- Signed policy hashes stored on-chain for audit.

Backend must validate transferability, status, ownership, event, and resale cap before any on-chain update.

## Resale Policy Reference

On-chain:

- Event ID hash.
- Ticket type hash.
- Resale cap hash or public cap.
- Transfer count limit.
- Policy version hash.

Off-chain:

- Full policy copy.
- Refund text.
- Jurisdiction-specific terms.
- Organizer private configuration.

## Redemption Status

Redemption should be written first to PostgreSQL in a transaction that prevents duplicates. Blockchain redemption sync can happen asynchronously. Scanner UX must not depend on waiting for chain confirmation.

Dynamic QR/NFC credentials now have an API-owned `EntryCredential` lifecycle in Prisma. QR refresh supersedes prior active credentials for the same ticket, and accepted scanner redemption consumes the credential with the check-in, ticket state change, audit log, and optional ownership outbox job in one transaction. The signed QR/NFC payload is still short lived and must not be logged or stored as a raw payload in release evidence.

## Metadata Strategy

On-chain:

- Safe identifiers.
- Content hashes.
- Policy hashes.
- Proof references.

Off-chain:

- User identity.
- Payment details.
- Full ticket seat metadata if sensitive.
- QR/NFC credentials.
- Scanner staff identity.

## Privacy Risks

- Public wallet correlation.
- Event attendance inference.
- Resale behavior exposure.
- Immutable mistakes.
- Metadata deanonymization.

Mitigations:

- Use minimal public data.
- Hash sensitive identifiers.
- Avoid full wallet addresses in UI.
- Consider backend-owned custody/abstraction for mainstream users.

## Gas Sponsorship

FanPass should sponsor gas for mainstream users:

- Backend relayer or account abstraction pattern.
- User never sees gas fees in consumer checkout.
- Rate limits and abuse controls required.
- Failed chain writes must reconcile without blocking ticket usability.

Current dev/staging implementation:

- `OWNERSHIP_ADAPTER=privy` uses a server-side Privy wallet RPC call with `sponsor: true` to submit Sepolia transactions.
- The user Privy wallet remains the NFT recipient/holder. The server-side sponsor wallet is only the transaction sender for the existing contract write methods.
- Because the current contract write methods are `onlyOwner`, the sponsor wallet must be the deployed contract owner or the write will revert. If FanPass later wants user-initiated sponsored writes, the contract permission model must be changed first.
- Keep Privy's client-side sponsorship toggle disabled for FanPass ticket issuance/redeem until the contract exposes safe non-owner entry points. Server-side sponsorship avoids exposing owner-only chain calls to iOS clients.
- Required env outside source control: `OWNERSHIP_ADAPTER=privy`, `PRIVY_APP_SECRET`, `FANPASS_PRIVY_SPONSOR_WALLET_ID`, `FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS`, `FANPASS_PRIVY_SPONSOR_CHAIN_CAIP2=eip155:11155111`, `FANPASS_TICKET_CONTRACT_ADDRESS`, and `TESTNET_RPC_URL` if receipt confirmation/log parsing is needed.
- Run `npm run chain:privy-sponsorship:readiness` before deploying this path. The check verifies required env, the `users.privy_wallet_id` database column, and the chain `owner()` match against `FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS` without printing secrets or full addresses.
- For the temporary test-owner path only, `npm run privy:import-owner-wallet` can import the existing Sepolia owner private key into Privy using HPKE. The key must be entered interactively or passed through a short-lived environment variable and must never be committed, logged, written to evidence, or copied into deployment configuration.

## Backend-Controlled Settlement Flow

1. Payment succeeds.
2. Backend issues ticket in PostgreSQL.
3. Backend enqueues blockchain sync job through the durable side-effect outbox.
4. Relayer writes proof record.
5. `blockchain_transactions` records tx status.
6. Proof & History shows safe proof fragment after confirmation.

## MVP Boundary

Phase 6 should prove testnet sync and proof display only. Do not make production entry or payment settlement depend on chain finality until reliability, privacy, and recovery are hardened.

## Deployment Boundary

Allowed without additional user action:

- Local Hardhat compile, tests, and dry-run deployment.
- Secret-free draft evidence generation with current implementation snapshots.
- Documentation and adapter preparation for later testnet use.
- Sepolia dev-only deployment script preparation, as long as no real RPC URL, private key, seed phrase, provider token, or full address artifact is committed.
- Opt-in local outbox proof-sync prewiring with `FANPASS_CHAIN_PROOF_SYNC_OUTBOX=true`, using mock ownership by default and no production-like testnet signer.

Allowed only as dev-only testnet work, not release evidence:

- Sepolia deployment with a temporary hot key for fictional data, gated by `FANPASS_ALLOW_SEPOLIA_DEV_HOTKEY=true`.
- Local gitignored deployment artifacts under `.fanpass-local/chain-dev/`.
- Manual validation of contract addresses, ABI behavior, and gas friction.
- Dev-only backend `OwnershipService` smoke testing against Sepolia using fictional data.
- Owner-approved staging/dev API run-through with `OWNERSHIP_ADAPTER=testnet` and `FANPASS_ALLOW_PRIVATE_KEY_TESTNET_WRITES=true`, provided `FANPASS_ENV` is not `production`.
- Direct request-path chain writes for the fastest run-through by keeping `FANPASS_CHAIN_PROOF_SYNC_OUTBOX=false`; with `true`, the side-effect worker must be running and healthy.
- Backend proof-history display of a safe `On-chain proof` row with a shortened transaction reference and Sepolia explorer link.

Blocked until the end-user/external phase or release-grade custody phase:

- Treating Sepolia or other public testnet deployment using a raw private key as custody evidence.
- Production `OWNERSHIP_ADAPTER=testnet` startup with a raw private key.
- Saved chain custody closure without vault/KMS or delegated signer proof.
- Contract ownership controlled by a single hot key.
- Any evidence file containing RPC URLs, private keys, seed phrases, bearer tokens, provider secrets, database URLs, Stripe keys, real wallet addresses, or real personal data.

Operational custody procedures live in `docs/technical/FanPass_Chain_Custody_Runbook_V4.md`. That runbook must be reviewed before any testnet signer is configured.
