"use client";

/**
 * The team at work: one seat per teammate showing who is working right now,
 * on what, for how long, and who is waiting on whom. Built from the live task
 * board (dispatch state, parents) and agent presence; no extra backend.
 */

import { useEffect, useState } from "react";
import { Clock3, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Task } from "../lib/perkosApi";
import { AgentOrb } from "./AgentOrb";
import { agentHue } from "./CoordinationRow";

export type SeatState = "working" | "review" | "waiting" | "done" | "resting" | "ready";

export type Seat = {
  name: string;
  lead: boolean;
  state: SeatState;
  task?: Task;
  /** Agent this seat waits for (a parent task's owner). */
  waitingOn?: string;
  /** ISO time the current work started, for the live clock. */
  since?: string;
  doneCount: number;
};

type Presence = { hibernationState?: string | null } | undefined;

/** Pure seat derivation so the stage can be tested without Firestore. */
export function deriveSeats(
  agentNames: string[],
  pmAgent: string | null | undefined,
  tasks: Task[],
  presence: Record<string, Presence> = {},
): Seat[] {
  const byId = new Map(tasks.filter((t) => t.id).map((t) => [t.id as string, t]));
  const ordered = pmAgent && agentNames.includes(pmAgent)
    ? [pmAgent, ...agentNames.filter((n) => n !== pmAgent)]
    : agentNames;
  return ordered.map((name) => {
    const mine = tasks.filter((t) => t.agent === name);
    const doneCount = mine.filter((t) => t.status === "Done").length;
    const working = mine.find((t) => t.status === "In progress");
    const review = mine.find((t) => t.status === "Review");
    const waiting = mine.find(
      (t) => t.status !== "Done" && (t.dispatchState === "waiting_on_dependency" || (t.parents ?? []).some((p) => byId.get(p)?.status !== "Done")),
    );
    const next = mine.find((t) => t.status === "Backlog" || t.status === "To do");
    const lastDone = [...mine].reverse().find((t) => t.status === "Done");
    const sleeping = ["hibernated", "hibernating"].includes(presence[name]?.hibernationState ?? "");
    const lead = name === pmAgent;
    if (working) return { name, lead, state: "working", task: working, since: working.dispatchedAt ?? working.updatedAt, doneCount };
    if (review) return { name, lead, state: "review", task: review, doneCount };
    if (waiting) {
      const parent = (waiting.parents ?? []).map((p) => byId.get(p)).find((p) => p && p.status !== "Done");
      return { name, lead, state: "waiting", task: waiting, waitingOn: parent?.agent, doneCount };
    }
    if (next) return { name, lead, state: sleeping ? "resting" : "ready", task: next, doneCount };
    if (lastDone) return { name, lead, state: "done", task: lastDone, doneCount };
    return { name, lead, state: sleeping ? "resting" : "ready", doneCount };
  });
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function elapsed(since: string | undefined, now: number): string | null {
  if (!since) return null;
  const ms = now - new Date(since).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

const STATUS: Record<SeatState, string> = {
  working: "Working on it",
  review: "Waiting for review",
  waiting: "Waiting",
  done: "Delivered",
  resting: "Resting · wakes when work arrives",
  ready: "Ready for the next assignment",
};

export function ProjectTeamStage({
  agentNames,
  pmAgent,
  tasks,
  presence,
  onFocusAgent,
}: {
  agentNames: string[];
  pmAgent: string | null | undefined;
  tasks: Task[];
  presence?: Record<string, Presence>;
  onFocusAgent?: (name: string) => void;
}) {
  const seats = deriveSeats(agentNames, pmAgent, tasks, presence);
  const anyWorking = seats.some((s) => s.state === "working");
  const now = useNow(anyWorking);

  if (seats.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No teammates yet. Add agents to this project to see them work here.
      </p>
    );
  }

  return (
    <div className="relative">
      <style>{`
        @keyframes pk-orbit { to { transform: rotate(360deg); } }
        @keyframes pk-flow { from { left: 0% } to { left: 100% } }
      `}</style>
      {seats.length > 1 ? (
        <div aria-hidden className="pointer-events-none absolute inset-x-[12%] top-9 hidden h-px border-t border-dashed border-border md:block">
          {anyWorking ? (
            <span className="absolute -top-[3px] h-1.5 w-8 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent [animation:pk-flow_2.4s_linear_infinite]" />
          ) : null}
        </div>
      ) : null}
      <ul className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", seats.length >= 4 ? "xl:grid-cols-4" : seats.length === 3 ? "lg:grid-cols-3" : "")}>
        {seats.map((seat, i) => (
          <li key={seat.name} className="animate-in fade-in zoom-in-95 duration-500" style={{ animationDelay: `${i * 60}ms` }}>
            <SeatCard seat={seat} clock={seat.state === "working" ? elapsed(seat.since, now) : null} onFocus={onFocusAgent} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SeatCard({ seat, clock, onFocus }: { seat: Seat; clock: string | null; onFocus?: (name: string) => void }) {
  const hue = agentHue(seat.name);
  const step = seat.state === "done" || seat.state === "review" ? 3 : seat.state === "working" ? 2 : seat.task ? 1 : 0;
  return (
    <article
      className={cn(
        "relative flex h-full flex-col items-center gap-3 rounded-xl border bg-background p-4 text-center",
        seat.state === "working" ? "border-transparent" : "border-border",
        seat.state === "resting" && "opacity-75",
      )}
      style={seat.state === "working" ? { boxShadow: `inset 0 0 0 1px ${agentHue(seat.name, 0.45)}, 0 0 40px -18px ${hue}` } : undefined}
    >
      <div className="relative grid h-[72px] w-[72px] place-items-center">
        {seat.state === "working" ? (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full [animation:pk-orbit_2.2s_linear_infinite]"
            style={{
              background: `conic-gradient(from 0deg, transparent 0 55%, ${hue} 85%, transparent 100%)`,
              mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
            }}
          />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `inset 0 0 0 2px ${seat.state === "done" ? "rgba(52,211,153,.6)" : seat.state === "waiting" || seat.state === "resting" ? "rgba(255,255,255,.1)" : agentHue(seat.name, 0.35)}` }}
          />
        )}
        <AgentOrb name={seat.name} size={60} />
      </div>
      <div className="w-full min-w-0">
        <p className="truncate text-sm font-medium" title={seat.name}>{seat.name}</p>
        <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: hue }}>{seat.lead ? "Lead" : `${seat.doneCount} delivered`}</p>
      </div>
      <p className={cn("text-xs", seat.state === "working" ? "text-foreground" : "text-muted-foreground")}>
        {seat.state === "waiting" && seat.waitingOn ? `Waiting for ${seat.waitingOn}` : seat.lead && seat.state === "ready" ? "Coordinating the plan" : STATUS[seat.state]}
      </p>
      {seat.task ? (
        <div className="w-full rounded-lg border border-border bg-card/80 p-2.5 text-left">
          <p className="line-clamp-2 text-xs text-foreground/90">{seat.task.name}</p>
          <div className="mt-2 flex items-center gap-1" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className="h-1 flex-1 rounded-full"
                style={{ background: n <= step ? (seat.state === "done" || seat.state === "review" ? "rgb(52 211 153)" : hue) : "rgba(255,255,255,.08)" }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{seat.state === "done" ? "Delivered" : seat.state === "working" ? "Working" : seat.state === "review" ? "In review" : "Up next"}</span>
            {clock ? <span className="inline-flex items-center gap-1 font-mono"><Clock3 className="h-3 w-3" />{clock}</span> : null}
          </div>
        </div>
      ) : (
        <div className="w-full rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">No task yet</div>
      )}
      {onFocus ? (
        <button type="button" onClick={() => onFocus(seat.name)} className="mt-auto inline-flex min-h-9 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <MessageSquare className="h-3 w-3" /> See in conversation
        </button>
      ) : null}
    </article>
  );
}
