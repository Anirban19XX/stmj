"use client";

/**
 * Wallet hook: a thin, ergonomic wrapper over the wallet store plus derived
 * helpers (network mismatch, short address) and a one-time session restore.
 */

import { useEffect } from "react";
import { useWalletStore } from "@/stores/wallet-store";
import { config } from "@/lib/stellar/config";
import { truncateAddress } from "@/lib/format";

export function useWallet() {
  const store = useWalletStore();

  // Restore a previously connected wallet once the persisted session becomes available.
  useEffect(() => {
    if (!store.walletId) return;
    if (store.status === "connected" && Boolean(store.address)) return;

    void store.restore();
  }, [store.address, store.restore, store.status, store.walletId]);

  const isConnected = store.status === "connected" && Boolean(store.address);
  const networkMismatch = store.network !== config.network;

  return {
    address: store.address,
    walletName: store.walletName,
    walletId: store.walletId,
    status: store.status,
    error: store.error,
    isConnected,
    isConnecting: store.status === "connecting",
    networkMismatch,
    network: config.network,
    shortAddress: store.address ? truncateAddress(store.address) : "",
    connect: store.connect,
    disconnect: store.disconnect,
    sign: store.sign,
  };
}
