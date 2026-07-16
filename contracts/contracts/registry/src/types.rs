use soroban_sdk::{contracterror, contracttype, Address};

/// Storage keys for the registry contract.
///
/// Instance storage holds small, contract-wide singletons (admin, the
/// authorised escrow address, aggregate stats). Persistent storage holds
/// per-account reputation and per-token fee balances that must outlive the
/// instance TTL.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Contract administrator (governance / upgrade authority).
    Admin,
    /// The single escrow contract authorised to mutate reputation & fees.
    Escrow,
    /// Per-account reputation record. -> `Reputation`
    Reputation(Address),
    /// Accumulated, withdrawable platform fees per token. -> `i128`
    Fees(Address),
    /// Lifetime number of completed escrows. -> `u64`
    TotalCompleted,
    /// Lifetime settled volume (sum of released amounts). -> `i128`
    TotalVolume,
    /// Lifetime number of disputes recorded. -> `u64`
    TotalDisputes,
}

/// Reputation record for a marketplace participant.
///
/// `score` is a derived 0–1000 trust score recomputed on every update so the
/// frontend never has to replay history.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Reputation {
    pub account: Address,
    /// Jobs delivered & released as the seller.
    pub jobs_as_seller: u32,
    /// Jobs funded & released as the buyer.
    pub jobs_as_buyer: u32,
    /// Disputes this account was a party to.
    pub disputes: u32,
    /// Lifetime value transacted (buyer + seller side).
    pub volume: i128,
    /// Derived trust score, 0–1000.
    pub score: u32,
    /// Ledger timestamp of the last update.
    pub updated_at: u64,
}

/// Aggregate, marketplace-wide statistics surfaced on the Analytics page.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stats {
    pub total_completed: u64,
    pub total_volume: i128,
    pub total_disputes: u64,
}

/// Canonical error codes. Kept stable across upgrades so clients can map them
/// to human-readable messages.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Contract has already been initialised.
    AlreadyInitialized = 1,
    /// Contract has not been initialised yet.
    NotInitialized = 2,
    /// Caller is not the registered escrow contract.
    NotAuthorizedEscrow = 3,
    /// Reputation record does not exist for the requested account.
    ReputationNotFound = 4,
    /// Requested fee withdrawal exceeds the collected balance.
    InsufficientFees = 5,
    /// A supplied numeric argument was non-positive where positivity is required.
    InvalidAmount = 6,
}

/// Trust-score model. Pure function so it can be unit-tested in isolation and
/// reasoned about independently of storage.
///
/// Rewards completed work, penalises disputes, and saturates at 1000.
pub fn compute_score(jobs_as_seller: u32, jobs_as_buyer: u32, disputes: u32) -> u32 {
    let completed = jobs_as_seller.saturating_add(jobs_as_buyer);
    // Each completed job grants 40 points; sellers earn a small extra premium
    // for delivering. Each dispute removes 120 points.
    let positive = completed
        .saturating_mul(40)
        .saturating_add(jobs_as_seller.saturating_mul(10));
    let penalty = disputes.saturating_mul(120);
    let raw = positive.saturating_sub(penalty);
    raw.min(1000)
}
