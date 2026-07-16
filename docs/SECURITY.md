# Aegis — Security Considerations

This document describes the security model of the Aegis escrow/registry system
and the operational practices that keep a deployment safe. It complements the
deploy guide ([`DEPLOYMENT.md`](./DEPLOYMENT.md)).

> Scope: on-chain contracts (`aegis-escrow`, `aegis-registry`), the deployment
> tooling under `scripts/`, and the Next.js frontend under `web/`. This is an
> operational/design reference, not a substitute for a professional audit before
> mainnet.

---

## 1. Input validation

Validate at the trust boundary — on-chain — and never rely on the frontend for
correctness:

- **Fee bounds.** `escrow.initialize` and `set_fee` reject `fee_bps` above the
  contract's `MAX_FEE_BPS` (10% / 1000 bps). The deploy scripts default to
  `FEE_BPS=250` (2.5%); keep production fees within an agreed policy.
- **Amounts.** Milestone amounts must be strictly positive; zero/negative
  amounts and empty milestone lists are rejected (`InvalidAmount`).
- **Deadlines.** Escrow deadlines must be in the future relative to the ledger
  timestamp (`InvalidDeadline`).
- **Distinct parties.** Buyer and seller must differ (`SamePartyError`).
- **State machine.** Transitions (deliver → release → refund/dispute/resolve)
  are guarded by status checks (`InvalidStatus`) so funds can't be double-spent
  or released out of order.
- **Frontend.** Treat client-side validation (zod schemas, form checks) purely
  as UX. The contract is the authority; the UI must surface contract errors
  faithfully rather than masking them.

---

## 2. Role-based access control & the escrow↔registry boundary

Roles in the system:

- **Admin** (both contracts): governance — config changes and upgrades.
  Established at `initialize` and changeable via `set_admin`.
- **Buyer / seller / arbiter** (escrow): per-escrow participants. Releases,
  refunds, disputes and resolutions are authorized against the relevant party.
- **Escrow contract** (as caller of the registry): the registry trusts only the
  configured escrow address for privileged bookkeeping.

The **permission boundary** between the two contracts is critical:

- The registry stores the authorized escrow address (`registry.set_escrow`,
  admin-only). Privileged registry mutations driven by escrow activity
  (recording completions/disputes, noting fees) must be gated so that **only the
  configured escrow contract** can call them — never arbitrary accounts. A
  misconfigured or unset escrow address means reputation/fee accounting can be
  spoofed, so `set_escrow` is admin-gated and part of the required deploy wiring.
- `withdraw_fees` (registry) is restricted to the admin/treasury role.
- Keep the wiring authoritative: after any redeploy, re-run
  `init_contracts.sh` so `registry.set_escrow` points at the live escrow.

Principle: least privilege. Each entry point authorizes the *specific* role it
needs, not a generic "owner".

---

## 3. Reentrancy & the Soroban auth model (`require_auth`)

- **Authorization.** Every state-changing entry point calls `require_auth()` on
  the account whose authority is required (e.g. `admin.require_auth()` in
  `initialize`, buyer auth in `create_escrow`). Soroban verifies a signed
  authorization entry scoped to the contract, function and arguments — this is
  how the contract knows the caller truly consented, independent of who
  submitted the transaction.
- **No ambient authority.** Do not infer permissions from the transaction
  source account; always derive them from the `Address` that `require_auth`s.
- **Reentrancy.** Soroban does not allow a contract to be re-entered while it is
  already on the call stack, which removes the classic EVM single-contract
  reentrancy vector. Still follow checks-effects-interactions: validate and
  update contract storage **before** calling out to the token contract (e.g.
  pull funds / pay out), so external token logic can never observe or exploit a
  half-updated state.
- **Token transfers.** Custody transfers use the SEP-41/`token::Client`
  interface. Only move funds after status/role checks pass, and update escrow
  status atomically with the transfer path.
- **Overflow.** The release profile enables `overflow-checks = true`, so
  arithmetic on amounts panics (aborts the tx) rather than wrapping.

---

## 4. Environment variables & secret handling

- **Frontend env is public.** Every `NEXT_PUBLIC_*` var is embedded in the
  browser bundle. Only put non-secret, client-safe values there (RPC URLs,
  contract ids, network passphrase). Never put private keys, API tokens, or
  signing secrets in `NEXT_PUBLIC_*`.
