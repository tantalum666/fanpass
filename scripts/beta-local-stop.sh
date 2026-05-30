#!/usr/bin/env bash
set -euo pipefail

API_PORT="${BETA_LOCAL_API_PORT:-4000}"
CONSOLE_PORT="${BETA_LOCAL_CONSOLE_PORT:-3000}"

screen -S fanpass-beta-api -X quit >/dev/null 2>&1 || true
screen -S fanpass-beta-console -X quit >/dev/null 2>&1 || true
screen -S fanpass-beta-worker -X quit >/dev/null 2>&1 || true

for port in "$API_PORT" "$CONSOLE_PORT"; do
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids >/dev/null 2>&1 || true
  fi
done

echo "Beta local services stopped."
