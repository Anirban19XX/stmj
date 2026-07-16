#!/usr/bin/env bash
#
# deploy_testnet.sh — Build, deploy and wire up the Aegis contracts on a
# Stellar network (testnet by default) and record the result as a deployment
# manifest under deployments/<network>.json.
#
# Deploy order (see CONTRACT INTERFACES):
#   1. deploy registry
#   2. deploy escrow
#   3. escrow.initialize(admin, registry_id, fee_bps)
#   4. registry.initialize(admin)
#   5. registry.set_escrow(escrow_id)
#
# Environment overrides:
#   STELLAR_NETWORK  network name passed to the CLI            (default: testnet)
#   IDENTITY         stellar keys identity used as deployer    (default: aegis-deployer)
#   FEE_BPS          platform fee in basis points              (default: 250)
#
# Requirements: stellar CLI v22+, rust wasm32v1-none target, jq, a sha256 tool.
set -euo pipefail

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
STELLAR_NETWORK="${STELLAR_NETWORK:-testnet}"
IDENTITY="${IDENTITY:-aegis-deployer}"
FEE_BPS="${FEE_BPS:-250}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/contracts"
WASM_DIR="$CONTRACTS_DIR/target/wasm32v1-none/release"
DEPLOYMENTS_DIR="$REPO_ROOT/deployments"
MANIFEST="$DEPLOYMENTS_DIR/${STELLAR_NETWORK}.json"

ESCROW_WASM="$WASM_DIR/aegis_escrow.wasm"
REGISTRY_WASM="$WASM_DIR/aegis_registry.wasm"

# Testnet network endpoints (used for the NEXT_PUBLIC_* hints printed at the end).
RPC_URL="https://soroban-testnet.stellar.org"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
HORIZON_URL="https://horizon-testnet.stellar.org"
EXPLORER_BASE_URL="https://stellar.expert/explorer/testnet"

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
log()  { printf '\033[1;34m==>\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

require() { command -v "$1" >/dev/null 2>&1 || die "missing required tool: $1"; }

# Portable sha256 of a file -> bare hex digest (this equals the on-chain WASM hash).
sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    die "no sha256 tool found (need sha256sum or shasum)"
  fi
}

require stellar
require jq

# --------------------------------------------------------------------------- #
# 0. Identity — generate & fund if it does not exist
# --------------------------------------------------------------------------- #
ensure_identity() {
  if stellar keys address "$IDENTITY" >/dev/null 2>&1; then
    log "Using existing identity '$IDENTITY'"
  else
    log "Identity '$IDENTITY' not found — generating and funding on $STELLAR_NETWORK"
    stellar keys generate "$IDENTITY" --network "$STELLAR_NETWORK" --fund
  fi
}
ensure_identity
ADMIN_ADDRESS="$(stellar keys address "$IDENTITY")"
log "Deployer / admin address: $ADMIN_ADDRESS"

# --------------------------------------------------------------------------- #
# 1. Build
# --------------------------------------------------------------------------- #
log "Building contracts (stellar contract build)"
( cd "$CONTRACTS_DIR" && stellar contract build )
[ -f "$ESCROW_WASM" ]   || die "escrow wasm not found at $ESCROW_WASM"
[ -f "$REGISTRY_WASM" ] || die "registry wasm not found at $REGISTRY_WASM"

REGISTRY_WASM_HASH="$(sha256_file "$REGISTRY_WASM")"
ESCROW_WASM_HASH="$(sha256_file "$ESCROW_WASM")"

# --------------------------------------------------------------------------- #
# 2. Deploy registry, then escrow
# --------------------------------------------------------------------------- #
log "Deploying registry"
REGISTRY_ID="$(stellar contract deploy \
  --wasm "$REGISTRY_WASM" \
  --source "$IDENTITY" \
  --network "$STELLAR_NETWORK" \
  --alias aegis-registry | tail -n1 | tr -d '[:space:]')"
