#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="${FANPASS_ALPHA_WALKTHROUGH_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
OUTPUT_DIR="${FANPASS_ALPHA_WALKTHROUGH_OUTPUT_DIR:-$ROOT_DIR/outputs/alpha-walkthrough/$STAMP}"
COMMAND_LOG="$OUTPUT_DIR/commands.log"
MANIFEST="$OUTPUT_DIR/manifest.md"
CONSOLE_SCREENSHOT="$OUTPUT_DIR/fanpass-console.png"
STOPPED_LOCAL_STACK=false

mkdir -p "$OUTPUT_DIR"
: >"$COMMAND_LOG"

cleanup() {
  if [[ "$STOPPED_LOCAL_STACK" != "true" ]]; then
    (
      cd "$ROOT_DIR"
      npm run beta:local:stop >>"$COMMAND_LOG" 2>&1 || true
    )
    STOPPED_LOCAL_STACK=true
  fi
}

trap cleanup EXIT

run_step() {
  local label="$1"
  shift
  local log_file="$OUTPUT_DIR/${label}.log"
  {
    printf '\n[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$label"
    printf 'command:'
    printf ' %q' "$@"
    printf '\n'
  } >>"$COMMAND_LOG"
  (
    cd "$ROOT_DIR"
    "$@"
  ) >"$log_file" 2>&1
  scan_for_forbidden_markers "$log_file"
}

scan_for_forbidden_markers() {
  local file="$1"
  local forbidden=(
    "sk_live_"
    "sk_test_"
    "pk_live_"
    "whsec_"
    "-----BEGIN PRIVATE KEY-----"
    "PRIVY_VERIFICATION_KEY="
    "STRIPE_SECRET_KEY="
    "Authorization: Bearer "
  )
  local marker
  for marker in "${forbidden[@]}"; do
    if grep -Fq -- "$marker" "$file"; then
      echo "Forbidden marker found in $file: $marker" >&2
      exit 1
    fi
  done
}

run_step alpha-demo-script-audit npm run alpha:demo-script:audit
run_step alpha-walkthrough-evidence-audit npm run alpha:walkthrough:evidence:audit
run_step beta-foundation-verify npm run beta:foundation:verify
run_step beta-local-start npm run beta:local:start
run_step beta-local-verify npm run beta:local:verify
run_step console-visual-check env FANPASS_CONSOLE_SCREENSHOT="$CONSOLE_SCREENSHOT" npm run console:verify:local
run_step beta-local-stop npm run beta:local:stop
STOPPED_LOCAL_STACK=true

scan_for_forbidden_markers "$COMMAND_LOG"

cat >"$MANIFEST" <<EOF
# FanPass Alpha Walkthrough Capture

Captured at: $STAMP

Status: local evidence bundle captured; walkthrough recording remains open until a human-reviewed recording artifact exists.

## Local-only scope

- No real personal data.
- No production credentials.
- No Stripe secrets.
- No Privy secrets.
- No wallet private keys or production provider dashboards.

## Command evidence

- \`npm run alpha:demo-script:audit\` -> \`alpha-demo-script-audit.log\`
- \`npm run alpha:walkthrough:evidence:audit\` -> \`alpha-walkthrough-evidence-audit.log\`
- \`npm run beta:foundation:verify\` -> \`beta-foundation-verify.log\`
- \`npm run beta:local:start\` -> \`beta-local-start.log\`
- \`npm run beta:local:verify\` -> \`beta-local-verify.log\`
- \`npm run console:verify:local\` -> \`console-visual-check.log\`
- \`npm run beta:local:stop\` -> \`beta-local-stop.log\`

## Visual evidence

- FanPass Console screenshot: \`fanpass-console.png\`

## Seven-scene checklist

- Scene 1 - Product Boundary: pending human recording review.
- Scene 2 - Fan Discovery And Wallet: pending human recording review.
- Scene 3 - Marketplace And Settlement: local verifier evidence captured.
- Scene 4 - Fan Access: pending human recording review.
- Scene 5 - Console Operations: Console screenshot and verifier evidence captured.
- Scene 6 - FanPass Ops Entry: pending human recording review.
- Scene 7 - Security Boundary Close: pending human recording review.

## Remaining blockers

- Production tenant/staff staging evidence.
- Signed iOS/TestFlight staging evidence.
- Public/real-user dependency clean audit or Console migration.
- Signed Apple Wallet \`.pkpass\`.
- Physical QR/NFC device validation.
- Chain custody evidence.
EOF

scan_for_forbidden_markers "$MANIFEST"

echo "{\"ok\":true,\"outputDir\":\"$OUTPUT_DIR\",\"manifest\":\"$MANIFEST\",\"consoleScreenshot\":\"$CONSOLE_SCREENSHOT\"}"
