# FanPass contracts

This package contains three deliberately owner-operated contracts:

- `FanPassTicket`: ticket proofs and settlement-controlled transfers.
- `FanPassSoulbound`: non-transferable Fan Access badges.
- `RedemptionRegistry`: redemption records.

The API/outbox is the business-system authority. A contract owner is an
execution role, not permission to bypass the database settlement lifecycle.

## Deployment paths

| Command                                                   | Purpose                              | Owner                    | Writes demo state | Release evidence                  |
| --------------------------------------------------------- | ------------------------------------ | ------------------------ | ----------------- | --------------------------------- |
| `npm run deploy:local -w packages/contracts`              | disposable Hardhat demo              | local signer             | yes               | no                                |
| `npm run deploy:sepolia-dev -w packages/contracts`        | disposable Sepolia development smoke | temporary dev signer     | yes               | no                                |
| `npm run deploy:sepolia-staging -w packages/contracts`    | reviewed Staging migration           | configured Privy sponsor | no                | partial chain-state evidence only |
| `npm run preflight:sepolia-staging -w packages/contracts` | keyless Staging cutover preflight    | read only                | no                | preflight evidence only           |

`deploy:sepolia-dev` intentionally makes the temporary dev signer the owner so
its demo mint cannot be mistaken for sponsor custody. It always reports
`custodyEvidence: false`. Never reuse its addresses or artifact as Staging
evidence.

## Sepolia Staging migration contract

The migration command is fail closed. It requires all of the following through
an approved local secret-injection mechanism:

The protected mode flag is read before any local environment file. Both
`deploy:sepolia-staging` and `preflight:sepolia-staging` deliberately skip the
root and package `.env.local` files, so every required value must be injected
explicitly into that command's process by the approved operator secret
mechanism. This prevents the migration from inheriting an unrelated dev signer
and keeps the read-only preflight genuinely keyless. Ordinary local and
`deploy:sepolia-dev` commands retain the existing local-env loading behavior.
The migration also rejects explicitly inherited dev, testnet-operator, and
Privy-authorization signing keys; only its dedicated temporary deployment key
may be present.

- `FANPASS_ALLOW_SEPOLIA_STAGING_MIGRATION` must exactly equal
  `DEPLOY_FANPASS_STAGING_TO_PUBLIC_SEPOLIA`.
- `FANPASS_SEPOLIA_RPC_URL` must be an HTTPS Sepolia endpoint.
- `FANPASS_SEPOLIA_STAGING_TEMP_PRIVATE_KEY` must be a valid, funded,
  temporary Sepolia-only key.
- `FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS` must be the canonical API/Render Privy
  sponsor setting, a valid non-zero
  address and must differ from the temporary deployer.
- the live chain id must be `11155111` and the Hardhat network must be
  `sepoliaStaging`.

The temporary deployer only pays deployment gas. Each constructor receives the
Privy sponsor address directly, so there is no interval in which the temporary
hot key owns a Staging contract. The script waits for two successful
confirmations per contract and executes no mint, redemption, or transfer.

Both public Staging commands force a fresh Hardhat compile before running. They
then verify every artifact against the compiler input and output, current
Solidity source, ABI, creation/runtime bytecode, Hardhat config, package file,
and root lockfile. The protected migration journal records the resulting
`manifestSha256`; CUTOVER requires that exact full digest through
`FANPASS_SEPOLIA_STAGING_EXPECTED_BUILD_MANIFEST_SHA256`. A stale or replaced
gitignored artifact therefore cannot become the reviewed deployment merely by
matching itself on-chain.

Console output contains shortened addresses and transaction hashes only. The
full public chain-state journal is stored under gitignored
`.fanpass-local/chain-staging/`; its directory is mode `0700` and each artifact
is mode `0600`. The journal never stores the RPC URL or private key. Do not copy
raw provider errors into tickets, chat, or evidence.

If a journal ends as `FAILED` after `CONTRACT_DEPLOYMENT`, do not blindly rerun
the migration: first inspect its confirmed partial addresses and transaction
hashes, then make an explicit recovery or replacement decision.

## Cutover sequence

1. Freeze and test one RC revision. Record its commit, compiler settings, current
   live API revision, and current contract route.
2. Move the Staging API to a Maintenance-Mode-capable paid instance. Enable
   Maintenance Mode, prove the public API consistently returns `503`, drain old
   requests, and apply `FANPASS_SIDE_EFFECT_WORKER_ENABLED=false` plus worker
   limit `1` to the exact live revision. Wait until the prior instance has
   exited. Free-tier sleep or suspend/resume is not a cutover boundary.
