#!/usr/bin/env bash
set -euo pipefail

API_URL="${STAGING_API_URL:-${API_URL:-}}"
CONSOLE_URL="${STAGING_CONSOLE_URL:-${CONSOLE_URL:-}}"
ALLOW_LOCAL="${ALLOW_LOCAL_STAGING_CHECK:-false}"
ORDERBOOK_EVENT_ID="${STAGING_ORDERBOOK_EVENT_ID:-evt_weekend_demo}"
ORDERBOOK_TICKET_TYPE_ID="${STAGING_ORDERBOOK_TICKET_TYPE_ID:-tt_cat2_demo}"
ADMIN_ACCESS_TOKEN="${STAGING_ADMIN_ACCESS_TOKEN:-${FANPASS_STAGING_ADMIN_ACCESS_TOKEN:-}}"
API_TRUST_PROXY_HOPS="${STAGING_API_TRUST_PROXY_HOPS:-${FANPASS_STAGING_API_TRUST_PROXY_HOPS:-}}"

if [[ -z "$API_URL" || -z "$CONSOLE_URL" ]]; then
  printf 'Set STAGING_API_URL and STAGING_CONSOLE_URL before running this check.\n' >&2
  printf 'Example: STAGING_API_URL=https://api.staging.example/health STAGING_CONSOLE_URL=https://console.staging.example npm run security:runtime:staging\n' >&2
  exit 1
fi

if [[ "$API_URL" != https://* || "$CONSOLE_URL" != https://* ]]; then
  if [[ "$ALLOW_LOCAL" != "true" ]]; then
    printf 'Staging runtime checks require https URLs. Set ALLOW_LOCAL_STAGING_CHECK=true only for local dry-runs.\n' >&2
    exit 1
  fi
fi

if [[ "$ALLOW_LOCAL" != "true" && -z "$API_TRUST_PROXY_HOPS" ]]; then
  printf 'Set STAGING_API_TRUST_PROXY_HOPS to the deployed API trust proxy hop count (1-3) before running deployed staging checks.\n' >&2
  exit 1
fi

if [[ "$ALLOW_LOCAL" == "true" && -z "$API_TRUST_PROXY_HOPS" ]]; then
  API_TRUST_PROXY_HOPS="1"
fi

if [[ ! "$API_TRUST_PROXY_HOPS" =~ ^[1-3]$ ]]; then
  printf 'STAGING_API_TRUST_PROXY_HOPS must be an integer between 1 and 3.\n' >&2
  exit 1
fi

api_headers="$(mktemp)"
console_headers="$(mktemp)"
console_body="$(mktemp)"
demo_body="$(mktemp)"
health_body="$(mktemp)"
health_unauth_body="$(mktemp)"
trap 'rm -f "$api_headers" "$console_headers" "$console_body" "$demo_body" "$health_body" "$health_unauth_body"' EXIT

curl --max-time 10 -fsSI "$API_URL" >"$api_headers"
curl --max-time 10 -fsSI "$CONSOLE_URL" >"$console_headers"
curl --max-time 10 -fsS "$CONSOLE_URL" >"$console_body"

api_origin_from_url() {
  node -e 'const url = new URL(process.argv[1]); console.log(`${url.protocol}//${url.host}`)' "$1"
}

API_ORIGIN="$(api_origin_from_url "$API_URL")"
CONSOLE_ORIGIN="$(api_origin_from_url "$CONSOLE_URL")"
SOCKET_ALLOWED_ORIGIN="${STAGING_SOCKET_ORIGIN:-$CONSOLE_ORIGIN}"
demo_status="$(
  curl --max-time 10 -sS -o "$demo_body" -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -X POST "$API_ORIGIN/auth/demo-session" \
    --data '{"userId":"usr_organizer_demo"}' || true
)"
health_unauth_status="$(
  curl --max-time 10 -sS -o "$health_unauth_body" -w '%{http_code}' \
    "$API_ORIGIN/alpha/side-effects/health" || true
)"

assert_header_present() {
  local file="$1"
  local header="$2"
  local label="$3"

  if ! grep -iq "^${header}:" "$file"; then
    printf '%s is missing required header: %s\n' "$label" "$header" >&2
    exit 1
  fi
}

assert_header_absent() {
  local file="$1"
  local header="$2"
  local label="$3"

  if grep -iq "^${header}:" "$file"; then
    printf '%s must not expose header: %s\n' "$label" "$header" >&2
    exit 1
  fi
}

assert_header_present "$api_headers" "x-content-type-options" "API"
assert_header_present "$api_headers" "x-frame-options" "API"
assert_header_present "$api_headers" "referrer-policy" "API"
assert_header_present "$api_headers" "cross-origin-opener-policy" "API"
assert_header_present "$api_headers" "strict-transport-security" "API"
assert_header_absent "$api_headers" "x-powered-by" "API"

