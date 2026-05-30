#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgresql://fanpass:fanpass@localhost:5432/fanpass}"

cd "$ROOT_DIR"

if command -v docker >/dev/null 2>&1 && [[ "${FANPASS_SKIP_DOCKER_POSTGRES:-false}" != "true" ]]; then
  docker compose up -d postgres >/dev/null
fi

printf 'Waiting for Alpha Postgres'
for _ in {1..40}; do
  if DATABASE_URL="$DATABASE_URL" npx prisma db execute --schema apps/api/prisma/schema.prisma --stdin >/dev/null 2>&1 <<<"SELECT 1;"; then
    printf '\n'
    break
  fi
  printf '.'
  sleep 1
done

if ! DATABASE_URL="$DATABASE_URL" npx prisma db execute --schema apps/api/prisma/schema.prisma --stdin >/dev/null 2>&1 <<<"SELECT 1;"; then
  printf '\nAlpha Postgres did not become reachable at %s\n' "$DATABASE_URL" >&2
  exit 1
fi

DATABASE_URL="$DATABASE_URL" npm run prisma:push -w @fanpass/api -- --accept-data-loss
DATABASE_URL="$DATABASE_URL" npm run alpha:seed -w @fanpass/api
