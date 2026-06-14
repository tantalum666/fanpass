# FanPass Content Model V4

Status: UI data model before screen implementation.
Date: 2026-06-05

This content model defines what the UI may show, how it should be named, and which privacy constraints apply. It is not a database schema.

## Event

| Field | UI meaning | Notes |
| --- | --- | --- |
| `id` | Internal event reference | Do not show full ID by default. |
| `title` | Event name | Demo data must avoid real artist names and copyrighted event titles. |
| `subtitle` | Optional event description | Keep short and mainstream. |
| `startTime` | Event date/time | Show local venue time where possible. |
| `status` | Published, sold out, cancelled, completed | Drives CTA availability. |
| `heroImage` | Optional safe generated/licensed image | No real posters or venue branding. |
| `venue` | Venue object | City and venue display. |
| `ticketTypes` | Available primary inventory | Includes transfer and resale rules. |
| `fanAccessProgramId` | Optional program link | Use `Fan Access` label. |
| `marketSummary` | Resale context | Use transparent price language. |

## Venue

| Field | UI meaning | Notes |
| --- | --- | --- |
| `id` | Internal venue reference | Do not show unless needed. |
| `name` | Venue display name | Avoid implying real partnership in demo data. |
| `city` | City | Useful for filters. |
| `country` | Country/region | Useful for global event browsing. |
| `timezone` | Venue timezone | Needed for QR/event timing. |
| `gateMap` | Gate labels | Staff only unless needed for ticket detail. |

## Ticket Type

| Field | UI meaning | Notes |
| --- | --- | --- |
| `id` | Ticket type reference | Hidden by default. |
| `eventId` | Parent event | Hidden. |
| `name` | General Admission, VIP, Section type | Demo-safe names only. |
| `faceValue` | Primary price | Show with currency. |
| `currency` | Currency code | Use localized format. |
| `supply` | Total supply | Can show availability summary. |
| `availableQuantity` | Available primary inventory | Use simple availability language. |
| `transferable` | Whether ticket can be transferred/listed | Must be visible before purchase. |
| `resaleCap` | Maximum allowed resale price | Use `Organizer cap`. |
| `maxTransferCount` | Transfer limit | Explain plainly. |
| `refundPolicy` | Refund/cancel policy summary | Required before checkout. |

## Ticket

| Field | UI meaning | Notes |
| --- | --- | --- |
| `id` | Ticket reference | Show only shortened fragment. |
| `tokenId` | Proof/record reference | Hide or show as safe proof fragment; do not call it NFT in consumer UI. |
| `eventId` | Parent event | Hidden. |
| `ticketTypeId` | Ticket type | Hidden. |
| `ownerId` | Owner reference | Do not show. |
| `status` | Active, listed, transferred, redeemed, cancelled, refunded, expired | Drives CTA and visual status. |
| `seat` | Section/row/seat if assigned | Use monospaced digits for row/seat. |
| `transferCount` | Number of ownership transfers | Explain in Proof & History. |
| `transferable` | Whether listing/transfer is allowed | Needed on detail. |
| `entryReadiness` | QR/NFC available, unavailable, expired | Drives ticket card state. |
| `proofSummary` | Verified issue and ownership state | Use Proof & History terms. |

## Resale Listing

| Field | UI meaning | Notes |
| --- | --- | --- |
| `id` | Listing reference | Hidden or shortened. |
| `ticketId` | Listed ticket | Hidden. |
| `eventId` | Event | Hidden. |
| `ticketTypeId` | Ticket type | Shown by name. |
| `sellerDisplay` | Seller display | Usually anonymous, such as `Verified fan`. |
| `price` | Listing price | Must be readable. |
| `currency` | Currency | Localized. |
| `feeEstimate` | Estimated fee | Show before buy. |
| `status` | Open, matched, cancelled, settled | Drives availability. |
| `createdAt` | Listing time | Optional. |
| `ruleSummary` | Transfer/resale policy | Required. |

## Orderbook Order

| Field | UI meaning | Notes |
| --- | --- | --- |
| `id` | Order reference | Hidden. |
| `side` | Buy or sell interest | Translate to fan language. |
| `price` | Offer/listing price | Must not be obscured by charts. |
| `quantity` | Ticket count | Current UX is one-ticket first. |
| `remainingQuantity` | Remaining count | Usually hidden in fan UI. |
| `status` | Open, matched, settled, cancelled, rejected | Visible only when relevant to user's own order. |
| `createdAt` | Time priority | Can show `Listed recently`. |

Fan-facing labels:

- Sell order: `Resale listing`.
- Buy order: `Buy request` only if needed.
- Orderbook: `Transparent Prices` or `Market depth`.

## Trade

| Field | UI meaning | Notes |
| --- | --- | --- |
| `id` | Trade reference | Hidden or shortened in Proof & History. |
| `ticketId` | Ticket transferred | Hidden. |
| `price` | Sale price | Show in market history. |
| `fee` | Fee | Show in receipt/payout context. |
| `settlementStatus` | Processing, settled, failed | Drives post-purchase state. |
| `createdAt` | Trade time | Used in recent sales. |

