"use client";

import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { WalletMenu } from "./wallet-menu";

export function ConnectButton({ full = false }: { full?: boolean }) {
  const { isConnected, isConnecting, connect } = useWallet();

  if (isConnected) return <WalletMenu />;

  return (
    <Button
      onClick={() => void connect().catch(() => {})}
      disabled={isConnecting}
      className={full ? "w-full" : ""}
    >
      {isConnecting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Wallet className="mr-2 h-4 w-4" />
      )}
      {isConnecting ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
