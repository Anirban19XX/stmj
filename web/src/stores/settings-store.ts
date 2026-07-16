"use client";

/** User preferences (persisted locally; no on-chain or server state). */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { config } from "@/lib/stellar/config";

interface SettingsState {
  /** Default arbiter address pre-filled in the create form. */
  defaultArbiter: string;
  /** Default settlement token id. */
  preferredTokenId: string;
  /** Activity feed poll cadence (ms). */
  activityPollIntervalMs: number;
  /** Compact tables on the dashboard/tx center. */
  compactTables: boolean;
  /** Show the live activity toasts. */
  liveToasts: boolean;

  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  reset: () => void;
}

const DEFAULTS = {
  defaultArbiter: "",
  preferredTokenId: config.defaultTokenId,
  activityPollIntervalMs: 5_000,
  compactTables: false,
  liveToasts: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      reset: () => set({ ...DEFAULTS }),
    }),
    { name: "aegis.settings" },
  ),
);
