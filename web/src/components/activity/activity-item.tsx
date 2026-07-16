"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Gavel,
  PackageCheck,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { describeActivity, type ActivityTone } from "@/lib/activity-format";
import { explorerTxUrl } from "@/lib/stellar/config";
import { timeAgo } from "@/lib/format";
import type { ActivityEvent, ActivityKind } from "@/types";
import { cn } from "@/lib/utils";

const ICON: Partial<Record<ActivityKind, LucideIcon>> = {
  EscrowCreated: FileText,
  Delivered: PackageCheck,
  MilestoneReleased: ArrowUpRight,
  Refunded: ArrowDownLeft,
  Disputed: ShieldAlert,
  Resolved: Gavel,
  Cancelled: Ban,
  CompletionRecorded: CheckCircle2,
  DisputeRecorded: ShieldAlert,
  FeeCollected: CircleDollarSign,
  FeesWithdrawn: CircleDollarSign,
};

const TONE: Record<ActivityTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-primary/10 text-primary",
};

export function ActivityItem({ event }: { event: ActivityEvent }) {
  const { title, detail, tone } = describeActivity(event);
  const Icon = ICON[event.kind] ?? FileText;

  return (
    <div className="flex items-start gap-3 py-3">
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          TONE[tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {detail && <p className="truncate text-sm text-muted-foreground">{detail}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-muted-foreground">
          {event.timestamp ? timeAgo(new Date(event.timestamp).getTime()) : `ledger ${event.ledger}`}
        </p>
        {event.txHash && (
          <a
            href={explorerTxUrl(event.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            view tx
          </a>
        )}
      </div>
    </div>
  );
}
