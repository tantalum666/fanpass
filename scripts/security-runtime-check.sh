#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:4000/health}"
CONSOLE_URL="${CONSOLE_URL:-http://localhost:3000/}"
API_BASE_URL="${API_BASE_URL:-${API_URL%/health}}"

api_headers="$(mktemp)"
auth_privy_headers="$(mktemp)"
console_headers="$(mktemp)"
trap 'rm -f "$api_headers" "$auth_privy_headers" "$console_headers"' EXIT

curl -fsSI "$API_URL" >"$api_headers"
curl -sS -D "$auth_privy_headers" -o /dev/null \
  -X POST "$API_BASE_URL/auth/privy/sync" \
  -H "content-type: application/json" \
  --data '{}'
curl -fsSI "$CONSOLE_URL" >"$console_headers"

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
assert_header_absent "$api_headers" "x-powered-by" "API"
assert_header_present "$auth_privy_headers" "ratelimit-policy" "API Privy auth"

assert_header_present "$console_headers" "x-content-type-options" "Console"
assert_header_present "$console_headers" "x-frame-options" "Console"
assert_header_present "$console_headers" "referrer-policy" "Console"
assert_header_present "$console_headers" "cross-origin-opener-policy" "Console"
assert_header_present "$console_headers" "permissions-policy" "Console"
assert_header_present "$console_headers" "content-security-policy" "Console"
assert_header_absent "$console_headers" "x-powered-by" "Console"

node <<NODE
console.log(JSON.stringify({
  ok: true,
  apiUrl: "$API_URL",
  consoleUrl: "$CONSOLE_URL",
  checked: {
    api: [
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
      "cross-origin-opener-policy",
      "x-powered-by absent",
      "privy auth ratelimit-policy"
    ],
    console: [
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
      "cross-origin-opener-policy",
      "permissions-policy",
      "content-security-policy",
      "x-powered-by absent"
    ]
  }
}, null, 2));
NODE
