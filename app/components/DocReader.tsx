"use client";

/**
 * Reading surface for project docs: the doc sits on the same sheet as an
 * agent's result (centered column, Copy / Download .md / Full screen), plan
 * tasks read as numbered sections, and each task carries its owner, live
 * board status and delivered result right where the plan asked for it.
 */

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, CircleCheck, Sparkles, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import type { DocReading, PlanTaskView } from "../lib/docReading";
import { AgentOrb } from "./AgentOrb";
import { DocumentView } from "./DocumentView";
import { readingStats } from "./TaskDetailLayout";

/** Results longer than this open as a preview with "Read the full result". */
const PREVIEW_WORDS = 160;

export function DocSheet({
  title,
  eyebrow,
  icon: Icon,
  meta,
  source,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  /** Byline, counts and reading time under the title. */
  meta: ReactNode;
  /** The doc as Markdown, for copy, download and full screen. */
  source: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="relative overflow-hidden rounded-xl border border-border bg-card animate-in fade-in slide-in-from-bottom-2 duration-500"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -top-28 left-1/2 h-56 w-2/3 -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="relative px-4 py-5 sm:px-8 sm:py-7">
        <DocumentView
          title={title}
          centered
          className="mx-auto w-full max-w-[72ch]"
          header={
            <span className="inline-flex min-h-8 items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
              <Icon className="h-3.5 w-3.5" />
              {eyebrow}
            </span>
          }
          body={
            <div className="flex flex-col gap-6">
              {/* Title under the toolbar row so it gets the full width on phones. */}
              <div className="flex min-w-0 flex-col gap-2">
                <h2 className="text-balance text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">{title}</h2>
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">{meta}</div>
              </div>
              {children}
            </div>
          }
        >
          {source}
        </DocumentView>
      </div>
    </section>
  );
}

/** Status pill, delivery bar and the plan's next action, under the title. */
export function PlanProgress({
  reading,
  statusPill,
  action,
}: {
  reading: DocReading;
  statusPill: ReactNode;
  action: ReactNode;
}) {
  const { t } = useTranslation();
  const { taskCount, onBoard, active, delivered } = reading;
  const pct = (n: number) => `${taskCount ? (n / taskCount) * 100 : 0}%`;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {statusPill}
          <span className="text-muted-foreground">
            {onBoard > 0
              ? t("chat.docs.reader.progress", { done: delivered, total: taskCount })
              : t("chat.docs.editor.draftTaskCount", { count: taskCount })}
          </span>
        </div>
        {onBoard > 0 && taskCount > 0 ? (
          <div
            className="flex h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={taskCount}
            aria-valuenow={delivered}
            aria-label={t("chat.docs.reader.progress", { done: delivered, total: taskCount })}
          >
            <span className="h-full bg-emerald-400 transition-[width] duration-700" style={{ width: pct(delivered) }} />
            <span className="h-full bg-primary/80 transition-[width] duration-700" style={{ width: pct(active) }} />
          </div>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
    </div>
  );
}

export function DocGroupHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-2 border-b border-border pb-2 text-lg font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h3>
  );
}

const TASK_STATUS: Record<string, { key: string; cls: string; dot: string }> = {
  planned: { key: "planned", cls: "border-dashed border-border text-muted-foreground", dot: "bg-muted-foreground/50" },
  Backlog: { key: "toDo", cls: "border-border text-muted-foreground", dot: "bg-muted-foreground" },
  "To do": { key: "toDo", cls: "border-border text-muted-foreground", dot: "bg-muted-foreground" },
  "In progress": { key: "inProgress", cls: "border-primary/40 bg-primary/10 text-foreground", dot: "bg-primary animate-pulse" },
  Review: { key: "review", cls: "border-amber-500/30 bg-amber-500/10 text-amber-200", dot: "bg-amber-300" },
  Done: { key: "done", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200", dot: "bg-emerald-400" },
};

function TaskStatusChip({ status }: { status: string }) {
  const { t } = useTranslation();
  const meta = TASK_STATUS[status] ?? TASK_STATUS.Backlog!;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]", meta.cls)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {t(`chat.docs.reader.status.${meta.key}`)}
    </span>
  );
}

