"use client";

/**
 * Transaction lifecycle store. Every contract write is tracked here through its
 * states (pending → processing → confirmed | failed) and surfaced in the
 * Transaction Center, with hash, explorer link, timestamp, target contract and
 * retry support.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TrackedTransaction, TxStatus } from "@/types";

let counter = 0;
const newId = () => `tx_${Date.now().toString(36)}_${(counter++).toString(36)}`;

interface TxState {
  transactions: TrackedTransaction[];
  add: (tx: Pick<TrackedTransaction, "label" | "method" | "contractId" | "argsJson" | "invalidateJson">) => string;
  update: (id: string, patch: Partial<TrackedTransaction>) => void;
  setStatus: (id: string, status: TxStatus, extra?: Partial<TrackedTransaction>) => void;
  remove: (id: string) => void;
  clearResolved: () => void;
}

const MAX = 100;

export const useTxStore = create<TxState>()(
  persist(
    (set) => ({
      transactions: [],

      add(tx) {
        const id = newId();
        const now = Date.now();
        const record: TrackedTransaction = {
          id,
          label: tx.label,
          method: tx.method,
          contractId: tx.contractId,
          argsJson: tx.argsJson,
          invalidateJson: tx.invalidateJson,
          status: "pending",
          createdAt: now,
          updatedAt: now,
          retries: 0,
        };
        set((s) => ({ transactions: [record, ...s.transactions].slice(0, MAX) }));
        return id;
      },

      update(id, patch) {
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t,
          ),
        }));
      },

      setStatus(id, status, extra) {
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, status, ...extra, updatedAt: Date.now() } : t,
          ),
        }));
      },

      remove(id) {
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
      },

      clearResolved() {
        set((s) => ({
          transactions: s.transactions.filter(
            (t) => t.status === "pending" || t.status === "processing",
          ),
        }));
      },
    }),
    { name: "aegis.transactions" },
  ),
);

/** Derived selectors. */
export const selectActiveCount = (s: TxState) =>
  s.transactions.filter((t) => t.status === "pending" || t.status === "processing")
    .length;
