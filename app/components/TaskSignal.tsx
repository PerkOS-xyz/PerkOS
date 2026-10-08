"use client";

/**
 * A task card's live signal: picked up by its agent, working (with a moving
 * bar along the card's top edge and a clock), delivered, retrying or paused.
 * Read from the board's dispatch fields, so it changes the moment the agent
 * does.
 */

import { CheckCircle2, Eye, Loader2, PauseCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import type { Task } from "../lib/perkosApi";
import { elapsed, useNow } from "./ProjectTeamStage";

export type TaskSignalKind = "delivered" | "paused" | "retrying" | "review" | "working" | "pickedUp" | "waiting";

export function taskSignal(
  task: Pick<Task, "status" | "dispatchState" | "dispatchStuck">,
): TaskSignalKind | null {
  if (task.status === "Done") return "delivered";
  if (task.dispatchStuck === true || task.dispatchState === "failed") return "paused";
  if (task.dispatchState === "retrying") return "retrying";
  if (task.status === "Review") return "review";
  if (task.status === "In progress" || task.dispatchState === "working") return "working";
  if (task.dispatchState === "starting") return "pickedUp";
  if (task.dispatchState === "waiting_on_dependency") return "waiting";
  return null;
}

const STYLE: Record<TaskSignalKind, string> = {
  delivered: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  paused: "border-red-500/30 bg-red-500/10 text-red-200",
  retrying: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  review: "border-violet-400/30 bg-violet-400/10 text-violet-100",
  working: "border-amber-400/40 bg-amber-400/10 text-amber-100",
  pickedUp: "border-primary/40 bg-primary/10 text-foreground",
  waiting: "border-border text-muted-foreground",
};

export function TaskSignal({
  task,
}: {
  task: Pick<Task, "status" | "dispatchState" | "dispatchStuck" | "dispatchedAt">;
}) {
  const { t } = useTranslation();
  const kind = taskSignal(task);
  const now = useNow(kind === "working");
  if (!kind) return null;
  const clock = kind === "working" ? elapsed(task.dispatchedAt, now) : null;
  return (
    <>
      {kind === "working" ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-md bg-[linear-gradient(90deg,transparent,rgba(251,191,36,.95),transparent)] bg-[length:40%_100%] bg-no-repeat motion-safe:animate-[pk-card-progress_1.6s_ease-in-out_infinite]"
        />
      ) : null}
      <span
        className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", STYLE[kind])}
      >
        {kind === "delivered" ? <CheckCircle2 className="h-3 w-3" /> : null}
        {kind === "paused" ? <TriangleAlert className="h-3 w-3" /> : null}
        {kind === "retrying" ? <RotateCcw className="h-3 w-3" /> : null}
        {kind === "review" ? <Eye className="h-3 w-3" /> : null}
        {kind === "pickedUp" ? <Loader2 className="h-3 w-3 motion-safe:animate-spin" /> : null}
        {kind === "waiting" ? <PauseCircle className="h-3 w-3" /> : null}
        {kind === "working" ? (
          <span aria-hidden className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-300" />
          </span>
        ) : null}
        {t(`projectRoom.taskCard.signal.${kind}`)}
        {clock ? <span className="font-mono text-[10px] opacity-80">{clock}</span> : null}
      </span>
    </>
  );
}