assert_header_present "$console_headers" "x-content-type-options" "Console"
assert_header_present "$console_headers" "x-frame-options" "Console"
assert_header_present "$console_headers" "referrer-policy" "Console"
assert_header_present "$console_headers" "cross-origin-opener-policy" "Console"
assert_header_present "$console_headers" "strict-transport-security" "Console"
assert_header_present "$console_headers" "permissions-policy" "Console"
assert_header_present "$console_headers" "content-security-policy" "Console"
assert_header_absent "$console_headers" "x-powered-by" "Console"

if [[ "$demo_status" =~ ^2 ]]; then
  printf 'Staging API must not issue demo sessions. Status: %s Body: %s\n' "$demo_status" "$(cat "$demo_body")" >&2
  exit 1
fi

if [[ "$health_unauth_status" =~ ^2 ]]; then
  printf 'Admin side-effect health must reject unauthenticated access. Status: %s Body: %s\n' "$health_unauth_status" "$(cat "$health_unauth_body")" >&2
  exit 1
fi

if grep -q 'FanPass Console' "$console_body" && ! grep -Eq 'Console locked|Authentication required|Privy|Sign in' "$console_body"; then
  printf 'Console rendered, but no locked/sign-in state was detected for unauthenticated staging access.\n' >&2
  exit 1
fi

side_effect_health_status="skipped; set STAGING_ADMIN_ACCESS_TOKEN to verify admin-only outbox health"
if [[ -n "$ADMIN_ACCESS_TOKEN" ]]; then
  API_ORIGIN="$API_ORIGIN" \
  STAGING_ADMIN_ACCESS_TOKEN="$ADMIN_ACCESS_TOKEN" \
  HEALTH_BODY_PATH="$health_body" \
  node <<'NODE'
const fs = await import("node:fs");

const apiOrigin = process.env.API_ORIGIN;
const accessToken = process.env.STAGING_ADMIN_ACCESS_TOKEN;
const healthBodyPath = process.env.HEALTH_BODY_PATH;

const response = await fetch(`${apiOrigin}/alpha/side-effects/health`, {
  headers: {
    Authorization: `Bearer ${accessToken}`
  }
});
const text = await response.text();
fs.writeFileSync(healthBodyPath, text);

let body;
try {
  body = text ? JSON.parse(text) : null;
} catch {
  throw new Error(`Side-effect health response was not JSON. Status: ${response.status}`);
}

if (!response.ok) {
  throw new Error(`Side-effect health check failed. Status: ${response.status} Body: ${JSON.stringify(body)}`);
}
if (body?.ok !== true || typeof body.checkedAt !== "string" || !body.thresholds) {
  throw new Error(`Side-effect health check returned an unhealthy or malformed response: ${JSON.stringify(body)}`);
}
const serialized = JSON.stringify(body).toLowerCase();
for (const forbidden of ["payloadjson", "clientsecret", "invitetoken", "stripe_secret", "privy_verification_key", "owneremail", "scanneremail"]) {
  if (serialized.includes(forbidden)) {
    throw new Error(`Side-effect health response contains forbidden private field marker: ${forbidden}`);
  }
}
NODE
  side_effect_health_status="admin side-effect outbox health ok"
fi

API_ORIGIN="$API_ORIGIN" \
SOCKET_ALLOWED_ORIGIN="$SOCKET_ALLOWED_ORIGIN" \
ORDERBOOK_EVENT_ID="$ORDERBOOK_EVENT_ID" \
ORDERBOOK_TICKET_TYPE_ID="$ORDERBOOK_TICKET_TYPE_ID" \
node <<'NODE'
const { io } = await import("socket.io-client");

const apiOrigin = process.env.API_ORIGIN;
const allowedOrigin = process.env.SOCKET_ALLOWED_ORIGIN;
const eventId = process.env.ORDERBOOK_EVENT_ID;
const ticketTypeId = process.env.ORDERBOOK_TICKET_TYPE_ID;

