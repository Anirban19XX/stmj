"use client";

import { ChevronDown, Copy, ExternalLink, LogOut, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/hooks/use-wallet";
import { explorerAccountUrl } from "@/lib/stellar/config";
import { NetworkBadge } from "./network-badge";

export function WalletMenu() {
  const { address, shortAddress, walletName, disconnect, connect, networkMismatch } =
    useWallet();
  if (!address) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm">{shortAddress}</span>
          {networkMismatch && (
            <span className="h-2 w-2 rounded-full bg-destructive" title="Network mismatch" />
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{walletName ?? "Wallet"}</span>
          <NetworkBadge />
        </DropdownMenuLabel>
        <div className="px-2 pb-1 font-mono text-xs text-muted-foreground break-all">
          {address}
        </div>
        <DropdownMenuSeparator />
        {networkMismatch && (
          <>
            <div className="px-2 py-1.5">
              <Badge variant="destructive" className="w-full justify-center">
                Wallet network mismatch
              </Badge>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={async () => {
            await navigator.clipboard.writeText(address);
            toast.success("Address copied");
          }}
        >
          <Copy className="mr-2 h-4 w-4" /> Copy address
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={explorerAccountUrl(address)} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" /> View on explorer
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void connect().catch(() => {})}>
          <RefreshCw className="mr-2 h-4 w-4" /> Switch wallet / account
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={disconnect}
        >
          <LogOut className="mr-2 h-4 w-4" /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
