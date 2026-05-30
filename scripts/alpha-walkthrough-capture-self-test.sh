#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
BIN_DIR="$TMP_DIR/bin"
OUTPUT_DIR="$TMP_DIR/output"
COMMANDS_FILE="$TMP_DIR/npm-commands.log"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$BIN_DIR"

cat >"$BIN_DIR/npm" <<'FAKE_NPM'
#!/usr/bin/env bash
set -euo pipefail
echo "$*" >>"${FANPASS_FAKE_NPM_COMMANDS:?}"
if [[ "$*" == "run console:verify:local" ]]; then
  if [[ -z "${FANPASS_CONSOLE_SCREENSHOT:-}" ]]; then
    echo "FANPASS_CONSOLE_SCREENSHOT missing" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$FANPASS_CONSOLE_SCREENSHOT")"
  printf 'fake screenshot\n' >"$FANPASS_CONSOLE_SCREENSHOT"
fi
case "$*" in
  "run alpha:demo-script:audit" | \
  "run alpha:walkthrough:evidence:audit" | \
  "run beta:foundation:verify" | \
  "run beta:local:start" | \
  "run beta:local:verify" | \
  "run console:verify:local" | \
  "run beta:local:stop")
    echo "{\"ok\":true,\"command\":\"$*\"}"
    ;;
  *)
    echo "unexpected npm command: $*" >&2
    exit 1
    ;;
esac
FAKE_NPM
chmod +x "$BIN_DIR/npm"

PATH="$BIN_DIR:$PATH" \
  FANPASS_FAKE_NPM_COMMANDS="$COMMANDS_FILE" \
  FANPASS_ALPHA_WALKTHROUGH_STAMP="fixture" \
  FANPASS_ALPHA_WALKTHROUGH_OUTPUT_DIR="$OUTPUT_DIR" \
  bash "$ROOT_DIR/scripts/alpha-walkthrough-capture.sh" >/tmp/fanpass-alpha-walkthrough-capture-self-test.out

required_files=(
  "$OUTPUT_DIR/manifest.md"
  "$OUTPUT_DIR/commands.log"
  "$OUTPUT_DIR/alpha-demo-script-audit.log"
  "$OUTPUT_DIR/alpha-walkthrough-evidence-audit.log"
  "$OUTPUT_DIR/beta-foundation-verify.log"
  "$OUTPUT_DIR/beta-local-start.log"
  "$OUTPUT_DIR/beta-local-verify.log"
  "$OUTPUT_DIR/console-visual-check.log"
  "$OUTPUT_DIR/beta-local-stop.log"
  "$OUTPUT_DIR/fanpass-console.png"
)

for file in "${required_files[@]}"; do
  if [[ ! -s "$file" ]]; then
    echo "Expected capture output file missing or empty: $file" >&2
    exit 1
  fi
done

expected_commands=(
  "run alpha:demo-script:audit"
  "run alpha:walkthrough:evidence:audit"
  "run beta:foundation:verify"
  "run beta:local:start"
  "run beta:local:verify"
  "run console:verify:local"
  "run beta:local:stop"
)

for command in "${expected_commands[@]}"; do
  if ! grep -Fxq "$command" "$COMMANDS_FILE"; then
    echo "Expected npm command was not run: $command" >&2
    exit 1
  fi
done

for marker in \
  "sk_live_" \
  "sk_test_" \
  "pk_live_" \
  "whsec_" \
  "-----BEGIN PRIVATE KEY-----" \
  "PRIVY_VERIFICATION_KEY=" \
  "STRIPE_SECRET_KEY=" \
  "Authorization: Bearer "; do
  if grep -R -Fq -- "$marker" "$OUTPUT_DIR"; then
    echo "Forbidden marker found in capture output: $marker" >&2
    exit 1
  fi
done

if ! grep -Fq "walkthrough recording remains open" "$OUTPUT_DIR/manifest.md"; then
  echo "Expected manifest to keep walkthrough recording open" >&2
  exit 1
fi

echo '{"ok":true,"cases":[{"label":"captures local-only walkthrough evidence bundle with fake npm boundary","status":0}]}'
