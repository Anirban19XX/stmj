//! Typed client for cross-contract calls into the Registry.
//!
//! We deliberately declare the Registry's interface here with
//! `#[contractclient]` rather than depending on the `aegis-registry` crate at
//! build time. Linking another contract's `#[contractimpl]` into this cdylib
//! would duplicate its exported WASM symbols (e.g. `get_escrow`). This trait
//! generates only the *client* — the host-side invocation shim — so there are
//! no symbol collisions, while still giving us full type safety on the call.

use soroban_sdk::{contractclient, Address, Env};

#[contractclient(name = "RegistryClient")]
pub trait RegistryInterface {
    fn record_completion(env: Env, seller: Address, buyer: Address, amount: i128);
    fn record_dispute(env: Env, account: Address);
    fn note_fee(env: Env, token: Address, amount: i128);
}
