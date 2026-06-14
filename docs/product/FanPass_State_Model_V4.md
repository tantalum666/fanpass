# FanPass State Model V4

Status: internal prototype state model
Date: 2026-06-05

## State Owners

| Layer | Responsibility |
| --- | --- |
| Models | Stable product entities and enum states. |
| MockData | Deterministic fixtures for users, events, tickets, listings, orderbook, trades, scanner results. |
| Mock services | Simulated product actions and safe success/error outcomes. |
| ViewModels | Loading mock data, handling simulated actions, exposing UI state. |
| Views | Rendering state and routing. Avoid business logic. |

## Core Model States

### User

`DemoUserScenario` supports:

- Normal fan.
- Verified fan with Access Badge.
- Purchased-ticket fan.
- Listed-resale fan.
- Gate staff.
- Organizer admin-lite.

### Ticket

`TicketStatus` supports:

- `active`
- `listed`
- `transferPending`
- `transferred`
- `redeemed`
- `cancelled`
- `refunded`
- `expired`

`TicketEntryMode` supports:

- `nfcReady`
- `qrOnly`
- `unavailable`

### Payment

`DemoPaymentResult` supports:

- Success.
- Failure.
- Expired checkout.

Payment maps to `PaymentState` through `MockPaymentService`.

### Scanner

QR/NFC outcomes map to `ScanResult`:

- Accepted.
- Duplicate/already used.
- Expired.
- Invalid.
- Owner mismatch/wrong event.
- Not active.
- Cancelled.
- Unknown error.

### Prototype Controls

`PrototypeControlState` combines:

- User scenario.
- Ticket status.
- Payment result.
- Scanner result.
- Network condition.
- Transferability condition.
- Resale cap condition.

## Simulated Transitions

| Transition | Service | Output |
| --- | --- | --- |
| Buy ticket | `MockTicketService.purchaseTicket` | Active ticket. |
| Payment success | `MockPaymentService.captureDemoPayment(.success)` | Captured payment and purchased ticket. |
| Payment failure | `MockPaymentService.captureDemoPayment(.failure)` | Payment failed state. |
| Checkout expired | `MockPaymentService.captureDemoPayment(.expired)` | Cancelled/expired checkout state. |
| Add to wallet | `MockWalletService.addTicketToWallet` | Same mock ticket returned. |
| Fan task completed | `MockFanAccessService.completeTask` | Approved task. |
| Access Badge earned | `MockFanAccessService.earnBadge` | Earned Access Badge. |
| List ticket | `MockTicketService.listForResale` | Open resale listing or cap/transfer error. |
| Cancel listing | `MockTicketService.cancelListing` | Cancelled listing. |
| Buy resale | `MockMarketService.buyResaleTicket` | Active transferred ticket for buyer. |
| Transfer ticket | `MockTicketService.transfer` | Transfer pending ticket. |
| Refresh QR | `MockScannerService.refreshQRCredential` | New safe demo credential string. |
| QR scan | `MockScannerService.scan` | Check-in result. |
| NFC scan | `MockScannerService.nfcResult` | Check-in result. |

## Backend Replacement Boundary

Mock services are the intended swap points for real API integration. Views should not call backend clients directly.
