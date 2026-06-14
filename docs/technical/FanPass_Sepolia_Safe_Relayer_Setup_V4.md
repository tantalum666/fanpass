# FanPass Sepolia Safe And Relayer Setup V4

Status: selected release custody direction; external setup required later
Date: 2026-06-06

## Selected Direction

Use this custody architecture for FanPass chain custody evidence:

- Chain: Sepolia.
- Contract owner/admin: Safe multisig on Sepolia.
- Transaction signer/relayer: OpenZeppelin Relayer with a Turnkey signer.
- Backend integration: FanPass API calls the relayer only from durable side-effect workers, never directly from request handlers.

Do not use OpenZeppelin Defender as the long-term relayer for this project. OpenZeppelin's current documentation says Defender is in maintenance mode and recommends migrating to open-source tools; it also says Defender shuts down on 2026-07-01. FanPass should start directly on OpenZeppelin Relayer rather than collecting new evidence on a tool that is about to be retired.

Official references checked on 2026-06-05:

- OpenZeppelin Defender status: `https://docs.openzeppelin.com/defender`
- OpenZeppelin Relayer signer configuration: `https://docs.openzeppelin.com/relayer/1.3.x/configuration/signers`
- Safe web creation guide: `https://help.safe.global/articles/7267202833-creating-a-safe-on-a-web-browser`

## Relationship To Dev-Only Deployment

This document remains the release-grade custody target. It is not required before basic contract development on Sepolia.

For faster development, FanPass may use the temporary dev-only signer path in `docs/technical/FanPass_Sepolia_Dev_Hotkey_Runbook_V4.md`. That path is intentionally marked `custodyEvidence: false` and does not close chain custody, public Beta, real-user Beta, or pilot readiness blockers.

## Why This Setup

This setup maps to the chain custody evidence validator:

| Evidence field | How this setup satisfies it |
| --- | --- |
| `usesVaultKmsOrDelegatedSigner` | Turnkey is the managed signer behind OpenZeppelin Relayer. |
| `rawPrivateKeyUnavailableToApp` | FanPass API only gets relayer API access; it does not receive raw private keys. |
| `multisigOwnerConfigured` | Safe owns the contracts. |
| `singleHotKeyIsNotOwner` | Contract ownership is controlled by Safe, not by the relayer key. |
| `signingAuditLogCaptured` | Relayer and signer logs can be captured in redacted form. |
| `chainCallsThroughDurableOutboxOnly` | Backend chain calls stay inside side-effect workers. |

## Manual Setup Inputs Needed Later

Codex can prepare commands, docs, schemas, evidence templates, and validators. The user must still do the provider-account steps because they involve wallet connection and sensitive provider access.

Needed later:

- A Sepolia Safe address.
- The Safe threshold, recommended `2-of-3` for evidence.
- Three signer addresses for the Safe. They can be test wallets, but do not paste seed phrases or private keys into the repo or chat.
- A Turnkey organization/project for testnet signing.
- An OpenZeppelin Relayer instance configured for Sepolia with Turnkey signer.
- The relayer public address.
- A Sepolia RPC endpoint configured inside relayer infrastructure; do not save the raw RPC URL in evidence.
- Enough Sepolia ETH for Safe deployment and relayer gas.

Do not paste private keys, seed phrases, Turnkey API private keys, OpenZeppelin Relayer API tokens, RPC URLs, or browser-wallet export material into chat. If a command needs a token, Codex should prefer a local env file, keychain, provider UI, or one-time terminal paste that is not committed and not echoed.

## Recommended Safe Setup

Use Safe web app on Sepolia:

1. Open `https://app.safe.global/`.
2. Connect a signer wallet.
3. Select Sepolia.
4. Create a new Safe named `FanPass Sepolia Admin`.
5. Add three test signer addresses.
6. Set threshold to `2-of-3`.
7. Deploy or activate the Safe on Sepolia.
8. Save only non-secret evidence:
   - network: Sepolia
   - Safe address shortened or redacted
   - threshold: `2-of-3`
   - signer count: `3`
   - deployment status: deployed/active

Never save seed phrases, private keys, browser wallet export files, or full signer addresses in evidence.

## Recommended Relayer Setup

Use OpenZeppelin Relayer, not Defender-hosted Relayer:

1. Configure an OpenZeppelin Relayer service for Sepolia.
2. Use a Turnkey signer configuration.
3. Restrict relayer policy to FanPass proof-sync contract calls.
4. Fund the relayer address with a small amount of Sepolia ETH.
5. Confirm the relayer API can return:
   - relayer id
   - network: Sepolia
   - public relayer address shortened/redacted
   - balance available
   - signer type: Turnkey
6. Capture redacted signer audit proof showing a test transaction request and result.

Do not commit OpenZeppelin Relayer API tokens, Turnkey API private keys, RPC URLs, or raw provider config files.

## Deployment Sequence

1. Compile and test contracts locally:

```bash
scripts/with-node-22.sh npm run test -w packages/contracts
```

2. Deploy `FanPassTicket`, `FanPassSoulbound`, and `RedemptionRegistry` on Sepolia with constructor `initialOwner` set to the Safe address.
3. Verify contract owner is the Safe address.
4. Run a test proof mint through the relayer path only.
5. Run a redemption context write through the relayer path only.
6. Confirm no direct request-path chain call exists.
7. Confirm side-effect outbox health is healthy after the run.
8. Save a redacted chain custody evidence file and run:

```bash
npm run security:chain-custody:evidence -- <saved-json-output>
npm run security:evidence-redaction -- <saved-json-output>
```

## Evidence That Must Not Be Saved

- Private keys.
- Seed phrases.
- Turnkey API private keys.
- OpenZeppelin Relayer API tokens.
- RPC URLs or provider API keys.
- Full wallet addresses.
- Copyable transaction hashes if the evidence validator treats them as sensitive.
- Real user data.
- Production credentials.
- CI masking commands with literal values.

## Current Status

- Local contract foundation is implemented.
- Chain custody runbook exists.
- Secret-free draft evidence exists at `outputs/chain-custody/20260605T051653Z-draft.json`.
- Real Safe, relayer, Turnkey signer, Sepolia deployment, outbox-backed testnet proof, and passing chain custody evidence are still not collected.
