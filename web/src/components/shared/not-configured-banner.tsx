"use client";

import { AlertTriangle } from "lucide-react";
import { isContractsConfigured } from "@/lib/stellar/config";

/**
 * Shown when the contract ids aren't set in the environment. Keeps the app fully
 * navigable for demos while making the missing configuration obvious.
 */
export function NotConfiguredBanner() {
  if (isContractsConfigured()) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div>
        <p className="font-medium">Contracts not configured</p>
        <p className="text-muted-foreground">
          Set <code className="rounded bg-muted px-1">NEXT_PUBLIC_ESCROW_CONTRACT_ID</code>{" "}
          and <code className="rounded bg-muted px-1">NEXT_PUBLIC_REGISTRY_CONTRACT_ID</code>{" "}
          in <code className="rounded bg-muted px-1">.env.local</code> (run{" "}
          <code className="rounded bg-muted px-1">scripts/deploy_testnet.sh</code>) to enable
          on-chain actions.
        </p>
      </div>
    </div>
  );
}
