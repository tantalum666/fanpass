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
# This optional capture is not release evidence by itself. The verifier still
# uses the authoritative pre-Node environment boundary so a caller preload
# cannot turn the captured gate into false-success evidence.
REVIEWED_BETA_FOUNDATION_LAUNCHER_SHA256="377af7200bfffe357620315caf2c158d13a81de0ee3f2bad0e767731f8b4e47f"
run_step beta-foundation-verify \
  /usr/bin/env -i \
  HOME=/tmp \
  TMPDIR=/tmp \
  PATH=/opt/homebrew/opt/node@22/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  DATABASE_URL=postgresql://fanpass:fanpass@127.0.0.1:5432/fanpass \
  /opt/homebrew/opt/node@22/bin/node \
  -e 'const crypto=require("node:crypto"),fs=require("node:fs"),Module=require("node:module"),path=require("node:path");try{const relative=process.argv[1],expected=process.argv[2],requestedRoot=process.argv[3],root=fs.realpathSync(requestedRoot),cwd=fs.realpathSync(process.cwd());if(root!==cwd)throw new Error("Canonical workspace does not match the current directory");const file=path.join(root,relative),real=fs.realpathSync(file);if(real!==file)throw new Error("Launcher path contains a symlink or escapes the canonical workspace");const descriptor=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));let source;try{const stat=fs.fstatSync(descriptor);if(!stat.isFile())throw new Error("Launcher must be a regular file");source=fs.readFileSync(descriptor)}finally{fs.closeSync(descriptor)}const actual=crypto.createHash("sha256").update(source).digest("hex");if(actual!==expected)throw new Error("Launcher digest does not match the reviewed bytes");const loaded=new Module(file);loaded.filename=file;loaded.paths=Module._nodeModulePaths(path.dirname(file));loaded._compile(source.toString("utf8"),file);if(typeof loaded.exports.main!=="function")throw new Error("Launcher must export main");loaded.exports.main()}catch(error){console.error(`Beta foundation bootstrap failed: ${error instanceof Error?error.message:"unknown error"}`);process.exit(1)}' \
  scripts/beta-foundation-launcher.js \
  "$REVIEWED_BETA_FOUNDATION_LAUNCHER_SHA256" \
  "$ROOT_DIR"
run_step beta-local-start npm run beta:local:start
run_step beta-local-verify npm run beta:local:verify
run_step console-visual-check env FANPASS_CONSOLE_SCREENSHOT="$CONSOLE_SCREENSHOT" npm run console:verify:local
run_step beta-local-stop npm run beta:local:stop
STOPPED_LOCAL_STACK=true

scan_for_forbidden_markers "$COMMAND_LOG"

cat >"$MANIFEST" <<EOF
# FanPass Alpha Walkthrough Capture

Captured at: $STAMP

Status: local evidence bundle captured; walkthrough recording is owner-skipped for current Beta foundation.

## Local-only scope

- No real personal data.
- No production credentials.
- No Stripe secrets.
- No Privy secrets.
- No wallet private keys or production provider dashboards.

## Command evidence

- \`npm run alpha:demo-script:audit\` -> \`alpha-demo-script-audit.log\`
- \`npm run alpha:walkthrough:evidence:audit\` -> \`alpha-walkthrough-evidence-audit.log\`
- \`README.md authoritative env-i Node 22 gate\` -> \`beta-foundation-verify.log\`
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
