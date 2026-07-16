import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TxStatus } from "@/types";

const MAP: Record<
  TxStatus,
  { label: string; variant: "secondary" | "success" | "destructive" | "warning"; spin?: boolean; icon: typeof Clock }
> = {
  pending: { label: "Pending", variant: "warning", icon: Clock },
  processing: { label: "Processing", variant: "secondary", spin: true, icon: Loader2 },
  confirmed: { label: "Confirmed", variant: "success", icon: CheckCircle2 },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
};

export function TxStatusBadge({ status }: { status: TxStatus }) {
  const { label, variant, spin, icon: Icon } = MAP[status];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className={`h-3 w-3 ${spin ? "animate-spin" : ""}`} />
      {label}
    </Badge>
  );
}
