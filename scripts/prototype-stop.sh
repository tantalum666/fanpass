#!/usr/bin/env bash
set -euo pipefail

screen -S fanpass-api -X quit >/dev/null 2>&1 || true
screen -S fanpass-dashboard -X quit >/dev/null 2>&1 || true

for port in 4000 3000; do
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids >/dev/null 2>&1 || true
  fi
done

echo "Prototype services stopped."