- **No secrets in the repo.** `.gitignore` excludes `web/.env*` (keeping only
  `.env.example`), `.vercel/`, and `deployments/*.json`. Deployment manifests
  hold live ids — back them up off-repo.
- **CI/CD secrets** live only in GitHub Actions secrets
  (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) and Vercel project
  settings — never echoed into logs. Rotate `VERCEL_TOKEN` periodically and on
  any suspected exposure.
- **Signing keys.** `stellar keys` material stays on the operator machine / in a
  hardware-backed signer. Deployer keys are never committed or shipped to the
  browser.

---

## 5. Transaction verification on the frontend

- **Simulate before submit.** Use Soroban RPC simulation to preview results,
  detect errors, and surface accurate fees/footprints before asking the user to
  sign.
- **Wallet signing only.** Signing happens in the user's wallet
  (stellar-wallets-kit); the app never handles user private keys.
- **Verify the network.** Check `NEXT_PUBLIC_NETWORK_PASSPHRASE` matches the
  connected wallet's network to prevent cross-network replay/confusion.
- **Confirm finality.** After submit, poll RPC for the final transaction status
  and decode the contract result/events rather than assuming success; show the
  authoritative on-chain outcome (and an explorer link via
  `NEXT_PUBLIC_EXPLORER_BASE_URL`).
- **Trust on-chain reads.** Display balances/state from RPC/Horizon, and treat
  any value derived from user input as untrusted until validated by the
  contract.

---

## 6. Fee bounds

- Fees are basis points with a hard contract cap (`MAX_FEE_BPS = 1000`, i.e.
  10%). Attempts to set a higher fee are rejected (`InvalidFee`).
- Fee changes are admin-only (`set_fee`) and should follow a governance/change
  process; consider announcing changes since they affect every new escrow.
- Fee accounting flows through the registry treasury (`note_fee` /
  `withdraw_fees`); only the configured escrow may record fees and only the
  admin/treasury may withdraw.

---

## 7. Upgrade authority & key management

- **Who can upgrade.** `upgrade(new_wasm_hash)` on each contract is gated by
  that contract's admin via `require_auth`. The admin key is therefore the
  single most sensitive credential in the system.
- **Protect the admin key.** For mainnet, hold admin authority in a hardware
  wallet or, preferably, a multi-signature / threshold setup so no single key
  compromise enables a malicious upgrade or fee/treasury change.
- **Change of control.** Use `set_admin` to rotate authority; verify the new
  admin can sign before relinquishing the old key. Record the change in the
  deployment manifest.
- **Upgrade hygiene.** Review and (ideally) audit new WASM before upgrading.
  Confirm the uploaded `wasm_hash` matches the artifact you built
  (`upgrade_contract.sh` uploads and records the exact hash). Preserve storage
  layout compatibility across upgrades; keep prior artifacts/hashes to enable
  rollback (see DEPLOYMENT.md §9).
- **Least privilege for ops.** The CI/Vercel pipeline deploys only the
  *frontend*; it has no contract upgrade authority. Contract upgrades are a
  deliberate, manually-signed operation.

---

## 8. Dependency hygiene

- **Pin & lock.** `Cargo.lock` and `web/package-lock.json` are committed; CI
  uses `--locked` / `npm ci` for reproducible installs. The Stellar CLI version
  is pinned in CI.
- **Reproducible builds.** The release profile is size-optimized and
  deterministic (`lto`, `codegen-units = 1`, `strip`), so the deployed
  `wasm_hash` is verifiable.
- **Audit regularly.** Run `cargo audit` (RustSec) and `npm audit` and keep
  dependencies current; review transitive additions, especially anything
  touching crypto, signing, or network IO.
- **CI gates.** `cargo clippy -D warnings`, `cargo fmt --check`, `cargo test`,
  and the frontend `lint`/`typecheck`/`test` jobs must pass before merge,
  reducing the chance of insecure code or footguns landing on `main`.
- **Supply chain.** Prefer official Soroban/Stellar SDKs and well-maintained
  crates/packages; avoid unmaintained dependencies for security-relevant paths.
