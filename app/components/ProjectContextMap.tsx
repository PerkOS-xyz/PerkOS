"use client";

/**
 * Project context map — a CURATED one-hop graph: the project at the center,
 * its agents in an inner orbit (with live presence), and their active tasks
 * in an outer orbit, connected by assignment edges. Capped at ~30 nodes so it
 * stays a map, not a hairball; every node navigates somewhere.
 *
 * Hand-rolled radial layout (no graph lib): deterministic positions, SVG
 * edges, absolutely-positioned node cards.
 */

import Link from "next/link";
import { useMemo } from "react";
import { Bot, Compass, Folder } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Task } from "../lib/perkosApi";
import {
  realtimeAgentStatus,
  type AgentLiveStatus,
} from "../lib/useWalletAgents";
import { agentColor } from "./charts";

const W = 920;
const H = 560;
const CX = W / 2;
const CY = H / 2;
const MAX_TASKS = 18;

type MapNode = {
  key: string;
  kind: "project" | "agent" | "task";
  label: string;
  x: number;
  y: number;
  href?: string;
  color?: string;
  status?: string;
  isPM?: boolean;
  live?: AgentLiveStatus;
};

type MapEdge = { from: string; to: string; color: string; dashed?: boolean };

export function ProjectContextMap({
  projectId,
  projectName,
  pmAgent,
  agentNames,
  tasks,
  liveAgents,
}: {
  projectId: string;
  projectName: string;
  pmAgent?: string | null;
  agentNames: string[];
  tasks: Task[];
  liveAgents: Record<string, AgentLiveStatus>;
}) {
  const { nodes, edges } = useMemo(() => {
    const nodes: MapNode[] = [
      {
        key: "project",
        kind: "project",
        label: projectName,
        x: CX,
        y: CY,
      },
    ];
    const edges: MapEdge[] = [];

    // Inner orbit: agents (PM first, at 12 o'clock).
    const orderedAgents = [
      ...agentNames.filter((n) => n === pmAgent),
      ...agentNames.filter((n) => n !== pmAgent),
    ].slice(0, 10);
    const agentR = Math.min(170, 120 + orderedAgents.length * 8);
    orderedAgents.forEach((name, i) => {
      const angle = -Math.PI / 2 + (i / orderedAgents.length) * 2 * Math.PI;
      nodes.push({
        key: `agent:${name}`,
        kind: "agent",
        label: name,
        x: CX + agentR * Math.cos(angle),
        y: CY + agentR * Math.sin(angle),
        color: agentColor(name),
        isPM: name === pmAgent,
        live: liveAgents[name],
      });
      edges.push({
        from: "project",
        to: `agent:${name}`,
        color: agentColor(name, 0.35),
      });
    });

    // Outer orbit: most recent non-done tasks first, then recent done ones.
    const active = tasks.filter((t) => t.status !== "Done");
    const doneRecent = tasks
      .filter((t) => t.status === "Done")
      .sort(
        (a, b) =>
          Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""),
      );
    const shown = [...active, ...doneRecent].slice(0, MAX_TASKS);
    const taskR = 250;
    shown.forEach((t, i) => {
      if (!t.id) return;
      const angle = -Math.PI / 2 + (i / shown.length) * 2 * Math.PI + 0.18;
      const key = `task:${t.id}`;
      nodes.push({
        key,
        kind: "task",
        label: t.name,
        x: CX + taskR * Math.cos(angle),
        y: CY + taskR * Math.sin(angle),
        status: String(t.status),
        href: `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(t.id)}`,
      });
      const agent = t.agent?.trim();
      if (agent && orderedAgents.includes(agent)) {
        edges.push({
          from: `agent:${agent}`,
          to: key,
          color: agentColor(agent, 0.3),
          dashed: t.status === "Done",
        });
      } else {
        edges.push({ from: "project", to: key, color: "rgba(121,117,168,0.2)", dashed: true });
      }
    });

    return { nodes, edges };
  }, [projectId, projectName, pmAgent, agentNames, tasks, liveAgents]);

  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const hiddenTasks = tasks.length - Math.min(tasks.length, MAX_TASKS);

  if (agentNames.length === 0 && tasks.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        The map fills in as you add agents and tasks to this project.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full overflow-x-auto rounded-lg border border-border bg-[#0b0512]">
        <div className="relative mx-auto" style={{ width: W, height: H }}>
          {/* dot grid backdrop */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          />
          <svg
            width={W}
            height={H}
            className="absolute inset-0"
            aria-hidden
          >
            {edges.map((e, i) => {
              const a = byKey.get(e.from);
              const b = byKey.get(e.to);
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={e.color}
                  strokeWidth={1.25}
                  strokeDasharray={e.dashed ? "3 4" : undefined}
                />
              );
            })}
          </svg>

          {nodes.map((n) => (
            <MapNodeCard key={n.key} node={n} />
          ))}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Project at the center, agents in orbit (PM ringed), their tasks on the
        edge — solid lines are active assignments, dashed are done.
        {hiddenTasks > 0 ? ` ${hiddenTasks} older task${hiddenTasks === 1 ? "" : "s"} not shown.` : ""}
      </p>
    </div>
  );
}

function MapNodeCard({ node }: { node: MapNode }) {
  const style = {
    left: node.x,
    top: node.y,
    transform: "translate(-50%, -50%)",
  } as const;

  if (node.kind === "project") {
    return (
      <div
        className="glow-hero absolute z-20 flex max-w-[200px] items-center gap-2 rounded-xl border border-primary/50 bg-card px-4 py-3"
        style={style}
      >
        <Folder className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate text-sm font-semibold text-foreground">
          {node.label}
        </span>
      </div>
    );
  }

  if (node.kind === "agent") {
    const { color, label } = realtimeAgentStatus(node.live);
    return (
      <div className="absolute z-10" style={style}>
        <div
          className={cn(
            "flex w-[120px] flex-col items-center gap-1 rounded-lg border bg-card/95 px-2 py-2 text-center",
            node.isPM ? "border-primary/60" : "border-border",
          )}
          title={`${node.label} — ${label}`}
        >
          <span
            className="relative grid h-9 w-9 place-items-center rounded-full font-mono text-xs text-foreground"
            style={{ background: agentColor(node.label, 0.25) }}
          >
            {node.isPM ? <Compass className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4" />}
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                color,
              )}
            />
          </span>
          <span className="w-full truncate text-[11px] font-medium text-foreground">
            {node.label}
          </span>
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
            {node.isPM ? "PM · " : ""}
            {label}
          </span>
        </div>
      </div>
    );
  }

  const tone =
    node.status === "Done"
      ? "border-emerald-500/40 text-emerald-200/90"
      : node.status === "In progress" || node.status === "Review"
        ? "border-amber-500/40 text-amber-100/90"
        : "border-border text-foreground/80";

  const card = (
    <div
      className={cn(
        "max-w-[150px] truncate rounded-md border bg-[#0e0716]/95 px-2.5 py-1.5 text-[10px] leading-tight transition-colors hover:border-primary/50",
        tone,
      )}
      title={node.label}
    >
      {node.label}
    </div>
  );

  return (
    <div className="absolute z-10" style={style}>
      {node.href ? <Link href={node.href}>{card}</Link> : card}
    </div>
  );
}
