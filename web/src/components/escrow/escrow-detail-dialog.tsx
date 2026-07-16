"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  Gavel,
  PackageCheck,
  RotateCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "./status-badge";
import { MilestoneList } from "./milestone-list";
import { useEscrowRole } from "./use-escrow-role";
import { AddressDisplay } from "@/components/shared/address-display";
import { useEscrowActions } from "@/hooks/use-escrows";
import { useWallet } from "@/hooks/use-wallet";
import { EscrowStatus, type Escrow } from "@/types";
import { formatAmount, formatDate, progressPct } from "@/lib/format";

export function EscrowDetailDialog({
  escrow,
  open,
  onOpenChange,
}: {
  escrow: Escrow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const role = useEscrowRole(escrow);
  const { address } = useWallet();
  const actions = useEscrowActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [sellerPct, setSellerPct] = useState(50);

  const isOpen =
    escrow.status === EscrowStatus.Funded || escrow.status === EscrowStatus.Delivered;
  const pastDeadline = Date.now() / 1000 > Number(escrow.deadline);

  async function run<T>(key: string, fn: () => Promise<T>) {
    setBusy(key);
    try {
      await fn();
    } catch {
      /* errors are surfaced via toast in the orchestrator */
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="truncate">{escrow.title}</DialogTitle>
            <StatusBadge status={escrow.status} />
          </div>
          <DialogDescription>
            Escrow #{escrow.id.toString()} · created {formatDate(escrow.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount summary */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total in escrow</p>
                <p className="text-2xl font-semibold">{formatAmount(escrow.totalAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Released</p>
                <p className="text-lg font-medium text-success">
                  {formatAmount(escrow.releasedAmount)}
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPct(escrow.releasedAmount, escrow.totalAmount)}%` }}
              />
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <Party label="Buyer" address={escrow.buyer} me={address} />
            <Party label="Seller" address={escrow.seller} me={address} />
            <Party label="Arbiter" address={escrow.arbiter} me={address} />
          </div>

          <Separator />

          {/* Milestones */}
          <div>
            <p className="mb-2 text-sm font-medium">Milestones</p>
            <MilestoneList
              milestones={escrow.milestones}
              canRelease={role === "buyer" && isOpen}
              releasingIndex={busy?.startsWith("release-") ? Number(busy.split("-")[1]) : null}
              onRelease={(i) => run(`release-${i}`, () => actions.releaseMilestone(escrow.id, i))}
            />
          </div>

          {/* Role-based actions */}
          <div className="space-y-2">
            {role === "seller" && escrow.status === EscrowStatus.Funded && (
              <Button
                className="w-full"
                disabled={busy !== null}
                onClick={() => run("deliver", () => actions.markDelivered(escrow.id))}
              >
                <PackageCheck className="mr-2 h-4 w-4" /> Mark as delivered
              </Button>
            )}

            {(role === "buyer" || role === "seller") && isOpen && (
              <Button
                variant="outline"
                className="w-full text-destructive"
                disabled={busy !== null}
                onClick={() =>
                  run("dispute", () => actions.raiseDispute(escrow.id, address!))
                }
              >
                <AlertTriangle className="mr-2 h-4 w-4" /> Raise dispute
              </Button>
            )}

            {role === "buyer" && isOpen && (
              <Button
                variant="outline"
                className="w-full"
                disabled={busy !== null || !pastDeadline}
                title={pastDeadline ? undefined : `Available after ${formatDate(escrow.deadline)}`}
                onClick={() => run("refund", () => actions.refund(escrow.id))}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {pastDeadline ? "Refund (deadline passed)" : "Refund available after deadline"}
              </Button>
            )}

            {role === "buyer" &&
              escrow.status === EscrowStatus.Funded &&
              escrow.releasedAmount === 0n && (
                <Button
                  variant="ghost"
                  className="w-full text-destructive"
                  disabled={busy !== null}
                  onClick={() => run("cancel", () => actions.cancel(escrow.id))}
                >
                  <Ban className="mr-2 h-4 w-4" /> Cancel & refund
                </Button>
              )}

            {role === "arbiter" && escrow.status === EscrowStatus.Disputed && (
              <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <Label className="text-sm">
                  Award to seller: <span className="font-semibold">{sellerPct}%</span>{" "}
                  <span className="text-muted-foreground">
                    (buyer gets {100 - sellerPct}%)
                  </span>
                </Label>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  value={sellerPct}
                  onChange={(e) => setSellerPct(Number(e.target.value))}
                />
                <Button
                  className="w-full"
                  disabled={busy !== null}
                  onClick={() =>
                    run("resolve", () =>
                      actions.resolveDispute(escrow.id, sellerPct * 100),
                    )
                  }
                >
                  <Gavel className="mr-2 h-4 w-4" /> Resolve dispute
                </Button>
              </div>
            )}

            {role === "observer" && (
              <p className="text-center text-xs text-muted-foreground">
                You are not a party to this escrow.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Party({
  label,
  address,
  me,
}: {
  label: string;
  address: string;
  me?: string | null;
}) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-xs text-muted-foreground">
        {label}
        {me === address && <span className="ml-1 text-primary">(you)</span>}
      </p>
      <AddressDisplay address={address} showExplorer={false} />
    </div>
  );
}
