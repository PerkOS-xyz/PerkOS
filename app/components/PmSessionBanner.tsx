"use client";

import { Loader2, CheckCircle2, PauseCircle, Compass } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PmSession } from "../lib/perkosApi";

const REASON_LABEL: Record<string, string> = {
  "goal-met": "Goal met",
  "no-more-work": "Nothing left to do",
  "max-rounds": "Hit the round limit — run again to continue",
  "bad-plan": "Couldn't form a valid plan",
  "empty-plan": "No work to do",
  "llm-error": "The model errored",
  "no-pm": "No PM designated",
};

/**
 * Compact status strip for a project's autonomous PM session. Shows what the
 * PM is doing (planning / workers running / reviewing) or the final outcome.
 */
export function PmSessionBanner({
  session,
  pmAgent,
}: {
  session?: PmSession;
  pmAgent?: string | null;
}) {
  if (!session) return null;

  const active =
    session.status === "planning" ||
    session.status === "working" ||
    session.status === "reviewing";
  const tone =
    session.status === "done" ? "ok" : session.status === "stopped" ? "warn" : "active";

  const label =
    session.status === "planning"
      ? "Planning the next steps"
      : session.status === "working"
        ? "Workers are on it"
        : session.status === "reviewing"
          ? "Reviewing results"
          : session.status === "done"
            ? "Goal complete"
            : "Paused";

  const Icon = active ? Loader2 : session.status === "done" ? CheckCircle2 : PauseCircle;
  const reason = session.reason ? REASON_LABEL[session.reason] ?? session.reason : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-xs",
        tone === "ok" && "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
        tone === "warn" && "border-amber-500/30 bg-amber-500/5 text-amber-300",
        tone === "active" && "border-primary/30 bg-primary/5 text-primary",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active && "animate-spin")} />
      <span className="inline-flex items-center gap-1 font-medium">
        <Compass className="h-3.5 w-3.5" />
        {pmAgent ? `${pmAgent}` : "PM"}
      </span>
      <span className="opacity-90">{label}</span>
      {session.maxRounds > 0 ? (
        <span className="opacity-70">
          · round {Math.min(session.round, session.maxRounds)}/{session.maxRounds}
        </span>
      ) : null}
      {reason ? <span className="opacity-70">· {reason}</span> : null}
    </div>
  );
}
