"use client";

/**
 * Central orchestration for every contract write.
 *
 * Wraps a service call in the full transaction lifecycle: registers a tracked
 * transaction, drives its status, shows toast feedback, maps errors to readable
 * messages, invalidates the right React Query caches, and registers a retry
 * handler so the Transaction Center can re-run failed writes.
 */

import { useCallback } from "react";
import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWallet } from "./use-wallet";
import { useTxStore } from "@/stores/tx-store";
import { type Signer } from "@/lib/stellar/contracts/invoke";
import { type SubmitResult } from "@/lib/stellar/client";
import { AppError, handleError } from "@/lib/errors";
import * as escrow from "@/lib/stellar/contracts/escrow";

export interface WriteOptions {
  /** Human label, e.g. "Release milestone #2". */
  label: string;
  /** Contract method invoked (for the tx record). */
  method: string;
  contractId?: string;
  /** Performs the actual service call. */
  run: (publicKey: string, sign: Signer) => Promise<SubmitResult>;
  /** Query keys to invalidate on success. */
  invalidate?: QueryKey[];
  /** Which error table to use for messages. */
  contract?: "escrow" | "registry";
  /** Arguments passed to the contract call (optional, for persistent retry). */
  args?: any[];
}

/** In-memory retry handlers, keyed by tracked-tx id (this session only). */
const retryHandlers = new Map<string, () => Promise<SubmitResult>>();

function stringifyWithBigInt(value: any): string {
  return JSON.stringify(value, (_, v) =>
    typeof v === "bigint" ? { __type: "bigint", value: v.toString() } : v
  );
}

function parseWithBigInt(text: string): any {
  return JSON.parse(text, (_, v) =>
    v && typeof v === "object" && v.__type === "bigint" ? BigInt(v.value) : v
  );
}

function reconstructRun(method: string, args: any[]): ((publicKey: string, sign: Signer) => Promise<SubmitResult>) | null {
  switch (method) {
    case "create_escrow":
      return (pk, sign) => escrow.createEscrow(args[0], pk, sign);
    case "mark_delivered":
      return (pk, sign) => escrow.markDelivered(args[0], pk, sign);
    case "release_milestone":
      return (pk, sign) => escrow.releaseMilestone(args[0], args[1], pk, sign);
    case "refund":
      return (pk, sign) => escrow.refund(args[0], pk, sign);
    case "raise_dispute":
      return (pk, sign) => escrow.raiseDispute(args[0], args[1], pk, sign);
    case "resolve_dispute":
      return (pk, sign) => escrow.resolveDispute(args[0], args[1], pk, sign);
    case "cancel":
      return (pk, sign) => escrow.cancel(args[0], pk, sign);
    default:
      return null;
  }
}

export function useContractWrite() {
  const { address, isConnected } = useWallet();
  const sign = useWallet().sign;
  const qc = useQueryClient();
  const txStore = useTxStore();

  const execute = useCallback(
    async (opts: WriteOptions): Promise<SubmitResult> => {
      if (!isConnected || !address) {
        const e = new AppError("WALLET_UNAVAILABLE", "Connect a wallet first.");
        toast.error(e.message);
        throw e;
      }

      const id = txStore.add({
        label: opts.label,
        method: opts.method,
        contractId: opts.contractId,
        argsJson: opts.args ? stringifyWithBigInt(opts.args) : undefined,
        invalidateJson: opts.invalidate ? JSON.stringify(opts.invalidate) : undefined,
      });
      const attempt = () => opts.run(address, sign);
      retryHandlers.set(id, attempt);

      txStore.setStatus(id, "processing");
      const toastId = toast.loading(`${opts.label}…`);

      try {
        const res = await attempt();
        txStore.setStatus(id, "confirmed", { hash: res.hash });
        toast.success(`${opts.label} confirmed`, { id: toastId });
        opts.invalidate?.forEach((key) => qc.invalidateQueries({ queryKey: key }));
        retryHandlers.delete(id);
        return res;
      } catch (err) {
        const e = handleError(err, {
          scope: "contract-write",
          method: opts.method,
          contract: opts.contract,
        });
        txStore.setStatus(id, "failed", { error: e.message });
        toast.error(e.message, { id: toastId });
        throw e;
      }
    },
    [address, isConnected, sign, qc, txStore],
  );

  /** Re-run a previously failed transaction (if its handler is still in memory). */
  const retry = useCallback(
    async (trackedId: string) => {
      const tx = useTxStore.getState().transactions.find((t) => t.id === trackedId);
      let handler = retryHandlers.get(trackedId);

      if (!handler) {
        if (!tx || !tx.method || !tx.argsJson) {
          toast.error("This transaction can no longer be retried — re-submit it.");
          return;
        }
        if (!isConnected || !address) {
          toast.error("Connect a wallet first.");
          return;
        }
        try {
          const parsedArgs = parseWithBigInt(tx.argsJson);
          const runFn = reconstructRun(tx.method, parsedArgs);
          if (!runFn) {
            toast.error("This transaction can no longer be retried — re-submit it.");
            return;
          }
          handler = () => runFn(address, sign);
        } catch (err) {
          console.error("Failed to reconstruct retry handler", err);
          toast.error("This transaction can no longer be retried — re-submit it.");
          return;
        }
      }

      txStore.update(trackedId, {
        status: "processing",
        retries: (tx?.retries ?? 0) + 1,
        error: undefined,
      });
      const toastId = toast.loading(`Retrying ${tx?.label ?? "transaction"}…`);
      try {
        const res = await handler();
        txStore.setStatus(trackedId, "confirmed", { hash: res.hash });
        toast.success("Transaction confirmed", { id: toastId });
        if (tx?.invalidateJson) {
          try {
            const invalidateKeys = JSON.parse(tx.invalidateJson) as QueryKey[];
            invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
          } catch (e) {
            console.error("Failed to parse invalidateJson during retry", e);
          }
        }
        retryHandlers.delete(trackedId);
      } catch (err) {
        const e = handleError(err, { scope: "contract-write.retry" });
        txStore.setStatus(trackedId, "failed", { error: e.message });
        toast.error(e.message, { id: toastId });
      }
    },
    [txStore, isConnected, address, sign, qc],
  );

  return { execute, retry };
}
