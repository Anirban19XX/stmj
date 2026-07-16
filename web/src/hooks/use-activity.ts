"use client";

/**
 * Subscribes to the contract event stream once, fans events into the activity
 * store, refreshes affected React Query caches (so the whole UI stays live), and
 * optionally raises a toast. Mount this once, high in the tree (see providers).
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { subscribeToEvents } from "@/lib/stellar/events";
import { describeActivity } from "@/lib/activity-format";
import { isContractsConfigured } from "@/lib/stellar/config";
import { useActivityStore } from "@/stores/activity-store";
import { useSettingsStore } from "@/stores/settings-store";

export function useActivityStream() {
  const push = useActivityStore((s) => s.push);
  const setConnected = useActivityStore((s) => s.setConnected);
  const qc = useQueryClient();
  const pollIntervalMs = useSettingsStore((s) => s.activityPollIntervalMs);
  const liveToasts = useSettingsStore((s) => s.liveToasts);

  useEffect(() => {
    if (!isContractsConfigured()) return;

    const sub = subscribeToEvents({
      pollIntervalMs,
      onEvent: (event) => {
        push(event);
        setConnected(true);
        // Live state sync — refresh lists/stats touched by this event.
        qc.invalidateQueries({ queryKey: ["escrows"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
        qc.invalidateQueries({ queryKey: ["reputation"] });
        if (liveToasts) {
          const { title, detail } = describeActivity(event);
          toast(title, { description: detail });
        }
      },
      onError: () => setConnected(false),
    });

    return () => {
      sub.stop();
      setConnected(false);
    };
  }, [pollIntervalMs, liveToasts, push, setConnected, qc]);
}
