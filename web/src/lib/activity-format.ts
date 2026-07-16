/** Human-readable descriptions for contract activity events. */

import { formatAmount } from "./format";
import type { ActivityEvent, ActivityKind } from "@/types";

export type ActivityTone = "success" | "warning" | "danger" | "neutral";

const amt = (v: string | number | undefined) =>
  v === undefined ? "" : `${formatAmount(BigInt(v))}`;

export interface ActivityDescription {
  title: string;
  detail: string;
  tone: ActivityTone;
}

export function describeActivity(e: ActivityEvent): ActivityDescription {
  const id = e.data.id !== undefined ? `#${e.data.id}` : "";
  switch (e.kind) {
    case "EscrowCreated":
      return { title: `Escrow ${id} created`, detail: `${amt(e.data.amount)} locked in escrow`, tone: "neutral" };
    case "Delivered":
      return { title: `Escrow ${id} marked delivered`, detail: "Seller signalled delivery", tone: "neutral" };
    case "MilestoneReleased":
      return { title: `Milestone released ${id}`, detail: `${amt(e.data.amount)} released to seller`, tone: "success" };
    case "Refunded":
      return { title: `Escrow ${id} refunded`, detail: `${amt(e.data.amount)} returned to buyer`, tone: "warning" };
    case "Disputed":
      return { title: `Dispute raised ${id}`, detail: "Escalated to arbiter", tone: "danger" };
    case "Resolved":
      return {
        title: `Dispute resolved ${id}`,
        detail: `Seller ${amt(e.data.toSeller)} · Buyer ${amt(e.data.toBuyer)}`,
        tone: "success",
      };
    case "Cancelled":
      return { title: `Escrow ${id} cancelled`, detail: "Full refund to buyer", tone: "warning" };
    case "CompletionRecorded":
      return { title: "Reputation updated", detail: `${amt(e.data.amount)} settled volume`, tone: "success" };
    case "DisputeRecorded":
      return { title: "Dispute recorded", detail: "Reputation penalised", tone: "danger" };
    case "FeeCollected":
      return { title: "Platform fee collected", detail: `${amt(e.data.amount)} to treasury`, tone: "neutral" };
    case "FeesWithdrawn":
      return { title: "Treasury withdrawal", detail: `${amt(e.data.amount)} withdrawn`, tone: "neutral" };
    case "RegistryInitialized":
    case "Initialized":
    case "EscrowRegistered":
      return { title: "Contract configured", detail: "Marketplace setup", tone: "neutral" };
    default:
      return { title: e.kind as ActivityKind, detail: "", tone: "neutral" };
  }
}
