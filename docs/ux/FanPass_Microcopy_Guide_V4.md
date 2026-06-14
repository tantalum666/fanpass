# FanPass Microcopy Guide V4

Status: product wording guide for the iOS prototype
Date: 2026-06-05

## Voice

FanPass should sound calm, premium, direct, and protective. Copy should make verified ticketing feel simple without foregrounding blockchain mechanics.

Use short sentences. Prefer action-oriented recovery copy. Avoid hype, speculation, gambling, and crypto-native slang.

## Preferred Terms

| Use | Avoid |
| --- | --- |
| Verified Ticket | NFT |
| Secure Resale | token marketplace |
| Fan Access | token-gated drop |
| Access Badge | SBT in primary UI |
| Proof & History | on-chain transaction |
| Ownership History | blockchain ledger |
| Ticket identity | seed phrase |
| Entry Code | QR nonce |
| Organizer cap | smart contract limit |
| Transparent Prices | trading chart |

Technical terms may appear only inside Proof & History or technical notes when needed.

## Core Labels

| Concept | Primary copy |
| --- | --- |
| Verified ticket | `Verified Ticket` |
| Resale policy | `Organizer resale rule` |
| Resale cap | `Organizer cap: resale cannot exceed HK$X.` |
| Non-transferable | `This ticket cannot be transferred under organizer rules.` |
| Listed ticket | `Listed tickets cannot be used for entry while resale is open.` |
| Refunded ticket | `This ticket was refunded. Entry and resale are disabled.` |
| Cancelled ticket | `Organizer policy cancelled this ticket.` |
| Redeemed ticket | `This ticket has already been accepted at entry.` |
| Dynamic QR | `Dynamic QR refreshes every 30s.` |
| NFC Ready | `NFC Ready` |
| Proof | `Proof & History shows safe ownership records.` |

## Button Copy

| Action | Use |
| --- | --- |
| Buy primary ticket | `Buy Ticket` |
| Pay | `Pay with Apple Pay`, `Pay with card` |
| View owned ticket | `View Ticket` |
| Add wallet pass | `Add to Apple Wallet` |
| Join access program | `Join Fan Access` |
| Complete task | `Complete demo task` in prototype, `Complete Task` in production. |
| List resale | `Submit listing` or `List Ticket` |
| Buy resale | `Buy Resale Ticket` |
| Scan | `Scan QR`, `Scan NFC`, `Scan next` |
| Recovery | `Reset checkout`, `Retry`, `Use QR`, `Manual lookup` |

## Trust Signals

Use trust signals when they clarify state:

- `Verified Ticket`
- `Secure Resale`
- `Organizer cap applies`
- `Non-transferable Access Badge`
- `NFC Ready`
- `Proof & History`
- `Ticket identity ready`

Do not stack more than three pills in a dense mobile row. If labels wrap or crowd, move the explanation into a contained policy notice.

## Error Copy Pattern

1. State what happened.
2. State whether the ticket/payment changed.
3. Offer one recovery.

Examples:

- `Payment failed. No ticket was assigned. Try Apple Pay again or use card.`
- `Code expired. Ask the fan to refresh the ticket.`
- `Organizer cap is HK$1,500. Lower the price before listing.`

## Prototype Copy Rules

- Mark simulated behavior with short product-safe notes, not developer jargon.
- Use `placeholder`, `mock`, or `demo` where a real integration is not connected.
- Do not claim live payment, live Wallet signing, live chain custody, or real NFC scanning until those integrations pass release evidence.
- Never include real emails, personal names, tokens, secrets, QR payloads, payment IDs, wallet addresses, or provider IDs in UI copy.
