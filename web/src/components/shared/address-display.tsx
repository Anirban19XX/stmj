"use client";

import { ExternalLink } from "lucide-react";
import { truncateAddress } from "@/lib/format";
import { explorerAccountUrl, explorerContractUrl } from "@/lib/stellar/config";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";

export function AddressDisplay({
  address,
  kind = "account",
  className,
  showCopy = true,
  showExplorer = true,
}: {
  address: string;
  kind?: "account" | "contract";
  className?: string;
  showCopy?: boolean;
  showExplorer?: boolean;
}) {
  if (!address) return <span className="text-muted-foreground">—</span>;
  const url =
    kind === "contract" ? explorerContractUrl(address) : explorerAccountUrl(address);

  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-sm", className)}>
      <span title={address}>{truncateAddress(address)}</span>
      {showCopy && <CopyButton value={address} label="Address copied" />}
      {showExplorer && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary"
          aria-label="View on explorer"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </span>
  );
}
