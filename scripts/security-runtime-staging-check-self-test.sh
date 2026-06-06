#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CHECK_SCRIPT="$ROOT_DIR/scripts/security-runtime-staging-check.sh"

run_case() {
  local label="$1"
  local fixture_case="$2"
  local expected="$3"
  local api_url="${4:-https://api.staging.fanpass.test/health}"
  local console_url="${5:-https://console.staging.fanpass.test/}"
  local trust_proxy_hops="${6-1}"
  local tmp_dir
  local status
  local output

  tmp_dir="$(mktemp -d)"
  mkdir -p "$tmp_dir/bin"
  write_fake_curl "$tmp_dir/bin/curl"
  write_fake_node "$tmp_dir/bin/node"
  chmod +x "$tmp_dir/bin/curl" "$tmp_dir/bin/node"

  set +e
  output="$(
    FANPASS_STAGING_RUNTIME_SELF_TEST_CASE="$fixture_case" \
      PATH="$tmp_dir/bin:$PATH" \
      STAGING_API_URL="$api_url" \
      STAGING_CONSOLE_URL="$console_url" \
      STAGING_API_TRUST_PROXY_HOPS="$trust_proxy_hops" \
      STAGING_ADMIN_ACCESS_TOKEN="fixture-admin-token" \
      bash "$CHECK_SCRIPT" 2>&1
  )"
  status=$?
  set -e

  rm -rf "$tmp_dir"

  if [[ "$expected" == "pass" && "$status" -eq 0 ]]; then
    printf '{"label":"%s","expected":"pass","status":0}\n' "$label"
    return 0
  fi

  if [[ "$expected" == "fail" && "$status" -ne 0 ]]; then
    printf '{"label":"%s","expected":"fail","status":%s}\n' "$label" "$status"
    return 0
  fi

  printf 'Case failed: %s\nExpected: %s\nStatus: %s\nOutput:\n%s\n' \
    "$label" "$expected" "$status" "$output" >&2
  return 1
}

write_fake_curl() {
  local target="$1"
  cat >"$target" <<'FAKE_CURL'
#!/usr/bin/env bash
set -euo pipefail

fixture_case="${FANPASS_STAGING_RUNTIME_SELF_TEST_CASE:-accept}"
args=" $* "

api_headers() {
  printf 'HTTP/1.1 200 OK\r\n'
  if [[ "$fixture_case" != "missing-api-content-type-options" ]]; then
    printf 'x-content-type-options: nosniff\r\n'
  fi
  printf 'x-frame-options: DENY\r\n'
  printf 'referrer-policy: no-referrer\r\n'
  printf 'cross-origin-opener-policy: same-origin\r\n'
  if [[ "$fixture_case" != "missing-api-hsts" ]]; then
    printf 'strict-transport-security: max-age=15552000; includeSubDomains\r\n'
  fi
  if [[ "$fixture_case" == "api-powered-by" ]]; then
    printf 'x-powered-by: Express\r\n'
  fi
  printf '\r\n'
}

console_headers() {
  printf 'HTTP/1.1 200 OK\r\n'
  printf 'x-content-type-options: nosniff\r\n'
  printf 'x-frame-options: DENY\r\n'
  printf 'referrer-policy: no-referrer\r\n'
  if [[ "$fixture_case" != "missing-console-coop" ]]; then
    printf 'cross-origin-opener-policy: same-origin\r\n'
  fi
  if [[ "$fixture_case" != "missing-console-hsts" ]]; then
    printf 'strict-transport-security: max-age=15552000; includeSubDomains\r\n'
  fi
  printf 'permissions-policy: camera=()\r\n'
  if [[ "$fixture_case" != "missing-console-csp" ]]; then
    printf "content-security-policy: default-src 'self'\r\n"
  fi
  printf '\r\n'
}

write_to_o_file() {
  local body="$1"
  local file=""
  local previous=""
  for arg in "$@"; do
    if [[ "$previous" == "-o" ]]; then
      file="$arg"
      break
    fi
    previous="$arg"
  done
  if [[ -n "$file" ]]; then
    printf '%s' "$body" >"$file"
  fi
}

if [[ "$args" == *" -fsSI "* && "$args" == *"api.staging.fanpass.test/health"* ]]; then
  api_headers
  exit 0
fi

if [[ "$args" == *" -fsSI "* && "$args" == *"console.staging.fanpass.test/"* ]]; then
  console_headers
  exit 0
fi

if [[ "$args" == *"/api/console/operations"* ]]; then
  if [[ "$fixture_case" == "console-unlocked" ]]; then
    write_to_o_file '{"ok":true,"events":[]}' "$@"
    printf '200'
  else
    write_to_o_file '{"ok":false,"message":"FanPass Console requires organizer/admin authentication"}' "$@"
    printf '401'
  fi
  exit 0
fi

if [[ "$args" == *" -fsS "* && "$args" == *"console.staging.fanpass.test/"* ]]; then
  printf '<html><title>FanPass Console</title><body><div id="root"></div></body></html>'
  exit 0
fi

if [[ "$args" == *"/auth/demo-session"* ]]; then
  write_to_o_file '{"ok":false}' "$@"
  if [[ "$fixture_case" == "demo-session-allowed" ]]; then
    printf '200'
  else
    printf '401'
  fi
  exit 0
fi

if [[ "$args" == *"/alpha/side-effects/health"* ]]; then
  write_to_o_file '{"ok":false}' "$@"
  if [[ "$fixture_case" == "unauth-health-allowed" ]]; then
    printf '200'
  else
    printf '401'
  fi
  exit 0
fi

printf 'unexpected fake curl invocation: %s\n' "$*" >&2
exit 2
FAKE_CURL
}

