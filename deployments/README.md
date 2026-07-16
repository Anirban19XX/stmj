# Deployments

This directory holds **deployment manifests** — one JSON file per network,
written by the deploy/init/upgrade scripts in [`../scripts`](../scripts).

> Real manifests (`testnet.json`, `local.json`, `mainnet.json`) contain
> live contract ids and are **gitignored**. Only `.gitkeep` and this `README.md`
> are tracked. Treat manifests as the source of truth for the addresses the
> scripts and (optionally) the frontend consume — keep a backup of production
> manifests outside the repo.

## File naming

```
deployments/<network>.json     # e.g. testnet.json, local.json, mainnet.json
```

The `<network>` segment matches the `STELLAR_NETWORK` used at deploy time and is
the positional argument accepted by `init_contracts.sh`, `upgrade_contract.sh`
and `gen_bindings.sh`.

## Schema

```jsonc
{
  "network": "testnet",                      // CLI network name
  "timestamp": "2026-06-30T12:00:00Z",       // UTC time the manifest was written
  "deployer": "G...",                        // deployer / admin public key
  "identity": "aegis-deployer",              // stellar keys identity name used
  "contracts": {
    "escrow": {
      "contract_id": "C...",                 // deployed escrow contract id
      "wasm_hash": "<64-hex>",               // sha256 of the deployed wasm
      "upgraded_at": "2026-06-30T13:00:00Z"  // optional; set by upgrade_contract.sh
    },
    "registry": {
      "contract_id": "C...",
      "wasm_hash": "<64-hex>"
    }
  },
  "init": {
    "fee_bps": 250,                          // platform fee in basis points
    "admin": "G...",                         // admin address used at init
    "escrow_initialized": true,
    "registry_initialized": true,
    "escrow_wired": true                     // registry.set_escrow done
  },
  "last_upgrade": {                          // optional; set by upgrade_contract.sh
    "contract": "escrow",
    "wasm_hash": "<64-hex>",
    "timestamp": "2026-06-30T13:00:00Z"
  }
}
```

The `wasm_hash` recorded here is the SHA-256 of the compiled `.wasm`, which is
also the on-chain installed-WASM hash referenced by `upgrade(new_wasm_hash)`.
