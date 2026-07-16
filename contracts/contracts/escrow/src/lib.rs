#![no_std]
//! # Aegis Escrow (core contract)
//!
//! Milestone-based escrow for a two-sided marketplace. A **buyer** locks funds
//! against a set of milestones; a **seller** delivers; the buyer releases funds
//! milestone by milestone. A neutral **arbiter** can settle disputes by
//! splitting the remaining balance.
//!
//! ## Inter-contract communication
//!
//! On settlement the escrow contract calls into the **Registry** contract to:
//! * accrue the platform fee into the treasury (`note_fee`), and
//! * update both parties' on-chain reputation (`record_completion` /
//!   `record_dispute`).
//!
//! The Registry authorises these calls with `escrow.require_auth()`. Because
//! Soroban automatically authorises a contract for the sub-invocations it makes,
//! only this contract can satisfy that check — establishing a hard permission
//! boundary between the two contracts.
//!
//! ## Roles & access control
//!
//! | Action            | Authorised role         |
//! |-------------------|-------------------------|
//! | create_escrow     | buyer                   |
//! | mark_delivered    | seller                  |
//! | release_milestone | buyer                   |
//! | raise_dispute     | buyer or seller         |
//! | resolve_dispute   | arbiter                 |
//! | refund            | buyer (after deadline)  |
//! | cancel            | buyer (pre-release)     |
//! | set config / upgrade | admin                |

mod events;
mod registry_client;
mod types;

#[cfg(test)]
mod test;

use registry_client::RegistryClient;
use soroban_sdk::{
    contract, contractimpl, contractmeta, panic_with_error, token, Address, BytesN, Env, String,
    Vec,
};

pub use events::{
    Cancelled, Delivered, Disputed, EscrowCreated, Initialized, MilestoneReleased, Refunded,
    Resolved,
};
pub use types::{
    Config, DataKey, Error, Escrow, EscrowStatus, Milestone, BPS_DENOMINATOR, MAX_FEE_BPS,
};

