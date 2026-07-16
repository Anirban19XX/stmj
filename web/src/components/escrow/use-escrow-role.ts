"use client";

import { useWallet } from "@/hooks/use-wallet";
import type { Escrow } from "@/types";

export type EscrowRole = "buyer" | "seller" | "arbiter" | "observer";

/** Determine the connected account's role in an escrow. */
export function useEscrowRole(escrow: Escrow): EscrowRole {
  const { address } = useWallet();
  if (!address) return "observer";
  if (address === escrow.buyer) return "buyer";
  if (address === escrow.seller) return "seller";
  if (address === escrow.arbiter) return "arbiter";
  return "observer";
}
