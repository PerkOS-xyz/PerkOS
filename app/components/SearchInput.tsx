"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  ariaLabel = "Search",
}: Props) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/** Lowercased, trimmed query. Empty string if not searching. */
export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

/** Matches a query against multiple fields (case-insensitive). */
export function matchesQuery(query: string, fields: (string | undefined | null)[]): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}
