//! Strongly-typed registry events (soroban-sdk 23 `#[contractevent]`).

use soroban_sdk::{contractevent, Address};

#[contractevent(data_format = "vec")]
pub struct RegistryInitialized {
    #[topic]
    pub admin: Address,
}

#[contractevent(data_format = "vec")]
pub struct EscrowRegistered {
    #[topic]
    pub escrow: Address,
}

#[contractevent(data_format = "vec")]
pub struct CompletionRecorded {
    #[topic]
    pub seller: Address,
    #[topic]
    pub buyer: Address,
    pub amount: i128,
}

#[contractevent(data_format = "vec")]
pub struct DisputeRecorded {
    #[topic]
    pub account: Address,
    pub total_disputes: u32,
}

#[contractevent(data_format = "vec")]
pub struct FeeCollected {
    #[topic]
    pub token: Address,
    pub amount: i128,
}

#[contractevent(data_format = "vec")]
pub struct FeesWithdrawn {
    #[topic]
    pub token: Address,
    #[topic]
    pub to: Address,
    pub amount: i128,
}
