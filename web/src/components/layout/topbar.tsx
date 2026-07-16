"use client";

import { ConnectButton } from "@/components/wallet/connect-button";
import { ActivityBell } from "@/components/activity/activity-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "./mobile-nav";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
      <MobileNav />
      <div className="flex-1" />
      <ActivityBell />
      <ThemeToggle />
      <ConnectButton />
    </header>
  );
}
