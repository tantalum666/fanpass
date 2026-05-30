#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERIFY_SCRIPT="$ROOT_DIR/scripts/side-effects-worker-verify.sh"

run_case() {
  local label="$1"
  local mode="$2"
  local expected="$3"
  local tmp_dir
  local script_under_test
  local output
  local status
  local worker_runs

  tmp_dir="$(mktemp -d)"
  mkdir -p "$tmp_dir/bin"
  : >"$tmp_dir/npm.log"
  script_under_test="$tmp_dir/side-effects-worker-verify.sh"
  cp "$VERIFY_SCRIPT" "$script_under_test"
  mutate_script "$script_under_test" "$mode"
  write_fake_tools "$tmp_dir/bin"

  set +e
  output="$(
    PATH="$tmp_dir/bin:$PATH" \
      TMPDIR="$tmp_dir" \
      DATABASE_URL="postgresql://fanpass:fanpass@localhost:5432/fanpass" \
      bash "$script_under_test" 2>&1
  )"
  status=$?
  set -e

  local passed=0
  if [[ "$status" -eq 0 ]]; then
    passed=1
  fi
  worker_runs="$(grep -c "side-effects:work-once" "$tmp_dir/npm.log" || true)"
  if [[ "$worker_runs" -ne 2 ]]; then
    passed=0
    status=1
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
    if ! grep -q "alpha:db:reset" "$tmp_dir/npm.log"; then
      printf 'Case failed: %s\n- verifier must reset Alpha Prisma state before worker checks\n' "$label" >&2
      rm -rf "$tmp_dir"
      return 1
    fi
    if [[ "$worker_runs" -ne 2 ]]; then
      printf 'Case failed: %s\n- verifier must run side-effects:work-once twice; saw %s\n' "$label" "$worker_runs" >&2
      rm -rf "$tmp_dir"
      return 1
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
    default)
      ;;
    missing-stale-recovery)
      perl -0pi -e 's/sfx_worker_stale_recovery/sfx_worker_stale_missing/g' "$script_path"
      ;;
    missing-second-worker-run)
      perl -0pi -e 's/FANPASS_DATA_SOURCE=prisma DATABASE_URL="\$DATABASE_URL" npm run side-effects:work-once -w \@fanpass\/api\nFANPASS_DATA_SOURCE=prisma DATABASE_URL="\$DATABASE_URL" npm run side-effects:work-once -w \@fanpass\/api/FANPASS_DATA_SOURCE=prisma DATABASE_URL="\$DATABASE_URL" npm run side-effects:work-once -w \@fanpass\/api/' "$script_path"
      ;;
    missing-finalization-check)
      perl -0pi -e 's/ownership-finalize:/ownership-finalize-missing:/g' "$script_path"
      ;;
    missing-ticket-order-settlement-check)
      perl -0pi -e 's/ticket\.ownerId/ticket.removedOwnerId/g; s/buyOrder\.status/buyOrder.removedStatus/g' "$script_path"
      ;;
    *)
      printf 'Unknown mode: %s\n' "$mode" >&2
      exit 1
      ;;
  esac
}

write_fake_tools() {
  local bin_dir="$1"

  cat >"$bin_dir/npm" <<'FAKE_NPM'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"${TMPDIR}/npm.log"
exit 0
FAKE_NPM

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

if [[ "$script" == *"sideEffectOutbox.create"* ]]; then
  require_marker 'id: "sfx_worker_verify"' "seed step must create the direct ownership transfer worker job"
  require_marker 'id: "sfx_worker_stale_recovery"' "seed step must create a stale PROCESSING recovery job"
  require_marker 'status: "PROCESSING"' "seed step must mark the stale recovery job as PROCESSING"
  require_marker 'lockedAt: new Date(Date.now() - 10 * 60 * 1000)' "seed step must make the stale recovery lock old enough to recover"
  require_marker 'id: "sfx_worker_async_transfer"' "seed step must create the async ownership transfer saga job"
  require_marker 'status: "TRANSFER_PENDING"' "seed step must put the ticket into transfer-pending state"
  require_marker 'status: "MATCHED"' "seed step must put async buy/sell orders into matched state"
else
  require_marker 'id: "sfx_worker_verify"' "verification step must load the direct ownership transfer job"
  require_marker 'id: "sfx_worker_async_transfer"' "verification step must load the async transfer job"
  require_marker 'id: "sfx_worker_stale_recovery"' "verification step must load the stale recovery job"
  require_marker 'idempotencyKey: "ownership-finalize:ord_worker_async_buy:ord_worker_async_sell"' "verification step must load the ownership finalization job"
  require_marker 'job.status !== "COMPLETED"' "verification step must assert direct job completion"
  require_marker 'transferJob.status !== "COMPLETED"' "verification step must assert async transfer completion"
  require_marker 'staleJob.status !== "COMPLETED" || staleJob.attempts !== 2' "verification step must assert stale job recovered and retried"
  require_marker 'finalizeJob.status !== "COMPLETED"' "verification step must assert finalization job completion"
  require_marker 'trade.settlementStatus !== "SETTLED"' "verification step must assert settled trade status"
  require_marker 'ticket.ownerId !== "usr_buyer_demo" || ticket.status !== "TRANSFERRED"' "verification step must assert ticket owner and status"
  require_marker 'buyOrder.status !== "SETTLED" || sellOrder.status !== "SETTLED"' "verification step must assert buy and sell orders settle"
fi

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

printf '{ "ok": true, "fixtureVerified": true }\n'
FAKE_NODE

  chmod +x "$bin_dir/npm" "$bin_dir/node"
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

add_case "accepts side-effect worker verifier semantics" "default" "pass"
add_case "rejects missing stale processing recovery fixture" "missing-stale-recovery" "fail"
add_case "rejects missing second worker pass" "missing-second-worker-run" "fail"
add_case "rejects missing ownership finalization check" "missing-finalization-check" "fail"
add_case "rejects missing ticket/order settlement checks" "missing-ticket-order-settlement-check" "fail"

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
