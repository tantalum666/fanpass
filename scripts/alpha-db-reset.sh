#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgresql://fanpass:fanpass@localhost:5432/fanpass}"
ALPHA_RESET_EXPECTED_DATABASE="fanpass"
NODE_BIN="${FANPASS_NODE_BIN:-$(command -v node)}"
PRISMA_CLI="$ROOT_DIR/node_modules/prisma/build/index.js"
TS_NODE_CLI="$ROOT_DIR/node_modules/ts-node/dist/bin.js"

cd "$ROOT_DIR"

assert_local_database_target() {
  DATABASE_URL="$DATABASE_URL" \
    ALPHA_RESET_EXPECTED_DATABASE="$ALPHA_RESET_EXPECTED_DATABASE" \
    "$NODE_BIN" <<'NODE'
const connectionString = process.env.DATABASE_URL;
const expectedDatabase = process.env.ALPHA_RESET_EXPECTED_DATABASE;

let target;
try {
  target = new URL(connectionString);
} catch {
  process.exit(1);
}

const allowedProtocols = new Set(["postgres:", "postgresql:"]);
const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const allowedLocalQueryParameters = new Set([
  "application_name",
  "connect_timeout",
  "connection_limit",
  "pgbouncer",
  "pool_timeout",
  "schema",
  "socket_timeout",
  "sslmode",
]);

const authorityMatch = connectionString.match(
  /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i,
);
const authority = authorityMatch?.[1] || "";
const hostAndPort = authority.slice(authority.lastIndexOf("@") + 1);
let explicitHost = hostAndPort;
let explicitPort = "";
if (hostAndPort.startsWith("[")) {
  const closingBracket = hostAndPort.indexOf("]");
  explicitHost = hostAndPort.slice(0, closingBracket + 1);
  explicitPort = hostAndPort.slice(closingBracket + 1);
} else {
  const colon = hostAndPort.lastIndexOf(":");
  if (colon >= 0) {
    explicitHost = hostAndPort.slice(0, colon);
    explicitPort = hostAndPort.slice(colon);
  }
}
explicitHost = explicitHost.toLowerCase();

let databaseName;
try {
  databaseName = decodeURIComponent(target.pathname.slice(1));
} catch {
  process.exit(1);
}

if (
  !allowedProtocols.has(target.protocol) ||
  !allowedHosts.has(explicitHost) ||
  !allowedHosts.has(target.hostname) ||
  (explicitPort && !/^:[0-9]+$/.test(explicitPort)) ||
  databaseName !== expectedDatabase ||
  target.hash ||
  [...target.searchParams.keys()].some((key) =>
    !allowedLocalQueryParameters.has(key.toLowerCase()),
  )
) {
  process.exit(1);
}
NODE
}

if ! assert_local_database_target; then
  printf "Alpha database reset refused: DATABASE_URL must target the local PostgreSQL database '%s' on localhost, 127.0.0.1, or ::1.\n" \
    "$ALPHA_RESET_EXPECTED_DATABASE" >&2
  exit 1
fi

if command -v docker >/dev/null 2>&1 && [[ "${FANPASS_SKIP_DOCKER_POSTGRES:-false}" != "true" ]]; then
  docker compose up -d postgres >/dev/null
fi

printf 'Waiting for Alpha Postgres'
for _ in {1..40}; do
  if DATABASE_URL="$DATABASE_URL" "$NODE_BIN" "$PRISMA_CLI" db execute --schema apps/api/prisma/schema.prisma --stdin >/dev/null 2>&1 <<<"SELECT 1;"; then
    printf '\n'
    break
  fi
  printf '.'
  sleep 1
done

if ! DATABASE_URL="$DATABASE_URL" "$NODE_BIN" "$PRISMA_CLI" db execute --schema apps/api/prisma/schema.prisma --stdin >/dev/null 2>&1 <<<"SELECT 1;"; then
  printf '\nAlpha Postgres did not become reachable.\n' >&2
  exit 1
fi

DATABASE_URL="$DATABASE_URL" "$NODE_BIN" "$PRISMA_CLI" db push --schema apps/api/prisma/schema.prisma --accept-data-loss
(
  cd "$ROOT_DIR/apps/api"
  DATABASE_URL="$DATABASE_URL" "$NODE_BIN" "$TS_NODE_CLI" prisma/seed-alpha.ts
)
