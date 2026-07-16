"use client";

import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TxTable } from "@/components/transactions/tx-table";
import { Button } from "@/components/ui/button";
import { useTxStore } from "@/stores/tx-store";

export default function TransactionsPage() {
  const transactions = useTxStore((s) => s.transactions);
  const clearResolved = useTxStore((s) => s.clearResolved);

  return (
    <>
      <PageHeader
        title="Transaction center"
        description="Every contract transaction you've submitted, with live status, hashes and retry."
        action={
          transactions.length > 0 ? (
            <Button variant="outline" size="sm" onClick={clearResolved}>
              Clear resolved
            </Button>
          ) : undefined
        }
      />

      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="When you create or settle an escrow, the transaction lifecycle will show up here."
        />
      ) : (
        <TxTable transactions={transactions} />
      )}
    </>
  );
}
