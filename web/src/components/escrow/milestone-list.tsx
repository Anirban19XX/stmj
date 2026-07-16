"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/format";
import type { Milestone } from "@/types";
import { cn } from "@/lib/utils";

export function MilestoneList({
  milestones,
  canRelease,
  releasingIndex,
  onRelease,
}: {
  milestones: Milestone[];
  canRelease?: boolean;
  releasingIndex?: number | null;
  onRelease?: (index: number) => void;
}) {
  return (
    <ol className="space-y-2">
      {milestones.map((m, i) => (
        <li
          key={i}
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
            m.released ? "border-success/30 bg-success/5" : "bg-card",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
                m.released
                  ? "bg-success text-success-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {m.released ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{m.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatAmount(m.amount)} · {m.released ? "Released" : "Pending"}
              </p>
            </div>
          </div>
          {canRelease && !m.released && onRelease && (
            <Button
              size="sm"
              variant="outline"
              disabled={releasingIndex === i}
              onClick={() => onRelease(i)}
            >
              {releasingIndex === i && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Release
            </Button>
          )}
        </li>
      ))}
    </ol>
  );
}
