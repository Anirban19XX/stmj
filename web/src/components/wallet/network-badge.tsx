"use client";

import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { config } from "@/lib/stellar/config";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  testnet: "border-warning/40 bg-warning/10 text-warning",
  mainnet: "border-success/40 bg-success/10 text-success",
  local: "border-border bg-muted text-muted-foreground",
};

export function NetworkBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium capitalize", TONE[config.network], className)}
    >
      <Globe className="h-3 w-3" />
      {config.network}
    </Badge>
  );
}
