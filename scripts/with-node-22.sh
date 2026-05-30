#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -eq 0 ]]; then
  echo "Usage: scripts/with-node-22.sh <command> [args...]" >&2
  exit 64
fi

candidate_bins=()

if [[ -n "${FANPASS_NODE22_BIN_DIR:-}" ]]; then
  candidate_bins+=("$FANPASS_NODE22_BIN_DIR")
fi

candidate_bins+=(
  "/opt/homebrew/opt/node@22/bin"
  "/usr/local/opt/node@22/bin"
)

if [[ -n "${NVM_DIR:-}" ]]; then
  while IFS= read -r node_bin; do
    candidate_bins+=("$(dirname "$node_bin")")
  done < <(find "$NVM_DIR/versions/node" -maxdepth 3 -type f -path '*/v22.*/bin/node' 2>/dev/null | sort -r)
fi

for bin_dir in "${candidate_bins[@]}"; do
  if [[ -x "$bin_dir/node" ]]; then
    node_version="$("$bin_dir/node" -p 'process.versions.node')"
    if [[ "$node_version" == 22.* ]]; then
      export PATH="$bin_dir:$PATH"
      exec "$@"
    fi
  fi
done

echo "Node 22 LTS was not found. Install it with 'brew install node@22' or set FANPASS_NODE22_BIN_DIR." >&2
exit 69
