"use client";

/** In-memory live activity feed, shared by the navbar badge and Activity page. */

import { create } from "zustand";
import type { ActivityEvent } from "@/types";

interface ActivityState {
  events: ActivityEvent[];
  unread: number;
  connected: boolean;
  push: (event: ActivityEvent) => void;
  markAllRead: () => void;
  setConnected: (connected: boolean) => void;
  clear: () => void;
}

const MAX = 200;

export const useActivityStore = create<ActivityState>((set) => ({
  events: [],
  unread: 0,
  connected: false,

  push(event) {
    set((s) => {
      if (s.events.some((e) => e.id === event.id)) return s;
      const events = [event, ...s.events].slice(0, MAX);
      return { events, unread: s.unread + 1 };
    });
  },

  markAllRead: () => set({ unread: 0 }),
  setConnected: (connected) => set({ connected }),
  clear: () => set({ events: [], unread: 0 }),
}));
