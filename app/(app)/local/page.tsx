"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InboxRow = {
  id: string;
  vertical: "barbershop" | "restaurant";
  status: string;
  contact: { waId: string; profileName?: string };
  updatedAt: string;
  lastMessage: { body: string; direction: string } | null;
  messageCount: number;
};

export default function LocalInboxPage() {
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "barbershop" | "restaurant">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = filter === "all" ? "" : `?vertical=${filter}`;
      const res = await fetch(`/api/local/conversations${q}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { conversations: InboxRow[] };
      setRows(data.conversations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Store className="h-4 w-4" />
            PerkOS Local · pilot
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp inbox</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Dual vertical pilot: barbershop/stylists + restaurant. Bot never invents
            prices or slots; low confidence hands off to a human.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "barbershop", "restaurant"] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={filter === v ? "default" : "outline"}
            onClick={() => setFilter(v)}
          >
            {v === "all" ? "All" : v === "barbershop" ? "Barbershop" : "Restaurant"}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border">
        {rows.length === 0 && !loading ? (
          <p className="p-6 text-sm text-muted-foreground">
            No conversations yet. Point a Meta WhatsApp webhook at{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              /api/local/whatsapp/webhook
            </code>{" "}
            and send a test message.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium">
                    {row.contact.profileName ?? row.contact.waId}{" "}
                    <span className="text-xs font-normal uppercase text-muted-foreground">
                      {row.vertical}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {row.lastMessage?.body ?? "—"}
                  </p>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  <div className="uppercase tracking-wide">{row.status}</div>
                  <div>{row.messageCount} msgs</div>
                  <div>{new Date(row.updatedAt).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
