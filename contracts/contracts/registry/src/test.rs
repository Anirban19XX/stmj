#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, Address, Env};

fn create_token<'a>(env: &Env, admin: &Address) -> (Address, token::StellarAssetClient<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let id = sac.address();
    (id.clone(), token::StellarAssetClient::new(env, &id))
}

struct Setup<'a> {
    env: Env,
    contract_id: Address,
    client: RegistryContractClient<'a>,
    admin: Address,
    escrow: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RegistryContract, ());
    let client = RegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let escrow = Address::generate(&env);
    client.initialize(&admin);
    client.set_escrow(&escrow);
    Setup {
        env,
        contract_id,
        client,
        admin,
        escrow,
    }
}

#[test]
fn test_initialize_sets_admin_and_escrow() {
    let s = setup();
    assert_eq!(s.client.get_admin(), s.admin);
    assert_eq!(s.client.get_escrow(), s.escrow);
    let stats = s.client.get_stats();
    assert_eq!(stats.total_completed, 0);
    assert_eq!(stats.total_volume, 0);
}

#[test]
#[should_panic] // AlreadyInitialized
fn test_double_initialize_panics() {
    let s = setup();
    s.client.initialize(&s.admin);
}

#[test]
fn test_record_completion_updates_reputation_and_score() {
    let s = setup();
    let seller = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);

    s.client.record_completion(&seller, &buyer, &1_000);
    s.client.record_completion(&seller, &buyer, &500);

    let seller_rep = s.client.get_reputation(&seller);
    assert_eq!(seller_rep.jobs_as_seller, 2);
    assert_eq!(seller_rep.volume, 1_500);
    // 2 completed * 40 + 2 seller-jobs * 10 = 100
    assert_eq!(seller_rep.score, 100);

    let buyer_rep = s.client.get_reputation(&buyer);
    assert_eq!(buyer_rep.jobs_as_buyer, 2);
    // 2 completed * 40 = 80
    assert_eq!(buyer_rep.score, 80);

    let stats = s.client.get_stats();
    assert_eq!(stats.total_completed, 2);
    assert_eq!(stats.total_volume, 1_500);
}

#[test]
fn test_dispute_penalises_score() {
    let s = setup();
    let account = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);

    // 3 completed jobs as seller -> 3*40 + 3*10 = 150
    for _ in 0..3 {
        s.client.record_completion(&account, &buyer, &100);
    }
    assert_eq!(s.client.get_reputation(&account).score, 150);

    // one dispute removes 120 -> 30
    s.client.record_dispute(&account);
    let rep = s.client.get_reputation(&account);
    assert_eq!(rep.disputes, 1);
    assert_eq!(rep.score, 30);
    assert_eq!(s.client.get_stats().total_disputes, 1);
}

#[test]
fn test_unauthorized_caller_cannot_record() {
    let env = Env::default();
    let contract_id = env.register(RegistryContract, ());
    let client = RegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let escrow = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin);
    client.set_escrow(&escrow);

    // Drop all mocked auths: nobody is authorised now.
    env.set_auths(&[]);
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let res = client.try_record_completion(&seller, &buyer, &100);
    assert!(res.is_err());
}

#[test]
fn test_fee_accounting_and_withdraw() {
    let s = setup();
    let token_admin = Address::generate(&s.env);
    let (token_id, token_mint) = create_token(&s.env, &token_admin);

    // Fund the registry contract so it can pay out.
    token_mint.mint(&s.contract_id, &10_000);

    s.client.note_fee(&token_id, &300);
    s.client.note_fee(&token_id, &200);
    assert_eq!(s.client.get_fees(&token_id), 500);

    let dest = Address::generate(&s.env);
    s.client.withdraw_fees(&token_id, &dest, &400);
    assert_eq!(s.client.get_fees(&token_id), 100);

    let token_client = token::Client::new(&s.env, &token_id);
    assert_eq!(token_client.balance(&dest), 400);
}

#[test]
fn test_withdraw_more_than_collected_fails() {
    let s = setup();
    let token_admin = Address::generate(&s.env);
    let (token_id, _) = create_token(&s.env, &token_admin);
    s.client.note_fee(&token_id, &100);
    let dest = Address::generate(&s.env);
    let res = s.client.try_withdraw_fees(&token_id, &dest, &200);
    assert!(res.is_err());
}

#[test]
fn test_reputation_updated_at_tracks_ledger() {
    let s = setup();
    s.env.ledger().set_timestamp(12_345);
    let seller = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);
    s.client.record_completion(&seller, &buyer, &100);
    assert_eq!(s.client.get_reputation(&seller).updated_at, 12_345);
}
