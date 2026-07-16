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

  // Restore a previously connected wallet exactly once on mount.
  useEffect(() => {
    if (store.walletId) {
      void store.restore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
