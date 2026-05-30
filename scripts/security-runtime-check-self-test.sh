#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CHECK_SCRIPT="$ROOT_DIR/scripts/security-runtime-check.sh"

run_case() {
  local label="$1"
  local fixture_case="$2"
  local expected="$3"
  local tmp_dir
  local status
  local output

  tmp_dir="$(mktemp -d)"
  mkdir -p "$tmp_dir/bin"
  cat >"$tmp_dir/bin/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
set -euo pipefail

fixture_case="${FANPASS_RUNTIME_SELF_TEST_CASE:-accept}"
args=" $* "

api_headers() {
  printf 'HTTP/1.1 200 OK\r\n'
  if [[ "$fixture_case" != "missing-api-content-type-options" ]]; then
    printf 'x-content-type-options: nosniff\r\n'
  fi
  printf 'x-frame-options: DENY\r\n'
  printf 'referrer-policy: no-referrer\r\n'
  printf 'cross-origin-opener-policy: same-origin\r\n'
  if [[ "$fixture_case" == "api-powered-by" ]]; then
    printf 'x-powered-by: Express\r\n'
  fi
  printf '\r\n'
}

auth_privy_headers() {
  printf 'HTTP/1.1 400 Bad Request\r\n'
  if [[ "$fixture_case" != "missing-auth-ratelimit-policy" ]]; then
    printf 'ratelimit-policy: 5;w=60\r\n'
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
  printf 'permissions-policy: camera=()\r\n'
  if [[ "$fixture_case" != "missing-console-csp" ]]; then
    printf "content-security-policy: default-src 'self'\r\n"
  fi
  if [[ "$fixture_case" == "console-powered-by" ]]; then
    printf 'x-powered-by: Next.js\r\n'
  fi
  printf '\r\n'
}

if [[ "$args" == *"/auth/privy/sync"* ]]; then
  dump_file=""
  previous=""
  for arg in "$@"; do
    if [[ "$previous" == "-D" ]]; then
      dump_file="$arg"
      break
    fi
    previous="$arg"
  done
  if [[ -z "$dump_file" ]]; then
    printf 'fake curl expected -D <headers-file> for auth request\n' >&2
    exit 2
  fi
  auth_privy_headers >"$dump_file"
  exit 0
fi

if [[ "$args" == *"http://api.local/health"* ]]; then
  api_headers
  exit 0
fi

if [[ "$args" == *"http://console.local/"* ]]; then
  console_headers
  exit 0
fi

printf 'unexpected fake curl invocation: %s\n' "$*" >&2
exit 2
FAKE_CURL
  chmod +x "$tmp_dir/bin/curl"

  set +e
  output="$(
    FANPASS_RUNTIME_SELF_TEST_CASE="$fixture_case" \
      PATH="$tmp_dir/bin:$PATH" \
      API_URL="http://api.local/health" \
      CONSOLE_URL="http://console.local/" \
      bash "$CHECK_SCRIPT" 2>&1
  )"
  status=$?
  set -e

  rm -rf "$tmp_dir"

  if [[ "$expected" == "pass" && "$status" -eq 0 ]]; then
    printf '{"label":%s,"expected":"pass","status":0}\n' "$(json_string "$label")"
    return 0
  fi

  if [[ "$expected" == "fail" && "$status" -ne 0 ]]; then
    printf '{"label":%s,"expected":"fail","status":%s}\n' "$(json_string "$label")" "$status"
    return 0
  fi

  printf 'Case failed: %s\nExpected: %s\nStatus: %s\nOutput:\n%s\n' \
    "$label" "$expected" "$status" "$output" >&2
  return 1
}

json_string() {
  node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"
}

cases_json=()
while IFS= read -r result; do
  cases_json+=("$result")
done < <(
  run_case "accepts required API, Console, and Privy auth headers" "accept" "pass"
  run_case "rejects missing API content-type hardening header" "missing-api-content-type-options" "fail"
  run_case "rejects API powered-by disclosure" "api-powered-by" "fail"
  run_case "rejects missing Privy auth rate-limit policy header" "missing-auth-ratelimit-policy" "fail"
  run_case "rejects missing Console cross-origin opener policy header" "missing-console-coop" "fail"
  run_case "rejects missing Console CSP header" "missing-console-csp" "fail"
  run_case "rejects Console powered-by disclosure" "console-powered-by" "fail"
)

printf '{\n  "ok": true,\n  "cases": [\n'
for index in "${!cases_json[@]}"; do
  printf '    %s' "${cases_json[$index]}"
  if [[ "$index" -lt $((${#cases_json[@]} - 1)) ]]; then
    printf ','
  fi
  printf '\n'
done
printf '  ]\n}\n'
