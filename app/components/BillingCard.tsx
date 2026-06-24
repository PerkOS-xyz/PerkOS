"use client";

/**
 * Billing section of the user dashboard. Shows THIS wallet's own usage for the
 * current month — team working hours (the billable unit), agents, and AI tokens
 * — plus what they've paid. Deliberately usage-facing: no platform cost/margin.
 * Reads GET /billing/me. Charges/plan/included-hours appear here once the
 * charging engine + prepaid credits land.
 */

import { useQuery } from "@tanstack/react-query";
import { Banknote, Clock, Bot, Sparkles } from "lucide-react";

import { getMyBilling } from "../lib/perkosApi";

function fmtHours(h: number): string {
  return h.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function BillingCard({ address }: { address: string }) {
  const query = useQuery({
    queryKey: ["my-billing", address],
    queryFn: getMyBilling,
    enabled: Boolean(address),
    refetchInterval: 300_000,
  });

  const b = query.data;

  return (
    <section className="glow-card flex flex-col gap-3 rounded-lg border border-primary/25 bg-card/60 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Banknote className="h-4 w-4 text-primary" />
          Billing
        </h2>
        {b ? (
          <span className="font-mono text-[11px] text-muted-foreground">{b.month}</span>
        ) : null}
      </div>

      {query.isLoading || !b ? (
        <p className="text-xs text-muted-foreground">Loading usage…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Metric
              icon={<Clock className="h-3.5 w-3.5 text-primary" />}
              label="Team hours"
              value={fmtHours(b.usage.activeHours)}
            />
            <Metric
              icon={<Bot className="h-3.5 w-3.5 text-primary" />}
              label="Agents"
              value={String(b.usage.agentCount)}
            />
            <Metric
              icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
              label="AI tokens"
              value={
                b.usage.llmTokens >= 1_000_000
                  ? `${(b.usage.llmTokens / 1e6).toFixed(1)}M`
                  : b.usage.llmTokens >= 1000
                    ? `${(b.usage.llmTokens / 1e3).toFixed(0)}k`
                    : String(b.usage.llmTokens)
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">Paid this month</span>
            <span className="font-mono text-sm text-foreground">
              {b.paymentsUsd.toLocaleString(undefined, {
                style: "currency",
                currency: "USD",
              })}
            </span>
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground">
            You only pay for the hours your team actually works. A plan with
            included hours + top-ups arrives soon — for now this tracks your usage.
          </p>
        </>
      )}
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-mono text-base text-foreground tabular-nums">{value}</span>
    </div>
  );
}
