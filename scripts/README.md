# Aegis operations scripts

Operational scripts for building, deploying, initializing and upgrading the
Aegis Soroban contracts, and for generating the frontend TypeScript bindings.

All scripts are written for `bash` with `set -euo pipefail` and use absolute,
repo-relative paths, so they can be run from any working directory.

## Prerequisites

- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli) v22+ (`stellar`)
- Rust toolchain with the `wasm32v1-none` target: `rustup target add wasm32v1-none`
- `jq` (manifest read/write)
- `curl` (local network reachability check)
- A sha256 tool (`sha256sum` or `shasum`)

## Scripts

| Script | Purpose |
| ------ | ------- |
| `deploy_testnet.sh` | Build, deploy (registry → escrow), initialize and wire the contracts on **testnet** (default), then write `deployments/testnet.json` and print the `NEXT_PUBLIC_*` env block. |
| `deploy_local.sh` | Same flow against a **local** network (`--network local`). Requires a running quickstart container at `http://localhost:8000` (`stellar network container start local`). Writes `deployments/local.json`. |
| `init_contracts.sh` | Idempotently (re)run `initialize` + `set_escrow` from an existing `deployments/<network>.json`. |
| `upgrade_contract.sh` | Build, upload new WASM, and invoke `upgrade(new_wasm_hash)` on the chosen contract; updates the manifest. |
| `gen_bindings.sh` | Generate TypeScript bindings for both contracts into `web/src/lib/stellar/bindings/{escrow,registry}`. |

## Usage

```bash
# Deploy everything to testnet (creates + funds identity if needed)
./scripts/deploy_testnet.sh

# Deploy to a local quickstart network
./scripts/deploy_local.sh

# Re-run init/wiring for an existing deployment
./scripts/init_contracts.sh testnet

# Upgrade a single contract
./scripts/upgrade_contract.sh escrow testnet
./scripts/upgrade_contract.sh registry testnet

# Regenerate frontend bindings from a deployment
./scripts/gen_bindings.sh testnet
```

## Environment overrides

| Variable | Used by | Default | Meaning |
| -------- | ------- | ------- | ------- |
| `STELLAR_NETWORK` | deploy_* | `testnet` / `local` | Network name passed to the CLI. |
| `IDENTITY` | all | `aegis-deployer` | `stellar keys` identity used as deployer/admin. |
| `FEE_BPS` | deploy_*, init | `250` | Platform fee in basis points (max 1000 = 10%). |

> The first positional argument to `init_contracts.sh`, `upgrade_contract.sh`
> and `gen_bindings.sh` selects the network/manifest (e.g. `testnet`, `local`).

## Deploy order

The deploy scripts follow the required ordering:

1. deploy **registry**
2. deploy **escrow**
3. `escrow.initialize(admin, registry_id, fee_bps)`
4. `registry.initialize(admin)`
5. `registry.set_escrow(escrow_id)`

See [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for the full walkthrough.
