"use client";

import { Award, CircleDollarSign, FileText, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { NotConfiguredBanner } from "@/components/shared/not-configured-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/stats/stat-card";
import { EscrowList } from "@/components/escrow/escrow-list";
import { CreateEscrowDialog } from "@/components/escrow/create-escrow-dialog";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { ConnectButton } from "@/components/wallet/connect-button";
import { Card } from "@/components/ui/card";
import { useWallet } from "@/hooks/use-wallet";
import { useUserEscrows } from "@/hooks/use-escrows";
import { useReputation } from "@/hooks/use-stats";
import { formatAmount } from "@/lib/format";
import { OPEN_STATUSES } from "@/types";

export default function DashboardPage() {
  const { address, isConnected } = useWallet();
  const { data: escrows = [], isLoading } = useUserEscrows(address);
  const { data: reputation } = useReputation(address);

  const active = escrows.filter((e) => OPEN_STATUSES.has(e.status)).length;
  const locked = escrows
    .filter((e) => OPEN_STATUSES.has(e.status))
    .reduce((sum, e) => sum + (e.totalAmount - e.releasedAmount), 0n);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Manage your escrows, release milestones and resolve disputes."
        action={isConnected ? <CreateEscrowDialog /> : undefined}
      />

      <NotConfiguredBanner />

      {!isConnected ? (
        <EmptyState
          icon={Wallet}
          title="Connect your wallet"
          description="Connect a Stellar wallet to view your escrows and start trustless deals."
          action={<ConnectButton />}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active escrows" value={active} icon={FileText} />
            <StatCard
              label="Value locked"
              valueText={formatAmount(locked)}
              icon={CircleDollarSign}
              hint="across your open escrows"
            />
            <StatCard
              label="Reputation"
              value={reputation?.score ?? 0}
              icon={Award}
              hint={`${reputation?.jobsAsSeller ?? 0} delivered · ${reputation?.disputes ?? 0} disputes`}
            />
            <StatCard
              label="Total deals"
              value={escrows.length}
              icon={Wallet}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <EscrowList escrows={escrows} isLoading={isLoading} />
            </div>
            <Card className="h-fit p-4">
              <h3 className="mb-2 text-sm font-semibold">Recent activity</h3>
              <ActivityFeed limit={6} />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
