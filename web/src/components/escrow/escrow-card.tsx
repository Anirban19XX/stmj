"use client";

import { useState } from "react";
import { ArrowRight, Calendar, Layers } from "lucide-react";
import { MagicCard } from "@/components/magicui/magic-card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { EscrowDetailDialog } from "./escrow-detail-dialog";
import { useEscrowRole } from "./use-escrow-role";
import { formatAmount, formatDate, progressPct, truncateAddress } from "@/lib/format";
import type { Escrow } from "@/types";

const ROLE_LABEL: Record<string, string> = {
  buyer: "Buyer",
  seller: "Seller",
  arbiter: "Arbiter",
  observer: "Observer",
};

export function EscrowCard({ escrow }: { escrow: Escrow }) {
  const [open, setOpen] = useState(false);
  const role = useEscrowRole(escrow);
  const counterparty = role === "seller" ? escrow.buyer : escrow.seller;

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-left">
        <MagicCard className="h-full cursor-pointer rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{escrow.title}</p>
              <p className="text-xs text-muted-foreground">#{escrow.id.toString()}</p>
            </div>
            <StatusBadge status={escrow.status} />
          </div>

          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-2xl font-semibold">{formatAmount(escrow.totalAmount)}</p>
              <p className="text-xs text-muted-foreground">
                {role === "seller" ? "from" : "to"} {truncateAddress(counterparty)}
              </p>
            </div>
            <Badge variant="outline">{ROLE_LABEL[role]}</Badge>
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${progressPct(escrow.releasedAmount, escrow.totalAmount)}%` }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {escrow.milestones.filter((m) => m.released).length}/{escrow.milestones.length}{" "}
              milestones
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(escrow.deadline)}
            </span>
          </div>

          <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Manage <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </MagicCard>
      </button>

      <EscrowDetailDialog escrow={escrow} open={open} onOpenChange={setOpen} />
    </>
  );
}
