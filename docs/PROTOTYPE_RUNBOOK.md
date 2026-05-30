# FanPass Prototype Runbook

Use this file to run and verify the Technical Prototype from a clean local state.

## Start Services

```bash
npm run prototype:start
```

This starts detached `screen` sessions:

- `fanpass-api` on `http://localhost:4000`
- `fanpass-dashboard` on `http://localhost:3000`

It also resets the in-memory demo store through:

```bash
POST http://localhost:4000/prototype/reset
```

## Stop Services

```bash
npm run prototype:stop
```

## Verify Backend Lifecycle

```bash
npm run prototype:verify
```

Expected result:

- API health passes.
- Demo event and ticket type load.
- Sell order is created.
- Buy order matches the sell order.
- Trade settles.
- QR payload is generated.
- First redemption returns `ACCEPTED`.
- Duplicate redemption is rejected.

## FanPass Console

Open:

```text
http://localhost:3000
```

Prototype Console supports:

- View events.
- View ticket inventory and redemption state.
- View orderbook levels.
- Create a demo event.
- Add a ticket type to an event.

## iOS Fan App

Build/run scheme:

```text
FanPass
```

Bundle id:

```text
com.fanpass.app
```

Expected prototype behavior:

- Signed-out launch opens event discovery, not a login wall.
- Auth appears only when account or transaction actions require it.
- Default fan navigation has no staff scanner.
- Ticket wallet can show a real signed entry QR for demo tickets.

## FanPass Ops

Build/run scheme:

```text
FanPassOps
```

Bundle id:

```text
com.fanpass.ops
```

Expected prototype behavior:

- App opens to operational event/gate selection.
- API status shows `ONLINE` when local API is running.
- Scanner can redeem a signed QR payload once.
- Duplicate redemption is rejected.
- Camera QR scanner is implemented with AVFoundation, but simulator can only validate permission/no-camera fallback.
- Core NFC NDEF scanner prototype is implemented in `FanPassOps`, but simulator can only validate unavailable/fallback UI.
- Paste fallback remains for simulator QA.

## Known Prototype Limits

- API data is in-memory and resettable; persistence starts in Alpha.
- Core NFC requires a signed physical iPhone build and supported NDEF tag for real validation.
- Testnet contract calls are not wired into API/app yet.
- Stripe and Privy are Beta scope.
- The old fan-app staff deep link has been removed from the product path; staff demo should use `FanPassOps`.
- Console creation flows mutate only the in-memory store. Run `npm run prototype:verify` or `POST /prototype/reset` to return to the clean seeded demo.
