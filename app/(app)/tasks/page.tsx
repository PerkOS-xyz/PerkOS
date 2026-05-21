"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { Plus, Folder, ListTodo, X } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  getWalletProject,
  getWalletProjects,
  type Project,
  type Task,
} from "../../lib/perkosApi";
import { KanbanBoard } from "../../components/KanbanBoard";
import {
  SearchInput,
  matchesQuery,
} from "../../components/SearchInput";
import { EmptyState } from "../../components/EmptyState";

type EnrichedTask = {
  task: Task;
  projectId: string;
  projectName: string;
};

export default function TasksPage() {
  const { address, isConnected } = useConnection();
  const [query, setQuery] = useState("");
  const searchParams = useSearchParams();
  // Status filter via ?status=. Values:
  //   "active" → In progress + Review
  //   "done"   → Done
  // Anything else is ignored. The dashboard's StatCards send these.
  const statusFilter = searchParams.get("status");

  const projectsQuery = useQuery({
    queryKey: ["wallet-projects", address],
    queryFn: () => getWalletProjects(address!),
    enabled: isConnected && Boolean(address),
  });

  const projects = projectsQuery.data?.projects ?? [];
  const projectIds = useMemo(
    () => projects.map((p) => p.id).filter((id): id is string => Boolean(id)),
    [projects]
  );

  const projectDetails = useQueries({
    queries: projectIds.map((pid) => ({
      queryKey: ["wallet-project", address, pid],
      queryFn: () =>
        getWalletProject({ walletAddress: address!, projectId: pid }),
      enabled: isConnected && Boolean(address),
    })),
  });

  const ready = projectDetails.every((q) => !q.isLoading);

  const allTasks: EnrichedTask[] = useMemo(() => {
    const out: EnrichedTask[] = [];
    for (const q of projectDetails) {
      const detail = q.data;
      if (!detail) continue;
      for (const task of detail.tasks) {
        out.push({
          task,
          projectId: detail.project.id ?? "",
          projectName: detail.project.name,
        });
      }
    }
    return out;
  }, [projectDetails]);

  // Status filter from the URL — applied before the text-search filter so
  // the empty-state copy can refer to the correct slice.
  const statusFiltered = allTasks.filter(({ task }) => {
    if (statusFilter === "active") {
      return task.status === "In progress" || task.status === "Review";
    }
    if (statusFilter === "done") {
      return task.status === "Done";
    }
    return true;
  });

  // Filter by search query (name, agent, project name, status, priority).
  const filteredTasks = statusFiltered.filter(({ task, projectName }) =>
    matchesQuery(query, [
      task.name,
      task.agent,
      task.priority,
      task.status,
      projectName,
    ])
  );

  // Map backend status strings → kanban ids
  const kanbanItems = filteredTasks
    .filter((t): t is EnrichedTask & { task: Task & { id: string } } =>
      Boolean(t.task.id)
    )
    .map(({ task, projectId, projectName }) => ({
      id: task.id,
      status:
        task.status === "Done"
          ? ("done" as const)
          : task.status === "In progress" || task.status === "Review"
          ? ("in_progress" as const)
          : ("todo" as const),
      task,
      projectId,
      projectName,
    }));

  const noResults =
    allTasks.length > 0 && filteredTasks.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Everything in flight across your projects.
          </p>
        </div>
        <Link
          href="/tasks/new"
          className="flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create task
        </Link>
      </header>

      {allTasks.length > 0 ? (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search tasks by name, agent, project, or status…"
        />
      ) : null}

      {statusFilter ? (
        <Link
          href="/tasks"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/15"
          aria-label="Clear status filter"
        >
          status: {statusFilter === "active" ? "in progress" : statusFilter}
          <X className="h-3 w-3" aria-hidden />
        </Link>
      ) : null}

      {projectsQuery.isLoading ? (
        <SkeletonKanban />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="No projects yet"
          description="Tasks live inside projects. Create one first."
          actions={[{ label: "Create project", href: "/projects/new", icon: Plus }]}
        />
      ) : !ready ? (
        <SkeletonKanban />
      ) : allTasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks yet"
          description="Add tasks to a project and route them to your agents."
          actions={[{ label: "Create task", href: "/tasks/new", icon: Plus }]}
        />
      ) : noResults ? (
        <p className="rounded-md border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          No tasks match &quot;{query}&quot;.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <KanbanBoard
            items={kanbanItems}
            onMove={(itemId, nextStatus) => {
              // eslint-disable-next-line no-console
              console.info("[Kanban Global] move", { itemId, nextStatus });
            }}
            renderCard={({ item }) => (
              <Link
                href={`/projects/${encodeURIComponent(item.projectId)}/tasks/${encodeURIComponent(item.id)}`}
                className="flex flex-col gap-2 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="pl-4 text-sm text-foreground">{item.task.name}</span>
                  <PriorityBadge priority={item.task.priority} />
                </div>
                <div className="flex items-center justify-between gap-3 pl-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 truncate">
                    <Folder className="h-3 w-3" />
                    <span className="truncate">{item.projectName}</span>
                  </span>
                  <span className="shrink-0">Agent: {item.task.agent || "—"}</span>
                </div>
              </Link>
            )}
          />
          <p className="text-[10px] text-muted-foreground">
            Drag-and-drop is local for now. Backend sync coming with the next
            release.
          </p>
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === "High"
      ? "bg-primary/20 text-primary"
      : priority === "Low"
      ? "bg-muted text-muted-foreground"
      : "bg-amber-500/20 text-amber-300";
  return (
    <Badge variant="secondary" className={cn("shrink-0 border-0", tone)}>
      {priority || "Medium"}
    </Badge>
  );
}

function SkeletonKanban() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-12 animate-pulse rounded-md border border-border bg-card" />
          <div className="h-20 animate-pulse rounded-md border border-border bg-card" />
          <div className="h-20 animate-pulse rounded-md border border-border bg-card" />
        </div>
      ))}
    </div>
  );
}

