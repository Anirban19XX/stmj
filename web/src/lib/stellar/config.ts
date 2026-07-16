/**
 * Network + contract configuration, resolved from `NEXT_PUBLIC_*` env vars with
 * sensible testnet defaults. All values are public by design (RPC URLs, network
 * passphrase, contract ids) — no secrets ever live here.
 */

import type { StellarNetwork } from "@/types";

const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet") as StellarNetwork;

interface NetworkDefaults {
  rpcUrl: string;
  passphrase: string;
  horizonUrl: string;
  explorerBase: string;
}

const DEFAULTS: Record<StellarNetwork, NetworkDefaults> = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    passphrase: "Test SDF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
    explorerBase: "https://stellar.expert/explorer/testnet",
  },
  mainnet: {
    rpcUrl: "https://soroban-rpc.mainnet.stellar.gateway.fm",
    passphrase: "Public Global Stellar Network ; September 2015",
    horizonUrl: "https://horizon.stellar.org",
    explorerBase: "https://stellar.expert/explorer/public",
  },
  local: {
    rpcUrl: "http://localhost:8000/rpc",
    passphrase: "Standalone Network ; February 2017",
    horizonUrl: "http://localhost:8000",
    explorerBase: "https://lab.stellar.org",
  },
};

const d = DEFAULTS[NETWORK];

export const config = {
  network: NETWORK,
  rpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? d.rpcUrl,
  networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? d.passphrase,
  horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL ?? d.horizonUrl,
  explorerBase: process.env.NEXT_PUBLIC_EXPLORER_BASE_URL ?? d.explorerBase,
  escrowContractId: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID ?? "",
  registryContractId: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ?? "",
  defaultTokenId: process.env.NEXT_PUBLIC_DEFAULT_TOKEN_ID ?? "",
  buildSha: process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev",
} as const;

/** True when both contract ids are present — gates write actions in the UI. */
export function isContractsConfigured(): boolean {
  return Boolean(config.escrowContractId && config.registryContractId);
}

/** Explorer URL for a transaction hash. */
export function explorerTxUrl(hash: string): string {
  return `${config.explorerBase}/tx/${hash}`;
}

/** Explorer URL for a contract or account. */
export function explorerContractUrl(id: string): string {
  return `${config.explorerBase}/contract/${id}`;
}

export function explorerAccountUrl(address: string): string {
  return `${config.explorerBase}/account/${address}`;
}
