import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { config } from "@/lib/stellar/config";

export function LandingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </span>
          Aegis
        </div>
        <p className="text-sm text-muted-foreground">
          Decentralized escrow on Stellar · Soroban smart contracts
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            App
          </Link>
          <a href="#architecture" className="hover:text-foreground">
            Architecture
          </a>
          <span className="font-mono text-xs">
            {config.network} · {config.buildSha.slice(0, 7)}
          </span>
        </div>
      </div>
    </footer>
  );
}
