"use client";

/**
 * Live project view: the conversation (you, Sparky and the team) on the left,
 * the stage on the right (team at work, workflow graph or knowledge graph)
 * and the work area below it (tasks, docs, agents, members). On phones a
 * sticky switcher shows one area at a time with live counts.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CircleDot, FileText, GitBranch, MessageSquare, Network, Users } from "lucide-react";

import { cn } from "@/lib/utils";

export type StageView = "tasks" | "workflow" | "knowledge" | "docs";
type MobileView = "talk" | "team" | "work";

const CONVERSATION_ID = "project-conversation";

const STAGE_TABS: { id: StageView; label: string; Icon: typeof Users }[] = [
  { id: "tasks", label: "Tasks", Icon: CircleDot },
  { id: "workflow", label: "Workflow", Icon: GitBranch },
  { id: "knowledge", label: "Knowledge", Icon: Network },
  { id: "docs", label: "Docs", Icon: FileText },
];

export function ProjectLiveLayout({
  conversation,
  guidance,
  summary,
  stage,
  initialStage = "tasks",
  requestedStage,
  work,
  counts,
  initialMobile = "talk",
  workFocus = 0,
}: {
  conversation: ReactNode;
  /** Contextual next action: one recommendation, then at most two alternatives. */
  guidance?: ReactNode;
  /** Goal, task counters and team workload: always on desktop, with Tasks on phones. */
  summary?: ReactNode;
  stage: (view: StageView, focusAgent: (name: string) => void) => ReactNode;
  initialStage?: StageView;
  /** External recommendation/CTA can bring the canvas to a specific stage. */
  requestedStage?: StageView;
  work: ReactNode;
  counts: { working: number; done: number; total: number };
  initialMobile?: MobileView;
  /** Bumped when a link opens a work tab (Members, Docs…): show it and scroll to it. */
  workFocus?: number;
}) {
  // A finished project opens on what the team learned.
  const [stageView, setStageView] = useState<StageView>(initialStage);
  const [mobile, setMobile] = useState<MobileView>(initialMobile);
  const conversationFrame = useRef<HTMLDivElement>(null);
  const workSection = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!requestedStage) return;
    setStageView(requestedStage);
    setMobile("team");
  }, [requestedStage]);

  // A link to a work tab lands on it: phones switch to the work area, and both
  // phones and desktop scroll it into view instead of changing a tab off screen.
  useEffect(() => {
    if (!workFocus) return;
    setMobile("work");
    const frame = window.requestAnimationFrame(() => {
      workSection.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [workFocus]);

  // Desktop: the conversation fills the window from where it rests down to the
  // bottom edge, so the newest messages and the composer are in view on
  // arrival. Its height comes from the resting position, not the scroll, so it
  // keeps one size and sticks to the top while the page scrolls.
  useEffect(() => {
    const el = conversationFrame.current;
    const cell = el?.parentElement;
    if (!el || !cell) return;
    let frame = 0;
    const fit = () => {
      frame = 0;
      const restingTop = Math.max(16, cell.getBoundingClientRect().top + window.scrollY);
      el.style.setProperty("--live-chat-height", `${Math.max(448, Math.floor(window.innerHeight - restingTop - 16))}px`);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(fit);
    };
    fit();
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(document.body);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, []);

  function focusAgent(name: string) {
    setMobile("talk");
    // Wait a frame so the conversation is visible on phones before scrolling.
    window.requestAnimationFrame(() => {
      const rows = document
        .getElementById(CONVERSATION_ID)
        ?.querySelectorAll<HTMLElement>(`[data-agent="${CSS.escape(name)}"]`);
      const last = rows && rows.length > 0 ? rows[rows.length - 1] : null;
      if (!last) return;
      last.scrollIntoView({ behavior: "smooth", block: "center" });
      last.classList.add("ring-2", "ring-primary/60", "rounded-2xl");
      window.setTimeout(() => last.classList.remove("ring-2", "ring-primary/60", "rounded-2xl"), 1600);
    });
  }

  // Knowledge sits next to the conversation, the team and the tasks: on
  // phones it is one tap away and opens the team area on the knowledge stage.
  const switcher: { id: MobileView | "knowledge" | "docs"; label: string; badge: string; Icon: typeof Users }[] = [
    { id: "talk", label: "Chat", badge: "Sparky", Icon: MessageSquare },
    { id: "team", label: "Tasks", badge: `${counts.done}/${counts.total} done`, Icon: CircleDot },
    { id: "work", label: "Team", badge: counts.working > 0 ? `${counts.working} working` : "ready", Icon: Users },
    { id: "knowledge", label: "Knowledge", badge: counts.done > 0 ? `${counts.done} learned` : "growing", Icon: Network },
    { id: "docs", label: "Docs", badge: counts.done > 0 ? `${counts.done} ready` : "project", Icon: FileText },
  ];
  const switcherActive = (id: MobileView | "knowledge" | "docs") =>
    id === "knowledge"
      ? mobile === "team" && stageView === "knowledge"
      : id === "docs"
        ? mobile === "team" && stageView === "docs"
      : id === "team"
        ? mobile === "team" && stageView !== "knowledge" && stageView !== "docs"
        : mobile === id;
  const selectArea = (id: MobileView | "knowledge" | "docs") => {
    if (id === "knowledge") {
      setStageView("knowledge");
      setMobile("team");
    } else if (id === "docs") {
      setStageView("docs");
      setMobile("team");
    } else {
      if (id === "team" && (stageView === "knowledge" || stageView === "docs")) setStageView("tasks");
      setMobile(id);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <nav
        aria-label="Project areas"
        className="sticky top-0 z-20 -mx-4 flex gap-1 border-b border-border bg-background/90 px-4 py-2 backdrop-blur lg:hidden"
      >
        {switcher.map(({ id, label, badge, Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={switcherActive(id)}
            onClick={() => selectArea(id)}
            className={cn(
              "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-lg text-xs transition-colors",
              switcherActive(id) ? "bg-primary/15 text-foreground" : "text-muted-foreground",
            )}
          >
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
            <span className="text-[10px] text-muted-foreground">{badge}</span>
          </button>
        ))}
      </nav>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,360px)_minmax(0,1fr)_minmax(360px,400px)]">
        <div
          id={CONVERSATION_ID}
          className={cn(
            "min-w-0 lg:block lg:h-full lg:min-h-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-cyan-300/15 lg:bg-cyan-300/[.015] lg:p-px lg:shadow-[0_0_38px_-22px_rgba(34,211,238,.62)]",
            mobile === "talk" ? "block" : "hidden",
          )}
        >
          <div
            ref={conversationFrame}
            className="h-full min-h-0 [&>*]:min-h-0 lg:flex lg:[&>*]:flex-1"
          >
            {conversation}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col lg:h-full lg:overflow-hidden">
          <section
            aria-label="Project stage"
            className={cn(
              "min-h-0 min-w-0 flex-1 rounded-2xl border border-border bg-card/70 p-4 md:p-5 lg:flex lg:flex-col lg:overflow-hidden lg:border-primary/25 lg:bg-[linear-gradient(145deg,rgba(236,27,105,.045),rgba(14,7,22,.72)_24%)] lg:shadow-[0_0_42px_-22px_rgba(236,27,105,.68)]",
              mobile === "team" ? "block" : "hidden",
            )}
          >
            <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <div role="tablist" className="inline-flex rounded-full border border-border bg-background/60 p-1">
                {STAGE_TABS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={stageView === id}
                    onClick={() => setStageView(id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                      stageView === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {stageView === "tasks"
                  ? "What the agents are doing, what is blocked and what has been delivered."
                  : stageView === "workflow"
                    ? "How work flows between teammates."
                    : stageView === "knowledge"
                      ? "How people, agents, work and sources relate."
                      : "Plans, deliverables and project knowledge you can review and reuse."}
              </p>
            </div>
            <div
              data-testid="project-stage-scroll"
              className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]"
            >
              {stage(stageView, focusAgent)}
            </div>
          </section>
        </div>

        <aside
          className={cn(
            "min-w-0 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:gap-3 lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-violet-300/15 lg:bg-[linear-gradient(155deg,rgba(167,139,250,.045),rgba(14,7,22,.5)_30%)] lg:p-3 lg:shadow-[0_0_38px_-22px_rgba(167,139,250,.58)]",
            mobile === "work" ? "block" : "hidden lg:flex",
          )}
        >
          {guidance ? <section aria-label="Recommended next action">{guidance}</section> : null}
          {summary ? <section aria-label="Project summary">{summary}</section> : null}
          <section ref={workSection} aria-label="Project work" className="min-w-0 scroll-mt-4">
            {work}
          </section>
        </aside>
      </div>
    </div>
  );
}
