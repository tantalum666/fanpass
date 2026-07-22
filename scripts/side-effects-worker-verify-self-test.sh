#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERIFY_SCRIPT="$ROOT_DIR/scripts/side-effects-worker-verify.sh"
REAL_NODE="$(command -v node)"

run_case() {
  local label="$1"
  local mode="$2"
  local expected="$3"
  local tmp_dir
  local script_under_test
  local output
  local status
  local worker_runs
  local mock_worker_runs
  local pause_script_runs
  local exit_trap_markers
  local trap_clear_markers

  tmp_dir="$(mktemp -d)"
  mkdir -p "$tmp_dir/bin" "$tmp_dir/scripts" "$tmp_dir/apps/api"
  : >"$tmp_dir/node.log"
  script_under_test="$tmp_dir/scripts/side-effects-worker-verify.sh"
  cp "$VERIFY_SCRIPT" "$script_under_test"
  cp "$ROOT_DIR/scripts/alpha-db-reset.sh" "$tmp_dir/scripts/alpha-db-reset.sh"
  mutate_script "$script_under_test" "$mode"
  write_fake_tools "$tmp_dir/bin"

  set +e
  output="$(
    PATH="$tmp_dir/bin:$PATH" \
      TMPDIR="$tmp_dir" \
      DATABASE_URL="postgresql://fanpass:fanpass@localhost:5432/fanpass" \
      FANPASS_NODE_BIN="$tmp_dir/bin/node" \
      FANPASS_REAL_NODE="$REAL_NODE" \
      FANPASS_SKIP_DOCKER_POSTGRES="true" \
      /bin/bash "$script_under_test" 2>&1
  )"
  status=$?
  set -e

  local passed=0
  if [[ "$status" -eq 0 ]]; then
    passed=1
  fi
  worker_runs="$(grep -c "worker-run" "$tmp_dir/node.log" || true)"
  mock_worker_runs="$(grep -c "OWNERSHIP_ADAPTER=mock worker-run" "$tmp_dir/node.log" || true)"
  pause_script_runs="$(grep -c '^pause$' "$tmp_dir/node.log" || true)"
  exit_trap_markers="$(grep -c '^trap pause_dispatch_best_effort EXIT$' "$script_under_test" || true)"
  trap_clear_markers="$(grep -c '^trap - EXIT$' "$script_under_test" || true)"
  if [[ "$worker_runs" -ne 2 || "$mock_worker_runs" -ne 2 || "$pause_script_runs" -ne 1 || "$exit_trap_markers" -ne 1 || "$trap_clear_markers" -ne 1 ]]; then
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
    if ! grep -q "db-reset" "$tmp_dir/node.log"; then
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
      perl -0pi -e 's/(FANPASS_DATA_SOURCE=prisma OWNERSHIP_ADAPTER=mock DATABASE_URL="\$DATABASE_URL" \\\n    "\$NODE_BIN" "\$TS_NODE_CLI" src\/workers\/side-effect-worker-once\.ts\n)  FANPASS_DATA_SOURCE=prisma OWNERSHIP_ADAPTER=mock DATABASE_URL="\$DATABASE_URL" \\\n    "\$NODE_BIN" "\$TS_NODE_CLI" src\/workers\/side-effect-worker-once\.ts\n/$1/' "$script_path"
      ;;
    missing-mock-ownership-isolation)
      perl -0pi -e 's/OWNERSHIP_ADAPTER=mock //g' "$script_path"
      ;;
    missing-finalization-check)
      perl -0pi -e 's/ownership-finalize:/ownership-finalize-missing:/g' "$script_path"
      ;;
    missing-ticket-order-settlement-check)
      perl -0pi -e 's/ticket\.ownerId/ticket.removedOwnerId/g; s/buyOrder\.status/buyOrder.removedStatus/g' "$script_path"
      ;;
    missing-local-dispatch-open)
      perl -0pi -e 's/const opened = await prisma\.sideEffectDispatchControl\.updateMany\(\{.*?\n\}\);\nif \(opened\.count !== 1\) \{.*?\n\}\n//s' "$script_path"
      ;;
    missing-fail-safe-pause)
      perl -0pi -e 's/trap pause_dispatch_best_effort EXIT/trap - EXIT/' "$script_path"
      ;;
    missing-safe-default-assertion)
      perl -0pi -e 's/dispatchControl\.paused !== true/dispatchControl.paused === true/' "$script_path"
      ;;
    missing-dispatch-cas)
      perl -0pi -e 's/revision: dispatchControl\.revision,/revision: { not: dispatchControl.revision },/' "$script_path"
      ;;
    missing-success-pause-proof)
      perl -0pi -e 's/trap - EXIT/trap pause_dispatch_best_effort EXIT/' "$script_path"
      ;;
    missing-ownership-snapshot)
      perl -0pi -e 's/      \.\.\.localDemoOwnershipSnapshot,\n//g' "$script_path"
      ;;
    *)
      printf 'Unknown mode: %s\n' "$mode" >&2
      exit 1
      ;;
  esac
}

