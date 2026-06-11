"use client";

/**
 * Model usage per agent — which brain each agent runs on (PerkOS LLM vs the
 * owner's own key) and how much work it has shipped. Task counts come from
 * the workspace's tasks (no extra reads); per-call gateway metering can plug
 * in here later.
 */

import Link from "next/link";
import { Cpu } from "lucide-react";

import type { Agent, Task } from "../lib/perkosApi";
import { agentColor } from "./charts";

export function ModelUsagePanel({
  agents,
  tasks,
}: {
  agents: Agent[];
  tasks: Task[];
}) {
  if (agents.length === 0) return null;

  const doneBy = new Map<string, number>();
  const totalBy = new Map<string, number>();
  for (const t of tasks) {
    const a = t.agent?.trim();
    if (!a) continue;
    totalBy.set(a, (totalBy.get(a) ?? 0) + 1);
    if (t.status === "Done") doneBy.set(a, (doneBy.get(a) ?? 0) + 1);
  }

  const rows = [...agents]
    .sort((a, b) => (totalBy.get(b.name) ?? 0) - (totalBy.get(a.name) ?? 0))
    .slice(0, 8);

  return (
    <section className="glow-card flex flex-col gap-3 rounded-lg border border-primary/25 bg-card/60 px-4 py-4">
      <header className="flex items-center gap-2">
        <Cpu className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-sm font-medium text-foreground">Model usage</h2>
      </header>
      <ul className="flex flex-col gap-1.5">
        {rows.map((a) => {
          const done = doneBy.get(a.name) ?? 0;
          const total = totalBy.get(a.name) ?? 0;
          return (
            <li key={a.id}>
              <Link
                href={`/agents/${encodeURIComponent(a.id)}`}
                className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-primary/10"
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[10px] text-foreground"
                  style={{ background: agentColor(a.name, 0.25) }}
                >
                  {a.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-xs font-medium text-foreground">
                    {a.name}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {a.runtime}
                    {" · "}
                    {a.modelKeyProvided ? "Your own model key" : "PerkOS LLM"}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {done}/{total} done
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
