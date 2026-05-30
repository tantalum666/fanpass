#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
START_SCRIPT="$ROOT_DIR/scripts/beta-local-start.sh"

run_case() {
  local label="$1"
  local mode="$2"
  local expected="$3"
  local tmp_dir
  local status
  local output

  tmp_dir="$(mktemp -d)"
  mkdir -p "$tmp_dir/bin"
  : >"$tmp_dir/screen.log"
  : >"$tmp_dir/npm.log"
  write_fake_tools "$tmp_dir/bin"

  set +e
  output="$(
    PATH="$tmp_dir/bin:$PATH" \
      TMPDIR="$tmp_dir" \
      FANPASS_BETA_LOCAL_START_SELF_TEST_MODE="$mode" \
      FANPASS_BETA_USE_STRIPE="$([ "$mode" = "stripe-opt-in" ] && printf true || printf false)" \
      STRIPE_SECRET_KEY="stripe_fixture_secret_must_not_leak_by_default" \
      STRIPE_WEBHOOK_SECRET="stripe_webhook_fixture_secret_must_not_leak_by_default" \
      BETA_LOCAL_API_PORT=4100 \
      BETA_LOCAL_CONSOLE_PORT=3100 \
      DATABASE_URL="postgresql://fanpass:fanpass@localhost:5432/fanpass" \
      bash "$START_SCRIPT" 2>&1
  )"
  status=$?
  set -e

  if [[ "$status" -ne 0 ]]; then
    printf 'Case failed during startup: %s\nStatus: %s\nOutput:\n%s\n' \
      "$label" "$status" "$output" >&2
    rm -rf "$tmp_dir"
    return 1
  fi

  local screen_log="$tmp_dir/screen.log"
  local npm_log="$tmp_dir/npm.log"
  local errors=()

  if [[ "$expected" == "clears-stripe" ]]; then
    if grep -q "stripe_fixture_secret_must_not_leak_by_default\|stripe_webhook_fixture_secret_must_not_leak_by_default" "$screen_log"; then
      errors+=("default local start must not forward inherited Stripe secret values")
    fi
    if ! grep -q "STRIPE_SECRET_KEY=''" "$screen_log"; then
      errors+=("default local start must pass an empty Stripe secret key into service screens")
    fi
    if ! grep -q "STRIPE_WEBHOOK_SECRET=''" "$screen_log"; then
      errors+=("default local start must pass an empty Stripe webhook secret into service screens")
    fi
  fi

  if [[ "$expected" == "forwards-opt-in" ]]; then
    if ! grep -q "STRIPE_SECRET_KEY='stripe_fixture_secret_must_not_leak_by_default'" "$screen_log"; then
      errors+=("Stripe opt-in mode must forward the configured Stripe secret key")
    fi
    if ! grep -q "STRIPE_WEBHOOK_SECRET='stripe_webhook_fixture_secret_must_not_leak_by_default'" "$screen_log"; then
      errors+=("Stripe opt-in mode must forward the configured Stripe webhook secret")
    fi
  fi

  for required in \
    "FANPASS_REQUIRE_PAYMENT_AUTHORIZATION=true" \
    "FANPASS_ASYNC_OWNERSHIP_SETTLEMENT=true" \
    "FANPASS_ENABLE_PAYMENTS=false" \
    "FANPASS_ENABLE_DEMO_AUTH=true"; do
    if ! grep -q "$required" "$screen_log"; then
      errors+=("local start screen commands must include $required")
    fi
  done

  if [[ "$mode" == "skip-db-reset" ]]; then
    if grep -q "alpha:db:reset" "$npm_log"; then
      errors+=("skip-db-reset mode must not invoke alpha:db:reset")
    fi
  else
    if ! grep -q "alpha:db:reset" "$npm_log"; then
      errors+=("local start must reset the Alpha database by default")
    fi
  fi

  if [[ "${#errors[@]}" -gt 0 ]]; then
    printf 'Case failed: %s\n' "$label" >&2
    printf -- '- %s\n' "${errors[@]}" >&2
    rm -rf "$tmp_dir"
    return 1
  fi

  printf '{"label":"%s","status":0}\n' "$label"
  rm -rf "$tmp_dir"
}

write_fake_tools() {
  local bin_dir="$1"

  cat >"$bin_dir/screen" <<'FAKE_SCREEN'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"${TMPDIR}/screen.log"
exit 0
FAKE_SCREEN

  cat >"$bin_dir/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
set -euo pipefail
args=" $* "
if [[ "$args" == *":4100/health"* ]]; then
  printf '{"ok":true}\n'
  exit 0
fi
if [[ "$args" == *":3100/"* ]]; then
  printf '<html>FanPass Console</html>\n'
  exit 0
fi
exit 1
FAKE_CURL

  cat >"$bin_dir/npm" <<'FAKE_NPM'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"${TMPDIR}/npm.log"
exit 0
FAKE_NPM

  cat >"$bin_dir/lsof" <<'FAKE_LSOF'
#!/usr/bin/env bash
set -euo pipefail
exit 1
FAKE_LSOF

  cat >"$bin_dir/kill" <<'FAKE_KILL'
#!/usr/bin/env bash
set -euo pipefail
exit 0
FAKE_KILL

  cat >"$bin_dir/sleep" <<'FAKE_SLEEP'
#!/usr/bin/env bash
set -euo pipefail
exit 0
FAKE_SLEEP

  chmod +x "$bin_dir/screen" "$bin_dir/curl" "$bin_dir/npm" "$bin_dir/lsof" "$bin_dir/kill" "$bin_dir/sleep"
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

add_case "clears inherited Stripe secrets by default" "default" "clears-stripe"
add_case "forwards Stripe secrets only when explicitly opted in" "stripe-opt-in" "forwards-opt-in"
FANPASS_BETA_SKIP_DB_RESET=true add_case "respects explicit DB reset skip" "skip-db-reset" "clears-stripe"

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
