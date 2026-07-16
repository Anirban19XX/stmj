#![no_std]
//! # Aegis Registry
//!
//! The Registry is the **secondary contract** in the Aegis marketplace. It owns
//! two pieces of shared state that must be isolated from the core escrow logic:
//!
//! 1. **Reputation** — an append-only trust ledger for every participant.
//! 2. **Treasury** — accumulated platform fees, withdrawable by governance.
//!
//! It is written so that *only* the registered Escrow contract may mutate this
//! state. This is the permission boundary that makes the inter-contract
//! communication trustworthy: the Escrow contract calls into the Registry, and
//! the Registry verifies the caller via `escrow.require_auth()`. Because Soroban
//! automatically authorises a contract for its own sub-invocations, only the one
//! authorised escrow address can satisfy that check.
//!
//! State transitions emit events so the frontend activity feed can react in
//! real time.

mod events;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, contractmeta, token, Address, BytesN, Env};

pub use events::{
    CompletionRecorded, DisputeRecorded, EscrowRegistered, FeeCollected, FeesWithdrawn,
    RegistryInitialized,
};
pub use types::{compute_score, DataKey, Error, Reputation, Stats};

contractmeta!(key = "name", val = "Aegis Registry");
contractmeta!(
    key = "desc",
    val = "Reputation registry and treasury for the Aegis escrow marketplace"
);

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    /// One-time initialisation. Sets the governance admin.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalCompleted, &0u64);
        env.storage().instance().set(&DataKey::TotalVolume, &0i128);
        env.storage().instance().set(&DataKey::TotalDisputes, &0u64);
        RegistryInitialized { admin }.publish(&env);
        Ok(())
    }

    /// Register (or rotate) the single escrow contract authorised to write to
    /// this registry. Admin-gated.
    pub fn set_escrow(env: Env, escrow: Address) -> Result<(), Error> {
        Self::admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Escrow, &escrow);
        EscrowRegistered { escrow }.publish(&env);
        Ok(())
    }

    /// Record a successfully released escrow. Increments completion counters for
    /// both parties, accrues volume, and recomputes trust scores.
    ///
    /// Authorisation: only the registered escrow contract may call this.
    pub fn record_completion(
        env: Env,
        seller: Address,
        buyer: Address,
        amount: i128,
    ) -> Result<(), Error> {
        Self::require_escrow(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut seller_rep = Self::load_or_default(&env, &seller);
        seller_rep.jobs_as_seller = seller_rep.jobs_as_seller.saturating_add(1);
        seller_rep.volume = seller_rep.volume.saturating_add(amount);
        Self::save_reputation(&env, &mut seller_rep);

        let mut buyer_rep = Self::load_or_default(&env, &buyer);
        buyer_rep.jobs_as_buyer = buyer_rep.jobs_as_buyer.saturating_add(1);
        buyer_rep.volume = buyer_rep.volume.saturating_add(amount);
        Self::save_reputation(&env, &mut buyer_rep);

        Self::bump_u64(&env, &DataKey::TotalCompleted, 1);
        Self::bump_i128(&env, &DataKey::TotalVolume, amount);

        CompletionRecorded {
            seller,
            buyer,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    /// Record that an account was party to a dispute. Lowers its trust score.
    ///
    /// Authorisation: only the registered escrow contract may call this.
    pub fn record_dispute(env: Env, account: Address) -> Result<(), Error> {
        Self::require_escrow(&env)?;
        let mut rep = Self::load_or_default(&env, &account);
        rep.disputes = rep.disputes.saturating_add(1);
        Self::save_reputation(&env, &mut rep);
        Self::bump_u64(&env, &DataKey::TotalDisputes, 1);
        DisputeRecorded {
            account,
            total_disputes: rep.disputes,
        }
        .publish(&env);
        Ok(())
    }

    /// Accrue a platform fee that the escrow contract has already transferred to
    /// this contract's balance. Tracks the withdrawable amount per token.
    ///
    /// Authorisation: only the registered escrow contract may call this.
    pub fn note_fee(env: Env, token: Address, amount: i128) -> Result<(), Error> {
        Self::require_escrow(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        Self::bump_i128(&env, &DataKey::Fees(token.clone()), amount);
        FeeCollected { token, amount }.publish(&env);
        Ok(())
    }

    /// Withdraw collected fees for a token to a destination. Admin-gated.
    pub fn withdraw_fees(
        env: Env,
        token: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), Error> {
        Self::admin(&env)?.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let key = DataKey::Fees(token.clone());
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount > balance {
            return Err(Error::InsufficientFees);
        }
        env.storage().persistent().set(&key, &(balance - amount));
        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );
        FeesWithdrawn { token, to, amount }.publish(&env);
        Ok(())
    }

    /// Transfer admin rights. Admin-gated.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        Self::admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        Ok(())
    }

    /// Upgrade the contract WASM in place. Admin-gated. The contract address,
    /// and therefore all storage, is preserved across the upgrade.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        Self::admin(&env)?.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    // --- read-only views -------------------------------------------------

    /// Fetch a participant's reputation, defaulting to a zeroed record so the
    /// frontend always has something to render.
    pub fn get_reputation(env: Env, account: Address) -> Reputation {
        Self::load_or_default(&env, &account)
    }

    /// Marketplace-wide aggregate statistics.
    pub fn get_stats(env: Env) -> Stats {
        Stats {
            total_completed: env
                .storage()
                .instance()
                .get(&DataKey::TotalCompleted)
                .unwrap_or(0),
            total_volume: env
                .storage()
                .instance()
                .get(&DataKey::TotalVolume)
                .unwrap_or(0),
            total_disputes: env
                .storage()
                .instance()
                .get(&DataKey::TotalDisputes)
                .unwrap_or(0),
        }
    }

    /// Withdrawable fee balance for a token.
    pub fn get_fees(env: Env, token: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Fees(token))
            .unwrap_or(0)
    }

    /// Current admin address.
    pub fn get_admin(env: Env) -> Result<Address, Error> {
        Self::admin(&env)
    }

    /// Currently registered escrow address.
    pub fn get_escrow(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Escrow)
            .ok_or(Error::NotInitialized)
    }

    // --- internal helpers ------------------------------------------------

    fn admin(env: &Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    /// Verify the caller is the registered escrow contract. This is the
    /// permission boundary protecting all reputation/treasury mutations.
    fn require_escrow(env: &Env) -> Result<(), Error> {
        let escrow: Address = env
            .storage()
            .instance()
            .get(&DataKey::Escrow)
            .ok_or(Error::NotAuthorizedEscrow)?;
        escrow.require_auth();
        Ok(())
    }

    fn load_or_default(env: &Env, account: &Address) -> Reputation {
        env.storage()
            .persistent()
            .get(&DataKey::Reputation(account.clone()))
            .unwrap_or(Reputation {
                account: account.clone(),
                jobs_as_seller: 0,
                jobs_as_buyer: 0,
                disputes: 0,
                volume: 0,
                score: 0,
                updated_at: 0,
            })
    }

    fn save_reputation(env: &Env, rep: &mut Reputation) {
        rep.score = compute_score(rep.jobs_as_seller, rep.jobs_as_buyer, rep.disputes);
        rep.updated_at = env.ledger().timestamp();
        let key = DataKey::Reputation(rep.account.clone());
        env.storage().persistent().set(&key, rep);
        // Keep the record alive for ~30 days of ledgers past last touch.
        env.storage()
            .persistent()
            .extend_ttl(&key, 17_280, 17_280 * 30);
    }

    fn bump_u64(env: &Env, key: &DataKey, by: u64) {
        let cur: u64 = env.storage().instance().get(key).unwrap_or(0);
        env.storage().instance().set(key, &(cur + by));
    }

    fn bump_i128(env: &Env, key: &DataKey, by: i128) {
        // Persistent for per-token fees, instance for global volume.
        match key {
            DataKey::Fees(_) => {
                let cur: i128 = env.storage().persistent().get(key).unwrap_or(0);
                env.storage().persistent().set(key, &(cur + by));
            }
            _ => {
                let cur: i128 = env.storage().instance().get(key).unwrap_or(0);
                env.storage().instance().set(key, &(cur + by));
            }
        }
    }
}
