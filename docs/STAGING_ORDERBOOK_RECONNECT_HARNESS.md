# Staging Orderbook Reconnect Harness

This harness performs a read-only deployed Staging regression against the `/orderbook` Socket.IO namespace. It emits only `orderbook.subscribe` and `orderbook.unsubscribe`; it never creates orders, captures payments, calls a wallet provider, or sends a chain transaction.

Run the offline fixture first:

```bash
npm run tooling:node22 -- npm run security:orderbook:staging:self-test
```

The self-test uses loopback only, makes no external request, and proves that the harness detects duplicate-budget charging, reconnect budget reset, stale reconnect snapshots, and pending-unsubscribe rejoin.

## Identity boundary

The current API derives the anonymous admission actor from the client address selected through its trusted-proxy policy, then HMACs that value on the server. It does not trust a caller-supplied identity header. The deployed harness must therefore run its reconnect sequence from one stable egress address with no competing orderbook load from that same identity.

`STAGING_ORDERBOOK_COOKIE_FILE` is optional. When an edge or a later API version issues a stable client Cookie, put the complete Cookie header in a private non-symlink file with mode `0600` or stricter; the harness forwards it on every reconnect but never prints it. The current API may ignore this Cookie and continue using its server-derived network identity. Do not place a raw Cookie, bearer token, wallet credential, or session token directly in a command line or saved output.

## Room fixture

Create a local JSON file containing exactly 16 distinct, public Staging room pairs. Every pair must already exist and be safe to read:

```json
{
  "rooms": [
    {
      "eventId": "<public-staging-event-id-1>",
      "ticketTypeId": "<public-staging-ticket-type-id-1>"
    }
  ]
}
```

Repeat the object shape until the array contains exactly 16 unique pairs. The harness never prints these identifiers. A missing/nonexistent room makes the run fail rather than substituting mock data.

## Deployed Staging run

Use the deployed HTTPS API namespace and the exact allowed Console/web Origin:

```bash
STAGING_ORDERBOOK_URL=https://<staging-api-host>/orderbook \
STAGING_ORDERBOOK_ORIGIN=https://<allowed-staging-client-origin> \
STAGING_ORDERBOOK_ROOMS_FILE=/absolute/path/to/staging-orderbook-rooms.json \
npm run tooling:node22 -- npm run security:orderbook:staging
```

If a server/edge-issued Cookie is part of the deployed identity contract:

```bash
chmod 600 /absolute/path/to/staging-orderbook-cookie.txt
STAGING_ORDERBOOK_COOKIE_FILE=/absolute/path/to/staging-orderbook-cookie.txt \
STAGING_ORDERBOOK_URL=https://<staging-api-host>/orderbook \
STAGING_ORDERBOOK_ORIGIN=https://<allowed-staging-client-origin> \
STAGING_ORDERBOOK_ROOMS_FILE=/absolute/path/to/staging-orderbook-rooms.json \
npm run tooling:node22 -- npm run security:orderbook:staging
```

The deployed mode rejects localhost, private IP literals, local-only hostnames, HTTP/WS, embedded credentials, query strings, fragments, and any namespace other than `/orderbook`. `STAGING_ORDERBOOK_ALLOW_LOCAL_FIXTURE=true` only permits loopback HTTP/WS and cannot weaken a remote target.

Timeouts are configurable in milliseconds:

- `STAGING_ORDERBOOK_CONNECT_TIMEOUT_MS` (default `5000`)
- `STAGING_ORDERBOOK_OPERATION_TIMEOUT_MS` (default `5000`)
- `STAGING_ORDERBOOK_DUPLICATE_OBSERVATION_MS` (default `200`)
- `STAGING_ORDERBOOK_CONTINUITY_OBSERVATION_MS` (default `500`)
- `STAGING_ORDERBOOK_ADMISSION_WINDOW_MS` (default `10000`, matching the API admission window)
- `STAGING_ORDERBOOK_ADMISSION_WINDOW_RESET_MS` (default `10500`, and must be greater than the admission window)
- `STAGING_ORDERBOOK_PENDING_RACE_OBSERVATION_MS` (default `750`)

Do not increase `STAGING_ORDERBOOK_ADMISSION_WINDOW_MS` beyond the actual deployed API window to make a slow run pass. If 16 accepted subscriptions cannot complete inside the real window, treat the boundary result as inconclusive and investigate Staging latency.

## What a passing run proves

A passing run confirms, for the one reached API process and stable actor identity:

- a duplicate subscription is idempotent and does not consume an attempt;
- 16 subscription attempts are accepted across a disconnect/reconnect sequence and the 17th is rate-limited in the same ten-second window;
- unsubscribing while a snapshot is pending cancels the join and no later snapshot reappears;
- snapshot revisions are present and a reconnect snapshot does not go backwards.

The harness is deliberately passive. If an unrelated real Staging orderbook update is observed, it additionally proves that the reconnect snapshot is at least as new as that update. If no update occurs, output uses `snapshot-monotonicity-only-no-market-mutation`; it does not claim that a write-driven replay path was exercised.

This does not close multi-instance WebSocket safety. Admission counters, leases, revision replay, and fan-out are currently in memory, so horizontal scaling still requires Redis/Valkey plus shared pub/sub and a separate cross-instance load run. The JSON result is a regression receipt, not canonical release evidence unless a release evidence contract separately snapshots and validates it.
