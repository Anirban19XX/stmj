import { Badge } from "@/components/ui/badge";
import { EscrowStatus, ESCROW_STATUS_LABELS } from "@/types";

type Variant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

const VARIANT: Record<EscrowStatus, Variant> = {
  [EscrowStatus.Funded]: "secondary",
  [EscrowStatus.Delivered]: "warning",
  [EscrowStatus.Released]: "success",
  [EscrowStatus.Refunded]: "outline",
  [EscrowStatus.Disputed]: "destructive",
  [EscrowStatus.Resolved]: "success",
  [EscrowStatus.Cancelled]: "outline",
};

export function StatusBadge({ status }: { status: EscrowStatus }) {
  return <Badge variant={VARIANT[status]}>{ESCROW_STATUS_LABELS[status]}</Badge>;
}
