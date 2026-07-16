use soroban_sdk::{contracterror, contracttype, Address, String, Vec};

/// Storage keys for the escrow contract.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Governance / upgrade authority.
    Admin,
    /// Address of the Registry contract (reputation + treasury).
    Registry,
    /// Platform fee in basis points (1/100th of a percent).
    FeeBps,
    /// Monotonic id counter for new escrows. -> `u64`
    NextId,
    /// Per-escrow agreement record. -> `Escrow`
    Escrow(u64),
    /// Index of escrow ids a given account participates in. -> `Vec<u64>`
    UserIndex(Address),
}

/// Lifecycle of an escrow agreement.
///
/// ```text
///                 release (all milestones)
///   Funded ──────────────────────────────────► Released
///     │  ▲                                          ▲
///     │  │ mark_delivered                           │ resolve (to seller)
///     ▼  │                                          │
///   Delivered ── raise_dispute ──► Disputed ──► Resolved
///     │                               │  (split)    │
///     │ release                       │ resolve (to buyer)
///     ▼                               ▼             ▼
///   (partial releases)            Refunded ◄───── Refunded
///
///   Funded ── cancel (nothing released) ──► Cancelled (full refund)
/// ```
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    /// Buyer has deposited funds; work may begin.
    Funded = 0,
    /// Seller has signalled delivery; awaiting buyer release.
    Delivered = 1,
    /// All milestones released to the seller.
    Released = 2,
    /// Funds returned to the buyer.
    Refunded = 3,
    /// A party has escalated to the arbiter.
    Disputed = 4,
    /// Arbiter has settled a disputed escrow.
    Resolved = 5,
    /// Cancelled before any release; buyer fully refunded.
    Cancelled = 6,
}

/// A single deliverable within an escrow. Funds are released milestone by
/// milestone, enabling partial settlement of larger engagements.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub description: String,
    pub amount: i128,
    pub released: bool,
}

/// The full escrow agreement record.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    pub id: u64,
    pub title: String,
    pub buyer: Address,
    pub seller: Address,
    /// Neutral third party able to resolve disputes.
    pub arbiter: Address,
    /// SEP-41 token used for settlement.
    pub token: Address,
    pub total_amount: i128,
    pub released_amount: i128,
    pub status: EscrowStatus,
    pub milestones: Vec<Milestone>,
    pub created_at: u64,
    /// Ledger timestamp after which the buyer may unilaterally reclaim funds.
    pub deadline: u64,
}

/// Public configuration snapshot, surfaced to the frontend.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub registry: Address,
    pub fee_bps: u32,
    pub next_id: u64,
}

/// Canonical error codes for the escrow contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    /// Referenced escrow id does not exist.
    EscrowNotFound = 3,
    /// Caller lacks the role required for this action.
    Unauthorized = 4,
    /// Action not permitted in the escrow's current status.
    InvalidStatus = 5,
    /// A supplied amount was non-positive or milestones were empty.
    InvalidAmount = 6,
    /// Milestone index out of range.
    MilestoneNotFound = 7,
    /// Milestone already released.
    MilestoneAlreadyReleased = 8,
    /// Fee basis points outside the permitted 0–1000 (0–10%) range.
    InvalidFee = 9,
    /// Deadline must be in the future relative to the ledger.
    InvalidDeadline = 10,
    /// Dispute split must be expressed in basis points (0–10000).
    InvalidSplit = 11,
    /// Buyer and seller must be distinct accounts.
    SamePartyError = 12,
}

/// Maximum platform fee: 10%.
pub const MAX_FEE_BPS: u32 = 1_000;
/// Basis-point denominator.
pub const BPS_DENOMINATOR: i128 = 10_000;
