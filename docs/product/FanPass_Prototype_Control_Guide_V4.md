# FanPass Prototype Control Guide V4

Status: internal controls reference
Date: 2026-06-05

## Location

Prototype controls live in:

`Profile → Prototype Controls`

This panel is demo-only. It is not a normal user-facing FanPass feature.

## Available Controls

| Control | Options | Purpose |
| --- | --- | --- |
| User role | Normal fan, verified fan, purchased-ticket fan, listed-resale fan, gate staff, organizer admin-lite | Review role-based states. |
| Ticket state | Active, listed, transfer pending, transferred, redeemed, cancelled, refunded, expired | Validate wallet and ticket detail lifecycle handling. |
| Payment result | Success, failed, checkout expired | Validate checkout state transitions. |
| Scanner result | Accepted, duplicate, expired, invalid, owner mismatch, not active, cancelled, error | Validate scanner outcomes. |
| Network | Online, slow, unavailable | Prepare service-driven loading/error states. |
| Transferability | Transferable, non-transferable, already redeemed | Validate listing and transfer blocks. |
| Resale cap | Within cap, above cap, no cap | Validate organizer cap handling. |

## Current Behavior

- Applying controls updates Profile's mock user and records a state summary.
- Checkout uses `CheckoutViewModel.paymentResult` for payment success/failure/expired simulation.
- Wallet state can be loaded from `MockTicketService.walletTickets(for:statusOverride:)`.
- Scanner state can be generated through `MockScannerService.scan` and `MockScannerService.nfcResult`.

## Development Notes

- Keep controls out of production builds later with a compile-time or runtime debug flag.
- Do not expose provider secrets, live payment IDs, real QR payloads, real wallet addresses, or real personal data through this panel.
- When real backend integration starts, keep the mock controls as a development fixture or preview-only harness.

## Future Improvements

- Make controls global through an injected prototype environment store.
- Add visual scenario badges for internal builds.
- Add UI tests that switch scenarios and snapshot key screens.
- Add simulator launch arguments for direct scenario boot, such as `--fanpassScenario purchasedTicketFan`.
