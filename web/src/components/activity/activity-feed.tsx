"use client";

import { Radio } from "lucide-react";
import { ActivityItem } from "./activity-item";
import { EmptyState } from "@/components/shared/empty-state";
import { useActivityStore } from "@/stores/activity-store";
import { cn } from "@/lib/utils";

export function ActivityFeed({ limit }: { limit?: number }) {
  const events = useActivityStore((s) => s.events);
  const connected = useActivityStore((s) => s.connected);
  const shown = limit ? events.slice(0, limit) : events;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn(
            "flex items-center gap-1.5",
            connected ? "text-success" : "text-muted-foreground",
          )}
        >
          <Radio className={cn("h-3.5 w-3.5", connected && "animate-pulse")} />
          {connected ? "Live" : "Connecting…"}
        </span>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="Waiting for events"
          description="On-chain contract events will stream in here in real time as they happen."
        />
      ) : (
        <div className="divide-y rounded-xl border px-4">
          {shown.map((e) => (
            <ActivityItem key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
