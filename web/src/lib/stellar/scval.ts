/**
 * Typed `ScVal` builders for contract arguments.
 *
 * Soroban requires explicit XDR encoding of arguments. These helpers keep the
 * conversions in one audited place so the service layer reads declaratively.
 */

import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import type { Milestone } from "@/types";

export const toAddress = (v: string): xdr.ScVal => Address.fromString(v).toScVal();
export const toU32 = (v: number): xdr.ScVal => nativeToScVal(v, { type: "u32" });
export const toU64 = (v: bigint | number): xdr.ScVal =>
  nativeToScVal(BigInt(v), { type: "u64" });
export const toI128 = (v: bigint): xdr.ScVal => nativeToScVal(v, { type: "i128" });
export const toStr = (v: string): xdr.ScVal => nativeToScVal(v, { type: "string" });
export const toBool = (v: boolean): xdr.ScVal => nativeToScVal(v, { type: "bool" });
const toSym = (v: string): xdr.ScVal => nativeToScVal(v, { type: "symbol" });

/**
 * Encode a `Milestone` struct. On-chain `#[contracttype]` structs are XDR maps
 * keyed by field-name symbols, which MUST be in ascending key order:
 * amount < description < released.
 */
export function toMilestone(m: Milestone): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: toSym("amount"), val: toI128(m.amount) }),
    new xdr.ScMapEntry({ key: toSym("description"), val: toStr(m.description) }),
    new xdr.ScMapEntry({ key: toSym("released"), val: toBool(m.released) }),
  ]);
}

export function toMilestoneVec(milestones: Milestone[]): xdr.ScVal {
  return xdr.ScVal.scvVec(milestones.map(toMilestone));
}
