# FanPass Error State Guide V4

Status: product error-state guidance
Date: 2026-06-05

## Principles

- Explain the specific reason.
- Provide one safe recovery action.
- Do not expose provider IDs, tokens, payment secrets, wallet internals, signatures, nonces, or raw API errors.
- Keep scanner states operational and short.
- Use red only for invalid/rejected states. Use amber for expired, duplicate, wrong event, cap, or policy limits.
- Never use crypto exchange or trading language in consumer errors.

## Payment And Checkout

| Error | User copy | Recovery |
| --- | --- | --- |
| Payment failed | `Payment failed. No ticket was assigned.` | Try Apple Pay again or use card placeholder. |
| Checkout expired | `The ticket reservation timed out.` | Return to event or reset checkout. |
| Network unavailable | `Connection unavailable. Your ticket was not charged or changed.` | Retry when connected. |
| Ticket unavailable | `This ticket is no longer available.` | Return to event detail or market. |

## Ticket And Wallet

| Error | User copy | Recovery |
| --- | --- | --- |
| Listed ticket | `Listed tickets cannot be used for entry while resale is open.` | Cancel listing or wait for sale. |
| Already redeemed | `This ticket has already been accepted at entry.` | Contact support or use another ticket. |
| Cancelled ticket | `Organizer policy cancelled this ticket.` | View refund or support options. |
| Refunded ticket | `This ticket was refunded.` | Keep history only. |
| Expired ticket | `The event window has passed.` | Keep history only. |
| Proof unavailable | `Proof & History could not load.` | Retry without blocking active entry unless policy requires it. |

## Resale

| Error | User copy | Recovery |
| --- | --- | --- |
| Non-transferable | `This ticket cannot be transferred under organizer rules.` | Keep ticket or view rules. |
| Price above cap | `Organizer cap is HK$X. Lower the price before listing.` | Adjust price. |
| Already listed | `This ticket is already listed.` | View listing or cancel it. |
| Redeemed/cancelled/refunded | `Only active verified tickets can be listed.` | No resale recovery. |
| Listing unavailable | `This resale ticket is no longer available.` | Refresh market. |

## QR Verification

| Error | User copy | Staff action |
| --- | --- | --- |
| Expired credential | `Code expired. Ask the fan to refresh the ticket.` | Scan refreshed QR. |
| Already redeemed | `This ticket was already checked in.` | Deny entry unless supervisor overrides outside app. |
| Wrong event | `This ticket belongs to a different event.` | Ask fan to open correct ticket. |
| Invalid ticket | `This QR code does not match a valid FanPass ticket.` | Use manual lookup if needed. |
| Unknown verification error | `Verification could not complete.` | Retry or manual lookup. |

## NFC Verification

| Error | User copy | Staff action |
| --- | --- | --- |
| Tag unreadable | `The NFC tag could not be read.` | Hold again or use QR. |
| Credential expired | `The NFC credential expired.` | Ask fan to refresh ticket. |
| Invalid credential | `Invalid NFC credential.` | Use QR or manual lookup. |
| Already redeemed | `This ticket has already been redeemed.` | Deny duplicate entry. |
| Unsupported device | `NFC scanning is unavailable on this device.` | Use QR scanner. |

## Technical Notes

- Map provider/network exceptions into the above product states.
- Keep raw errors in logs only, never in consumer UI.
- Add telemetry later for error type, route, recovery action, and retry success.
- Real scanner errors must be validated on signed devices because Core NFC behavior cannot be fully proven in simulator.
