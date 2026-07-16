#!/usr/bin/env bash
#
# upgrade_contract.sh — Upgrade a deployed Aegis contract to a freshly built
# WASM, preserving its contract id and storage.
#
# Usage:
#   scripts/upgrade_contract.sh <escrow|registry> <network>
#
# Both contracts expose `upgrade(new_wasm_hash: BytesN<32>)`, gated by the
# stored admin via require_auth. This script:
#   1. builds the contracts
#   2. uploads the target contract's WASM to capture the new wasm hash
#   3. invokes `upgrade --new_wasm_hash <hash>` on the contract id from the manifest
#   4. records the new wasm hash in deployments/<network>.json
#
# Environment overrides:
#   IDENTITY   stellar keys identity (must be the contract admin)  (default: from manifest, else aegis-deployer)
set -euo pipefail

CONTRACT="${1:-}"
NETWORK="${2:-}"

[ -n "$CONTRACT" ] && [ -n "$NETWORK" ] || {
  echo "usage: $0 <escrow|registry> <network>" >&2
  exit 2
}
case "$CONTRACT" in
  escrow|registry) ;;
  *) echo "error: contract must be 'escrow' or 'registry' (got '$CONTRACT')" >&2; exit 2 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/contracts"
WASM_DIR="$CONTRACTS_DIR/target/wasm32v1-none/release"
MANIFEST="$REPO_ROOT/deployments/${NETWORK}.json"

# Map the logical name to its built wasm artifact.
case "$CONTRACT" in
  escrow)   WASM="$WASM_DIR/aegis_escrow.wasm" ;;
  registry) WASM="$WASM_DIR/aegis_registry.wasm" ;;
esac

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || die "missing required tool: $1"; }

require stellar
require jq

[ -f "$MANIFEST" ] || die "deployment manifest not found: $MANIFEST"

CONTRACT_ID="$(jq -r ".contracts.${CONTRACT}.contract_id" "$MANIFEST")"
MANIFEST_IDENTITY="$(jq -r '.identity // empty' "$MANIFEST")"
IDENTITY="${IDENTITY:-${MANIFEST_IDENTITY:-aegis-deployer}}"

[ -n "$CONTRACT_ID" ] && [ "$CONTRACT_ID" != "null" ] || die "$CONTRACT contract id missing in manifest"

log "Upgrading $CONTRACT ($CONTRACT_ID) on $NETWORK using identity '$IDENTITY'"

# 1. Build
log "Building contracts"
( cd "$CONTRACTS_DIR" && stellar contract build )
[ -f "$WASM" ] || die "wasm not found at $WASM"

# 2. Upload to obtain the new wasm hash (prints the hash to stdout).
log "Uploading new WASM"
NEW_HASH="$(stellar contract upload \
  --wasm "$WASM" \
  --source "$IDENTITY" \
  --network "$NETWORK" | tail -n1 | tr -d '[:space:]')"
[ -n "$NEW_HASH" ] || die "failed to capture new wasm hash"
log "New wasm hash: $NEW_HASH"

# 3. Invoke upgrade on the contract.
log "Invoking ${CONTRACT}.upgrade"
stellar contract invoke --id "$CONTRACT_ID" --source "$IDENTITY" --network "$NETWORK" -- \
  upgrade --new_wasm_hash "$NEW_HASH"

# 4. Update the manifest.
TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TMP="$(mktemp)"
jq --arg c "$CONTRACT" --arg h "$NEW_HASH" --arg ts "$TIMESTAMP" \
  '.contracts[$c].wasm_hash = $h
   | .contracts[$c].upgraded_at = $ts
   | .last_upgrade = {contract: $c, wasm_hash: $h, timestamp: $ts}' \
  "$MANIFEST" > "$TMP" && mv "$TMP" "$MANIFEST"

log "Done. $CONTRACT upgraded to $NEW_HASH. Manifest updated: $MANIFEST"
