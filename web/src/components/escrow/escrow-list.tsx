"use client";

import { useState } from "react";
import { Inbox } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EscrowCard } from "./escrow-card";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateEscrowDialog } from "./create-escrow-dialog";
import { OPEN_STATUSES, type Escrow } from "@/types";

type Filter = "all" | "active" | "completed";

export function EscrowList({
  escrows,
  isLoading,
}: {
  escrows: Escrow[];
  isLoading?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = escrows.filter((e) => {
    if (filter === "active") return OPEN_STATUSES.has(e.status);
    if (filter === "completed") return !OPEN_STATUSES.has(e.status);
    return true;
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
    );
  }

  if (escrows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No escrows yet"
        description="Create your first escrow to lock funds against milestones and start a trustless deal."
        action={<CreateEscrowDialog />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="all">All ({escrows.length})</TabsTrigger>
          <TabsTrigger value="active">
            Active ({escrows.filter((e) => OPEN_STATUSES.has(e.status)).length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Settled ({escrows.filter((e) => !OPEN_STATUSES.has(e.status)).length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing here" description="No escrows match this filter." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <EscrowCard key={e.id.toString()} escrow={e} />
          ))}
        </div>
      )}
    </div>
  );
}