Privacy:

- Do not expose buyer/seller personal identity.

## Fan Task

| Field | UI meaning | Notes |
| --- | --- | --- |
| `id` | Task reference | Hidden. |
| `eventId` | Parent event | Hidden. |
| `title` | Task title | Clear and low jargon. |
| `description` | Task instructions | Include proof requirements. |
| `taskType` | Category | Use human label. |
| `points` | Fan Access score value | Show clearly. |
| `verificationMethod` | How task is reviewed | Explain what is shared. |
| `deadline` | Optional due time | Show local time. |

## Access Badge

| Field | UI meaning | Notes |
| --- | --- | --- |
| `id` | Badge reference | Hidden. |
| `eventId` | Parent event | Hidden. |
| `title` | Badge name | Example: `Early Access`. |
| `status` | Locked, in review, earned, expired | Drives visual state. |
| `criteria` | How to earn | Clear requirements. |
| `benefit` | What it unlocks | Purchase eligibility, discount, priority. |
| `earnedAt` | Earned time | Optional. |

## User Profile

| Field | UI meaning | Notes |
| --- | --- | --- |
| `userId` | Internal account reference | Never show full ID in normal UI. |
| `displayName` | User name | Can show. |
| `email` | Contact | Mask in shared/screenshot-prone states. |
| `role` | Fan, staff, organizer/admin-lite | Drives permission gates. |
| `walletAddress` | Wallet reference | Mask and call `Ticket identity` or `Wallet reference`. |
| `paymentMethods` | Payment options | Provider-safe labels only. |
| `privacySettings` | User controls | Keep accessible from Profile. |

## Wallet Reference

| Field | UI meaning | Notes |
| --- | --- | --- |
| `addressFragment` | Masked wallet/proof reference | Use only in Profile or Proof & History. |
| `provider` | Identity provider | Avoid provider complexity unless needed. |
| `status` | Ready, syncing, unavailable | Use clear operational state. |
| `lastSyncedAt` | Sync freshness | Optional. |

Consumer label:

- Prefer `Ticket identity`.
- Avoid seed phrase, gas, mint, and NFT wording.

## Verification Credential

| Field | UI meaning | Notes |
| --- | --- | --- |
| `ticketId` | Ticket reference | Short fragment only. |
| `eventId` | Event | Hidden. |
| `ownerIdHash` | Privacy-preserving owner proof | Never show raw. |
| `nonce` | Single-use code reference | Never show raw. |
| `issuedAt` | QR issue time | Can show as countdown. |
| `expiresAt` | QR expiration | Show countdown. |
| `signature` | Backend signature | Never show raw. |
| `transport` | QR or NFC | Staff scanner context. |

## Check-In Result

| Field | UI meaning | Notes |
| --- | --- | --- |
| `ticketId` | Safe ticket fragment | Staff result only. |
| `eventId` | Event | Staff context. |
| `gate` | Gate label | Staff context. |
| `result` | Accepted, duplicate, expired, invalid, not active, cancelled | Primary scanner state. |
| `redeemedAt` | Accepted/rejected time | Staff summary and Proof & History. |
| `failureReason` | Plain reason | No raw signature/nonce. |

## Payment State

| Field | UI meaning | Notes |
| --- | --- | --- |
| `id` | Internal payment reference | Hide. |
| `orderId` | Related order | Hide or shorten in support context. |
| `amount` | Amount paid/authorized | Show localized. |
| `currency` | Currency | Show. |
| `status` | Requires action, authorized, captured, cancelled, refunded, failed | Consumer-friendly labels. |
| `captureStatus` | Capture state | Usually hidden behind payment status. |
| `updatedAt` | Last update | Useful for pending/refund. |

Consumer labels:

- `Payment authorized`.
- `Payment complete`.
- `Refund processing`.
- `Refunded`.

Do not expose client secrets, provider IDs, or webhook concepts.

## Proof History Item

| Field | UI meaning | Notes |
| --- | --- | --- |
| `id` | History reference | Hidden. |
| `ticketId` | Ticket fragment | Optional. |
| `type` | Issue, purchase, list, transfer, redemption, cancellation, refund | Timeline event. |
| `title` | Human event label | Use consumer-safe language. |
| `description` | Explanation | Avoid crypto-heavy wording. |
| `timestamp` | When it happened | Show local time. |
| `actorLabel` | Organizer, verified fan, gate, FanPass | Avoid exposing personal data. |
| `proofReference` | Safe fragment | Optional and truncated. |
| `status` | Success, pending, failed | Drives color/icon. |

Allowed timeline labels:

- `Ticket issued`.
- `Purchase confirmed`.
- `Secure resale listed`.
- `Ownership updated`.
- `Entry code created`.
- `Entry accepted`.
- `Ticket cancelled`.
- `Refunded`.
