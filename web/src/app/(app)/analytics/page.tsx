"use client";

import { Activity, CheckCircle2, CircleDollarSign, ShieldAlert, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { NotConfiguredBanner } from "@/components/shared/not-configured-banner";
import { StatCard } from "@/components/stats/stat-card";
import { Card } from "@/components/ui/card";
import { useMarketplaceStats, useReputation } from "@/hooks/use-stats";
import { useWallet } from "@/hooks/use-wallet";
import { formatAmount } from "@/lib/format";

export default function AnalyticsPage() {
  const { data: stats } = useMarketplaceStats();
  const { address } = useWallet();
  const { data: rep } = useReputation(address);

  const completed = Number(stats?.totalCompleted ?? 0n);
  const disputes = Number(stats?.totalDisputes ?? 0n);
  const disputeRate = completed + disputes > 0 ? (disputes / (completed + disputes)) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Marketplace-wide metrics, sourced live from the on-chain registry contract."
      />
      <NotConfiguredBanner />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Completed escrows" value={completed} icon={CheckCircle2} />
        <StatCard
          label="Settled volume"
          valueText={formatAmount(stats?.totalVolume ?? 0n)}
          icon={CircleDollarSign}
        />
        <StatCard label="Disputes" value={disputes} icon={ShieldAlert} />
        <StatCard
          label="Dispute rate"
          value={disputeRate}
          decimalPlaces={1}
          icon={TrendingUp}
          hint="of all settled escrows"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold">Outcomes</h3>
          <p className="text-xs text-muted-foreground">Completed vs disputed across the marketplace.</p>
          <div className="mt-6 space-y-4">
            <Bar label="Completed" value={completed} total={completed + disputes} tone="bg-success" />
            <Bar label="Disputed" value={disputes} total={completed + disputes} tone="bg-destructive" />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold">Your reputation</h3>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-4xl font-bold text-primary">{rep?.score ?? 0}</span>
            <span className="mb-1 text-sm text-muted-foreground">/ 1000</span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Delivered as seller" value={rep?.jobsAsSeller ?? 0} />
            <Row label="Funded as buyer" value={rep?.jobsAsBuyer ?? 0} />
            <Row label="Disputes" value={rep?.disputes ?? 0} />
            <Row label="Lifetime volume" value={formatAmount(rep?.volume ?? 0n)} />
          </dl>
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5" /> Metrics refresh automatically as new contract events arrive.
      </p>
    </>
  );
}

function Bar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
