#![cfg(test)]
extern crate std;

use super::*;
use aegis_registry::{RegistryContract, RegistryContractClient};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, vec, Address, Env, String, Vec};

const FEE_BPS: u32 = 250; // 2.5%

struct World<'a> {
    env: Env,
    escrow: EscrowContractClient<'a>,
    escrow_id: Address,
    registry: RegistryContractClient<'a>,
    token_id: Address,
    token: token::Client<'a>,
    buyer: Address,
    seller: Address,
    arbiter: Address,
    admin: Address,
}

fn milestones(env: &Env, amounts: &[i128]) -> Vec<Milestone> {
    let mut v = Vec::new(env);
    for a in amounts {
        v.push_back(Milestone {
            description: String::from_str(env, "deliverable"),
            amount: *a,
            released: false,
        });
    }
    v
}

fn setup<'a>(fee_bps: u32) -> World<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);

    // Registry (secondary contract).
    let registry_id = env.register(RegistryContract, ());
    let registry = RegistryContractClient::new(&env, &registry_id);
    registry.initialize(&admin);

    // Escrow (core contract).
    let escrow_id = env.register(EscrowContract, ());
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    escrow.initialize(&admin, &registry_id, &fee_bps);

    // Wire the permission boundary: only this escrow may write to the registry.
    registry.set_escrow(&escrow_id);

    // SEP-41 settlement token, buyer funded.
    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = sac.address();
    let token = token::Client::new(&env, &token_id);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000_000);

    World {
        env,
        escrow,
        escrow_id,
        registry,
        token_id,
        token,
        buyer,
        seller,
        arbiter,
        admin,
    }
}

fn create_default(w: &World) -> u64 {
    w.escrow.create_escrow(
        &w.buyer,
        &w.seller,
        &w.arbiter,
        &w.token_id,
        &String::from_str(&w.env, "Logo design"),
        &milestones(&w.env, &[600, 400]),
        &10_000,
    )
}

#[test]
fn test_create_escrow_locks_funds() {
    let w = setup(FEE_BPS);
    let id = create_default(&w);
    assert_eq!(id, 0);

    let e = w.escrow.get_escrow(&id);
    assert_eq!(e.status, EscrowStatus::Funded);
    assert_eq!(e.total_amount, 1_000);
    assert_eq!(e.buyer, w.buyer);

    // Funds moved from buyer into the contract.
    assert_eq!(w.token.balance(&w.escrow_id), 1_000);
    assert_eq!(w.token.balance(&w.buyer), 999_000);

    // Indexed for both parties.
    assert_eq!(w.escrow.get_user_escrows(&w.buyer), vec![&w.env, 0u64]);
    assert_eq!(w.escrow.get_user_escrows(&w.seller), vec![&w.env, 0u64]);
}

#[test]
fn test_full_release_pays_seller_net_of_fee_and_updates_reputation() {
    let w = setup(FEE_BPS);
    let id = create_default(&w);

    w.escrow.mark_delivered(&id);
    assert_eq!(w.escrow.get_escrow(&id).status, EscrowStatus::Delivered);

    w.escrow.release_milestone(&id, &0);
    w.escrow.release_milestone(&id, &1);

    let e = w.escrow.get_escrow(&id);
    assert_eq!(e.status, EscrowStatus::Released);
    assert_eq!(e.released_amount, 1_000);

    // 2.5% fee on 1000 = 25 -> seller gets 975, treasury gets 25.
    assert_eq!(w.token.balance(&w.seller), 975);
    assert_eq!(w.token.balance(&w.registry.address), 25);
    assert_eq!(w.registry.get_fees(&w.token_id), 25);

    // Inter-contract reputation update fired exactly once at full release.
    let seller_rep = w.registry.get_reputation(&w.seller);
    assert_eq!(seller_rep.jobs_as_seller, 1);
    assert_eq!(seller_rep.volume, 1_000);
    let stats = w.registry.get_stats();
    assert_eq!(stats.total_completed, 1);
}

#[test]
fn test_partial_release_keeps_escrow_open() {
    let w = setup(0); // no fee for simpler maths
    let id = create_default(&w);

    w.escrow.release_milestone(&id, &0); // 600
    let e = w.escrow.get_escrow(&id);
    assert_eq!(e.status, EscrowStatus::Funded);
    assert_eq!(e.released_amount, 600);
    assert_eq!(w.token.balance(&w.seller), 600);

    // Reputation not yet recorded (escrow still open).
    assert_eq!(w.registry.get_stats().total_completed, 0);
}