write_fake_node() {
  local target="$1"
  cat >"$target" <<'FAKE_NODE'
#!/usr/bin/env bash
set -euo pipefail

fixture_case="${FANPASS_STAGING_RUNTIME_SELF_TEST_CASE:-accept}"

if [[ "${1:-}" == "-e" ]]; then
  url="${3:-}"
  protocol="${url%%://*}"
  rest="${url#*://}"
  host="${rest%%/*}"
  printf '%s://%s\n' "$protocol" "$host"
  exit 0
fi

script="$(cat)"

if [[ -n "${HEALTH_BODY_PATH:-}" ]]; then
  if [[ "$fixture_case" == "admin-health-private-payload" ]]; then
    printf '{"ok":true,"checkedAt":"2026-05-30T00:00:00.000Z","thresholds":{},"payloadJson":{}}' >"$HEALTH_BODY_PATH"
    printf 'Side-effect health response contains forbidden private field marker: payloadjson\n' >&2
    exit 1
  fi
  printf '{"ok":true,"checkedAt":"2026-05-30T00:00:00.000Z","thresholds":{}}' >"$HEALTH_BODY_PATH"
  exit 0
fi

if [[ "$script" == *"socket.io-client"* ]]; then
  if [[ "$fixture_case" == "orderbook-origin-failed" ]]; then
    printf 'Disallowed origin unexpectedly connected to orderbook feed\n' >&2
    exit 1
  fi
  exit 0
fi

cat <<JSON
{
  "ok": true,
  "checkedAt": "2026-05-30T00:00:00.000Z",
  "apiUrl": "${STAGING_API_URL:-}",
  "consoleUrl": "${STAGING_CONSOLE_URL:-}",
  "localDryRun": false,
  "orderbook": {
    "subscriptionTargetRedacted": true,
    "allowedOrigin": "${SOCKET_ALLOWED_ORIGIN:-https://console.staging.fanpass.test}"
  },
  "adminSideEffectHealth": "admin side-effect outbox health ok",
  "checked": {
    "api": ["x-content-type-options"],
    "console": ["content-security-policy"]
  }
}
JSON
FAKE_NODE
}

results=()
failures=0

add_case() {
  local result
  if result="$(run_case "$@")"; then
    results+=("$result")
  else
    failures=1
  fi
}

add_case "accepts deployed-style staging runtime evidence" "accept" "pass"
add_case "rejects non-HTTPS staging URLs without local override" "accept" "fail" "http://api.local/health" "https://console.staging.fanpass.test/"
add_case "rejects missing API trust proxy hop evidence" "accept" "fail" "https://api.staging.fanpass.test/health" "https://console.staging.fanpass.test/" ""
add_case "rejects invalid API trust proxy hop evidence" "accept" "fail" "https://api.staging.fanpass.test/health" "https://console.staging.fanpass.test/" "9"
add_case "rejects missing API content-type hardening header" "missing-api-content-type-options" "fail"
add_case "rejects missing API strict transport security header" "missing-api-hsts" "fail"
add_case "rejects API powered-by disclosure" "api-powered-by" "fail"
add_case "rejects missing Console cross-origin opener policy header" "missing-console-coop" "fail"
add_case "rejects missing Console strict transport security header" "missing-console-hsts" "fail"
add_case "rejects missing Console CSP header" "missing-console-csp" "fail"
add_case "rejects staging demo-session issuance" "demo-session-allowed" "fail"
add_case "rejects unauthenticated side-effect health access" "unauth-health-allowed" "fail"
add_case "rejects unlocked unauthenticated Console render" "console-unlocked" "fail"
add_case "rejects private payload markers in admin health" "admin-health-private-payload" "fail"
add_case "rejects orderbook origin check failure" "orderbook-origin-failed" "fail"

if [[ "$failures" -ne 0 ]]; then
  exit 1
fi

printf '{\n  "ok": true,\n  "cases": [\n'
for index in "${!results[@]}"; do
  printf '    %s' "${results[$index]}"
  if [[ "$index" -lt $((${#results[@]} - 1)) ]]; then
    printf ','
  fi
  printf '\n'
done
printf '  ]\n}\n'
