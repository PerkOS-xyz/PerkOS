"use client";

import Link from "next/link";
import { Bot } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Task } from "../lib/perkosApi";
import type { SwarmDefinition, SwarmRosterMember } from "../lib/swarm";
import { KanbanBoard, type KanbanStatus } from "./KanbanBoard";

type Props = {
  projectId: string;
  tasks: Task[];
  /** Optional swarm definition — when missing, the roster panel is hidden. */
  swarm?: SwarmDefinition;
  onMove?: (taskId: string, nextStatus: KanbanStatus) => void;
};

// Same mapping as TasksTab on the project page — keep these consistent.
const BACKEND_TO_KANBAN: Record<string, KanbanStatus> = {
  Backlog: "todo",
  "In progress": "in_progress",
  Review: "in_progress",
  Done: "done",
};

type BoardItem = {
  id: string;
  status: KanbanStatus;
  task: Task;
  /** Roster handle if the task's `agent` matches a swarm member. */
  handle?: string;
};

/**
 * Conductor view: kanban + per-agent roster sidebar.
 *
 * Tasks render with a chip indicating which roster member owns the
 * work; the roster sidebar shows each member's role, description, and
 * the count of in-progress tasks for them. The pairing key is
 * `Task.agent` (free-text label) matched against the roster's `handle`
 * or against the agent identity in `SwarmRosterMember.agent`.
 */
export function ConductorBoard({
  projectId,
  tasks,
  swarm,
  onMove,
}: Props) {
  const members = swarm?.roster ?? [];
  const byHandle = new Map<string, SwarmRosterMember>(
    members.map((m) => [m.handle, m]),
  );
  const byAgentName = new Map<string, SwarmRosterMember>(
    members.map((m) => [agentNameOf(m.agent), m]),
  );

  function memberFor(task: Task): SwarmRosterMember | undefined {
    if (!task.agent) return undefined;
    return (
      byHandle.get(task.agent) ??
      byAgentName.get(task.agent.toLowerCase()) ??
      undefined
    );
  }

  const items: BoardItem[] = tasks
    .filter((t): t is Task & { id: string } => Boolean(t.id))
    .map((task) => ({
      id: task.id,
      status: BACKEND_TO_KANBAN[task.status] ?? "todo",
      task,
      handle: memberFor(task)?.handle,
    }));

  const counts = inProgressCountByHandle(items);

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
      <div className="min-w-0">
        <KanbanBoard
          items={items}
          emptyMessage="No tasks yet. Add one to get started."
          onMove={(taskId, next) => onMove?.(taskId, next)}
          renderCard={({ item }) => (
            <ConductorCard
              task={item.task}
              projectId={projectId}
              member={item.handle ? byHandle.get(item.handle) : undefined}
            />
          )}
        />
      </div>

      <aside className="flex flex-col gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Roster
        </h3>
        {members.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
            No swarm defined for this project yet. Add agents to populate the
            roster.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {members.map((m) => (
              <RosterItem
                key={m.handle}
                member={m}
                inProgress={counts.get(m.handle) ?? 0}
              />
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function ConductorCard({
  task,
  projectId,
  member,
}: {
  task: Task;
  projectId: string;
  member?: SwarmRosterMember;
}) {
  return (
    <Link
      href={`/projects/${projectId}/tasks/${task.id}`}
      className="flex flex-col gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40"
    >
      <span className="font-medium leading-tight text-foreground">
        {task.name}
      </span>
      <div className="flex items-center justify-between gap-2">
        <AgentChip member={member} fallback={task.agent} />
        <PriorityChip priority={task.priority} />
      </div>
    </Link>
  );
}

function AgentChip({
  member,
  fallback,
}: {
  member?: SwarmRosterMember;
  fallback?: string;
}) {
  if (!member && !fallback) return null;
  const label = member ? `${member.handle} · ${member.role}` : fallback;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-foreground">
      <Bot className="h-3 w-3 text-primary" aria-hidden />
      {label}
    </span>
  );
}

function PriorityChip({ priority }: { priority: Task["priority"] }) {
  const tone =
    priority === "High"
      ? "border-destructive/40 text-destructive"
      : priority === "Low"
      ? "border-emerald-500/40 text-emerald-400"
      : "border-amber-500/40 text-amber-300";
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
        tone,
      )}
    >
      {priority}
    </span>
  );
}

function RosterItem({
  member,
  inProgress,
}: {
  member: SwarmRosterMember;
  inProgress: number;
}) {
  return (
    <li className="rounded-md border border-border bg-card px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs text-foreground">
          {member.handle}
        </span>
        <span
          className={cn(
            "rounded-full border px-1.5 py-0.5 font-mono text-[10px]",
            inProgress > 0
              ? "border-amber-500/40 text-amber-300"
              : "border-border text-muted-foreground",
          )}
          aria-label={`${inProgress} in progress`}
          title={`${inProgress} in progress`}
        >
          {inProgress}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {member.role}
      </p>
      {member.description ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {member.description}
        </p>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Helpers (exported for tests)
// ---------------------------------------------------------------------------

/** "agent:apollo" → "apollo" (lowercase). Returns input on shape mismatch. */
export function agentNameOf(agent: string): string {
  const m = agent.match(/^agent:(.+)$/);
  return (m ? m[1] : agent).toLowerCase();
}

/** Per-handle count of tasks currently in `in_progress`. */
export function inProgressCountByHandle(items: BoardItem[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) {
    if (item.status !== "in_progress" || !item.handle) continue;
    out.set(item.handle, (out.get(item.handle) ?? 0) + 1);
  }
  return out;
}
