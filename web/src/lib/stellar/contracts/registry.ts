/**
 * Registry contract service: reputation + treasury reads. (All mutations to the
 * registry are performed by the escrow contract via inter-contract calls, so the
 * frontend only ever reads from here.)
 */

import { config } from "../config";
import { simulateRead } from "../client";
import { toAddress } from "../scval";
import type { MarketplaceStats, Reputation } from "@/types";

const CID = () => config.registryContractId;

interface RawReputation {
  account: string;
  jobs_as_seller: number;
  jobs_as_buyer: number;
  disputes: number;
  volume: bigint;
  score: number;
  updated_at: bigint;
}

export async function getReputation(account: string): Promise<Reputation> {
  const raw = await simulateRead<RawReputation>(CID(), "get_reputation", [
    toAddress(account),
  ]);
  return {
    account: raw.account,
    jobsAsSeller: raw.jobs_as_seller,
    jobsAsBuyer: raw.jobs_as_buyer,
    disputes: raw.disputes,
    volume: raw.volume,
    score: raw.score,
    updatedAt: raw.updated_at,
  };
}

export async function getStats(): Promise<MarketplaceStats> {
  const raw = await simulateRead<{
    total_completed: bigint;
    total_volume: bigint;
    total_disputes: bigint;
  }>(CID(), "get_stats", []);
  return {
    totalCompleted: raw.total_completed,
    totalVolume: raw.total_volume,
    totalDisputes: raw.total_disputes,
  };
}

export async function getFees(token: string): Promise<bigint> {
  return simulateRead<bigint>(CID(), "get_fees", [toAddress(token)]);
}
