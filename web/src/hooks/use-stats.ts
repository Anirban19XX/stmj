"use client";

/** Marketplace stats + per-account reputation reads. */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import * as registry from "@/lib/stellar/contracts/registry";
import { isContractsConfigured } from "@/lib/stellar/config";

export function useMarketplaceStats() {
  return useQuery({
    queryKey: queryKeys.stats(),
    queryFn: () => registry.getStats(),
    enabled: isContractsConfigured(),
    staleTime: 20_000,
  });
}

export function useReputation(address?: string | null) {
  return useQuery({
    queryKey: queryKeys.reputation(address ?? undefined),
    queryFn: () => registry.getReputation(address!),
    enabled: Boolean(address) && isContractsConfigured(),
    staleTime: 20_000,
  });
}
