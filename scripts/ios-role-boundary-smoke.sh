#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_YML="$ROOT_DIR/apps/ios/FanPass/project.yml"
FAN_SHELL="$ROOT_DIR/apps/ios/FanPass/FanPass/App/AppShellView.swift"
OPS_SHELL="$ROOT_DIR/apps/ios/FanPass/FanPassOps/OpsShellView.swift"
FAN_INFO="$ROOT_DIR/apps/ios/FanPass/FanPass/Generated/Info.plist"

fan_target_block="$(awk '/^  FanPass:/{flag=1} /^  FanPassOps:/{flag=0} flag {print}' "$PROJECT_YML")"
if ! grep -q "Features/Scanner" <<<"$fan_target_block"; then
  echo "FanPass target must explicitly exclude Features/Scanner." >&2
  exit 1
fi

if grep -Eq "ScannerView|Gate Scanner|Open scanner|fanpass://staff/scanner" "$FAN_SHELL"; then
  echo "FanPass app shell exposes scanner or staff copy." >&2
  exit 1
fi

if grep -q "CFBundleURLTypes" "$FAN_INFO"; then
  if ! grep -q "<string>fanpass-payments</string>" "$FAN_INFO"; then
    echo "FanPass consumer app may only register the payment return URL scheme." >&2
    exit 1
  fi

  if grep -Eq "<string>fanpass</string>|fanpass-ops|staff|scanner" "$FAN_INFO"; then
    echo "FanPass consumer app must not register staff scanner URL schemes." >&2
    exit 1
  fi
fi

if ! grep -q "ScannerView(" "$OPS_SHELL"; then
  echo "FanPass Ops must own the scanner workflow." >&2
  exit 1
fi

echo "iOS role boundary smoke passed."