#[test]
fn test_double_release_same_milestone_fails() {
    let w = setup(0);
    let id = create_default(&w);
    w.escrow.release_milestone(&id, &0);
    let res = w.escrow.try_release_milestone(&id, &0);
    assert_eq!(res, Err(Ok(Error::MilestoneAlreadyReleased)));
}

#[test]
fn test_dispute_then_resolve_split() {
    let w = setup(0);
    let id = create_default(&w);

    w.escrow.raise_dispute(&id, &w.seller);
    assert_eq!(w.escrow.get_escrow(&id).status, EscrowStatus::Disputed);
    // Dispute recorded against the caller.
    assert_eq!(w.registry.get_reputation(&w.seller).disputes, 1);

    // Arbiter awards 70% to the seller.
    w.escrow.resolve_dispute(&id, &7_000);
    let e = w.escrow.get_escrow(&id);
    assert_eq!(e.status, EscrowStatus::Resolved);
    assert_eq!(w.token.balance(&w.seller), 700);
    assert_eq!(w.token.balance(&w.buyer), 999_000 + 300);
    // Completion recorded for the awarded portion.
    assert_eq!(w.registry.get_stats().total_completed, 1);
}

#[test]
fn test_refund_after_deadline() {
    let w = setup(0);
    let id = create_default(&w);
    // Before deadline: refund is rejected.
    assert_eq!(
        w.escrow.try_refund(&id),
        Err(Ok(Error::Unauthorized))
    );
    // Advance past the deadline.
    w.env.ledger().set_timestamp(20_000);
    w.escrow.refund(&id);
    let e = w.escrow.get_escrow(&id);
    assert_eq!(e.status, EscrowStatus::Refunded);
    assert_eq!(w.token.balance(&w.buyer), 1_000_000);
}

#[test]
fn test_cancel_before_release_refunds_buyer() {
    let w = setup(0);
    let id = create_default(&w);
    w.escrow.cancel(&id);
    assert_eq!(w.escrow.get_escrow(&id).status, EscrowStatus::Cancelled);
    assert_eq!(w.token.balance(&w.buyer), 1_000_000);
    assert_eq!(w.token.balance(&w.escrow_id), 0);
}

#[test]
fn test_cancel_after_release_fails() {
    let w = setup(0);
    let id = create_default(&w);
    w.escrow.release_milestone(&id, &0);
    assert_eq!(w.escrow.try_cancel(&id), Err(Ok(Error::InvalidStatus)));
}

#[test]
fn test_stranger_cannot_raise_dispute() {
    let w = setup(0);
    let id = create_default(&w);
    let stranger = Address::generate(&w.env);
    let res = w.escrow.try_raise_dispute(&id, &stranger);
    assert_eq!(res, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_create_rejects_same_buyer_seller() {
    let w = setup(0);
    let res = w.escrow.try_create_escrow(
        &w.buyer,
        &w.buyer,
        &w.arbiter,
        &w.token_id,
        &String::from_str(&w.env, "bad"),
        &milestones(&w.env, &[100]),
        &10_000,
    );
    assert_eq!(res, Err(Ok(Error::SamePartyError)));
}

#[test]
fn test_create_rejects_past_deadline() {
    let w = setup(0);
    w.env.ledger().set_timestamp(50_000);
    let res = w.escrow.try_create_escrow(
        &w.buyer,
        &w.seller,
        &w.arbiter,
        &w.token_id,
        &String::from_str(&w.env, "late"),
        &milestones(&w.env, &[100]),
        &10_000,
    );
    assert_eq!(res, Err(Ok(Error::InvalidDeadline)));
}

#[test]
fn test_initialize_rejects_excessive_fee() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let registry_id = env.register(RegistryContract, ());
    RegistryContractClient::new(&env, &registry_id).initialize(&admin);
    let escrow_id = env.register(EscrowContract, ());
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let res = escrow.try_initialize(&admin, &registry_id, &5_000); // 50% > max
    assert_eq!(res, Err(Ok(Error::InvalidFee)));
}

#[test]
fn test_config_view() {
    let w = setup(FEE_BPS);
    create_default(&w);
    let cfg = w.escrow.get_config();
    assert_eq!(cfg.fee_bps, FEE_BPS);
    assert_eq!(cfg.next_id, 1);
    assert_eq!(cfg.admin, w.admin);
}
