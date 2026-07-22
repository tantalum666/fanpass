#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
BIN_DIR="$TMP_DIR/bin"
OUTPUT_DIR="$TMP_DIR/output"
COMMANDS_FILE="$TMP_DIR/npm-commands.log"
NODE_COMMANDS_FILE="$TMP_DIR/node-commands.log"

cleanup() {
  if [[ "${FANPASS_KEEP_CAPTURE_TEST_TMP:-false}" == "true" ]]; then
    printf 'Kept capture self-test fixture: %s\n' "$TMP_DIR" >&2
  else
    rm -rf "$TMP_DIR"
  fi
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

cat >"$BIN_DIR/node" <<FAKE_NODE
#!/usr/bin/env bash
set -euo pipefail
if [[ -n "\${NODE_OPTIONS+x}" || -n "\${NODE_PATH+x}" ]]; then
  echo "Node preload variables crossed the env-i boundary" >&2
  exit 1
fi
if [[ "\${1:-}" == "-e" ]]; then
  relative="\${3:?}"
  expected="\${4:?}"
  requested_root="\${5:?}"
  actual="\$(/usr/bin/shasum -a 256 "\$requested_root/\$relative" | /usr/bin/awk '{print \$1}')"
  if [[ "\$actual" != "\$expected" ]]; then
    echo "Beta foundation bootstrap failed: Launcher digest does not match the reviewed bytes" >&2
    exit 1
  fi
  echo "\$relative" >>"$NODE_COMMANDS_FILE"
  echo '{"ok":true,"command":"reviewed launcher bytes"}'
  exit 0
fi
echo "unexpected node command: \$*" >&2
exit 1
FAKE_NODE
chmod +x "$BIN_DIR/node"

FIXTURE_ROOT="$TMP_DIR/fixture-root"
FIXTURE_CAPTURE="$FIXTURE_ROOT/scripts/alpha-walkthrough-capture.sh"
mkdir -p "$(dirname "$FIXTURE_CAPTURE")"
cp "$ROOT_DIR/scripts/beta-foundation-launcher.js" \
  "$FIXTURE_ROOT/scripts/beta-foundation-launcher.js"
sed \
  "s|/opt/homebrew/opt/node@22/bin/node|$BIN_DIR/node|g" \
  "$ROOT_DIR/scripts/alpha-walkthrough-capture.sh" >"$FIXTURE_CAPTURE"
chmod +x "$FIXTURE_CAPTURE"

PATH="$BIN_DIR:$PATH" \
  FANPASS_FAKE_NPM_COMMANDS="$COMMANDS_FILE" \
  FANPASS_ALPHA_WALKTHROUGH_STAMP="fixture" \
  FANPASS_ALPHA_WALKTHROUGH_OUTPUT_DIR="$OUTPUT_DIR" \
  NODE_OPTIONS="--require=gate-preload" \
  NODE_PATH="$TMP_DIR/attacker-modules" \
  bash "$FIXTURE_CAPTURE" >/tmp/fanpass-alpha-walkthrough-capture-self-test.out

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

if ! grep -Fxq "scripts/beta-foundation-launcher.js" "$NODE_COMMANDS_FILE"; then
  echo "Expected env-i isolated Node launcher command was not run" >&2
  exit 1
fi

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

if ! grep -Fq "walkthrough recording is owner-skipped" "$OUTPUT_DIR/manifest.md"; then
  echo "Expected manifest to keep walkthrough recording owner-skipped" >&2
  exit 1
fi

printf '\n# unreviewed mutation\n' >>"$FIXTURE_ROOT/scripts/beta-foundation-launcher.js"
if PATH="$BIN_DIR:$PATH" \
  FANPASS_FAKE_NPM_COMMANDS="$COMMANDS_FILE" \
  FANPASS_ALPHA_WALKTHROUGH_STAMP="tampered" \
  FANPASS_ALPHA_WALKTHROUGH_OUTPUT_DIR="$TMP_DIR/tampered-output" \
  NODE_OPTIONS="--require=gate-preload" \
  NODE_PATH="$TMP_DIR/attacker-modules" \
  bash "$FIXTURE_CAPTURE" >"$TMP_DIR/tampered.stdout" 2>"$TMP_DIR/tampered.stderr"; then
  echo "Tampered launcher unexpectedly passed capture preflight" >&2
  exit 1
fi
if ! grep -Fq \
  "Launcher digest does not match the reviewed bytes" \
  "$TMP_DIR/tampered-output/beta-foundation-verify.log"; then
  echo "Tampered launcher did not fail at the reviewed digest boundary" >&2
  exit 1
fi

echo '{"ok":true,"cases":[{"label":"captures local-only walkthrough evidence bundle with isolated npm and Node boundaries","status":0},{"label":"rejects an unreviewed launcher before capture","status":0}]}'
