#!/usr/bin/env bash
#
# init_contracts.sh — (Re)run the initialize + wiring invokes for an existing
# deployment, idempotently. Reads contract ids from deployments/<network>.json.
#
# Usage:
#   scripts/init_contracts.sh [network]      # network defaults to "testnet"
#
# Environment overrides:
#   IDENTITY   stellar keys identity used as admin/source   (default: from manifest, else aegis-deployer)
#   FEE_BPS    platform fee in basis points                 (default: from manifest, else 250)
#
# `initialize` can only succeed once per contract; if a contract is already
# initialized this script logs a warning and continues, so it is safe to re-run.
# `set_escrow` is owner-authorised and may be re-run to (re)point the wiring.
set -euo pipefail

NETWORK="${1:-testnet}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$REPO_ROOT/deployments/${NETWORK}.json"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || die "missing required tool: $1"; }

require stellar
require jq

[ -f "$MANIFEST" ] || die "deployment manifest not found: $MANIFEST (run deploy_${NETWORK}.sh first)"

ESCROW_ID="$(jq -r '.contracts.escrow.contract_id'   "$MANIFEST")"
REGISTRY_ID="$(jq -r '.contracts.registry.contract_id' "$MANIFEST")"
MANIFEST_IDENTITY="$(jq -r '.identity // empty'        "$MANIFEST")"
MANIFEST_ADMIN="$(jq -r '.init.admin // .deployer // empty' "$MANIFEST")"
MANIFEST_FEE="$(jq -r '.init.fee_bps // empty'         "$MANIFEST")"

IDENTITY="${IDENTITY:-${MANIFEST_IDENTITY:-aegis-deployer}}"
FEE_BPS="${FEE_BPS:-${MANIFEST_FEE:-250}}"

[ -n "$ESCROW_ID" ]   && [ "$ESCROW_ID" != "null" ]   || die "escrow contract id missing in manifest"
[ -n "$REGISTRY_ID" ] && [ "$REGISTRY_ID" != "null" ] || die "registry contract id missing in manifest"

ADMIN_ADDRESS="$(stellar keys address "$IDENTITY")"
[ -z "$MANIFEST_ADMIN" ] || [ "$MANIFEST_ADMIN" = "$ADMIN_ADDRESS" ] || \
  warn "admin in manifest ($MANIFEST_ADMIN) != identity '$IDENTITY' address ($ADMIN_ADDRESS)"

log "network=$NETWORK identity=$IDENTITY admin=$ADMIN_ADDRESS fee_bps=$FEE_BPS"
log "escrow=$ESCROW_ID registry=$REGISTRY_ID"

# Run an invoke but never abort the script if it fails (e.g. AlreadyInitialized).
try_invoke() {
  local label="$1"; shift
  if "$@"; then
    log "$label: ok"
  else
    warn "$label: invoke failed (likely already done) — continuing"
  fi
}

log "Initializing escrow (idempotent)"
try_invoke "escrow.initialize" \
  stellar contract invoke --id "$ESCROW_ID" --source "$IDENTITY" --network "$NETWORK" -- \
    initialize --admin "$ADMIN_ADDRESS" --registry "$REGISTRY_ID" --fee_bps "$FEE_BPS"

log "Initializing registry (idempotent)"
try_invoke "registry.initialize" \
  stellar contract invoke --id "$REGISTRY_ID" --source "$IDENTITY" --network "$NETWORK" -- \
    initialize --admin "$ADMIN_ADDRESS"

log "Wiring registry.set_escrow -> $ESCROW_ID"
try_invoke "registry.set_escrow" \
  stellar contract invoke --id "$REGISTRY_ID" --source "$IDENTITY" --network "$NETWORK" -- \
    set_escrow --escrow "$ESCROW_ID"

# Reflect the wiring state back into the manifest.
TMP="$(mktemp)"
jq --argjson fee "$FEE_BPS" --arg admin "$ADMIN_ADDRESS" \
  '.init = (.init // {}) + {fee_bps: $fee, admin: $admin, escrow_initialized: true, registry_initialized: true, escrow_wired: true}' \
  "$MANIFEST" > "$TMP" && mv "$TMP" "$MANIFEST"

log "Done. Manifest updated: $MANIFEST"
