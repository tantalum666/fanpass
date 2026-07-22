# Staging database release preflight

`staging:db:preflight` is a read-only release gate for the FanPass Staging
database. It never migrates, backfills, or repairs data. Run it only after the
dispatch fence, route-enforcement SQL, ticket/outbox backfill, and
route-validation SQL have completed. Both the API configuration and the
database dispatch control must remain paused.

## Required environment

Set these values in the same protected environment as the Staging API. Do not
copy the database URL into a command line or evidence file.

- `DATABASE_URL`
- `FANPASS_STAGING_DATABASE_IDENTITY_SHA256`
- `OWNERSHIP_ADAPTER=privy`
- `FANPASS_CHAIN_PROOF_SYNC_OUTBOX=true`
- `FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true`
- `FANPASS_SIDE_EFFECT_WORKER_ENABLED=false`

The database URL must identify PostgreSQL with a nonempty username, host, and
database name, exactly one `sslmode=require`, and exactly one
`sslaccept=strict`. Prisma's default certificate-acceptance behavior is not an
acceptable production identity boundary. Its schema must be absent (normalized
to `public`) or be exactly `schema=public`. Only the documented pool/timing
parameters are ignored by identity canonicalization; unknown, mixed-case,
connection-routing, session, channel-binding, and certificate-file overrides
are rejected. Before the first release, generate the expected identity digest
inside the protected Staging environment:

```bash
npm --silent run staging:db:preflight -- \
  --print-identity-digest --json
```

Store the returned lowercase digest as
`FANPASS_STAGING_DATABASE_IDENTITY_SHA256`. The v3 digest covers only a
canonical scheme, decoded username, lowercase hostname, port, decoded database
name, normalized `public` schema, SSL mode, and strict certificate-acceptance
mode; the password and explicitly allowed pool/timing parameters are excluded.
Normal preflight output never prints the
digest, username, hostname, database name, schema, or URL. It reports only
boolean matches for the configured identity and same-connection database
properties. Do not regenerate the expected value from an arbitrary URL during
each release; it is the independently recorded Staging target identity.

## Pre-mutation identity gate

Every API `prisma:push` and `prisma:deploy` starts with the schema-independent
identity gate before it executes SQL, Prisma schema push, route backfill, or
catalog upsert:

```bash
npm --silent run staging:db:preflight -- --identity-only --json
```

The gate first compares the protected digest with the canonical target URL,
then opens that same PostgreSQL connection and, inside a repeatable-read,
read-only transaction, verifies `current_database()`, `current_user`,
`current_schema()`, and `session_user`. It does not read application tables or
require the FanPass schema to exist. Its output contains only boolean checks,
redaction flags, and stable blocker codes; it never returns the URL, digest,
hostname, database name, schema, username, or credentials. A missing,
malformed, or mismatched identity exits `2` and the migration chain is not
started.

`prisma:after-identity` is the internal migration chain used by disposable CI
and focused integration tests after their target identity has already been
established by the test harness. A fresh disposable database is bootstrapped
with `prisma:push:raw` before that chain because the predeploy fence expects the
core outbox table to exist; this exception is limited to isolated test data.
Hosted release commands must call
`prisma:push` or `prisma:deploy`; operators must not invoke the internal chain
to bypass the identity gate. This also protects the older Render service build
command that still calls `prisma:push` directly.

If the aggregate result says tokenized tickets still need a route, the
backfill also requires `FANPASS_LEGACY_OWNERSHIP_ADAPTER` and, for `privy` or
`testnet`, a valid `FANPASS_LEGACY_TICKET_CONTRACT_ADDRESS` and
`FANPASS_LEGACY_TICKET_CHAIN_ID`. The preflight reports only whether those
values are structurally ready; it never prints them.

## Run

```bash
npm --silent run staging:db:preflight -- --json
```

