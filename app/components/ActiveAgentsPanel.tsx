"use client";

import Link from "next/link";
import { Bot, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Agent } from "../lib/perkosApi";
import { useConnection } from "wagmi";
import { formatRelativeShort } from "../lib/format";
import {
  useWalletAgents,
  realtimeAgentStatus,
  STATUS_AVAILABLE,
  type AgentLiveStatus,
} from "../lib/useWalletAgents";

type Props = {
  agents: Agent[];
  isLoading?: boolean;
};

/**
 * "Active Agents" rail on the dashboard. Surfaces the wallet's registered
 * agents at a glance: avatar (initials), name, runtime, status dot.
 *
 * Status is REALTIME — derived from the live hibernation + heartbeat signals
 * (via useWalletAgents), not the static `agent.status` field, so a hibernated
 * or still-booting agent doesn't falsely read "Online".
 */
export function ActiveAgentsPanel({ agents, isLoading }: Props) {
  const { address } = useConnection();
  const { byName } = useWalletAgents(address);

  const labelFor = (a: Agent) => realtimeAgentStatus(byName[a.name]).label;
  const online = agents.filter((a) => labelFor(a) === STATUS_AVAILABLE).length;

  return (
    <section className="glow-card flex flex-col gap-3 rounded-lg border border-primary/30 bg-card/60 px-4 py-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-foreground">Active agents</h2>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
            {isLoading ? "…" : agents.length}
          </span>
        </div>
        <Link
          href="/agents"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View all →
        </Link>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Loading roster…
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-start gap-2 py-2">
          <p className="text-xs text-muted-foreground">
            No agents registered yet. Launch your first worker.
          </p>
          <Link
            href="/agents/new"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Bot className="h-3 w-3" aria-hidden />
            Register agent
          </Link>
        </div>
      ) : (
        <>
          <ul className="flex gap-3 overflow-x-auto pb-1">
            {agents.slice(0, 10).map((a) => (
              <AgentAvatar key={a.id} agent={a} live={byName[a.name]} />
            ))}
          </ul>

          <footer className="flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
            <span>
              {online} of {agents.length} available
            </span>
            <span className="font-mono">
              {Math.round((online / Math.max(agents.length, 1)) * 100)}% available
            </span>
          </footer>
        </>
      )}
    </section>
  );
}

function AgentAvatar({
  agent,
  live,
}: {
  agent: Agent;
  live?: AgentLiveStatus;
}) {
  const initial = (agent.name || "?").slice(0, 1).toUpperCase();
  const { color, label } = realtimeAgentStatus(live);
  const isOnline = label === STATUS_AVAILABLE;
  const isError = label === "Needs attention" || label === "Failed";

  return (
    <li className="flex shrink-0 flex-col items-center gap-1">
      <Link
        href={`/agents/${agent.id}`}
        className={cn(
          "relative grid h-12 w-12 place-items-center rounded-full border bg-card font-mono text-sm transition-shadow",
          isOnline
            ? "border-emerald-500/50 text-emerald-200 shadow-[0_0_12px_-2px_rgba(16,185,129,0.4)] hover:shadow-[0_0_16px_-2px_rgba(16,185,129,0.6)]"
            : isError
              ? "border-destructive/50 text-destructive"
              : "border-primary/30 text-foreground shadow-[0_0_12px_-2px_rgba(236,27,105,0.35)] hover:shadow-[0_0_16px_-2px_rgba(236,27,105,0.55)]",
        )}
        aria-label={`${agent.name} (${label})`}
      >
        {initial}
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
            color,
          )}
          aria-hidden
        />
      </Link>
      <span className="max-w-[64px] truncate text-[10px] font-medium text-foreground">
        {agent.name}
      </span>
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {/* Temporal context: when was this agent last heard from. */}
      {!isOnline && live?.lastBridgeSeenMs ? (
        <span className="text-[9px] text-muted-foreground/70">
          {formatRelativeShort(new Date(live.lastBridgeSeenMs))}
        </span>
      ) : null}
    </li>
  );
}