contractmeta!(key = "name", val = "Aegis Escrow");
contractmeta!(
    key = "desc",
    val = "Milestone-based, dispute-resolved escrow for the Aegis marketplace"
);

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// One-time initialisation.
    ///
    /// * `admin` — governance authority (config + upgrades).
    /// * `registry` — address of the deployed Registry contract.
    /// * `fee_bps` — platform fee in basis points (max 1000 = 10%).
    pub fn initialize(
        env: Env,
        admin: Address,
        registry: Address,
        fee_bps: u32,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        if fee_bps > MAX_FEE_BPS {
            return Err(Error::InvalidFee);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Registry, &registry);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage().instance().set(&DataKey::NextId, &0u64);
        Initialized {
            admin,
            registry,
            fee_bps,
        }
        .publish(&env);
        Ok(())
    }

    /// Create and fund a new escrow. The buyer's `total` (sum of milestone
    /// amounts) is transferred into the contract immediately.
    ///
    /// Authorised by the **buyer**.
    pub fn create_escrow(
        env: Env,
        buyer: Address,
        seller: Address,
        arbiter: Address,
        token: Address,
        title: String,
        milestones: Vec<Milestone>,
        deadline: u64,
    ) -> Result<u64, Error> {
        buyer.require_auth();
        Self::require_init(&env)?;

        if buyer == seller {
            return Err(Error::SamePartyError);
        }
        if milestones.is_empty() {
            return Err(Error::InvalidAmount);
        }
        if deadline <= env.ledger().timestamp() {
            return Err(Error::InvalidDeadline);
        }

        let mut total: i128 = 0;
        for m in milestones.iter() {
            if m.amount <= 0 {
                return Err(Error::InvalidAmount);
            }
            if m.released {
                return Err(Error::InvalidStatus);
            }
            total += m.amount;
        }

        // Pull funds into escrow custody.
        token::Client::new(&env, &token).transfer(
            &buyer,
            &env.current_contract_address(),
            &total,
        );

        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        let escrow = Escrow {
            id,
            title,
            buyer: buyer.clone(),
            seller: seller.clone(),
            arbiter,
            token,
            total_amount: total,
            released_amount: 0,
            status: EscrowStatus::Funded,
            milestones,
            created_at: env.ledger().timestamp(),
            deadline,
        };
        Self::save_escrow(&env, &escrow);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        Self::index_for(&env, &buyer, id);
        Self::index_for(&env, &seller, id);

        EscrowCreated {
            buyer,
            seller,
            id,
            amount: total,
        }
        .publish(&env);
        Ok(id)
    }

    /// Seller signals that the deliverable is ready. Funded -> Delivered.
    /// Authorised by the **seller**.
    pub fn mark_delivered(env: Env, escrow_id: u64) -> Result<(), Error> {
        let mut e = Self::load_escrow(&env, escrow_id)?;
        e.seller.require_auth();
        if e.status != EscrowStatus::Funded {
            return Err(Error::InvalidStatus);
        }
        e.status = EscrowStatus::Delivered;
        Self::save_escrow(&env, &e);
        Delivered {
            seller: e.seller.clone(),
            id: escrow_id,
        }
        .publish(&env);
        Ok(())
    }

    /// Release a single milestone's funds to the seller (net of platform fee).
    /// When the final milestone is released the escrow transitions to Released
    /// and both parties' reputation is updated via the Registry.
    ///
    /// Authorised by the **buyer**.
    pub fn release_milestone(env: Env, escrow_id: u64, index: u32) -> Result<(), Error> {
        let mut e = Self::load_escrow(&env, escrow_id)?;
        e.buyer.require_auth();
        if e.status != EscrowStatus::Funded && e.status != EscrowStatus::Delivered {
            return Err(Error::InvalidStatus);
        }

        let mut milestone = e
            .milestones
            .get(index)
            .ok_or(Error::MilestoneNotFound)?;
        if milestone.released {
            return Err(Error::MilestoneAlreadyReleased);
        }

        let amount = milestone.amount;
        Self::pay_seller(&env, &e, amount);

        milestone.released = true;
        e.milestones.set(index, milestone);
        e.released_amount += amount;

        let fully_released = e.milestones.iter().all(|m| m.released);
        if fully_released {
            e.status = EscrowStatus::Released;
        }
        Self::save_escrow(&env, &e);

        MilestoneReleased {
            buyer: e.buyer.clone(),
            seller: e.seller.clone(),
            id: escrow_id,
            amount,
        }
        .publish(&env);

        if fully_released {
            Self::registry(&env).record_completion(&e.seller, &e.buyer, &e.released_amount);
        }
        Ok(())
    }

    /// Buyer reclaims all *unreleased* funds once the deadline has passed.
    /// Authorised by the **buyer**.
    pub fn refund(env: Env, escrow_id: u64) -> Result<(), Error> {
        let mut e = Self::load_escrow(&env, escrow_id)?;
        e.buyer.require_auth();
        if e.status != EscrowStatus::Funded && e.status != EscrowStatus::Delivered {
            return Err(Error::InvalidStatus);
        }
        if env.ledger().timestamp() < e.deadline {
            return Err(Error::Unauthorized);
        }
        let remaining = e.total_amount - e.released_amount;
        if remaining > 0 {
            token::Client::new(&env, &e.token).transfer(
                &env.current_contract_address(),
                &e.buyer,
                &remaining,
            );
        }
        e.status = EscrowStatus::Refunded;
        Self::save_escrow(&env, &e);
        Refunded {
            buyer: e.buyer.clone(),
            id: escrow_id,
            amount: remaining,
        }
        .publish(&env);
        Ok(())
    }

    /// Buyer or seller escalates a live escrow to the arbiter.
    /// Records the dispute against the *caller* in the Registry.
    pub fn raise_dispute(env: Env, escrow_id: u64, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        let mut e = Self::load_escrow(&env, escrow_id)?;
        if caller != e.buyer && caller != e.seller {
            return Err(Error::Unauthorized);
        }
        if e.status != EscrowStatus::Funded && e.status != EscrowStatus::Delivered {
            return Err(Error::InvalidStatus);
        }
        e.status = EscrowStatus::Disputed;
        Self::save_escrow(&env, &e);
        Self::registry(&env).record_dispute(&caller);
        Disputed {
            caller,
            id: escrow_id,
        }
        .publish(&env);
        Ok(())
    }

    /// Arbiter settles a disputed escrow by splitting the remaining balance.
    /// `seller_bps` is the share (in basis points, 0–10000) of the *unreleased*
    /// funds awarded to the seller; the remainder is refunded to the buyer.
    ///
    /// Authorised by the **arbiter**.
    pub fn resolve_dispute(
        env: Env,
        escrow_id: u64,
        seller_bps: u32,
    ) -> Result<(), Error> {
        let mut e = Self::load_escrow(&env, escrow_id)?;
        e.arbiter.require_auth();
        if e.status != EscrowStatus::Disputed {
            return Err(Error::InvalidStatus);
        }
        if seller_bps as i128 > BPS_DENOMINATOR {
            return Err(Error::InvalidSplit);
        }

        let remaining = e.total_amount - e.released_amount;
        let to_seller = remaining * (seller_bps as i128) / BPS_DENOMINATOR;
        let to_buyer = remaining - to_seller;

        if to_seller > 0 {
            Self::pay_seller(&env, &e, to_seller);
            e.released_amount += to_seller;
        }
        if to_buyer > 0 {
            token::Client::new(&env, &e.token).transfer(
                &env.current_contract_address(),
                &e.buyer,
                &to_buyer,
            );
        }
        e.status = EscrowStatus::Resolved;
        Self::save_escrow(&env, &e);

        let registry = Self::registry(&env);
        if to_seller > 0 {
            registry.record_completion(&e.seller, &e.buyer, &to_seller);
        }
        Resolved {
            arbiter: e.arbiter.clone(),
            id: escrow_id,
            to_seller,
            to_buyer,
        }
        .publish(&env);
        Ok(())
    }

    /// Buyer cancels an escrow before anything has been released, recovering the
    /// full deposit. Authorised by the **buyer**.
    pub fn cancel(env: Env, escrow_id: u64) -> Result<(), Error> {
        let mut e = Self::load_escrow(&env, escrow_id)?;
        e.buyer.require_auth();
        if e.status != EscrowStatus::Funded {
            return Err(Error::InvalidStatus);
        }
        if e.released_amount != 0 {
            return Err(Error::InvalidStatus);
        }
        token::Client::new(&env, &e.token).transfer(
            &env.current_contract_address(),
            &e.buyer,
            &e.total_amount,
        );
        e.status = EscrowStatus::Cancelled;
        Self::save_escrow(&env, &e);
        Cancelled {
            buyer: e.buyer.clone(),
            id: escrow_id,
        }
        .publish(&env);
        Ok(())
    }

    // --- admin -----------------------------------------------------------

    pub fn set_fee(env: Env, fee_bps: u32) -> Result<(), Error> {
        Self::admin(&env)?.require_auth();
        if fee_bps > MAX_FEE_BPS {
            return Err(Error::InvalidFee);
        }
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        Ok(())
    }

    pub fn set_registry(env: Env, registry: Address) -> Result<(), Error> {
        Self::admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Registry, &registry);
        Ok(())
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        Self::admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        Ok(())
    }

    /// Upgrade the contract WASM in place. Admin-gated. Storage is preserved.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        Self::admin(&env)?.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    // --- views -----------------------------------------------------------

    pub fn get_escrow(env: Env, escrow_id: u64) -> Result<Escrow, Error> {
        Self::load_escrow(&env, escrow_id)
    }

    /// All escrow ids an account participates in (as buyer or seller).
    pub fn get_user_escrows(env: Env, account: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::UserIndex(account))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_config(env: Env) -> Result<Config, Error> {
        Ok(Config {
            admin: Self::admin(&env)?,
            registry: env
                .storage()
                .instance()
                .get(&DataKey::Registry)
                .ok_or(Error::NotInitialized)?,
            fee_bps: env.storage().instance().get(&DataKey::FeeBps).unwrap_or(0),
            next_id: env.storage().instance().get(&DataKey::NextId).unwrap_or(0),
        })
    }

    // --- internal --------------------------------------------------------

    /// Pay the seller `gross` minus the platform fee. The fee is forwarded to
    /// the Registry treasury and recorded there. This is an inter-contract call.
    fn pay_seller(env: &Env, e: &Escrow, gross: i128) {
        let fee_bps: i128 = env
            .storage()
            .instance()
            .get::<_, u32>(&DataKey::FeeBps)
            .unwrap_or(0) as i128;
        let fee = gross * fee_bps / BPS_DENOMINATOR;
        let net = gross - fee;
        let token_client = token::Client::new(env, &e.token);
        let this = env.current_contract_address();

        if net > 0 {
            token_client.transfer(&this, &e.seller, &net);
        }
        if fee > 0 {
            let registry_addr = Self::registry_addr(env);
            token_client.transfer(&this, &registry_addr, &fee);
            Self::registry(env).note_fee(&e.token, &fee);
        }
    }

    fn registry(env: &Env) -> RegistryClient {
        RegistryClient::new(env, &Self::registry_addr(env))
    }

    fn registry_addr(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Registry)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    fn admin(env: &Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    fn require_init(env: &Env) -> Result<(), Error> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }
        Ok(())
    }

    fn load_escrow(env: &Env, id: u64) -> Result<Escrow, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(Error::EscrowNotFound)
    }

    fn save_escrow(env: &Env, e: &Escrow) {
        let key = DataKey::Escrow(e.id);
        env.storage().persistent().set(&key, e);
        // ~30 days of ledgers (5s ledgers): bump on every write.
        env.storage()
            .persistent()
            .extend_ttl(&key, 17_280, 17_280 * 30);
    }

    fn index_for(env: &Env, account: &Address, id: u64) {
        let key = DataKey::UserIndex(account.clone());
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));
        ids.push_back(id);
        env.storage().persistent().set(&key, &ids);
        env.storage()
            .persistent()
            .extend_ttl(&key, 17_280, 17_280 * 30);
    }
}
