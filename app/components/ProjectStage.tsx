"use client";

import Link from "next/link";
import { ArrowRight, Bot, Check, CircleAlert, Clock3, Database, Radio, Sparkles } from "lucide-react";

import type { Task } from "../lib/perkosApi";
import type { AgentLiveStatus } from "../lib/useWalletAgents";
import { AgentOrb } from "./AgentOrb";
import { agentColor } from "./charts";
import { cn } from "@/lib/utils";

const MAX_TASKS_PER_AGENT = 4;

function taskState(task: Task) {
  if (task.status === "Done") return { label: "Done", icon: Check, tone: "text-emerald-300 border-emerald-400/25 bg-emerald-400/10" };
  if (task.failureCode || task.stopReason) return { label: "Needs attention", icon: CircleAlert, tone: "text-amber-300 border-amber-400/25 bg-amber-400/10" };
  if (task.status === "Review") return { label: "Review", icon: Sparkles, tone: "text-violet-300 border-violet-400/25 bg-violet-400/10" };
  if (task.status === "In progress") return { label: "Working", icon: Radio, tone: "text-sky-300 border-sky-400/25 bg-sky-400/10" };
  return { label: "Ready", icon: Clock3, tone: "text-muted-foreground border-white/10 bg-white/[.04]" };
}

function AgentColumn({ name, isPM, tasks, live, projectId }: { name: string; isPM: boolean; tasks: Task[]; live?: AgentLiveStatus; projectId: string }) {
  const color = agentColor(name, 1);
  const active = Boolean(live?.bridgeConnected) || tasks.some((task) => task.status === "In progress");
  return (
    <article className="relative min-w-[220px] flex-1 basis-56" data-testid={`stage-agent-${name}`}>
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border bg-[#0d0a16] shadow-[0_0_24px_var(--agent-glow)]" style={{ borderColor: color, "--agent-glow": agentColor(name, 0.28) } as React.CSSProperties}>
          <AgentOrb name={name} size={50} />
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <strong className="max-w-[160px] truncate text-xs text-foreground">{name}</strong>
          {isPM ? <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-primary">Lead</span> : null}
        </div>
        <span className={cn("mt-1 inline-flex items-center gap-1 text-[9px] uppercase tracking-[.16em]", active ? "text-emerald-300" : "text-muted-foreground")}>
          <i className={cn("h-1.5 w-1.5 rounded-full", active ? "animate-pulse bg-emerald-300" : "bg-muted-foreground/50")} />
          {active ? "Active" : "Ready"}
        </span>
      </div>

      <div className="mt-4 min-h-[190px] rounded-2xl border border-white/10 bg-gradient-to-b from-white/[.055] to-black/20 p-2.5 shadow-xl backdrop-blur">
        <div className="mb-2 flex items-center justify-between px-1 text-[9px] uppercase tracking-[.15em] text-muted-foreground">
          <span>Current work</span><span>{tasks.length}</span>
        </div>
        <div className="space-y-2">
          {tasks.slice(0, MAX_TASKS_PER_AGENT).map((task) => {
            const state = taskState(task);
            const Icon = state.icon;
            return task.id ? (
              <Link key={task.id} href={`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(task.id)}`} className="group block rounded-xl border border-white/[.08] bg-[#0b0812]/80 p-2.5 transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/[.06]">
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 text-[11px] font-medium leading-4 text-foreground">{task.name}</span>
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <span className={cn("mt-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] uppercase tracking-wider", state.tone)}><Icon className="h-2.5 w-2.5" />{state.label}</span>
              </Link>
            ) : null;
          })}
          {tasks.length === 0 ? <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-white/10 px-4 text-center text-[10px] text-muted-foreground">Ready for the next assignment</div> : null}
          {tasks.length > MAX_TASKS_PER_AGENT ? <p className="px-1 text-[9px] text-muted-foreground">+{tasks.length - MAX_TASKS_PER_AGENT} more tasks</p> : null}
        </div>
      </div>
    </article>
  );
}

export function ProjectStage({ projectId, projectName, pmAgent, agentNames, tasks, liveAgents, externalSystems = [] }: { projectId: string; projectName: string; pmAgent?: string | null; agentNames: string[]; tasks: Task[]; liveAgents: Record<string, AgentLiveStatus>; externalSystems?: string[] }) {
  const orderedAgents = [...agentNames.filter((name) => name === pmAgent), ...agentNames.filter((name) => name !== pmAgent)];
  const unassigned = tasks.filter((task) => !task.agent?.trim() || !orderedAgents.includes(task.agent.trim()));
  const columns = unassigned.length > 0 && !orderedAgents.includes("Unassigned") ? [...orderedAgents, "Unassigned"] : orderedAgents;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#07030d] p-4 sm:p-5" role="region" aria-label="Project stage">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(236,27,105,.16),transparent_42%),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:auto,32px_32px,32px_32px]" />
      <div className="relative mx-auto mb-7 flex max-w-xl flex-col items-center text-center">
        <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[9px] uppercase tracking-[.18em] text-primary"><Bot className="h-3 w-3" />Project goal</div>
        <h3 className="mt-2 max-w-lg text-balance text-base font-semibold text-foreground sm:text-lg">{projectName}</h3>
        <div className="mt-3 h-7 w-px bg-gradient-to-b from-primary/70 to-white/10" />
      </div>

      <div className="relative overflow-x-auto pb-2">
        <div className="relative flex min-w-max gap-3 px-1 pt-4 sm:gap-4">
          <div className="absolute left-[110px] right-[110px] top-11 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
          {columns.map((name) => <AgentColumn key={name} name={name} isPM={name === pmAgent} tasks={name === "Unassigned" ? unassigned : tasks.filter((task) => task.agent?.trim() === name)} live={liveAgents[name]} projectId={projectId} />)}
        </div>
      </div>

      {externalSystems.length > 0 ? (
        <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2 border-t border-white/[.07] pt-4">
          <span className="mr-1 inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[.16em] text-muted-foreground"><Database className="h-3 w-3 text-sky-300" />Connected sources</span>
          {externalSystems.slice(0, 4).map((source) => <span key={source} className="rounded-full border border-sky-400/20 bg-sky-400/[.07] px-2.5 py-1 text-[10px] text-sky-200">{source}</span>)}
        </div>
      ) : null}
    </div>
  );
}
