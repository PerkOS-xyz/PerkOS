"use client";

/**
 * Plain-language activity feed — "Scholar completed Write menu copy · 5m ago".
 * The single surface that answers "what did my team do while I was away".
 * Reads the wallet's activity_events stream (live snapshot listener).
 */

import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  Compass,
  FileCheck2,
  FilePlus2,
  Flag,
  Loader2,
  MoveRight,
  Play,
  Rocket,
  RotateCcw,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { formatRelativeShort } from "../lib/format";
import {
  useActivityFeed,
  verbPhrase,
  type ActivityEvent,
} from "../lib/activityEvents";

const VERB_ICONS: Record<string, { Icon: LucideIcon; tone: string }> = {
  created_task: { Icon: FilePlus2, tone: "text-sky-300" },
  moved_task: { Icon: MoveRight, tone: "text-muted-foreground" },
  started_task: { Icon: Play, tone: "text-amber-300" },
  completed_task: { Icon: CheckCircle2, tone: "text-emerald-300" },
  retried_task: { Icon: RotateCcw, tone: "text-amber-300" },
  planned: { Icon: Compass, tone: "text-primary" },
  proposed_plan: { Icon: FileCheck2, tone: "text-sky-300" },
  approved_plan: { Icon: FileCheck2, tone: "text-emerald-300" },
  goal_done: { Icon: Flag, tone: "text-emerald-300" },
  launched_agent: { Icon: Rocket, tone: "text-primary" },
  agent_online: { Icon: Zap, tone: "text-emerald-300" },
  agent_failed: { Icon: Zap, tone: "text-destructive" },
  created_project: { Icon: FilePlus2, tone: "text-primary" },
};

function eventHref(e: ActivityEvent): string | null {
  if (e.projectId && e.taskId)
    return `/projects/${encodeURIComponent(e.projectId)}/tasks/${encodeURIComponent(e.taskId)}`;
  if (e.objectType === "plan" && e.projectId)
    return `/projects/${encodeURIComponent(e.projectId)}?tab=docs`;
  if (e.projectId) return `/projects/${encodeURIComponent(e.projectId)}`;
  if (e.agentId) return `/agents/${encodeURIComponent(e.agentId)}`;
  return null;
}

/**
 * Feed actors written server-side are raw wallet addresses (the API logs the
 * authed caller, which is the only identity it has). Render the viewer's own
 * wallet as "You" and anyone else's shortened, so a shared board still shows
 * who did what without a 42-character hex string in the line.
 */
function actorLabel(event: ActivityEvent, viewer?: string | null): string {
  const actor = event.actor ?? "";
  if (event.actorType !== "user" || !/^0x[0-9a-fA-F]{40}$/.test(actor)) return actor;
  if (viewer && actor.toLowerCase() === viewer.toLowerCase()) return "You";
  return `${actor.slice(0, 6)}…${actor.slice(-4)}`;
}

export function ActivityFeedCard({
  walletAddress,
  max = 25,
  className,
  /** Show only events for one project. */
  projectId,
  title,
}: {
  walletAddress?: string | null;
  max?: number;
  className?: string;
  projectId?: string;
  title?: string;
}) {
  const { t } = useTranslation();
  const { events, loaded } = useActivityFeed(walletAddress, projectId ? 120 : max);
  const visible = (
    projectId ? events.filter((e) => e.projectId === projectId) : events
  ).slice(0, max);

  return (
    <section
      className={cn(
        "glow-card flex flex-col gap-3 rounded-lg border border-primary/25 bg-card/60 px-4 py-4",
        className,
      )}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">
          {title ?? t("components.activityFeed.title")}
        </h2>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
          {t("components.activityFeed.live")}
        </span>
      </header>

      {!loaded && walletAddress ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {t("components.activityFeed.loading")}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-3 text-xs leading-relaxed text-muted-foreground">
          {t("components.activityFeed.empty")}
        </p>
      ) : (
        <ul className="flex flex-col">
          {visible.map((e) => (
            <FeedRow key={e.id} event={e} viewer={walletAddress} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedRow({
  event,
  viewer,
}: {
  event: ActivityEvent;
  viewer?: string | null;
}) {
  const { t } = useTranslation();
  const meta = VERB_ICONS[event.verb] ?? {
    Icon: event.actorType === "user" ? User : Bot,
    tone: "text-muted-foreground",
  };
  const href = eventHref(event);

  const line = (
    <div className="flex min-w-0 flex-1 items-baseline gap-1.5 text-xs leading-relaxed">
      <span className="shrink-0 font-medium text-foreground">
        {actorLabel(event, viewer)}
      </span>
      <span className="shrink-0 text-muted-foreground">{verbPhrase(event.verb, t)}</span>
      {event.object ? (
        <span className="min-w-0 truncate text-foreground/90">{event.object}</span>
      ) : null}
      {event.detail ? (
        <span className="min-w-0 truncate text-muted-foreground">
          · {event.detail}
        </span>
      ) : null}
    </div>
  );

  return (
    <li className="group flex items-center gap-2.5 border-b border-border/40 py-2 last:border-0">
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#1b1833]/80",
          meta.tone,
        )}
      >
        <meta.Icon className="h-3 w-3" />
      </span>
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-80">
          {line}
        </Link>
      ) : (
        line
      )}
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        {event.tsMs ? formatRelativeShort(new Date(event.tsMs)) : ""}
      </span>
    </li>
  );
}
