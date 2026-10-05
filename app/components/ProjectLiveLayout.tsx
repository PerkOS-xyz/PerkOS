"use client";

/**
 * Live project view: the conversation (you, Sparky and the team) on the left,
 * the stage on the right (team at work, workflow graph or knowledge graph)
 * and the work area below it (tasks, docs, agents, members). On phones a
 * sticky switcher shows one area at a time with live counts.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CircleDot, GitBranch, MessageSquare, Network, Users } from "lucide-react";

import { cn } from "@/lib/utils";

export type StageView = "team" | "workflow" | "knowledge";
type MobileView = "talk" | "team" | "work";

const CONVERSATION_ID = "project-conversation";

const STAGE_TABS: { id: StageView; label: string; Icon: typeof Users }[] = [
  { id: "team", label: "Team", Icon: Users },
  { id: "workflow", label: "Workflow", Icon: GitBranch },
  { id: "knowledge", label: "Knowledge", Icon: Network },
];

export function ProjectLiveLayout({
  conversation,
  summary,
  stage,
  initialStage = "team",
  work,
  counts,
  initialMobile = "talk",
}: {
  conversation: ReactNode;
  /** Goal, task counters and team workload: always on desktop, with Tasks on phones. */
  summary?: ReactNode;
  stage: (view: StageView, focusAgent: (name: string) => void) => ReactNode;
  initialStage?: StageView;
  work: ReactNode;
  counts: { working: number; done: number; total: number };
  initialMobile?: MobileView;
}) {
  const [stageView, setStageView] = useState<StageView>(initialStage);
  const [mobile, setMobile] = useState<MobileView>(initialMobile);
  const conversationFrame = useRef<HTMLDivElement>(null);

  // Desktop: the conversation fills the window from wherever it starts down to
  // the bottom edge, so the newest messages and the composer stay in view. It
  // grows as the page scrolls until it sticks to the top.
  useEffect(() => {
    const el = conversationFrame.current;
    if (!el) return;
    let frame = 0;
    const fit = () => {
      frame = 0;
      const top = Math.max(16, el.getBoundingClientRect().top);
      el.style.setProperty("--live-chat-height", `${Math.max(448, Math.floor(window.innerHeight - top - 16))}px`);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(fit);
    };
    fit();
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(document.body);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, { capture: true });
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

  const switcher: { id: MobileView; label: string; badge: string; Icon: typeof Users }[] = [
    { id: "talk", label: "Conversation", badge: "Sparky", Icon: MessageSquare },
    { id: "team", label: "Team", badge: counts.working > 0 ? `${counts.working} working` : "idle", Icon: Users },
    { id: "work", label: "Tasks", badge: `${counts.done}/${counts.total} done`, Icon: CircleDot },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <nav
        aria-label="Project areas"
        className="sticky top-0 z-20 -mx-4 flex gap-1 border-b border-border bg-background/90 px-4 py-2 backdrop-blur lg:hidden"
      >
        {switcher.map(({ id, label, badge, Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={mobile === id}
            onClick={() => setMobile(id)}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center justify-center rounded-lg text-xs transition-colors",
              mobile === id ? "bg-primary/15 text-foreground" : "text-muted-foreground",
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

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        <div id={CONVERSATION_ID} className={cn("min-w-0 lg:block", mobile === "talk" ? "block" : "hidden")}>
          <div ref={conversationFrame} className="lg:sticky lg:top-4">{conversation}</div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {summary ? (
            <section aria-label="Project summary" className={cn("min-w-0 lg:block", mobile === "work" ? "block" : "hidden")}>
              {summary}
            </section>
          ) : null}
          <section
            aria-label="Project stage"
            className={cn("min-w-0 rounded-2xl border border-border bg-card/70 p-4 md:p-5 lg:block", mobile === "team" ? "block" : "hidden")}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
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
                {stageView === "team"
                  ? "Who is doing what right now, and who is waiting on whom."
                  : stageView === "workflow"
                    ? "How work flows between teammates."
                    : "How people, agents, work and sources relate."}
              </p>
            </div>
            {stage(stageView, focusAgent)}
          </section>

          <section aria-label="Project work" className={cn("min-w-0 lg:block", mobile === "work" ? "block" : "hidden")}>
            {work}
          </section>
        </div>
      </div>
    </div>
  );
}
