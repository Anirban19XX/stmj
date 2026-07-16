# Aegis — Deployment Guide

End-to-end guide for deploying the Aegis contracts to a Stellar network and the
frontend to Vercel. Commands assume **Stellar CLI v22+** and the repo layout:

```
contracts/   Cargo workspace (aegis-escrow, aegis-registry)
web/         Next.js 15 frontend (deploys to Vercel)
scripts/     ops scripts (deploy / init / upgrade / bindings)
deployments/ per-network manifests (gitignored)
```

---

## 1. Toolchain install

```bash
# Rust + the Soroban wasm target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32v1-none

# Stellar CLI (v22+)
cargo install --locked stellar-cli
#   or: brew install stellar-cli   (macOS)
stellar --version

# Supporting tools used by the scripts
#   jq, curl, and a sha256 tool (sha256sum / shasum) — usually preinstalled.

# Node 20+ for the frontend
node --version   # >= 20
```

---

## 2. Identity setup

Deployments are signed by a `stellar keys` identity. The scripts default to the
identity name `aegis-deployer` and will create + fund it on the target network
if it does not already exist.

```bash
# Manually (optional — the scripts do this automatically on testnet/local):
stellar keys generate --global aegis-deployer --network testnet --fund
stellar keys address aegis-deployer        # -> G... (this becomes the admin)
```

The identity's public key becomes the **admin** of both contracts (config +
upgrade authority). For mainnet, use a securely-managed key — see
[`SECURITY.md`](./SECURITY.md#upgrade-authority--key-management).

---

## 3. Local network (optional dev loop)

Start a local quickstart network, then deploy against it:

```bash
stellar network container start local      # RPC at http://localhost:8000
./scripts/deploy_local.sh                  # writes deployments/local.json
```

`deploy_local.sh` checks the network is reachable, registers the `local` CLI
network alias if needed, builds, deploys, initializes and wires the contracts.

---

## 4. Testnet deploy walkthrough

```bash
# One command: ensure identity, build, deploy, init + wire, write manifest.
./scripts/deploy_testnet.sh

# Overrides (all optional):
STELLAR_NETWORK=testnet IDENTITY=aegis-deployer FEE_BPS=250 ./scripts/deploy_testnet.sh
```

What it does, in order:

1. Ensure/fund the `aegis-deployer` identity.
2. `stellar contract build` → `aegis_escrow.wasm`, `aegis_registry.wasm`.
3. Deploy **registry**, then **escrow** (capturing each contract id).
4. `escrow.initialize(admin, registry_id, fee_bps)`.
5. `registry.initialize(admin)`.
6. `registry.set_escrow(escrow_id)`.
7. Write `deployments/testnet.json`.
8. Print the `NEXT_PUBLIC_*` env block.

### Re-running init only

If the contracts are deployed but initialization needs re-running (idempotent):

```bash
./scripts/init_contracts.sh testnet
```

### Default token (native XLM SAC)

The frontend's default settlement token is the native XLM Stellar Asset
Contract. Get its id and put it in `NEXT_PUBLIC_DEFAULT_TOKEN_ID`:

```bash
stellar contract id asset --asset native --network testnet
```

---

## 5. Generate TypeScript bindings

After a deploy, regenerate the typed client used by the frontend:

```bash
./scripts/gen_bindings.sh testnet
# -> web/src/lib/stellar/bindings/escrow
# -> web/src/lib/stellar/bindings/registry
```

Commit the regenerated bindings if your frontend imports them directly.

---

## 6. Frontend environment

Copy the template and paste the values printed by the deploy script:

```bash
cp web/.env.example web/.env.local
# then fill: NEXT_PUBLIC_ESCROW_CONTRACT_ID, NEXT_PUBLIC_REGISTRY_CONTRACT_ID,
#            NEXT_PUBLIC_DEFAULT_TOKEN_ID, and confirm network endpoints.
```

Run locally:

```bash
cd web
npm ci
npm run dev        # http://localhost:3000
```

---

## 7. Vercel setup

1. Create a Vercel project pointed at the `web/` directory (Root Directory =
   `web`). Framework preset: **Next.js**.
2. In **Project Settings → Environment Variables**, add every `NEXT_PUBLIC_*`
   variable from `web/.env.example` for the **Production** (and Preview)
   environments. These are read at build time by `vercel build`.
3. Link locally once to capture the project/org ids:

   ```bash
   cd web
   npx vercel link
   cat .vercel/project.json   # contains orgId + projectId
   ```

### Required GitHub Actions secrets

The `Deploy` workflow (`.github/workflows/deploy.yml`) needs these repository
secrets (Settings → Secrets and variables → Actions):

| Secret | Where to get it |
| ------ | --------------- |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens → Create Token |
| `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` (or Vercel team settings) |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` |

On every push to `main`, the workflow runs `npm ci`, tests, a sanity `npm run
build`, then `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt
--prod`, and finally curls the deployment URL asserting **HTTP 200**.

### CI on pull requests

`.github/workflows/pr.yml` runs on every PR: the **contracts** job
(`cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`,
`stellar contract build`) and the **frontend** job (`npm run lint`,
`typecheck`, `test`). No secrets required.

---

## 8. Upgrade procedure

Both contracts expose `upgrade(new_wasm_hash)` gated by the admin. To ship new
code while preserving contract ids and storage:

```bash
# Build, upload to get the new wasm hash, invoke upgrade, update the manifest.
./scripts/upgrade_contract.sh escrow testnet
./scripts/upgrade_contract.sh registry testnet
```

The script records the new `wasm_hash` (and `last_upgrade`) in
`deployments/<network>.json`. If the contract's ABI changed, regenerate
bindings (`./scripts/gen_bindings.sh <network>`) and redeploy the frontend.

> The signing `IDENTITY` must be the contract admin, or `require_auth` will
> reject the upgrade.

---

## 9. Rollback notes

- **Contracts.** There is no automatic downgrade. To roll back, build the
  previous source revision, then run `upgrade_contract.sh` again to point the
  contract at the older WASM hash (re-upload the prior artifact first). Keep the
  previous `deployments/<network>.json` and the prior `wasm_hash` so you can
  restore quickly. Storage layout must remain compatible across the rollback —
  never roll back to a version with an incompatible storage schema.
- **Frontend.** Use Vercel's instant rollback: Project → Deployments → select a
  prior production deployment → **Promote to Production** (or
  `vercel rollback <url>`). Frontend rollbacks are independent of contract
  state.
- **Configuration.** `set_fee`, `set_registry` and `set_admin` (escrow) and
  `set_escrow` / `set_admin` (registry) let you correct wiring/parameters
  without a code upgrade. Re-run `init_contracts.sh` to re-apply wiring.
- **Disaster recovery.** Manifests are gitignored; keep an off-repo backup of
  production manifests so contract ids/admin/wasm hashes are never lost.
