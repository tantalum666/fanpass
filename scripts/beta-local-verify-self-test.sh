#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERIFY_SCRIPT="$ROOT_DIR/scripts/beta-local-verify.sh"

run_case() {
  local label="$1"
  local mode="$2"
  local expected="$3"
  local tmp_dir
  local status
  local output
  local script_under_test

  tmp_dir="$(mktemp -d)"
  mkdir -p "$tmp_dir/bin"
  : >"$tmp_dir/npm.log"
  script_under_test="$tmp_dir/beta-local-verify.sh"
  cp "$VERIFY_SCRIPT" "$script_under_test"
  mutate_script "$script_under_test" "$mode"
  write_fake_tools "$tmp_dir/bin"

  set +e
  output="$(
    PATH="$tmp_dir/bin:$PATH" \
      TMPDIR="$tmp_dir" \
      API_BASE_URL="http://localhost:4100" \
      CONSOLE_URL="http://localhost:3100" \
      DATABASE_URL="postgresql://fanpass:fanpass@localhost:5432/fanpass" \
      FANPASS_BETA_VERIFY_SKIP_DB_RESET="$([ "$mode" = "skip-db-reset" ] && printf true || printf false)" \
      bash "$script_under_test" 2>&1
  )"
  status=$?
  set -e

  local passed=0
  if [[ "$status" -eq 0 ]]; then
    passed=1
  fi

  if [[ "$expected" == "pass" && "$passed" -ne 1 ]]; then
    printf 'Case failed unexpectedly: %s\nOutput:\n%s\n' "$label" "$output" >&2
    rm -rf "$tmp_dir"
    return 1
  fi
  if [[ "$expected" == "fail" && "$passed" -eq 1 ]]; then
    printf 'Case passed unexpectedly: %s\nOutput:\n%s\n' "$label" "$output" >&2
    rm -rf "$tmp_dir"
    return 1
  fi

  if [[ "$expected" == "pass" ]]; then
    if [[ "$mode" == "skip-db-reset" ]]; then
      if grep -q "alpha:db:reset" "$tmp_dir/npm.log"; then
        printf 'Case failed: %s\n- skip-db-reset mode must not run alpha:db:reset\n' "$label" >&2
        rm -rf "$tmp_dir"
        return 1
      fi
    else
      if ! grep -q "alpha:db:reset" "$tmp_dir/npm.log"; then
        printf 'Case failed: %s\n- default verifier must run alpha:db:reset\n' "$label" >&2
        rm -rf "$tmp_dir"
        return 1
      fi
    fi
  fi

  printf '{"label":"%s","expected":"%s","status":%s}\n' \
    "$label" "$expected" "$status"
  rm -rf "$tmp_dir"
}

mutate_script() {
  local script_path="$1"
  local mode="$2"

  case "$mode" in
    default | skip-db-reset)
      ;;
    missing-admin-health)
      perl -0pi -e 's|const sideEffectHealth = await request\("/alpha/side-effects/health"[\s\S]*?sideEffectHealthCheckedAt: sideEffectHealth\.checkedAt,\n||' "$script_path"
      ;;
    missing-async-finalize)
      perl -0pi -e 's/OWNERSHIP_SETTLEMENT_FINALIZE/OWNERSHIP_TRANSFER/g' "$script_path"
      ;;
    missing-capture-check)
      perl -0pi -e 's/const paymentCapture = snapshot\.sideEffects\?\.find[\s\S]*?return trade && capturedPayment && ownershipTransfer && ownershipFinalize && paymentCapture/return trade && capturedPayment && ownershipTransfer && ownershipFinalize/' "$script_path"
      ;;
    missing-health-redaction)
      perl -0pi -e 's/for \(const forbidden of \["payloadjson", "clientsecret", "invitetoken", "stripe_secret", "privy_verification_key"\]\) \{[\s\S]*?\n\}//' "$script_path"
      ;;
    *)
      printf 'Unknown mode: %s\n' "$mode" >&2
      exit 1
      ;;
  esac
}

write_fake_tools() {
  local bin_dir="$1"

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

  cat >"$bin_dir/sleep" <<'FAKE_SLEEP'
#!/usr/bin/env bash
set -euo pipefail
exit 0
FAKE_SLEEP

  cat >"$bin_dir/node" <<'FAKE_NODE'
#!/usr/bin/env bash
set -euo pipefail
script="$(cat)"
errors=()

require_marker() {
  local marker="$1"
  local message="$2"
  if [[ "$script" != *"$marker"* ]]; then
    errors+=("$message")
  fi
}

require_marker "ensureLocalAdminDemoUser" "verifier must create/use a local admin demo user for admin-only health"
require_marker 'demoToken("usr_admin_demo")' "verifier must request an admin demo bearer before admin-only health"
require_marker 'request("/alpha/side-effects/health"' "verifier must call admin-only side-effect health through the API"
require_marker 'auth(adminToken)' "side-effect health call must use admin bearer auth"
require_marker "async ownership settlement and captured local payment" "verifier must wait for async ownership and payment capture"
require_marker 'job.type === "OWNERSHIP_TRANSFER"' "verifier must require completed ownership transfer side effect"
require_marker 'job.type === "OWNERSHIP_SETTLEMENT_FINALIZE"' "verifier must require completed ownership finalization side effect"
require_marker 'job.type === "PAYMENT_CAPTURE"' "verifier must require completed payment capture side effect"
require_marker 'captureStatus === "CAPTURED"' "verifier must require captured local payment status"
require_marker "payloadjson" "health response redaction check must reject provider payload markers"
require_marker "clientsecret" "health response redaction check must reject payment client-secret markers"
require_marker "invitetoken" "health response redaction check must reject invite token markers"
require_marker "stripe_secret" "health response redaction check must reject Stripe secret markers"
require_marker "privy_verification_key" "health response redaction check must reject Privy verification key markers"

if [[ "${#errors[@]}" -gt 0 ]]; then
  printf '{\n  "ok": false,\n  "errors": [\n' >&2
  for index in "${!errors[@]}"; do
    printf '    "%s"' "${errors[$index]}" >&2
    if [[ "$index" -lt $((${#errors[@]} - 1)) ]]; then
      printf ',' >&2
    fi
    printf '\n' >&2
  done
  printf '  ]\n}\n' >&2
  exit 1
fi

printf '{\n  "ok": true,\n  "fixtureVerified": true\n}\n'
FAKE_NODE

  chmod +x "$bin_dir/curl" "$bin_dir/npm" "$bin_dir/sleep" "$bin_dir/node"
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

add_case "accepts local verifier semantics" "default" "pass"
add_case "honors explicit DB reset skip" "skip-db-reset" "pass"
add_case "rejects missing admin side-effect health check" "missing-admin-health" "fail"
add_case "rejects missing async ownership finalization check" "missing-async-finalize" "fail"
add_case "rejects missing payment capture side-effect check" "missing-capture-check" "fail"
add_case "rejects missing side-effect health redaction markers" "missing-health-redaction" "fail"

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
