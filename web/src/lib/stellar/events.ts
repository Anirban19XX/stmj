/**
 * Real-time contract event stream.
 *
 * Soroban RPC exposes events through `getEvents` (polling) rather than a socket,
 * so we run a resilient poll loop: start a few ledgers back to backfill recent
 * history, then page forward by cursor. Decoded events drive the live activity
 * feed and invalidate React Query caches so the whole UI updates without a
 * refresh.
 */

import { scValToNative } from "@stellar/stellar-sdk";
import { getContractEvents, getLatestLedger } from "./client";
import { config } from "./config";
import { logger } from "@/lib/logger";
import type { ActivityEvent, ActivityKind } from "@/types";

const log = logger.scope("events");

/** Field names for each event's data vector (in on-chain definition order). */
const DATA_FIELDS: Partial<Record<ActivityKind, string[]>> = {
  EscrowCreated: ["id", "amount"],
  Delivered: ["id"],
  MilestoneReleased: ["id", "amount"],
  Refunded: ["id", "amount"],
  Disputed: ["id"],
  Resolved: ["id", "toSeller", "toBuyer"],
  Cancelled: ["id"],
  Initialized: ["registry", "feeBps"],
  CompletionRecorded: ["amount"],
  DisputeRecorded: ["totalDisputes"],
  FeeCollected: ["amount"],
  FeesWithdrawn: ["amount"],
};

function toJsonSafe(v: unknown): string | number {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return v;
  return String(v);
}

/** Decode a raw RPC event into an `ActivityEvent`. */
export function decodeEvent(raw: {
  id: string;
  contractId?: { toString(): string } | string;
  topic: unknown[];
  value: unknown;
  ledger: number;
  ledgerClosedAt?: string;
  txHash?: string;
}): ActivityEvent | null {
  try {
    const topics = raw.topic.map((t) => scValToNative(t as never));
    const kind = String(topics[0]) as ActivityKind;
    const topicAddrs = topics.slice(1).map((t) => String(t));

    const decodedValue = scValToNative(raw.value as never);
    const valueArr: unknown[] = Array.isArray(decodedValue)
      ? decodedValue
      : decodedValue == null
        ? []
        : [decodedValue];

    const fields = DATA_FIELDS[kind] ?? [];
    const data: Record<string, string | number> = {};
    fields.forEach((name, i) => {
      if (i < valueArr.length) data[name] = toJsonSafe(valueArr[i]);
    });

    return {
      id: raw.id,
      kind,
      contractId:
        typeof raw.contractId === "string"
          ? raw.contractId
          : (raw.contractId?.toString() ?? ""),
      topics: topicAddrs,
      data,
      ledger: raw.ledger,
      timestamp: raw.ledgerClosedAt,
      txHash: raw.txHash,
    };
  } catch (err) {
    log.warn("failed to decode event", { err: String(err) });
    return null;
  }
}

export interface EventSubscription {
  stop: () => void;
}

export interface SubscribeOptions {
  onEvent: (event: ActivityEvent) => void;
  onError?: (error: unknown) => void;
  /** Defaults to the escrow + registry contracts. */
  contractIds?: string[];
  pollIntervalMs?: number;
  /** How many ledgers of history to backfill on start. */
  backfillLedgers?: number;
}

/** Start polling for events. Returns a handle whose `stop()` ends the loop. */
export function subscribeToEvents(opts: SubscribeOptions): EventSubscription {
  const contractIds = (
    opts.contractIds ?? [config.escrowContractId, config.registryContractId]
  ).filter(Boolean);
  const interval = opts.pollIntervalMs ?? 5_000;
  const backfill = opts.backfillLedgers ?? 60;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cursor: string | undefined;
  const seen = new Set<string>();

  async function tick() {
    if (stopped) return;
    try {
      let startLedger = 0;
      if (!cursor) {
        const latest = await getLatestLedger();
        startLedger = Math.max(1, latest - backfill);
      }

      const res = await getContractEvents({ startLedger, contractIds, cursor });

      for (const raw of res.events) {
        const decoded = decodeEvent(raw as never);
        if (!decoded || seen.has(decoded.id)) continue;
        seen.add(decoded.id);
        opts.onEvent(decoded);
      }
      cursor = res.cursor;
    } catch (err) {
      // Most commonly the start ledger fell outside RPC retention — reset cursor
      // and the next tick re-derives a fresh start point.
      cursor = undefined;
      opts.onError?.(err);
      log.warn("poll error, will retry", { err: String(err) });
    } finally {
      if (!stopped) timer = setTimeout(tick, interval);
    }
  }

  void tick();

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
