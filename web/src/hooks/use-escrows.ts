"use client";

/** React Query hooks for escrow reads + write actions. */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import { useContractWrite } from "./use-contract-write";
import { useWallet } from "./use-wallet";
import * as escrow from "@/lib/stellar/contracts/escrow";
import { config, isContractsConfigured } from "@/lib/stellar/config";
import type { CreateEscrowParams } from "@/lib/stellar/contracts/escrow";

const STALE = 15_000;

export function useUserEscrows(address?: string | null) {
  return useQuery({
    queryKey: queryKeys.escrows(address ?? undefined),
    queryFn: () => escrow.getUserEscrows(address!),
    enabled: Boolean(address) && isContractsConfigured(),
    staleTime: STALE,
  });
}

export function useEscrow(id?: bigint) {
  return useQuery({
    queryKey: queryKeys.escrow(id?.toString() ?? ""),
    queryFn: () => escrow.getEscrow(id!),
    enabled: id !== undefined && isContractsConfigured(),
    staleTime: STALE,
  });
}

export function useEscrowConfig() {
  return useQuery({
    queryKey: queryKeys.escrowConfig(),
    queryFn: () => escrow.getConfig(),
    enabled: isContractsConfigured(),
    staleTime: 60_000,
  });
}

/** All write actions, wired through the transaction orchestrator. */
export function useEscrowActions() {
  const { execute } = useContractWrite();
  const { address } = useWallet();

  const invalidateFor = (id?: bigint) =>
    [
      queryKeys.escrows(address ?? undefined),
      queryKeys.stats(),
      ...(id !== undefined ? [queryKeys.escrow(id.toString())] : []),
    ];

  return {
    previewCreateEscrow: (params: CreateEscrowParams) => {
      if (!address) {
        throw new Error("Connect a wallet first.");
      }
      return escrow.previewCreateEscrow(params, address);
    },

    createEscrow: (params: CreateEscrowParams) =>
      execute({
        label: `Create escrow “${params.title}”`,
        method: "create_escrow",
        contractId: config.escrowContractId,
        run: (pk, sign) => escrow.createEscrow(params, pk, sign),
        invalidate: invalidateFor(),
        args: [params],
      }),

    markDelivered: (id: bigint) =>
      execute({
        label: `Mark escrow #${id} delivered`,
        method: "mark_delivered",
        contractId: config.escrowContractId,
        run: (pk, sign) => escrow.markDelivered(id, pk, sign),
        invalidate: invalidateFor(id),
        args: [id],
      }),

    releaseMilestone: (id: bigint, index: number) =>
      execute({
        label: `Release milestone #${index + 1} (escrow #${id})`,
        method: "release_milestone",
        contractId: config.escrowContractId,
        run: (pk, sign) => escrow.releaseMilestone(id, index, pk, sign),
        invalidate: invalidateFor(id),
        args: [id, index],
      }),

    refund: (id: bigint) =>
      execute({
        label: `Refund escrow #${id}`,
        method: "refund",
        contractId: config.escrowContractId,
        run: (pk, sign) => escrow.refund(id, pk, sign),
        invalidate: invalidateFor(id),
        args: [id],
      }),

    raiseDispute: (id: bigint, caller: string) =>
      execute({
        label: `Raise dispute on escrow #${id}`,
        method: "raise_dispute",
        contractId: config.escrowContractId,
        run: (pk, sign) => escrow.raiseDispute(id, caller, pk, sign),
        invalidate: invalidateFor(id),
        args: [id, caller],
      }),

    resolveDispute: (id: bigint, sellerBps: number) =>
      execute({
        label: `Resolve dispute on escrow #${id}`,
        method: "resolve_dispute",
        contractId: config.escrowContractId,
        run: (pk, sign) => escrow.resolveDispute(id, sellerBps, pk, sign),
        invalidate: invalidateFor(id),
        args: [id, sellerBps],
      }),

    cancel: (id: bigint) =>
      execute({
        label: `Cancel escrow #${id}`,
        method: "cancel",
        contractId: config.escrowContractId,
        run: (pk, sign) => escrow.cancel(id, pk, sign),
        invalidate: invalidateFor(id),
        args: [id],
      }),
  };
}
