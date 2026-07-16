"use client";

import { NumberTicker } from "@/components/magicui/number-ticker";
import { useMarketplaceStats } from "@/hooks/use-stats";
import { formatAmount } from "@/lib/format";

export function LiveStats() {
  const { data } = useMarketplaceStats();

  const items = [
    { label: "Escrows settled", value: Number(data?.totalCompleted ?? 0n), text: undefined },
    { label: "Volume secured", value: undefined, text: formatAmount(data?.totalVolume ?? 0n) },
    { label: "Disputes resolved", value: Number(data?.totalDisputes ?? 0n), text: undefined },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((it) => (
        <div key={it.label} className="text-center">
          <div className="text-2xl font-bold tracking-tight sm:text-3xl">
            {it.text ?? <NumberTicker value={it.value ?? 0} />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{it.label}</p>
        </div>
      ))}
    </div>
  );
}