The command opens one repeatable-read, read-only transaction and executes only
fixed schema and aggregate `SELECT` statements. Its JSON excludes connection
details, record identifiers, user/wallet/payment data, ticket details, and
outbox error text. Unknown global outbox statuses and any non-completed
side-effect type outside the worker's exact allowlist block the gate.

Exit codes:

- `0`: the inspected database snapshot is drained and the database dispatch
  fence is paused. This is release-gate evidence only; it does not enable the
  worker.
- `1`: the release gate is blocked. Keep the worker disabled and resolve the
  reported stable blocker codes.
- `2`: the preflight could not establish trustworthy evidence. Keep the worker
  disabled; no release conclusion can be made.

A non-zero result is fail-closed. Any `PENDING`, `RETRYING`, `PROCESSING`,
failed/dead, ambiguous, unknown-status, adapter-mismatched, route-invalid, or
Ticket-route-mismatched ownership work blocks the gate. Unresolved provider
jobs and unsafe sponsored-crypto submissions also block it. A card payment
with an incomplete Stripe provider reference, or one that still has
pre-provider pending semantics, must have the exact active
`PAYMENT_INTENT_CREATE` outbox marker bound to that payment; an orphaned payment
blocks the gate. The report exposes aggregate counts only and never prints
payment, provider, order, or outbox identifiers.

## Database dispatch fence

`20260720_side_effect_dispatch_control.sql` creates one default-paused control
row and a database trigger. A worker can claim a job only when it writes the
current dispatch revision. For outbox claims, an older application revision
that does not know the revision cannot bypass the trigger, even if its
process-level worker flag is still enabled. This claim protection does not
retroactively wrap old direct provider paths.

The first rollout of this fence has a stricter boundary. The currently live,
pre-fence API does not perform the provider-time revision check on its direct
Stripe and Privy paths, and Render keeps that old instance serving while a
normal zero-downtime build runs. Before installing this SQL or starting the
first route-aware deploy, block all public API traffic with a verified
maintenance boundary, wait for in-flight requests to drain, prove the existing
outbox/provider census is clean, and keep the process worker disabled. Do not
resume public traffic until the fence-aware revision is the only API instance
and the identity-bound preflight passes. If the hosting plan cannot provide
that traffic boundary, stop the release; suspension is not a substitute unless
the platform has independently proven that resume starts the reviewed RC
without ever exposing the old binary.

Use the protected operator command for status, pause, and resume operations:

```bash
npm --silent --workspace @fanpass/api run side-effects:dispatch-control -- status
npm --silent --workspace @fanpass/api run side-effects:dispatch-control -- pause
```

`pause` commits the revision fence first. If work was already `PROCESSING`, the
result remains unsafe until a later status/preflight proves that count is zero.
A provider call that had already crossed its final revision check cannot be
recalled; pausing prevents new or stale claims, not an already-sent external
request. Stale-lock recovery may move a fenced job back to `RETRYING`, but a
paused database still prevents it from submitting externally.

Resume always requires the exact `RESUME_FANPASS_SIDE_EFFECTS` confirmation. A
controlled probe additionally requires `--probe-limit 1`. The operator refuses
the operation unless exactly one eligible job is active and claimable, then
binds that internal job ID in the database without printing it. The trigger
rejects every other job, spends the one-claim budget, clears the binding, and
auto-pauses atomically.

```bash
npm --silent --workspace @fanpass/api run side-effects:dispatch-control -- \
  resume --confirm RESUME_FANPASS_SIDE_EFFECTS --probe-limit 1
```

Do not treat a successful probe as permission for an unlimited resume. Wait
for the probe to settle, run `pause`, and run the read-only preflight again.
Only after that evidence passes may an operator consider a separate full
resume with the same exact confirmation and no probe option.

Run the offline test without a database:

```bash
npm run staging:db:preflight:self-test
```

Passing this test proves the local gate behavior only. It is not Staging
evidence and does not replace a same-revision cloud run.
