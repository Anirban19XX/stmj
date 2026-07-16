//! Strongly-typed contract events.
//!
//! Each struct is published with the `#[contractevent]` macro (the recommended
//! approach in soroban-sdk 23+). The first topic is the struct name, followed by
//! any `#[topic]`-annotated fields; remaining fields form the event data vector.
//! The frontend subscribes to these by topic to drive the real-time activity
//! feed.

use soroban_sdk::{contractevent, Address};

#[contractevent(data_format = "vec")]
pub struct Initialized {
    #[topic]
    pub admin: Address,
    pub registry: Address,
    pub fee_bps: u32,
}

#[contractevent(data_format = "vec")]
pub struct EscrowCreated {
    #[topic]
    pub buyer: Address,
    #[topic]
    pub seller: Address,
    pub id: u64,
    pub amount: i128,
}

#[contractevent(data_format = "vec")]
pub struct Delivered {
    #[topic]
    pub seller: Address,
    pub id: u64,
}

#[contractevent(data_format = "vec")]
pub struct MilestoneReleased {
    #[topic]
    pub buyer: Address,
    #[topic]
    pub seller: Address,
    pub id: u64,
    pub amount: i128,
}

#[contractevent(data_format = "vec")]
pub struct Refunded {
    #[topic]
    pub buyer: Address,
    pub id: u64,
    pub amount: i128,
}

#[contractevent(data_format = "vec")]
pub struct Disputed {
    #[topic]
    pub caller: Address,
    pub id: u64,
}

#[contractevent(data_format = "vec")]
pub struct Resolved {
    #[topic]
    pub arbiter: Address,
    pub id: u64,
    pub to_seller: i128,
    pub to_buyer: i128,
}

#[contractevent(data_format = "vec")]
pub struct Cancelled {
    #[topic]
    pub buyer: Address,
    pub id: u64,
}
