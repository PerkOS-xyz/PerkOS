"use client";

/**
 * "What the team learned": the key points and cited sources of every result
 * the team delivered, grouped by deliverable and signed with the teammate's
 * orb. It grows as results land, so project knowledge reads as knowledge, not
 * as another view of the team.
 */

import Link from "next/link";
import { ArrowUpRight, Link2 } from "lucide-react";

import type { Learning } from "../lib/projectLearnings";
import { AgentOrb } from "./AgentOrb";
import { useAgentHue } from "./ProjectAgentIdentity";

const MAX_SOURCES = 4;

export function ProjectLearnings({
  learnings,
  taskHref,
}: {
  learnings: Learning[];
  taskHref: (taskId: string) => string;
}) {
  const hue = useAgentHue();
  if (learnings.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Every result your team delivers adds to what this project knows.
      </p>
    );
  }
  const sourceCount = new Set(learnings.flatMap((l) => l.sources.map((s) => s.url))).size;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {learnings.length} result{learnings.length === 1 ? "" : "s"} delivered
        {sourceCount ? ` · ${sourceCount} source${sourceCount === 1 ? "" : "s"} cited` : ""}
      </p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {learnings.map((learning) => (
          <li key={learning.taskId ?? learning.task} className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-white/[.03] p-3.5">
            <div className="flex items-start gap-2.5">
              {learning.agent ? <AgentOrb name={learning.agent} size={28} /> : null}
              <div className="min-w-0 flex-1">
                {learning.taskId ? (
                  <Link href={taskHref(learning.taskId)} className="group inline-flex items-start gap-1 text-sm font-medium text-foreground hover:text-primary">
                    <span className="line-clamp-2">{learning.task}</span>
                    <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                  </Link>
                ) : (
                  <span className="line-clamp-2 text-sm font-medium">{learning.task}</span>
                )}
                {learning.agent ? (
                  <p className="text-[11px]" style={{ color: hue(learning.agent, 0.9) }}>{learning.agent}</p>
                ) : null}
              </div>
            </div>
            {learning.points.length ? (
              <ul className="flex flex-col gap-1.5 pl-1">
                {learning.points.map((point) => (
                  <li key={point} className="flex gap-2 text-xs leading-relaxed text-foreground/85">
                    <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {learning.sources.length ? (
              <div className="flex flex-wrap gap-1.5">
                {learning.sources.slice(0, MAX_SOURCES).map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={source.url}
                    className="inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-white/10 bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    <Link2 className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{source.label}</span>
                  </a>
                ))}
                {learning.sources.length > MAX_SOURCES ? (
                  <span className="px-1 text-[10px] text-muted-foreground">+{learning.sources.length - MAX_SOURCES} more</span>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
