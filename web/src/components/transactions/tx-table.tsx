"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TxStatusBadge } from "./tx-status-badge";
import { useContractWrite } from "@/hooks/use-contract-write";
import { explorerTxUrl } from "@/lib/stellar/config";
import { truncateHash, timeAgo, truncateAddress } from "@/lib/format";
import type { TrackedTransaction } from "@/types";

export function TxTable({ transactions }: { transactions: TrackedTransaction[] }) {
  const { retry } = useContractWrite();

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Hash</TableHead>
              <TableHead>Contract</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="text-right">—</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="font-medium">
                  {tx.label}
                  <div className="font-mono text-xs text-muted-foreground">{tx.method}</div>
                </TableCell>
                <TableCell>
                  <TxStatusBadge status={tx.status} />
                  {tx.error && (
                    <div className="mt-1 max-w-[200px] truncate text-xs text-destructive" title={tx.error}>
                      {tx.error}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {tx.hash ? (
                    <a
                      href={explorerTxUrl(tx.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {truncateHash(tx.hash)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {tx.contractId ? truncateAddress(tx.contractId) : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {timeAgo(tx.createdAt)}
                  {tx.retries > 0 && <span className="ml-1">· {tx.retries} retr{tx.retries > 1 ? "ies" : "y"}</span>}
                </TableCell>
                <TableCell className="text-right">
                  {tx.status === "failed" && (
                    <Button size="sm" variant="ghost" onClick={() => void retry(tx.id)}>
                      <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {transactions.map((tx) => (
          <div key={tx.id} className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{tx.label}</p>
                <p className="font-mono text-xs text-muted-foreground">{tx.method}</p>
              </div>
              <TxStatusBadge status={tx.status} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{timeAgo(tx.createdAt)}</span>
              {tx.hash && (
                <a
                  href={explorerTxUrl(tx.hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary"
                >
                  {truncateHash(tx.hash)} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {tx.error && <p className="mt-2 text-xs text-destructive">{tx.error}</p>}
            {tx.status === "failed" && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => void retry(tx.id)}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
              </Button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