write_fake_tools() {
  local bin_dir="$1"

  cat >"$bin_dir/node" <<'FAKE_NODE'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$#" -gt 0 ]]; then
  if [[ "$*" == *'src/workers/side-effect-worker-once.ts'* ]]; then
    printf 'OWNERSHIP_ADAPTER=%s worker-run %s\n' "${OWNERSHIP_ADAPTER:-}" "$*" >>"${TMPDIR}/node.log"
  elif [[ "$*" == *'/node_modules/prisma/build/index.js'* || "$*" == *'prisma/seed-alpha.ts'* ]]; then
    printf 'db-reset %s\n' "$*" >>"${TMPDIR}/node.log"
  else
    printf 'unexpected-node-args %s\n' "$*" >>"${TMPDIR}/node.log"
    exit 1
  fi
  exit 0
fi
script="$(cat)"
errors=()

if [[ "$script" == *'const allowedProtocols = new Set(["postgres:", "postgresql:"])'* ]]; then
  printf '%s\n' "$script" | "$FANPASS_REAL_NODE"
  exit $?
fi

require_marker() {
  local marker="$1"
  local message="$2"
  if [[ "$script" != *"$marker"* ]]; then
    errors+=("$message")
  fi
}

if [[ "$script" == *"Local side-effect dispatch fence was not open before the required pause"* ]]; then
  require_marker 'FANPASS_REQUIRE_OPEN_DISPATCH' "pause step must distinguish strict success proof from best-effort cleanup"
  require_marker 'sideEffectDispatchControl.updateMany' "pause step must use a compare-and-swap update"
  require_marker 'revision: control.revision' "pause step must compare-and-swap the dispatch revision"
  require_marker 'paused: true' "pause step must restore the safe paused state"
  require_marker 'remainingClaims: null' "pause step must clear any probe budget"
  require_marker 'probeJobId: null' "pause step must clear any bound probe"
  require_marker 'finalControl.paused !== true' "pause step must verify the final paused state"
  printf 'pause\n' >>"${TMPDIR}/node.log"
elif [[ "$script" == *"sideEffectOutbox.create"* ]]; then
  snapshot_uses="$(printf '%s\n' "$script" | grep -cF '...localDemoOwnershipSnapshot' || true)"
  if [[ "$snapshot_uses" -ne 3 ]]; then
    errors+=("every synthetic ownership job must carry the immutable adapter and contract route snapshot")
  fi
  require_marker 'ownershipAdapter: "mock"' "seed step must bind jobs to the isolated mock ownership adapter"
  require_marker 'contractAddress: "0x0000000000000000000000000000000000003137"' "seed step must use the disposable local demo contract route"
  require_marker 'chainId: "31337"' "seed step must bind the local demo ownership chain"
  require_marker 'contractVersion: "fanpass-ticket-v1"' "seed step must bind the supported ownership contract version"
  require_marker 'id: "sfx_worker_verify"' "seed step must create the direct ownership transfer worker job"
  require_marker 'id: "sfx_worker_stale_recovery"' "seed step must create a stale PROCESSING recovery job"
  require_marker 'status: "PROCESSING"' "seed step must mark the stale recovery job as PROCESSING"
  require_marker 'lockedAt: new Date(Date.now() - 10 * 60 * 1000)' "seed step must make the stale recovery lock old enough to recover"
  require_marker 'id: "sfx_worker_async_transfer"' "seed step must create the async ownership transfer saga job"
  require_marker 'status: "TRANSFER_PENDING"' "seed step must put the ticket into transfer-pending state"
  require_marker 'status: "MATCHED"' "seed step must put async buy/sell orders into matched state"
  require_marker 'sideEffectDispatchControl.update' "seed step must explicitly open the local dispatch fence"
  require_marker 'paused: false' "seed step must open local dispatch only for the worker fixture"
  require_marker 'dispatchControl.paused !== true' "seed step must require the safe paused default"
  require_marker 'revision: dispatchControl.revision' "seed step must compare-and-swap the dispatch revision"
  require_marker 'remainingClaims: null' "seed step must reject an armed dispatch probe"
  require_marker 'probeJobId: null' "seed step must reject a bound dispatch probe"
  require_marker 'opened.count !== 1' "seed step must verify the dispatch compare-and-swap"
  require_marker 'dispatchRevision: dispatchControl.revision + 1n' "seed step must bind the stale claim to the open dispatch revision"
  require_marker 'staleClaim.count !== 1' "seed step must verify the stale recovery claim transition"
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
  require_marker 'ticket.ownershipContractAddress !== "0x0000000000000000000000000000000000003137"' "verification step must assert the immutable ticket contract address"
  require_marker 'ticket.ownershipChainId !== "31337"' "verification step must assert the immutable ticket chain"
  require_marker 'ticket.ownershipContractVersion !== "fanpass-ticket-v1"' "verification step must assert the immutable ticket contract version"
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

if [[ "$script" == *"Local side-effect dispatch fence was not open before the required pause"* ]]; then
  printf '{"ok":true,"control":{"paused":true}}\n'
else
  printf '{ "ok": true, "fixtureVerified": true }\n'
fi
FAKE_NODE

  chmod +x "$bin_dir/node"
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
add_case "rejects worker runs without mock ownership isolation" "missing-mock-ownership-isolation" "fail"
add_case "rejects missing ownership finalization check" "missing-finalization-check" "fail"
add_case "rejects missing ticket/order settlement checks" "missing-ticket-order-settlement-check" "fail"
add_case "rejects a worker fixture that never opens local dispatch" "missing-local-dispatch-open" "fail"
add_case "rejects a worker fixture without fail-safe dispatch pause" "missing-fail-safe-pause" "fail"
add_case "rejects a worker fixture without the safe default assertion" "missing-safe-default-assertion" "fail"
add_case "rejects a worker fixture without dispatch revision CAS" "missing-dispatch-cas" "fail"
add_case "rejects a worker fixture without successful pause proof" "missing-success-pause-proof" "fail"
add_case "rejects ownership jobs without immutable snapshots" "missing-ownership-snapshot" "fail"

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