[ -n "$REGISTRY_ID" ] || die "failed to capture registry contract id"
log "Registry deployed: $REGISTRY_ID"

log "Deploying escrow"
ESCROW_ID="$(stellar contract deploy \
  --wasm "$ESCROW_WASM" \
  --source "$IDENTITY" \
  --network "$STELLAR_NETWORK" \
  --alias aegis-escrow | tail -n1 | tr -d '[:space:]')"
[ -n "$ESCROW_ID" ] || die "failed to capture escrow contract id"
log "Escrow deployed: $ESCROW_ID"

# --------------------------------------------------------------------------- #
# 3-5. Initialize & wire up
# --------------------------------------------------------------------------- #
log "Initializing escrow (admin, registry, fee_bps=$FEE_BPS)"
stellar contract invoke --id "$ESCROW_ID" --source "$IDENTITY" --network "$STELLAR_NETWORK" -- \
  initialize --admin "$ADMIN_ADDRESS" --registry "$REGISTRY_ID" --fee_bps "$FEE_BPS"

log "Initializing registry (admin)"
stellar contract invoke --id "$REGISTRY_ID" --source "$IDENTITY" --network "$STELLAR_NETWORK" -- \
  initialize --admin "$ADMIN_ADDRESS"

log "Wiring registry.set_escrow -> $ESCROW_ID"
stellar contract invoke --id "$REGISTRY_ID" --source "$IDENTITY" --network "$STELLAR_NETWORK" -- \
  set_escrow --escrow "$ESCROW_ID"

# --------------------------------------------------------------------------- #
# Write the deployment manifest
# --------------------------------------------------------------------------- #
mkdir -p "$DEPLOYMENTS_DIR"
TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

jq -n \
  --arg network    "$STELLAR_NETWORK" \
  --arg timestamp  "$TIMESTAMP" \
  --arg deployer   "$ADMIN_ADDRESS" \
  --arg identity   "$IDENTITY" \
  --arg escrow_id  "$ESCROW_ID" \
  --arg escrow_h   "$ESCROW_WASM_HASH" \
  --arg reg_id     "$REGISTRY_ID" \
  --arg reg_h      "$REGISTRY_WASM_HASH" \
  --argjson fee    "$FEE_BPS" \
  '{
    network: $network,
    timestamp: $timestamp,
    deployer: $deployer,
    identity: $identity,
    contracts: {
      escrow:   { contract_id: $escrow_id, wasm_hash: $escrow_h },
      registry: { contract_id: $reg_id,    wasm_hash: $reg_h }
    },
    init: {
      fee_bps: $fee,
      escrow_initialized: true,
      registry_initialized: true,
      escrow_wired: true,
      admin: $deployer
    }
  }' > "$MANIFEST"

log "Wrote deployment manifest: $MANIFEST"

# --------------------------------------------------------------------------- #
# Print the frontend env block
# --------------------------------------------------------------------------- #
cat <<EOF

# ----------------------------------------------------------------------------
# Paste the following into web/.env.local
# ----------------------------------------------------------------------------
NEXT_PUBLIC_STELLAR_NETWORK=$STELLAR_NETWORK
NEXT_PUBLIC_SOROBAN_RPC_URL=$RPC_URL
NEXT_PUBLIC_NETWORK_PASSPHRASE=$NETWORK_PASSPHRASE
NEXT_PUBLIC_HORIZON_URL=$HORIZON_URL
NEXT_PUBLIC_ESCROW_CONTRACT_ID=$ESCROW_ID
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=$REGISTRY_ID
NEXT_PUBLIC_DEFAULT_TOKEN_ID=<native XLM SAC id — see docs/DEPLOYMENT.md>
NEXT_PUBLIC_EXPLORER_BASE_URL=$EXPLORER_BASE_URL
# ----------------------------------------------------------------------------
EOF

log "Done."
