"use client";

import { Loader2, CheckCircle2, PauseCircle, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { PmSession } from "../lib/perkosApi";
import { formatRelativeShort } from "../lib/format";

// Maps a session `reason` enum to its translation key.
const REASON_KEYS: Record<string, string> = {
  "goal-met": "components.pmBanner.reasons.goalMet",
  "no-more-work": "components.pmBanner.reasons.noMoreWork",
  "max-rounds": "components.pmBanner.reasons.maxRounds",
  "bad-plan": "components.pmBanner.reasons.badPlan",
  "empty-plan": "components.pmBanner.reasons.emptyPlan",
  "llm-error": "components.pmBanner.reasons.llmError",
  "no-pm": "components.pmBanner.reasons.noPm",
  "planning-timeout": "components.pmBanner.reasons.planningTimeout",
};

// The PM loop's phases, in order — rendered as a mini pipeline so the owner
// can see WHERE in the loop the session is, not just that it's "running".
const PHASES: { id: string; labelKey: string }[] = [
  { id: "planning", labelKey: "components.pmBanner.phases.plan" },
  { id: "working", labelKey: "components.pmBanner.phases.work" },
  { id: "reviewing", labelKey: "components.pmBanner.phases.review" },
  { id: "done", labelKey: "components.pmBanner.phases.done" },
];

/**
 * Status strip for a project's autonomous PM session: who's coordinating,
 * the phase pipeline with the current step lit, the round counter, and when
 * the PM last ran.
 */
export function PmSessionBanner({
  session,
  pmAgent,
  planningAttempt,
  planningMaxAttempts,
  failureReason,
}: {
  session?: PmSession;
  pmAgent?: string | null;
  planningAttempt?: number;
  planningMaxAttempts?: number;
  failureReason?: string;
}) {
  const { t } = useTranslation();
  if (!session) return null;

  const active =
    session.status === "planning" ||
    session.status === "working" ||
    session.status === "reviewing";
  const tone =
    session.status === "done" ? "ok" : session.status === "stopped" ? "warn" : "active";

  const Icon = active ? Loader2 : session.status === "done" ? CheckCircle2 : PauseCircle;
  const reason = session.reason
    ? REASON_KEYS[session.reason]
      ? t(REASON_KEYS[session.reason])
      : session.reason
    : null;
  const phaseIdx = PHASES.findIndex((p) => p.id === session.status);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border px-3 py-2 text-xs",
        tone === "ok" && "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
        tone === "warn" && "border-amber-500/30 bg-amber-500/5 text-amber-300",
        tone === "active" && "border-primary/30 bg-primary/5 text-primary",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active && "animate-spin")} />
      <span className="inline-flex items-center gap-1 font-medium">
        <Compass className="h-3.5 w-3.5" />
        {pmAgent ? `${pmAgent}` : t("components.pmBanner.teamLead")}
      </span>

      {/* Phase pipeline: Plan → Work → Review → Done */}
      {session.status !== "stopped" ? (
        <span className="inline-flex items-center gap-1">
          {PHASES.map((p, i) => (
            <span key={p.id} className="inline-flex items-center gap-1">
              {i > 0 ? <span className="opacity-40">→</span> : null}
              <span
                className={cn(
                  i < phaseIdx && "opacity-60",
                  i === phaseIdx && "rounded bg-current/10 px-1 font-semibold",
                  i > phaseIdx && "opacity-35",
                )}
              >
                {t(p.labelKey)}
              </span>
            </span>
          ))}
        </span>
      ) : (
        <span className="opacity-90">{t("components.pmBanner.paused")}</span>
      )}

      {session.maxRounds > 0 ? (
        <span className="opacity-70">
          {t("components.pmBanner.round", {
            current: Math.min(session.round, session.maxRounds),
            max: session.maxRounds,
          })}
        </span>
      ) : null}
      {session.lastRunAt ? (
        <span className="opacity-70" title={session.lastRunAt}>
          {t("components.pmBanner.lastRun", {
            time: formatRelativeShort(session.lastRunAt),
          })}
        </span>
      ) : null}
      {session.status === "planning" && planningAttempt && planningMaxAttempts ? (
        <span className="opacity-70">
          {t("components.pmBanner.planningAttempt", {
            current: planningAttempt,
            max: planningMaxAttempts,
          })}
        </span>
      ) : null}
      {reason ? <span className="opacity-70">· {reason}</span> : null}
      {failureReason ? <span className="basis-full opacity-80">{failureReason}</span> : null}
    </div>
  );
}
