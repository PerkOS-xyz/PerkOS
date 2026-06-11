"use client";

/**
 * Dashboard KPI strip — the 4 numbers an owner needs at a glance:
 * who's online, what's in flight, what needs them, what shipped this week.
 */

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

export function KpiStrip({
  online,
  agentsTotal,
  inFlight,
  needsAttention,
  doneThisWeek,
  isLoading,
}: {
  online: number;
  agentsTotal: number;
  inFlight: number;
  needsAttention: number;
  doneThisWeek: number;
  isLoading?: boolean;
}) {
  const v = (n: number) => (isLoading ? "—" : String(n));
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiTile
        label="Agents online"
        value={isLoading ? "—" : `${online}/${agentsTotal}`}
        Icon={Zap}
        tone={online > 0 ? "ok" : "muted"}
        href="/agents"
      />
      <KpiTile
        label="Tasks in flight"
        value={v(inFlight)}
        Icon={Loader2}
        tone={inFlight > 0 ? "active" : "muted"}
        href="/tasks?status=active"
      />
      <KpiTile
        label="Needs attention"
        value={v(needsAttention)}
        Icon={AlertTriangle}
        tone={needsAttention > 0 ? "warn" : "ok"}
        href="/agents"
      />
      <KpiTile
        label="Done this week"
        value={v(doneThisWeek)}
        Icon={CheckCircle2}
        tone="ok"
        href="/tasks?status=done"
      />
    </section>
  );
}

function KpiTile({
  label,
  value,
  Icon,
  tone,
  href,
}: {
  label: string;
  value: string;
  Icon: typeof Zap;
  tone: "ok" | "warn" | "active" | "muted";
  href: string;
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "active"
          ? "text-primary"
          : "text-muted-foreground";
  return (
    <Link
      href={href}
      className="glow-card flex h-full flex-col justify-between gap-2 rounded-md border border-primary/20 bg-gradient-to-br from-primary/8 to-transparent p-4 transition-colors hover:border-primary/40"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className={cn("h-4 w-4 shrink-0", toneClass)} />
      </div>
      <span className={cn("text-3xl font-semibold leading-none", toneClass)}>
        {value}
      </span>
    </Link>
  );
}
