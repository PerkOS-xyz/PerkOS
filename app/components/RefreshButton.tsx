"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Manual refresh: invalidates every active query so the current page refetches
 * its live data. A counterpart to the pull-to-refresh gesture for users who'd
 * rather tap. Spins while the refetch is in flight.
 */
export function RefreshButton({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Refresh data"
      title="Refresh"
      disabled={refreshing}
      onClick={handleRefresh}
      className={cn("h-9 w-9 text-foreground hover:bg-primary/10", className)}
    >
      <RefreshCw className={cn("h-5 w-5", refreshing && "animate-spin")} />
    </Button>
  );
}
