"use client";

/**
 * Backlinks — "where does this entity appear?" Notion-style linked-mentions
 * panel built on the edges collection: chat @-mentions and task assignments
 * pointing at the entity, each with a jump link. The 80%-value graph surface
 * (a full graph canvas is deliberately NOT this).
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AtSign, Link2, ListTodo } from "lucide-react";

import { formatRelativeShort } from "../lib/format";
import { getEdgesTo, type Edge } from "../lib/edges";

function edgeHref(e: Edge): string | null {
  if (e.rel === "assigned_to" && e.projectId && e.sourceRef)
    return `/projects/${encodeURIComponent(e.projectId)}/tasks/${encodeURIComponent(e.sourceRef)}`;
  if (e.rel === "mentions" && e.projectId)
    return `/projects/${encodeURIComponent(e.projectId)}?tab=chat`;
  if (e.projectId) return `/projects/${encodeURIComponent(e.projectId)}`;
  return null;
}

export function BacklinksPanel({
  walletAddress,
  entityKey: key,
}: {
  walletAddress?: string | null;
  /** e.g. "agent:Researcher" — see entityKey helpers in lib/edges. */
  entityKey: string;
}) {
  const { data } = useQuery({
    queryKey: ["edges-to", walletAddress, key],
    queryFn: () => getEdgesTo(walletAddress!, key),
    enabled: Boolean(walletAddress && key),
    staleTime: 60_000,
  });
  const edges = data ?? [];
  if (edges.length === 0) return null;

  const mentions = edges.filter((e) => e.rel === "mentions");
  const assignments = edges.filter((e) => e.rel === "assigned_to");

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 px-4 py-4">
      <header className="flex items-center gap-2">
        <Link2 className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-sm font-medium text-foreground">Linked from</h2>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          {edges.length}
        </span>
      </header>

      {assignments.length > 0 ? (
        <BacklinkGroup
          icon={<ListTodo className="h-3 w-3" />}
          title={`Assigned work (${assignments.length})`}
          edges={assignments}
        />
      ) : null}
      {mentions.length > 0 ? (
        <BacklinkGroup
          icon={<AtSign className="h-3 w-3" />}
          title={`Mentioned in chat (${mentions.length})`}
          edges={mentions}
        />
      ) : null}
    </section>
  );
}

function BacklinkGroup({
  icon,
  title,
  edges,
}: {
  icon: React.ReactNode;
  title: string;
  edges: Edge[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </span>
      <ul className="flex flex-col">
        {edges.slice(0, 6).map((e) => {
          const href = edgeHref(e);
          const label =
            e.sourceLabel ||
            (e.rel === "mentions" ? "Project chat message" : e.sourceRef || "—");
          const row = (
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="truncate text-xs text-foreground/90">{label}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {e.tsMs ? formatRelativeShort(new Date(e.tsMs)) : ""}
              </span>
            </span>
          );
          return (
            <li key={e.id} className="border-b border-border/40 py-1.5 last:border-0">
              {href ? (
                <Link href={href} className="flex hover:opacity-80">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