function connectOrderbook(origin, expectSuccess) {
  return new Promise((resolve, reject) => {
    const socket = io(`${apiOrigin}/orderbook`, {
      transports: ["websocket"],
      timeout: 5000,
      reconnection: false,
      extraHeaders: {
        Origin: origin
      }
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out waiting for orderbook ${expectSuccess ? "success" : "rejection"} from ${origin}`));
    }, 8000);

    socket.on("connect", () => {
      if (!expectSuccess) {
        clearTimeout(timer);
        socket.close();
        reject(new Error(`Disallowed origin unexpectedly connected to orderbook feed: ${origin}`));
        return;
      }
      socket.emit("orderbook.subscribe", { eventId, ticketTypeId });
    });

    socket.on("orderbook.snapshot", (payload) => {
      clearTimeout(timer);
      socket.close();
      if (!expectSuccess) {
        reject(new Error(`Disallowed origin unexpectedly received orderbook snapshot: ${origin}`));
        return;
      }
      if (payload?.eventId !== eventId || payload?.ticketTypeId !== ticketTypeId || !payload.snapshot) {
        reject(new Error(`Unexpected orderbook snapshot payload: ${JSON.stringify(payload)}`));
        return;
      }
      const serialized = JSON.stringify(payload).toLowerCase();
      for (const forbidden of ["clientsecret", "owneremail", "scanneremail", "privy", "nonce"]) {
        if (serialized.includes(forbidden)) {
          reject(new Error(`Orderbook snapshot contains forbidden private field marker: ${forbidden}`));
          return;
        }
      }
      resolve();
    });

    socket.on("connect_error", (error) => {
      clearTimeout(timer);
      socket.close();
      if (expectSuccess) {
        reject(new Error(`Allowed origin could not connect to orderbook feed: ${error.message}`));
        return;
      }
      resolve();
    });
  });
}

await connectOrderbook(allowedOrigin, true);
await connectOrderbook("https://disallowed-origin.invalid", false);
NODE

API_URL="$API_URL" \
CONSOLE_URL="$CONSOLE_URL" \
ALLOW_LOCAL="$ALLOW_LOCAL" \
API_TRUST_PROXY_HOPS="$API_TRUST_PROXY_HOPS" \
ORDERBOOK_EVENT_ID="$ORDERBOOK_EVENT_ID" \
ORDERBOOK_TICKET_TYPE_ID="$ORDERBOOK_TICKET_TYPE_ID" \
SOCKET_ALLOWED_ORIGIN="$SOCKET_ALLOWED_ORIGIN" \
SIDE_EFFECT_HEALTH_STATUS="$side_effect_health_status" \
node <<'NODE'
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const implementationSnapshotFiles = [
  "apps/api/src/main.ts",
  "apps/api/src/config/security-config.ts",
  "apps/api/.env.staging.example",
  "apps/api/src/common/fanpass-socket-io.adapter.ts",
  "apps/api/src/modules/alpha/alpha.controller.ts",
  "apps/api/src/modules/side-effects/side-effect-health.service.ts",
  "apps/dashboard/next.config.ts",
  "scripts/security-runtime-staging-check.sh",
  "scripts/staging-runtime-evidence-audit.js",
  "scripts/security-runtime-staging-local-dry-run.sh",
  "scripts/security-header-policy-audit.js",
];

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const rootDir = process.cwd();
const trustProxyHops = process.env.API_TRUST_PROXY_HOPS;
const sideEffectHealthStatus = process.env.SIDE_EFFECT_HEALTH_STATUS;

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedAt: new Date().toISOString(),
      apiUrl: process.env.API_URL,
      consoleUrl: process.env.CONSOLE_URL,
      localDryRun: process.env.ALLOW_LOCAL === "true",
      deploymentCredentialsAvailable: false,
      implementationSnapshot: {
        source: "staging-runtime-security-boundaries",
        files: implementationSnapshotFiles.map((file) => ({
          file,
          sha256: sha256File(path.join(rootDir, file)),
        })),
      },
      apiRuntime: {
        trustProxyHops: Number(trustProxyHops),
      },
      orderbook: {
        subscriptionTargetRedacted: true,
        allowedOrigin: process.env.SOCKET_ALLOWED_ORIGIN,
      },
      adminSideEffectHealth: sideEffectHealthStatus,
      redaction: {
        deploymentCredentialsRedacted: true,
        ciSecretMaskingCommandsRedacted: true,
      },
      checked: {
        api: [
          "x-content-type-options",
          "x-frame-options",
          "referrer-policy",
          "cross-origin-opener-policy",
          "strict-transport-security",
          "x-powered-by absent",
          "demo-session non-2xx",
          "admin side-effect health unauthenticated non-2xx",
          `admin side-effect health: ${sideEffectHealthStatus}`,
          `trust proxy hops configured: ${trustProxyHops}`,
          "orderbook websocket allowed origin",
          "orderbook websocket disallowed origin rejected",
        ],
        console: [
          "x-content-type-options",
          "x-frame-options",
          "referrer-policy",
          "cross-origin-opener-policy",
          "strict-transport-security",
          "permissions-policy",
          "content-security-policy",
          "x-powered-by absent",
          "locked-or-sign-in unauthenticated state",
        ],
      },
    },
    null,
    2,
  ),
);
NODE
