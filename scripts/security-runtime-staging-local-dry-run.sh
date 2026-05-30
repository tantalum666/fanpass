#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${STAGING_DRY_RUN_API_PORT:-4200}"
CONSOLE_PORT="${STAGING_DRY_RUN_CONSOLE_PORT:-3200}"
API_PID=""
CONSOLE_PID=""
API_LOG="${TMPDIR:-/tmp}/fanpass-staging-dry-run-api.log"
CONSOLE_LOG="${TMPDIR:-/tmp}/fanpass-staging-dry-run-console.log"
DATABASE_URL="${DATABASE_URL:-postgresql://fanpass:fanpass@localhost:5432/fanpass}"
KEY_DIR="$(mktemp -d)"

cleanup() {
  if [[ -n "$API_PID" ]]; then
    kill "$API_PID" >/dev/null 2>&1 || true
    wait "$API_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$CONSOLE_PID" ]]; then
    kill "$CONSOLE_PID" >/dev/null 2>&1 || true
    wait "$CONSOLE_PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$KEY_DIR"
}
trap cleanup EXIT

stop_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids >/dev/null 2>&1 || true
    sleep 1
  fi
}

cd "$ROOT_DIR"
screen -S fanpass-beta-console -X quit >/dev/null 2>&1 || true
screen -S fanpass-dashboard -X quit >/dev/null 2>&1 || true
stop_port "${BETA_LOCAL_CONSOLE_PORT:-3000}"
stop_port "$API_PORT"
stop_port "$CONSOLE_PORT"

npm run build -w @fanpass/api >/dev/null
npm run build -w @fanpass/dashboard >/dev/null
DATABASE_URL="$DATABASE_URL" npm run alpha:db:reset >/dev/null

node <<NODE
const { generateKeyPairSync } = require("crypto");
const { writeFileSync } = require("fs");
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
writeFileSync("$KEY_DIR/privy-public.pem", publicKey.export({ type: "spki", format: "pem" }));
writeFileSync("$KEY_DIR/privy-private.pem", privateKey.export({ type: "pkcs8", format: "pem" }));
NODE

PRIVY_VERIFICATION_KEY="$(
  node -e 'const fs = require("fs"); console.log(fs.readFileSync(process.argv[1], "utf8").replace(/\n/g, "\\n"));' "$KEY_DIR/privy-public.pem"
)"

STAGING_ADMIN_ACCESS_TOKEN="$(
  PRIVY_PRIVATE_KEY_PATH="$KEY_DIR/privy-private.pem" node <<'NODE'
const { readFileSync } = require("fs");
const { sign } = require("crypto");

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const privateKey = readFileSync(process.env.PRIVY_PRIVATE_KEY_PATH, "utf8");
const now = Math.floor(Date.now() / 1000);
const header = base64url({ alg: "ES256", typ: "JWT" });
const payload = base64url({
  iss: "privy.io",
  aud: "privy-staging-dry-run",
  sub: "did:privy:admin-demo",
  nbf: now - 60,
  exp: now + 1800
});
const signedValue = `${header}.${payload}`;
const signature = sign("sha256", Buffer.from(signedValue), {
  key: privateKey,
  dsaEncoding: "ieee-p1363"
}).toString("base64url");
console.log(`${signedValue}.${signature}`);
NODE
)"

DATABASE_URL="$DATABASE_URL" node <<'NODE'
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  await prisma.user.upsert({
    where: { id: "usr_admin_demo" },
    update: {
      name: "Demo Admin",
      email: "admin@fanpass.test",
      role: "ADMIN",
      privyId: "did:privy:admin-demo",
      walletAddress: null,
      riskScore: 0
    },
    create: {
      id: "usr_admin_demo",
      name: "Demo Admin",
      email: "admin@fanpass.test",
      role: "ADMIN",
      privyId: "did:privy:admin-demo",
      walletAddress: null,
      riskScore: 0
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE

PORT="$API_PORT" \
FANPASS_ENV=staging \
FANPASS_DATA_SOURCE=prisma \
FANPASS_ENABLE_PRISMA_CONNECT=true \
DATABASE_URL="$DATABASE_URL" \
QR_SIGNING_SECRET=fanpass-staging-dry-run-secret-32-chars \
QR_TTL_SECONDS=300 \
SESSION_TTL_SECONDS=28800 \
PRIVY_APP_ID=privy-staging-dry-run \
PRIVY_VERIFICATION_KEY="$PRIVY_VERIFICATION_KEY" \
FANPASS_CORS_ORIGINS=https://console.staging.local \
FANPASS_TRUST_PROXY_HOPS=1 \
FANPASS_ENABLE_DEMO_AUTH=false \
FANPASS_ENABLE_PAYMENTS=false \
node apps/api/dist/src/main.js >"$API_LOG" 2>&1 &
API_PID="$!"

printf 'Waiting for staging-like API'
for _ in {1..30}; do
  if curl --max-time 2 -fsS "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
    printf '\n'
    break
  fi
  printf '.'
  sleep 1
done
if ! curl --max-time 2 -fsS "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
  printf '\nStaging-like API did not become healthy. Log:\n' >&2
  sed -n '1,180p' "$API_LOG" >&2
  exit 1
fi

(
  cd "$ROOT_DIR/apps/dashboard"
  FANPASS_ENV=staging \
  FANPASS_API_BASE_URL="http://localhost:${API_PORT}" \
  NEXT_PUBLIC_API_BASE_URL="http://localhost:${API_PORT}" \
  npx next start -p "$CONSOLE_PORT"
) >"$CONSOLE_LOG" 2>&1 &
CONSOLE_PID="$!"

printf 'Waiting for staging-like Console'
for _ in {1..45}; do
  if curl --max-time 5 -fsS "http://localhost:${CONSOLE_PORT}/" 2>/dev/null | grep -Eq "Console locked|Authentication required"; then
    printf '\n'
    break
  fi
  printf '.'
  sleep 1
done
if ! curl --max-time 5 -fsS "http://localhost:${CONSOLE_PORT}/" | grep -Eq "Console locked|Authentication required"; then
  printf '\nStaging-like Console did not render locked state. Log:\n' >&2
  sed -n '1,180p' "$CONSOLE_LOG" >&2
  exit 1
fi

ALLOW_LOCAL_STAGING_CHECK=true \
STAGING_API_URL="http://localhost:${API_PORT}/health" \
STAGING_CONSOLE_URL="http://localhost:${CONSOLE_PORT}/" \
STAGING_SOCKET_ORIGIN="https://console.staging.local" \
STAGING_API_TRUST_PROXY_HOPS=1 \
STAGING_ADMIN_ACCESS_TOKEN="$STAGING_ADMIN_ACCESS_TOKEN" \
bash scripts/security-runtime-staging-check.sh
