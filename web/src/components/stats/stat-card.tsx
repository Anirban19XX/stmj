"use client";

import { type LucideIcon } from "lucide-react";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  valueText,
  icon: Icon,
  hint,
  decimalPlaces = 0,
  className,
}: {
  label: string;
  /** Numeric value (animated). Ignored if `valueText` is set. */
  value?: number;
  /** Pre-formatted string value (e.g. amounts) shown instead of the ticker. */
  valueText?: string;
  icon: LucideIcon;
  hint?: string;
  decimalPlaces?: number;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">
        {valueText !== undefined ? (
          valueText
        ) : (
          <NumberTicker value={value ?? 0} decimalPlaces={decimalPlaces} />
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
