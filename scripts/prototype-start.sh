#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

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

stop_screen fanpass-api
stop_screen fanpass-dashboard
stop_port 4000
stop_port 3000

rm -rf "$ROOT_DIR/apps/dashboard/.next"

screen -dmS fanpass-api bash -lc "cd '$ROOT_DIR' && npm run dev -w @fanpass/api"
screen -dmS fanpass-dashboard bash -lc "cd '$ROOT_DIR' && npm run dev -w @fanpass/dashboard"

printf 'Waiting for FanPass API'
for _ in {1..30}; do
  if curl --max-time 2 -fsS http://localhost:4000/health >/dev/null 2>&1; then
    printf '\n'
    node <<'NODE'
const baseUrl = "http://localhost:4000";
const sessionResponse = await fetch(`${baseUrl}/auth/demo-session`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: "usr_organizer_demo" })
});
const session = await sessionResponse.json();
if (!sessionResponse.ok || !session.accessToken) {
  throw new Error(`Demo organizer auth failed: ${JSON.stringify(session)}`);
}
const resetResponse = await fetch(`${baseUrl}/prototype/reset`, {
  method: "POST",
  headers: { Authorization: `Bearer ${session.accessToken}` }
});
if (!resetResponse.ok) {
  throw new Error(`Prototype reset failed: ${resetResponse.status}`);
}
NODE
    break
  fi
  printf '.'
  sleep 1
done

if ! curl --max-time 2 -fsS http://localhost:4000/health >/dev/null 2>&1; then
  printf '\nAPI did not become healthy. Run: screen -r fanpass-api\n' >&2
  exit 1
fi

printf 'Waiting for FanPass Console'
for _ in {1..45}; do
  if curl --max-time 5 -fsS http://localhost:3000/ | grep -q "FanPass Console"; then
    printf '\n'
    echo "Prototype services are running."
    echo "API: http://localhost:4000"
    echo "FanPass Console: http://localhost:3000"
    exit 0
  fi
  printf '.'
  sleep 1
done

printf '\nFanPass Console did not render. Run: screen -r fanpass-dashboard\n' >&2
exit 1
