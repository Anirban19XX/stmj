/** Centralised React Query keys so invalidation stays consistent. */
export const queryKeys = {
  escrows: (address?: string) => ["escrows", address] as const,
  escrow: (id: string) => ["escrow", id] as const,
  escrowConfig: () => ["escrow-config"] as const,
  stats: () => ["stats"] as const,
  reputation: (address?: string) => ["reputation", address] as const,
  fees: (token?: string) => ["fees", token] as const,
};
