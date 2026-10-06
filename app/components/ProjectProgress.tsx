"use client";

/**
 * Where the project stands, in one glance: a four-step track (Plan, Approve,
 * Work, Delivered), one plain sentence for the current
 * phase, and the few things that need the owner right now. Replaces counters
 * that all said the same number.
 */

import Link from "next/link";
import { CircleAlert, CircleCheck, Hand } from "lucide-react";

import type { ProjectDetail, Task } from "../lib/perkosApi";
import { cn } from "@/lib/utils";

type Phase = NonNullable<NonNullable<ProjectDetail["project"]["workflow"]>["phase"]>;

export const PROGRESS_STEPS = ["Plan", "Approve", "Work", "Delivered"] as const;

export type NeedItem = { key: string; text: string; href?: string };

export type ProjectProgressView = {
  /** Index of the current step; -1 before planning starts. */
  step: number;
  /** "attention" when the current step is blocked on something. */
  tone: "calm" | "active" | "attention" | "done";
  line: string;
  needs: NeedItem[];
};

function paused(task: Task): boolean {
  return task.dispatchStuck === true || task.dispatchState === "failed";
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Pure view of the project's progress, so it can be tested without React. */
export function projectProgress(input: {
  phase?: Phase;
  failureReason?: string | null;
  tasks: Task[];
  taskHref: (taskId: string) => string;
}): ProjectProgressView {
  const { tasks } = input;
  const phase = input.phase ?? "draft";
  const done = tasks.filter((t) => t.status === "Done").length;
  const working = tasks.filter((t) => t.status === "In progress").length;
  const stuck = tasks.filter((t) => t.id && t.status !== "Done" && paused(t));
  const teammates = new Set(tasks.filter((t) => t.status === "Done" && t.agent).map((t) => t.agent)).size;
  const needs: NeedItem[] = [];

  if (phase === "awaiting_approval") {
    needs.push({ key: "approve", text: "Review Sparky's plan and approve it", href: "#project-conversation" });
  }
  if (phase === "planning_failed") {
    needs.push({ key: "replan", text: "Put the team to work again so Sparky can finish the plan" });
  }
  for (const task of stuck.slice(0, 3)) {
    needs.push({ key: `paused-${task.id}`, text: `${task.name} is paused. Open it to retry`, href: input.taskHref(task.id as string) });
  }
  if (stuck.length > 3) {
    needs.push({ key: "paused-more", text: `${plural(stuck.length - 3, "more task")} paused` });
  }

  switch (phase) {
    case "planning":
      return { step: 0, tone: "active", line: "Sparky is planning the work with the team.", needs };
    case "planning_failed":
      return { step: 0, tone: "attention", line: input.failureReason || "Sparky needs another try to finish the plan.", needs };
    case "awaiting_approval":
      return { step: 1, tone: "attention", line: "Sparky's plan is ready for your approval.", needs };
    case "approved":
    case "running":
      return {
        step: 2,
        tone: stuck.length ? "attention" : "active",
        line: `${working > 0 ? `${working} working · ` : ""}${done} of ${plural(tasks.length, "task")} delivered`,
        needs,
      };
    case "pm_review":
      return { step: 2, tone: "active", line: `Wrapping up: ${done} of ${plural(tasks.length, "task")} delivered`, needs };
    case "complete":
      return {
        step: 3,
        tone: "done",
        line: `${plural(done, "task")} delivered${teammates ? ` by ${plural(teammates, "teammate")}` : ""}`,
        needs,
      };
    default:
      return { step: -1, tone: "calm", line: "Put the team to work and Sparky will plan the goal with them.", needs };
  }
}

export function ProjectProgress({
  detail,
  projectId,
  ownerWallet,
}: {
  detail: ProjectDetail;
  projectId: string;
  ownerWallet?: string;
}) {
  const workflow = detail.project.workflow;
  const view = projectProgress({
    phase: workflow?.phase,
    failureReason: workflow?.failureReason,
    tasks: detail.tasks,
    taskHref: (taskId) =>
      `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}` +
      (ownerWallet ? `?owner=${encodeURIComponent(ownerWallet)}` : ""),
  });

  return (
    <section aria-label="Project progress" className="rounded-lg border border-primary/25 bg-card/60 p-4">
      <ol className="flex items-center gap-1.5" aria-label="Project steps">
        {PROGRESS_STEPS.map((label, index) => {
          const state =
            index < view.step || view.tone === "done"
              ? "done"
              : index === view.step
                ? view.tone === "attention" ? "attention" : "current"
                : "next";
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-1.5" aria-current={state === "current" || state === "attention" ? "step" : undefined}>
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
                  state === "done" && "border-emerald-400/50 bg-emerald-400/15 text-emerald-300",
                  state === "current" && "border-primary bg-primary/20 text-primary shadow-[0_0_14px_-2px_rgba(236,27,105,.7)]",
                  state === "attention" && "border-amber-400/60 bg-amber-400/15 text-amber-300",
                  state === "next" && "border-white/15 text-muted-foreground",
                )}
              >
                {state === "done" ? <CircleCheck className="h-3 w-3" /> : index + 1}
              </span>
              <span className={cn("truncate text-[11px]", state === "next" ? "text-muted-foreground" : "text-foreground")}>{label}</span>
              {index < PROGRESS_STEPS.length - 1 ? (
                <span className={cn("h-px min-w-3 flex-1", index < view.step || view.tone === "done" ? "bg-emerald-400/40" : "bg-white/10")} />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className={cn("mt-3 text-sm", view.tone === "attention" ? "text-amber-200" : "text-foreground/90")}>{view.line}</p>
      {view.needs.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5" aria-label="Needs you">
          {view.needs.map((need) => (
            <li key={need.key} className="flex items-start gap-2 rounded-md border border-amber-400/25 bg-amber-400/[.06] px-3 py-2 text-xs text-amber-100">
              {need.key === "approve" ? <Hand className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              {need.href ? (
                need.href.startsWith("#") ? (
                  <a href={need.href} className="underline-offset-2 hover:underline">{need.text}</a>
                ) : (
                  <Link href={need.href} className="underline-offset-2 hover:underline">{need.text}</Link>
                )
              ) : (
                <span>{need.text}</span>
              )}
            </li>
          ))}
        </ul>
      ) : view.step === 2 ? (
        <p className="mt-2 text-xs text-muted-foreground">Nothing needs you right now. The team keeps going on its own.</p>
      ) : null}
    </section>
  );
}
