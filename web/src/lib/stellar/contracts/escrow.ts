/**
 * Escrow contract service. Wraps the core contract's read & write methods and
 * maps raw on-chain values (snake_case, bigint) into the app's domain types.
 */

import { config } from "../config";
import { simulateRead } from "../client";
import { invokeContract, previewContractInvoke, type Signer } from "./invoke";
import {
  toAddress,
  toI128,
  toMilestoneVec,
  toStr,
  toU32,
  toU64,
} from "../scval";
import type { Escrow, EscrowConfig, EscrowStatus, Milestone } from "@/types";

const CID = () => config.escrowContractId;

/* ------------------------------- mappers --------------------------------- */

interface RawMilestone {
  amount: bigint;
  description: string;
  released: boolean;
}
interface RawEscrow {
  id: bigint;
  title: string;
  buyer: string;
  seller: string;
  arbiter: string;
  token: string;
  total_amount: bigint;
  released_amount: bigint;
  status: number;
  milestones: RawMilestone[];
  created_at: bigint;
  deadline: bigint;
}

function mapEscrow(raw: RawEscrow): Escrow {
  return {
    id: raw.id,
    title: raw.title,
    buyer: raw.buyer,
    seller: raw.seller,
    arbiter: raw.arbiter,
    token: raw.token,
    totalAmount: raw.total_amount,
    releasedAmount: raw.released_amount,
    status: raw.status as EscrowStatus,
    milestones: raw.milestones.map((m) => ({
      description: m.description,
      amount: m.amount,
      released: m.released,
    })),
    createdAt: raw.created_at,
    deadline: raw.deadline,
  };
}

/* -------------------------------- reads ---------------------------------- */

export async function getEscrow(id: bigint): Promise<Escrow> {
  const raw = await simulateRead<RawEscrow>(CID(), "get_escrow", [toU64(id)]);
  return mapEscrow(raw);
}

export async function getUserEscrowIds(account: string): Promise<bigint[]> {
  const ids = await simulateRead<bigint[]>(CID(), "get_user_escrows", [
    toAddress(account),
  ]);
  return ids ?? [];
}

/** Fetch full escrow records for an account, newest first. */
export async function fetchEscrowsInBatches<T, R>(
  ids: T[],
  worker: (id: T) => Promise<R>,
  concurrency = 6,
): Promise<R[]> {
  if (ids.length === 0) {
    return [];
  }

  const results = new Array<R | undefined>(ids.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), ids.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex++;
        if (currentIndex >= ids.length) {
          return;
        }

        const id = ids[currentIndex];
        try {
          results[currentIndex] = await worker(id);
        } catch (error) {
          console.warn("Failed to fetch escrow detail", error);
        }
      }
    }),
  );

  return results.filter((item): item is R => item !== undefined);
}

export async function getUserEscrows(account: string): Promise<Escrow[]> {
  const ids = await getUserEscrowIds(account);
  const escrows = await fetchEscrowsInBatches(ids, (id) => getEscrow(id), 6);
  return escrows.sort((a, b) => Number(b.createdAt - a.createdAt));
}

export async function getConfig(): Promise<EscrowConfig> {
  const raw = await simulateRead<{
    admin: string;
    registry: string;
    fee_bps: number;
    next_id: bigint;
  }>(CID(), "get_config", []);
  return {
    admin: raw.admin,
    registry: raw.registry,
    feeBps: raw.fee_bps,
    nextId: raw.next_id,
  };
}

/* -------------------------------- writes --------------------------------- */

export interface CreateEscrowParams {
  buyer: string;
  seller: string;
  arbiter: string;
  token: string;
  title: string;
  milestones: Milestone[];
  /** Unix seconds. */
  deadline: bigint;
}

export function previewCreateEscrow(p: CreateEscrowParams, publicKey: string) {
  return previewContractInvoke(
    CID(),
    publicKey,
    "create_escrow",
    [
      toAddress(p.buyer),
      toAddress(p.seller),
      toAddress(p.arbiter),
      toAddress(p.token),
      toStr(p.title),
      toMilestoneVec(p.milestones),
      toU64(p.deadline),
    ],
  );
}

export function createEscrow(p: CreateEscrowParams, publicKey: string, sign: Signer) {
  return invokeContract(
    CID(),
    publicKey,
    "create_escrow",
    [
      toAddress(p.buyer),
      toAddress(p.seller),
      toAddress(p.arbiter),
      toAddress(p.token),
      toStr(p.title),
      toMilestoneVec(p.milestones),
      toU64(p.deadline),
    ],
    sign,
  );
}

export function markDelivered(id: bigint, publicKey: string, sign: Signer) {
  return invokeContract(CID(), publicKey, "mark_delivered", [toU64(id)], sign);
}

export function releaseMilestone(
  id: bigint,
  index: number,
  publicKey: string,
  sign: Signer,
) {
  return invokeContract(
    CID(),
    publicKey,
    "release_milestone",
    [toU64(id), toU32(index)],
    sign,
  );
}

export function refund(id: bigint, publicKey: string, sign: Signer) {
  return invokeContract(CID(), publicKey, "refund", [toU64(id)], sign);
}

export function raiseDispute(
  id: bigint,
  caller: string,
  publicKey: string,
  sign: Signer,
) {
  return invokeContract(
    CID(),
    publicKey,
    "raise_dispute",
    [toU64(id), toAddress(caller)],
    sign,
  );
}

export function resolveDispute(
  id: bigint,
  sellerBps: number,
  publicKey: string,
  sign: Signer,
) {
  return invokeContract(
    CID(),
    publicKey,
    "resolve_dispute",
    [toU64(id), toU32(sellerBps)],
    sign,
  );
}

export function cancel(id: bigint, publicKey: string, sign: Signer) {
  return invokeContract(CID(), publicKey, "cancel", [toU64(id)], sign);
}

/** Re-export for symmetry with i128 helpers used by callers. */
export { toI128 };
