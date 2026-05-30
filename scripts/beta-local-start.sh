#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${BETA_LOCAL_API_PORT:-4000}"
CONSOLE_PORT="${BETA_LOCAL_CONSOLE_PORT:-3000}"
DATABASE_URL="${DATABASE_URL:-postgresql://fanpass:fanpass@localhost:5432/fanpass}"
WORKER_INTERVAL_SECONDS="${BETA_LOCAL_WORKER_INTERVAL_SECONDS:-2}"
API_LOG="${TMPDIR:-/tmp}/fanpass-beta-local-api.log"
CONSOLE_LOG="${TMPDIR:-/tmp}/fanpass-beta-local-console.log"
WORKER_LOG="${TMPDIR:-/tmp}/fanpass-beta-local-worker.log"

stop_screen() {
  local name="$1"
  screen -S "$name" -X quit >/dev/null 2>&1 || true
}

stop_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids >/dev/null 2>&1 || true
    sleep 1
  fi
}

stripe_secret_key=""
stripe_webhook_secret=""
if [[ "${FANPASS_BETA_USE_STRIPE:-false}" == "true" ]]; then
  stripe_secret_key="${STRIPE_SECRET_KEY:-}"
  stripe_webhook_secret="${STRIPE_WEBHOOK_SECRET:-}"
fi

stop_screen fanpass-beta-api
stop_screen fanpass-beta-console
stop_screen fanpass-beta-worker
stop_screen fanpass-api
stop_screen fanpass-dashboard
stop_port "$API_PORT"
stop_port "$CONSOLE_PORT"

cd "$ROOT_DIR"

if [[ "${FANPASS_BETA_SKIP_DB_RESET:-false}" != "true" ]]; then
  DATABASE_URL="$DATABASE_URL" npm run alpha:db:reset
fi

rm -rf "$ROOT_DIR/apps/dashboard/.next"

screen -dmS fanpass-beta-api bash -lc "
cd '$ROOT_DIR' &&
PORT='$API_PORT' \
FANPASS_ENV=local \
FANPASS_DATA_SOURCE=prisma \
FANPASS_ENABLE_PRISMA_CONNECT=true \
FANPASS_REQUIRE_PAYMENT_AUTHORIZATION=true \
FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true \
OWNERSHIP_ADAPTER=mock \
FANPASS_ENABLE_PAYMENTS=false \
FANPASS_ENABLE_DEMO_AUTH=true \
FANPASS_CORS_ORIGINS='http://localhost:$CONSOLE_PORT,http://localhost:$API_PORT' \
QR_SIGNING_SECRET=replace-with-local-dev-secret \
SESSION_SIGNING_SECRET=replace-with-local-session-secret \
SESSION_TTL_SECONDS=28800 \
QR_TTL_SECONDS=300 \
RATE_LIMIT_GENERAL_PER_MINUTE=600 \
RATE_LIMIT_AUTH_PER_MINUTE=30 \
RATE_LIMIT_VERIFY_PER_MINUTE=120 \
DATABASE_URL='$DATABASE_URL' \
STRIPE_SECRET_KEY='$stripe_secret_key' \
STRIPE_WEBHOOK_SECRET='$stripe_webhook_secret' \
npm run dev -w @fanpass/api >'$API_LOG' 2>&1
"

printf 'Waiting for Beta local API'
for _ in {1..45}; do
  if curl --max-time 2 -fsS "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
    printf '\n'
    break
  fi
  printf '.'
  sleep 1
done

if ! curl --max-time 2 -fsS "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
  printf '\nBeta local API did not become healthy. Log:\n' >&2
  sed -n '1,180p' "$API_LOG" >&2
  exit 1
fi

screen -dmS fanpass-beta-worker bash -lc "
cd '$ROOT_DIR' &&
while true; do
  FANPASS_ENV=local \
  FANPASS_DATA_SOURCE=prisma \
  FANPASS_ENABLE_PRISMA_CONNECT=true \
  FANPASS_REQUIRE_PAYMENT_AUTHORIZATION=true \
  FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true \
  OWNERSHIP_ADAPTER=mock \
  FANPASS_ENABLE_PAYMENTS=false \
  DATABASE_URL='$DATABASE_URL' \
  STRIPE_SECRET_KEY='$stripe_secret_key' \
  STRIPE_WEBHOOK_SECRET='$stripe_webhook_secret' \
  npm run side-effects:work-once -w @fanpass/api >>'$WORKER_LOG' 2>&1 || true
  sleep '$WORKER_INTERVAL_SECONDS'
done
"

screen -dmS fanpass-beta-console bash -lc "
cd '$ROOT_DIR/apps/dashboard' &&
FANPASS_ENV=local \
FANPASS_API_BASE_URL='http://localhost:$API_PORT' \
NEXT_PUBLIC_API_BASE_URL='http://localhost:$API_PORT' \
FANPASS_CONSOLE_USER_ID=usr_organizer_demo \
npx next dev -p '$CONSOLE_PORT' >'$CONSOLE_LOG' 2>&1
"

printf 'Waiting for FanPass Console'
for _ in {1..60}; do
  if curl --max-time 5 -fsS "http://localhost:${CONSOLE_PORT}/" 2>/dev/null | grep -q "FanPass Console"; then
    printf '\n'
    echo "Beta local services are running."
    echo "API: http://localhost:${API_PORT} (Prisma data source)"
    echo "FanPass Console: http://localhost:${CONSOLE_PORT}"
    echo "Side-effect worker: screen -r fanpass-beta-worker"
    echo "Logs: $API_LOG, $CONSOLE_LOG, $WORKER_LOG"
    exit 0
  fi
  printf '.'
  sleep 1
done

printf '\nFanPass Console did not render. Log:\n' >&2
sed -n '1,180p' "$CONSOLE_LOG" >&2
exit 1