3. Verify a restorable database backup and a clean provider/outbox census. Keep
   the database dispatch fence paused. Do not change the runtime contract while
   an unpinned ownership job can execute.
4. Complete Phase A with the old global contract address: deploy the route-aware
   RC, run enforcement/backfill/validation, run the identity-bound database
   preflight, and prove the RC is the only API instance. Every existing ticket
   and active ownership job must retain its immutable adapter/address/chain/
   version route before proceeding.
5. Only after Phase A passes, inject the temporary deployment configuration on
   the operator workstation and run `deploy:sepolia-staging`. Do not put secrets
   in shell history, CI logs, screenshots, or Markdown.
6. Inspect the protected journal. The base preflight must show exact runtime
   bytecode matches, all three owners equal the configured sponsor, required ABI
   entries exist, and `tokenIdByTicketIdHash(bytes32)` decodes correctly. Copy
   the full protected `reviewedBuild.manifestSha256` value into the CUTOVER
   environment; the shortened console value is display-only.
7. Remove the temporary key and migration opt-in immediately. They must be
   absent before Phase B or the cutover preflight.
8. Complete Phase B from the same RC revision: with dispatch still paused,
   configure the exact new contract addresses, Sepolia RPC, and CAIP chain
   `eip155:11155111`, then prove the route-aware RC is again the only API
   instance. Preserve the previous route for route-aware rollback.
9. Enqueue exactly one dedicated, non-user policy-probe mint through the real
   Privy-sponsored ownership outbox. Bind that eligible job with
   `resume --confirm RESUME_FANPASS_SIDE_EFFECTS --probe-limit 1`, then run one
   manual route-aware worker pass while the scheduler remains disabled. The
   database must auto-pause on the claim; do not use the temporary deployer or a
   direct contract call. This first mint is the boundary after which rollback to
   a pre-routing API is prohibited.
10. Wait for the probe to settle, explicitly pause again, and rerun the database
    preflight. Ambiguous, failed, dead, stale, or route-mismatched state blocks
    the cutover.
11. Set the three `FANPASS_SEPOLIA_STAGING_*_ADDRESS` variables plus
    `FANPASS_SEPOLIA_STAGING_POLICY_PROBE_TICKET_ID_HASH`, then run
    `preflight:sepolia-staging`. This command refuses deployment/dev private-key
    variables and performs read-only RPC calls only.
12. The cutover preflight must verify chain id, distinct non-empty bytecode,
    exact reviewed runtime bytecode hashes, sponsor ownership, critical ABI,
    ticket-hash lookup, and exact `Use FanPass settlement` reverts for
    `transferFrom` and both `safeTransferFrom` overloads using the holder as the
    caller.
13. Complete ownership reconciliation plus real Privy/Stripe/runtime evidence
    before considering a separate unlimited resume. Do not renounce ownership,
    silently repoint in-flight work, or treat one successful probe as general
    dispatch authorization.

The keyless preflight requires:

- `FANPASS_SEPOLIA_RPC_URL`
- `FANPASS_PRIVY_SPONSOR_WALLET_ADDRESS`
- `FANPASS_SEPOLIA_STAGING_TICKET_ADDRESS`
- `FANPASS_SEPOLIA_STAGING_SOULBOUND_ADDRESS`
- `FANPASS_SEPOLIA_STAGING_REDEMPTION_REGISTRY_ADDRESS`
- `FANPASS_SEPOLIA_STAGING_POLICY_PROBE_TICKET_ID_HASH`
- `FANPASS_SEPOLIA_STAGING_EXPECTED_BUILD_MANIFEST_SHA256`

It must run with `FANPASS_SEPOLIA_STAGING_TEMP_PRIVATE_KEY`,
`FANPASS_SEPOLIA_DEV_PRIVATE_KEY`, `TESTNET_OPERATOR_PRIVATE_KEY`, and
`PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY` unset, and with every chain-write
opt-in disabled. Reusing the canonical sponsor variable prevents a preflight
for owner A while the API/Render runtime expects owner B.

## Evidence boundary

A successful migration and preflight prove the reviewed bytecode and owner
values observed on Sepolia. They do not by themselves prove that Privy controls
the sponsor, that sponsorship policy is correctly configured, that the outbox
is crash-safe, or that release-grade multisig/timelock custody exists. Preserve
those as separate provider, worker, and custody evidence. No Staging or public
release claim should be made from the development demo path.
