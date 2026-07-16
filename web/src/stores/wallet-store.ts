"use client";

/**
 * Wallet state (Zustand + persisted). Holds the connected account and exposes
 * connect / disconnect / restore / sign. The actual wallet I/O lives in the
 * `lib/stellar/wallet` service; this store is the React-facing state layer.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  connectWithModal,
  disconnect as kitDisconnect,
  reconnect,
  signTransaction,
} from "@/lib/stellar/wallet";
import { config } from "@/lib/stellar/config";
import { handleError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const log = logger.scope("wallet-store");

export type WalletStatus = "idle" | "connecting" | "connected";

interface WalletState {
  address: string | null;
  walletId: string | null;
  walletName: string | null;
  status: WalletStatus;
  /** Network the app is configured for; surfaced for mismatch warnings. */
  network: string;
  error: string | null;

  connect: () => Promise<void>;
  disconnect: () => void;
  /** Re-derive the address from a previously selected wallet on app load. */
  restore: () => Promise<void>;
  /** Sign an unsigned tx XDR with the active wallet. */
  sign: (unsignedXdr: string) => Promise<string>;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      address: null,
      walletId: null,
      walletName: null,
      status: "idle",
      network: config.network,
      error: null,

      async connect() {
        set({ status: "connecting", error: null });
        try {
          const { address, walletId, walletName } = await connectWithModal();
          set({ address, walletId, walletName, status: "connected", error: null });
        } catch (err) {
          const e = handleError(err, { scope: "wallet.connect" });
          set({ status: get().address ? "connected" : "idle", error: e.message });
          throw e;
        }
      },

      disconnect() {
        kitDisconnect();
        set({
          address: null,
          walletId: null,
          walletName: null,
          status: "idle",
          error: null,
        });
      },

      async restore() {
        const { walletId } = get();
        if (!walletId) return;
        try {
          const address = await reconnect(walletId);
          // Picks up account switching done inside the wallet extension.
          set({ address, status: "connected" });
        } catch (err) {
          log.warn("restore failed; clearing session", { err: String(err) });
          set({ address: null, walletId: null, walletName: null, status: "idle" });
        }
      },

      async sign(unsignedXdr: string) {
        const { address } = get();
        if (!address) throw new Error("Connect a wallet first.");
        return signTransaction(unsignedXdr, address);
      },
    }),
    {
      name: "aegis.wallet",
      partialize: (s) => ({
        address: s.address,
        walletId: s.walletId,
        walletName: s.walletName,
        network: s.network,
      }),
    },
  ),
);
