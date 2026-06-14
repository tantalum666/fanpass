# FanPass MoonPay Extension Notes V4

Status: optional future extension notes
Date: 2026-06-05

## Positioning

MoonPay should be treated as an optional crypto on-ramp/off-ramp extension, not the primary FanPass payment path. FanPass is a mainstream ticketing product with Web3 infrastructure hidden in the background.

## When MoonPay Is Useful

- User wants to buy crypto for an external wallet.
- Organizer or seller wants optional crypto settlement in a future market.
- FanPass expands into markets where regulated crypto on-ramp/off-ramp support is useful.
- Advanced users explicitly choose crypto funding outside the main checkout path.

## Why Not Primary MVP Payment

- Mainstream fans expect card, Apple Pay, and familiar checkout.
- Crypto payments complicate refunds and disputes.
- On-ramp availability varies by jurisdiction.
- KYC/compliance requirements can interrupt ticket purchase.
- Price volatility and settlement timing can confuse consumers.
- Customer support burden is higher.

## Crypto Payment Limitations

- Refunds are not equivalent to card refunds.
- Chargebacks and disputes do not map cleanly.
- Settlement finality can conflict with event cancellation policy.
- Wallet mistakes are hard to reverse.
- Some users cannot access on-ramp services due to region or compliance.

## Compliance Considerations

- Jurisdiction-specific KYC/AML requirements.
- Sanctions screening.
- Consumer disclosures.
- Tax/reporting treatment.
- Age and region restrictions.
- Custody and money-transmission implications.

## Refund And Dispute Limitations

FanPass should not promise card-like refund behavior for crypto rails. If crypto payment is ever offered, the UI must clearly explain:

- Which asset is used.
- Exchange rate timing.
- Refund asset/currency.
- Settlement delay.
- Support path.

## Possible Future Flow

1. User selects normal checkout.
2. Stripe remains default.
3. User opens advanced payment options.
4. User chooses crypto funding.
5. FanPass shows compliance and refund disclosure.
6. MoonPay handles on-ramp/off-ramp flow.
7. Backend waits for confirmed settlement.
8. Ticket assignment occurs only after backend confirms payment finality.

## MVP Decision

Keep MoonPay out of MVP ticket checkout. Document it as future optional infrastructure only.
