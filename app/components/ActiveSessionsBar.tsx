"use client";

import Link from "next/link";
import { useAppAccount } from "../lib/useAppAccount";

import {
  useWalletAgents,
  realtimeAgentStatus,
  STATUS_AVAILABLE,
  STATUS_GETTING_READY,
} from "../lib/useWalletAgents";
import { AgentOrb } from "./AgentOrb";

/**
 * ActiveSessionsBar — a live strip of the teammates working right now.
 *
 * One chip per teammate that's Available (or Getting ready), role-colored via
 * AgentOrb, click-through to that teammate. Makes "my team is working" legible
 * at a glance from anywhere in the app — reinforces the team mental model
 * without anyone having to read the activity feed. It owns its own border so
 * when nobody is working it renders NOTHING (no empty strip at rest).
 *
 * Realtime from the wallet's agents subcollection (bridge heartbeat +
 * hibernation lifecycle) via useWalletAgents — no extra fetch. Scoped to the
 * connected wallet (all of its teammates, across projects).
 *
 * Customer-facing copy uses TEAM language ("Working now", "Available"), per the
 * fear-reduction redesign — never "sessions" / "agents" / "online".
 */
export function ActiveSessionsBar() {
  const { address } = useAppAccount();
  const { byName, loaded } = useWalletAgents(address);

  if (!address || !loaded) return null;

  const active = Object.values(byName)
    .map((a) => ({ a, st: realtimeAgentStatus(a) }))
    .filter(
      ({ st }) =>
        st.label === STATUS_AVAILABLE || st.label === STATUS_GETTING_READY,
    )
    // Available first, then Getting ready; alphabetical within each group so the
    // order is stable as the snapshot updates.
    .sort((x, y) => {
      const rank = (l: string) => (l === STATUS_AVAILABLE ? 0 : 1);
      return (
        rank(x.st.label) - rank(y.st.label) || x.a.name.localeCompare(y.a.name)
      );
    });

  if (active.length === 0) return null;

  return (
    <div className="flex items-center gap-2 border-b border-border bg-background/60 px-4 py-1.5 md:px-8">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Working now
      </span>
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {active.map(({ a, st }) => (
          <Link
            key={a.id}
            href={`/agents/${a.id}`}
            title={`${a.name} · ${st.label}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/60 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-card"
          >
            <AgentOrb
              name={a.name}
              presetId={a.presetId}
              role={a.role}
              size={20}
              status={st.label === STATUS_AVAILABLE ? "available" : null}
            />
            <span className="max-w-[84px] truncate">{a.name}</span>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.color}`} />
          </Link>
        ))}
      </div>
    </div>
  );
}
