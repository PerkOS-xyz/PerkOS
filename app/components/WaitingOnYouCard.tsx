"use client";

/**
 * "Waiting on you" — the owner's worklist. Inverts the relationship: the
 * agents report to the human. Surfaces everything paused on a human decision
 * (proposed plans, tasks parked in Review, failed agents, stale invites)
 * instead of leaving them buried in tabs.
 */

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  FileCheck2,
  Inbox,
  Link2,
  type LucideIcon,
} from "lucide-react";

export type WaitingItem = {
  key: string;
  kind: "plan" | "review" | "agent-failed" | "invite-stale";
  label: string;
  hint?: string;
  href: string;
};

const KIND_META: Record<WaitingItem["kind"], { Icon: LucideIcon; tone: string }> = {
  plan: { Icon: FileCheck2, tone: "text-sky-300" },
  review: { Icon: Inbox, tone: "text-amber-300" },
  "agent-failed": { Icon: AlertTriangle, tone: "text-destructive" },
  "invite-stale": { Icon: Link2, tone: "text-amber-300" },
};

export function WaitingOnYouCard({ items }: { items: WaitingItem[] }) {
  return (
    <section className="glow-card flex flex-col gap-3 rounded-lg border border-primary/25 bg-card/60 px-4 py-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Waiting on you</h2>
        <span
          className={
            items.length > 0
              ? "rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300"
              : "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300"
          }
        >
          {items.length}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <CheckCheck className="h-3.5 w-3.5 text-emerald-300" />
          All caught up — nothing needs your decision.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.slice(0, 6).map((item) => {
            const meta = KIND_META[item.kind];
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-2.5 rounded-md border border-border/60 bg-background/40 px-3 py-2 transition-colors hover:border-primary/40"
                >
                  <meta.Icon className={`h-3.5 w-3.5 shrink-0 ${meta.tone}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-foreground">
                      {item.label}
                    </span>
                    {item.hint ? (
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {item.hint}
                      </span>
                    ) : null}
                  </span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