export function PlanTaskSection({
  view,
  last,
  taskHref,
  proposedBy,
}: {
  view: PlanTaskView;
  last: boolean;
  taskHref: (taskId: string) => string;
  /** "Proposed by … · draft", shown until the task reaches the board. */
  proposedBy: string;
}) {
  const { t } = useTranslation();
  const { block, number, task, result, agent } = view;
  const title = block.title || t("chat.docs.task.untitledTask");
  const taskId = block.materializedTaskId;
  return (
    <article className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[2.25rem_minmax(0,1fr)]">
      {/* Numbered rail: the plan reads as a sequence. */}
      <div className="relative flex flex-col items-center">
        <span className="grid h-7 w-7 place-items-center rounded-full border border-primary/40 bg-primary/10 font-mono text-[11px] tabular-nums text-primary">
          {String(number).padStart(2, "0")}
        </span>
        {!last ? <span aria-hidden className="mt-2 w-px flex-1 bg-gradient-to-b from-border to-transparent" /> : null}
      </div>
      <div className="min-w-0 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5 pt-0.5">
          <h4 className="min-w-0 text-base font-semibold leading-snug text-foreground">{title}</h4>
          <TaskStatusChip status={task?.status ?? (taskId ? "Backlog" : "planned")} />
        </div>
        {block.desc?.trim() ? (
          <DocumentView title={title} toolbar={false} className="mt-2">
            {block.desc}
          </DocumentView>
        ) : null}
        {block.acceptance?.trim() ? (
          <div className="mt-3 flex gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2.5">
            <CircleCheck aria-hidden className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-sm leading-6 text-foreground/80">
              <span className="font-medium text-emerald-300">{t("chat.docs.reader.doneWhen")}</span>{" "}
              {block.acceptance}
            </p>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {agent ? (
            <span className="inline-flex min-w-0 max-w-full items-center gap-2">
              <AgentOrb name={agent} size={22} />
              <span className="min-w-0 truncate">
                <span className="sr-only">{t("chat.docs.reader.assignedTo")} </span>
                <span className="text-foreground/85">{agent}</span>
              </span>
            </span>
          ) : null}
          {taskId ? (
            <Link
              href={taskHref(taskId)}
              className="inline-flex min-h-9 items-center gap-1 text-primary underline-offset-2 hover:underline sm:min-h-0"
            >
              {t("chat.docs.reader.openTask")} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span>{proposedBy}</span>
          )}
        </div>
        {result ? <ResultPanel title={title} text={result} agent={agent} /> : null}
      </div>
    </article>
  );
}

/** A delivered result inside the doc: same reader as the task page, clamped when long. */
export function ResultPanel({
  title,
  text,
  agent,
  showTitle = false,
}: {
  title: string;
  text: string;
  agent?: string | null;
  /** Orphan results (no plan task above them) carry their own heading. */
  showTitle?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const bodyId = useId();
  const { words, minutes } = readingStats(text);
  const long = words > PREVIEW_WORDS;
  const [open, setOpen] = useState(false);
  const clamped = long && !open;
  return (
    <section
      aria-label={`${t("chat.docs.reader.result")}: ${title}`}
      className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-3 sm:p-4"
    >
      <DocumentView
        title={title}
        header={
          <div className="flex min-w-0 flex-col gap-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              {t("chat.docs.reader.result")}
            </span>
            {showTitle ? <h3 className="text-base font-semibold leading-snug text-foreground">{title}</h3> : null}
            <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              {agent ? <span className="min-w-0 max-w-full truncate">{t("chat.docs.reader.byline", { name: agent })}</span> : null}
              <span className="whitespace-nowrap">
                {t("chat.docs.reader.stats", { words: words.toLocaleString(i18n.language), minutes })}
              </span>
            </span>
          </div>
        }
        body={
          <div
            id={bodyId}
            className={cn(clamped && "max-h-64 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]")}
          >
            <DocumentView title={title} toolbar={false}>
              {text}
            </DocumentView>
          </div>
        }
      >
        {text}
      </DocumentView>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-md text-xs font-medium text-emerald-300 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          {open ? t("chat.docs.reader.readLess") : t("chat.docs.reader.readMore")}
        </button>
      ) : null}
    </section>
  );
}
