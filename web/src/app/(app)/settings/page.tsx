"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ConnectButton } from "@/components/wallet/connect-button";
import { NetworkBadge } from "@/components/wallet/network-badge";
import { AddressDisplay } from "@/components/shared/address-display";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWallet } from "@/hooks/use-wallet";
import { useSettingsStore } from "@/stores/settings-store";
import { config, explorerContractUrl } from "@/lib/stellar/config";

export default function SettingsPage() {
  const { address, isConnected } = useWallet();
  const s = useSettingsStore();

  return (
    <>
      <PageHeader title="Settings" description="Manage your wallet connection and app preferences." />

      <Card className="p-6">
        <h3 className="text-sm font-semibold">Wallet</h3>
        <Separator className="my-4" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Network</span>
              <NetworkBadge />
            </div>
            {isConnected && address ? (
              <AddressDisplay address={address} />
            ) : (
              <p className="text-sm text-muted-foreground">No wallet connected</p>
            )}
          </div>
          <ConnectButton />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold">Preferences</h3>
        <Separator className="my-4" />
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Default arbiter address</Label>
              <Input
                placeholder="G…"
                value={s.defaultArbiter}
                onChange={(e) => s.set("defaultArbiter", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Pre-fills the create-escrow form.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Preferred token (SAC)</Label>
              <Input
                placeholder="C…"
                value={s.preferredTokenId}
                onChange={(e) => s.set("preferredTokenId", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Default settlement asset.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Activity poll interval (ms)</Label>
            <Input
              type="number"
              min={2000}
              step={1000}
              value={s.activityPollIntervalMs}
              onChange={(e) => s.set("activityPollIntervalMs", Number(e.target.value))}
              className="max-w-[200px]"
            />
          </div>

          <ToggleRow
            label="Live activity toasts"
            description="Pop a toast for each new on-chain event."
            checked={s.liveToasts}
            onChange={(v) => s.set("liveToasts", v)}
          />
          <ToggleRow
            label="Compact tables"
            description="Denser rows in the transaction center."
            checked={s.compactTables}
            onChange={(v) => s.set("compactTables", v)}
          />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Switch between light and dark.</p>
            </div>
            <ThemeToggle />
          </div>

          <Separator />
          <Button variant="outline" onClick={s.reset}>
            Reset preferences
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold">Contracts</h3>
        <Separator className="my-4" />
        <dl className="space-y-3 text-sm">
          <ContractRow label="Escrow contract" id={config.escrowContractId} />
          <ContractRow label="Registry contract" id={config.registryContractId} />
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">RPC endpoint</dt>
            <dd className="font-mono text-xs">{config.rpcUrl}</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ContractRow({ label, id }: { label: string; id: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        {id ? (
          <a
            href={explorerContractUrl(id)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-primary hover:underline"
          >
            {id.slice(0, 6)}…{id.slice(-6)}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">not set</span>
        )}
      </dd>
    </div>
  );
}
