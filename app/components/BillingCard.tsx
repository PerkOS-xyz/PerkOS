"use client";

/**
 * Billing section of the user dashboard. Shows THIS wallet's own usage for the
 * current month — team working hours (the billable unit), agents, and AI tokens
 * — plus what they've paid. Deliberately usage-facing: no platform cost/margin.
 * Reads GET /billing/me. Charges/plan/included-hours appear here once the
 * charging engine + prepaid credits land.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Clock, Bot, Sparkles, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

import { getMyBilling } from "../lib/perkosApi";
import { DepositDialog } from "./DepositDialog";

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
  const [showDeposit, setShowDeposit] = useState(false);

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

          <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
            <span className="text-xs text-muted-foreground">Credit balance</span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-mono text-sm font-medium",
                  b.creditsUsd > 0 ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {b.creditsUsd.toLocaleString(undefined, { style: "currency", currency: "USD" })}
              </span>
              <button
                type="button"
                onClick={() => setShowDeposit((v) => !v)}
                className="inline-flex items-center gap-0.5 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
          </div>

          {showDeposit ? (
            <DepositDialog address={address} onDeposited={() => query.refetch()} />
          ) : null}

          {b.enrolled ? (
            <p className="text-[11px] leading-snug text-muted-foreground">
              You only pay for the hours your team actually works ($
              {/* meter price */}0.15 / team-hour). Top up your USDC balance to keep
              your team running; at $0 it pauses until you add more.
            </p>
          ) : (
            <p className="text-[11px] leading-snug text-muted-foreground">
              Your team runs free for now. Add USDC credits to switch to
              pay-as-you-go ($0.15 / team-hour) — you only pay for the hours your
              team actually works.
            </p>
          )}
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
