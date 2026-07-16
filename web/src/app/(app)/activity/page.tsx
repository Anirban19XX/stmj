"use client";

import { useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { NotConfiguredBanner } from "@/components/shared/not-configured-banner";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { Button } from "@/components/ui/button";
import { useActivityStore } from "@/stores/activity-store";

export default function ActivityPage() {
  const markAllRead = useActivityStore((s) => s.markAllRead);
  const clear = useActivityStore((s) => s.clear);
  const count = useActivityStore((s) => s.events.length);

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  return (
    <>
      <PageHeader
        title="Activity feed"
        description="Live on-chain events from the escrow and registry contracts, streamed in real time."
        action={
          count > 0 ? (
            <Button variant="outline" size="sm" onClick={clear}>
              Clear
            </Button>
          ) : undefined
        }
      />
      <NotConfiguredBanner />
      <ActivityFeed />
    </>
  );
}
