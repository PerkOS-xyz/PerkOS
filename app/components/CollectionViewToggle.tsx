"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type CollectionViewMode = "cards" | "list";

export function useCollectionViewMode(storageKey: string) {
  const [mode, setModeState] = useState<CollectionViewMode>("cards");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "cards" || stored === "list") setModeState(stored);
    } catch {
      // Storage can be unavailable in private/embedded contexts; cards remain
      // the safe responsive default.
    }
  }, [storageKey]);

  const setMode = useCallback((next: CollectionViewMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // The preference is optional; the current session still updates.
    }
  }, [storageKey]);

  return [mode, setMode] as const;
}

export function CollectionViewToggle({
  mode,
  onChange,
  listLabel,
  cardsLabel,
}: {
  mode: CollectionViewMode;
  onChange: (mode: CollectionViewMode) => void;
  listLabel: string;
  cardsLabel: string;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-md border border-border bg-card/60 p-0.5" role="group" aria-label="View">
      <button
        type="button"
        aria-label={cardsLabel}
        title={cardsLabel}
        aria-pressed={mode === "cards"}
        onClick={() => onChange("cards")}
        className={cn("grid h-8 w-8 place-items-center rounded text-muted-foreground transition-colors", mode === "cards" && "bg-primary/15 text-primary")}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={listLabel}
        title={listLabel}
        aria-pressed={mode === "list"}
        onClick={() => onChange("list")}
        className={cn("grid h-8 w-8 place-items-center rounded text-muted-foreground transition-colors", mode === "list" && "bg-primary/15 text-primary")}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}
