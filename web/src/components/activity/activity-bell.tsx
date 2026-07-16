"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActivityStore } from "@/stores/activity-store";
import { cn } from "@/lib/utils";

export function ActivityBell() {
  const unread = useActivityStore((s) => s.unread);
  const connected = useActivityStore((s) => s.connected);
  const markAllRead = useActivityStore((s) => s.markAllRead);

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative"
      onClick={() => markAllRead()}
      aria-label="Activity"
    >
      <Link href="/activity">
        <Bell className="h-5 w-5" />
        <span
          className={cn(
            "absolute right-1.5 top-1.5 h-2 w-2 rounded-full",
            connected ? "bg-success" : "bg-muted-foreground/40",
          )}
          title={connected ? "Live" : "Offline"}
        />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
