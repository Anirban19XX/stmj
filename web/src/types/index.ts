/**
 * Domain types shared across the app. These mirror the on-chain Soroban data
 * structures (see `contracts/`) but use JS-friendly representations:
 * `i128`/`u64` amounts are carried as `bigint`, addresses/strings as `string`.
 */

/** Mirrors the on-chain `EscrowStatus` enum (discriminant order matters). */
export enum EscrowStatus {
  Funded = 0,
  Delivered = 1,
  Released = 2,
  Refunded = 3,
  Disputed = 4,
  Resolved = 5,
  Cancelled = 6,
}

export const ESCROW_STATUS_LABELS: Record<EscrowStatus, string> = {
  [EscrowStatus.Funded]: "Funded",
  [EscrowStatus.Delivered]: "Delivered",
  [EscrowStatus.Released]: "Released",
  [EscrowStatus.Refunded]: "Refunded",
  [EscrowStatus.Disputed]: "Disputed",
  [EscrowStatus.Resolved]: "Resolved",
  [EscrowStatus.Cancelled]: "Cancelled",
};

/** Open states a user can still act on. */
export const OPEN_STATUSES = new Set<EscrowStatus>([
  EscrowStatus.Funded,
  EscrowStatus.Delivered,
  EscrowStatus.Disputed,
]);

export interface Milestone {
  description: string;
  amount: bigint;
  released: boolean;
}

export interface Escrow {
  id: bigint;
  title: string;
  buyer: string;
  seller: string;
  arbiter: string;
  token: string;
  totalAmount: bigint;
  releasedAmount: bigint;
  status: EscrowStatus;
  milestones: Milestone[];
  createdAt: bigint;
  deadline: bigint;
}

export interface Reputation {
  account: string;
  jobsAsSeller: number;
  jobsAsBuyer: number;
  disputes: number;
  volume: bigint;
  score: number;
  updatedAt: bigint;
}

export interface MarketplaceStats {
  totalCompleted: bigint;
  totalVolume: bigint;
  totalDisputes: bigint;
}

export interface EscrowConfig {
  admin: string;
  registry: string;
  feeBps: number;
  nextId: bigint;
}

/* ----------------------------- transactions ----------------------------- */

export type TxStatus = "pending" | "processing" | "confirmed" | "failed";

export interface TrackedTransaction {
  /** Stable client id (used before a hash exists). */
  id: string;
  /** Human label, e.g. "Release milestone #2". */
  label: string;
  status: TxStatus;
  /** On-chain transaction hash once submitted. */
  hash?: string;
  /** Contract this tx targeted, for the explorer link + filtering. */
  contractId?: string;
  /** The contract method invoked. */
  method: string;
  createdAt: number;
  updatedAt: number;
  /** Human-readable error message when `status === "failed"`. */
  error?: string;
  /** How many times the user retried. */
  retries: number;
  /** Serialized argument string */
  argsJson?: string;
  /** Serialized query keys to invalidate on success */
  invalidateJson?: string;
}

/* ------------------------------- activity -------------------------------- */

export type ActivityKind =
  | "EscrowCreated"
  | "Delivered"
  | "MilestoneReleased"
  | "Refunded"
  | "Disputed"
  | "Resolved"
  | "Cancelled"
  | "CompletionRecorded"
  | "DisputeRecorded"
  | "FeeCollected"
  | "FeesWithdrawn"
  | "RegistryInitialized"
  | "Initialized"
  | "EscrowRegistered";

export interface ActivityEvent {
  /** `${ledger}-${txIndex}-${opIndex}` — stable + sortable. */
  id: string;
  kind: ActivityKind;
  /** Originating contract id. */
  contractId: string;
  /** Decoded topic addresses (buyer/seller/etc.) in topic order. */
  topics: string[];
  /** Decoded event data payload (JSON-safe). */
  data: Record<string, string | number>;
  ledger: number;
  /** ISO timestamp if the ledger close time is known. */
  timestamp?: string;
  txHash?: string;
}

/* ------------------------------- wallet ---------------------------------- */

export type StellarNetwork = "testnet" | "local" | "mainnet";

export interface WalletAccount {
  address: string;
  walletId: string;
  walletName: string;
}
