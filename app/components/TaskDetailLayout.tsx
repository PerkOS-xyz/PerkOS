"use client";

/**
 * Task detail building blocks: the deliverable reads like a document sheet,
 * everything else (assignee, project, brief) sits in a side rail on desktop
 * and collapses into a chip row plus a foldable brief on phones.
 */

import Link from "next/link";
import { useState } from "react";
import { Calendar, ChevronDown, Clock3, Folder, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

import { AgentOrb } from "./AgentOrb";
import { DocumentView } from "./DocumentView";
import { Markdown } from "./Markdown";

const WORDS_PER_MINUTE = 220;

/** Word count and reading time; Intl.Segmenter keeps Korean/Japanese/Chinese honest. */
export function readingStats(text: string): { words: number; minutes: number } {
  const trimmed = text.trim();
  if (!trimmed) return { words: 0, minutes: 0 };
  let words = 0;
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    for (const part of segmenter.segment(trimmed)) if (part.isWordLike) words++;
  } else {
    words = trimmed.split(/\s+/).length;
  }
  return { words, minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)) };
}

export type TaskPeople = {
  agentName: string | null;
  agentLabel: string | null;
  runtime: string | null;
  projectId: string;
  projectName: string | null | undefined;
};

export function DeliverableSheet({
  result,
  title,
  agentLabel,
}: {
  result: string;
  title: string;
  agentLabel: string | null;
}) {
  const { words, minutes } = readingStats(result);
  return (
    <section
      aria-label="Agent result"
      className="relative overflow-hidden rounded-xl border border-border bg-card animate-in fade-in slide-in-from-bottom-2 duration-500"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -top-28 left-1/2 h-56 w-2/3 -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="relative px-4 py-5 sm:px-8 sm:py-7">
        <DocumentView
          title={title}
          centered
          header={
            <div className="flex min-w-0 flex-col gap-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Agent result
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                {agentLabel ? (
                  <span className="min-w-0 max-w-full truncate">
                    by <span className="text-foreground/80">{agentLabel}</span>
                  </span>
                ) : null}
                <span className="whitespace-nowrap">
                  {words.toLocaleString("en-US")} words · {minutes} min read
                </span>
              </span>
            </div>
          }
        >
          {result}
        </DocumentView>
      </div>
    </section>
  );
}

export function PendingDeliverable({ status }: { status: string }) {
  const working = status === "In progress" || status === "Review";
  return (
    <section className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center animate-in fade-in duration-500">
      <Clock3 className={cn("h-5 w-5", working ? "text-amber-300" : "text-muted-foreground")} />
      <p className="text-sm font-medium text-foreground">
        {working ? "The agent is working on this task" : "No deliverable yet"}
      </p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
        The agent&apos;s result appears here as a document as soon as the task is done.
      </p>
    </section>
  );
}

function Brief({ prompt }: { prompt: string | undefined }) {
  return prompt?.trim() ? (
    <div className="text-sm leading-relaxed text-foreground/80">
      <Markdown>{prompt}</Markdown>
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">No brief was provided when this task was created.</p>
  );
}

function RailRow({ icon: Icon, label, children }: { icon: typeof Folder; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="min-w-0 truncate text-right text-sm text-foreground">{children}</dd>
      </div>
    </div>
  );
}

/** Desktop side rail: who, where, and the brief. */
export function TaskRail({ people, prompt }: { people: TaskPeople; prompt: string | undefined }) {
  const [briefOpen, setBriefOpen] = useState(false);
  const long = (prompt?.length ?? 0) > 420;
  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-2 duration-500">
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Assigned to</p>
        {people.agentName ? (
          <div className="mt-3 flex items-center gap-3">
            <AgentOrb name={people.agentLabel ?? people.agentName} size={44} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{people.agentLabel ?? people.agentName}</p>
              <p className="truncate text-xs text-muted-foreground">{people.runtime ?? "Runtime unverified"}</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Nobody yet</p>
        )}
        <dl className="mt-3 divide-y divide-border border-t border-border">
          <RailRow icon={Folder} label="Project">
            <Link href={`/projects/${people.projectId}`} className="hover:text-primary">
              {people.projectName ?? "Project"}
            </Link>
          </RailRow>
          <RailRow icon={Calendar} label="Due date">
            <span className="text-muted-foreground">Not set</span>
          </RailRow>
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Brief</p>
        <div className={cn("relative mt-3", long && !briefOpen && "max-h-56 overflow-hidden")}>
          <Brief prompt={prompt} />
          {long && !briefOpen ? (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
          ) : null}
        </div>
        {long ? (
          <button
            type="button"
            onClick={() => setBriefOpen((open) => !open)}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            {briefOpen ? "Show less" : "Show full brief"}
          </button>
        ) : null}
      </section>
    </div>
  );
}

/** Phone and tablet summary: swipeable chips plus a foldable brief. */
export function TaskMobileSummary({
  people,
  prompt,
  className,
}: {
  people: TaskPeople;
  prompt: string | undefined;
  className?: string;
}) {
  const chip =
    "inline-flex h-9 shrink-0 snap-start items-center gap-2 rounded-full border border-border bg-card px-3 text-xs text-foreground";
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {people.agentName ? (
          <span className={chip}>
            <AgentOrb name={people.agentLabel ?? people.agentName} size={22} />
            <span className="max-w-[12rem] truncate">{people.agentLabel ?? people.agentName}</span>
          </span>
        ) : null}
        <Link href={`/projects/${people.projectId}`} className={cn(chip, "hover:border-primary/40")}>
          <Folder className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="max-w-[12rem] truncate">{people.projectName ?? "Project"}</span>
        </Link>
        <span className={cn(chip, "text-muted-foreground")}>
          <Calendar className="h-3.5 w-3.5" />
          No due date
        </span>
      </div>
      <details className="group rounded-xl border border-border bg-card/70">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium text-foreground marker:content-none">
          Brief
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border px-4 py-3">
          <Brief prompt={prompt} />
        </div>
      </details>
    </div>
  );
}
