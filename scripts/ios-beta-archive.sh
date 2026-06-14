#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_PATH="$ROOT_DIR/apps/ios/FanPass/FanPass.xcodeproj"
CONFIGURATION="${FANPASS_IOS_CONFIGURATION:-Beta}"
ARCHIVE_ROOT="${FANPASS_IOS_ARCHIVE_ROOT:-$ROOT_DIR/outputs/ios-archives/$(date -u +%Y%m%dT%H%M%SZ)}"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

require_https_url() {
  local name="$1"
  local value="${!name:-}"
  require_env "$name"
  if [[ "$value" != https://* ]]; then
    echo "$name must be an HTTPS URL for signed iOS/TestFlight builds." >&2
    exit 1
  fi
  if [[ "$value" == *".invalid"* || "$value" == *"replace-me"* || "$value" == *"localhost"* ]]; then
    echo "$name must not be a placeholder, .invalid host, or localhost." >&2
    exit 1
  fi
}

require_env FANPASS_APPLE_TEAM_ID
require_env FANPASS_FANPASS_PROVISIONING_PROFILE_SPECIFIER
require_env FANPASS_OPS_PROVISIONING_PROFILE_SPECIFIER
require_https_url FANPASS_API_BASE_URL

mkdir -p "$ARCHIVE_ROOT"

archive_scheme() {
  local scheme="$1"
  local profile_setting="$2"
  local archive_path="$ARCHIVE_ROOT/$scheme.xcarchive"
  local log_path="$ARCHIVE_ROOT/$scheme.archive.log"

  echo "Archiving $scheme ($CONFIGURATION) to $archive_path"
  xcodebuild \
    -project "$PROJECT_PATH" \
    -scheme "$scheme" \
    -configuration "$CONFIGURATION" \
    -destination "generic/platform=iOS" \
    -archivePath "$archive_path" \
    FANPASS_APPLE_TEAM_ID="$FANPASS_APPLE_TEAM_ID" \
    FANPASS_API_BASE_URL="$FANPASS_API_BASE_URL" \
    FANPASS_PRIVY_APP_ID="${FANPASS_PRIVY_APP_ID:-}" \
    FANPASS_PRIVY_APP_CLIENT_ID="${FANPASS_PRIVY_APP_CLIENT_ID:-}" \
    FANPASS_STRIPE_PUBLISHABLE_KEY="${FANPASS_STRIPE_PUBLISHABLE_KEY:-}" \
    "$profile_setting" \
    archive \
    > "$log_path" 2>&1
  echo "Archive complete: $archive_path"
  echo "Build log: $log_path"
}

archive_scheme "FanPass" "FANPASS_FANPASS_PROVISIONING_PROFILE_SPECIFIER=$FANPASS_FANPASS_PROVISIONING_PROFILE_SPECIFIER"
archive_scheme "FanPassOps" "FANPASS_OPS_PROVISIONING_PROFILE_SPECIFIER=$FANPASS_OPS_PROVISIONING_PROFILE_SPECIFIER"

if [[ -n "${FANPASS_IOS_EXPORT_OPTIONS_PLIST:-}" ]]; then
  for scheme in FanPass FanPassOps; do
    echo "Exporting $scheme archive with caller-provided export options plist."
    xcodebuild \
      -exportArchive \
      -archivePath "$ARCHIVE_ROOT/$scheme.xcarchive" \
      -exportPath "$ARCHIVE_ROOT/$scheme-export" \
      -exportOptionsPlist "$FANPASS_IOS_EXPORT_OPTIONS_PLIST" \
      > "$ARCHIVE_ROOT/$scheme.export.log" 2>&1
    echo "Export complete: $ARCHIVE_ROOT/$scheme-export"
  done
else
  echo "No FANPASS_IOS_EXPORT_OPTIONS_PLIST provided; upload/export remains a manual Xcode Organizer or caller-owned export step."
fi

echo "Archive bundle root: $ARCHIVE_ROOT"
