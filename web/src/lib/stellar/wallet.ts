/**
 * Wallet infrastructure built on StellarWalletsKit.
 *
 * Supports every wallet module the kit ships (Freighter, xBull, Albedo, Lobstr,
 * Hana, Rabet, Ledger, WalletConnect, …) behind a single, framework-agnostic
 * API. The kit is browser-only, so it is lazily constructed on first use.
 *
 * Connect/disconnect, account switching and network selection are all routed
 * through here; React state lives in `stores/wallet-store.ts`.
 */

import {
  allowAllModules,
  ISupportedWallet,
  StellarWalletsKit,
  WalletNetwork,
} from "@creit.tech/stellar-wallets-kit";
import { config } from "./config";
import { logger } from "@/lib/logger";

const log = logger.scope("wallet");

function walletNetwork(): WalletNetwork {
  switch (config.network) {
    case "mainnet":
      return WalletNetwork.PUBLIC;
    case "local":
      return WalletNetwork.STANDALONE;
    default:
      return WalletNetwork.TESTNET;
  }
}

let kit: StellarWalletsKit | null = null;

/** Lazily build (or return) the singleton kit. Throws on the server. */
export function getKit(): StellarWalletsKit {
  if (typeof window === "undefined") {
    throw new Error("Wallet kit is only available in the browser.");
  }
  if (!kit) {
    kit = new StellarWalletsKit({
      network: walletNetwork(),
      // No wallet pre-selected; the modal lets the user choose.
      modules: allowAllModules(),
    });
    log.debug("kit initialized", { network: config.network });
  }
  return kit;
}

/** All wallets the kit can offer, with availability flags for the UI. */
export async function getSupportedWallets(): Promise<ISupportedWallet[]> {
  return getKit().getSupportedWallets();
}

/** Open the selector modal; resolves with the chosen address + wallet meta. */
export async function connectWithModal(): Promise<{
  address: string;
  walletId: string;
  walletName: string;
}> {
  const k = getKit();
  return new Promise((resolve, reject) => {
    k.openModal({
      onWalletSelected: async (option: ISupportedWallet) => {
        try {
          k.setWallet(option.id);
          const { address } = await k.getAddress();
          log.info("wallet connected", { walletId: option.id, address });
          resolve({ address, walletId: option.id, walletName: option.name });
        } catch (err) {
          reject(err);
        }
      },
      onClosed: (err?: Error) => {
        if (err) reject(err);
        else reject(new Error("Wallet selection cancelled."));
      },
    });
  });
}

/** Reconnect to a previously selected wallet without showing the modal. */
export async function reconnect(walletId: string): Promise<string> {
  const k = getKit();
  k.setWallet(walletId);
  const { address } = await k.getAddress();
  return address;
}

/** Sign a transaction XDR with the active wallet. Returns the signed XDR. */
export async function signTransaction(
  xdr: string,
  address: string,
): Promise<string> {
  const k = getKit();
  const { signedTxXdr } = await k.signTransaction(xdr, {
    address,
    networkPassphrase: config.networkPassphrase,
  });
  return signedTxXdr;
}

/** Forget the active wallet selection. */
export function disconnect(): void {
  try {
    kit?.disconnect?.();
  } catch {
    /* some modules have no disconnect — clearing local state is enough */
  }
  log.info("wallet disconnected");
}
