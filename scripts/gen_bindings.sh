#!/usr/bin/env bash
#
# gen_bindings.sh — Generate TypeScript client bindings for both Aegis contracts
# from a live deployment, into the frontend source tree.
#
# Usage:
#   scripts/gen_bindings.sh [network]      # network defaults to "testnet"
#
# Reads contract ids from deployments/<network>.json and writes:
#   web/src/lib/stellar/bindings/escrow
#   web/src/lib/stellar/bindings/registry
set -euo pipefail

NETWORK="${1:-testnet}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$REPO_ROOT/deployments/${NETWORK}.json"
BINDINGS_DIR="$REPO_ROOT/web/src/lib/stellar/bindings"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || die "missing required tool: $1"; }

require stellar
require jq

[ -f "$MANIFEST" ] || die "deployment manifest not found: $MANIFEST (deploy first)"

ESCROW_ID="$(jq -r '.contracts.escrow.contract_id'     "$MANIFEST")"
REGISTRY_ID="$(jq -r '.contracts.registry.contract_id' "$MANIFEST")"

[ -n "$ESCROW_ID" ]   && [ "$ESCROW_ID" != "null" ]   || die "escrow contract id missing in manifest"
[ -n "$REGISTRY_ID" ] && [ "$REGISTRY_ID" != "null" ] || die "registry contract id missing in manifest"

mkdir -p "$BINDINGS_DIR"

log "Generating escrow bindings (id=$ESCROW_ID)"
stellar contract bindings typescript \
  --network "$NETWORK" \
  --contract-id "$ESCROW_ID" \
  --output-dir "$BINDINGS_DIR/escrow" \
  --overwrite

log "Generating registry bindings (id=$REGISTRY_ID)"
stellar contract bindings typescript \
  --network "$NETWORK" \
  --contract-id "$REGISTRY_ID" \
  --output-dir "$BINDINGS_DIR/registry" \
  --overwrite

log "Done. Bindings written under $BINDINGS_DIR"
