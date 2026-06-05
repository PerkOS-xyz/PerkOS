"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { Plus, Folder, ListTodo, Trash2, X, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import {
  deleteTask,
  getWalletProject,
  getWalletProjects,
  updateTask,
  type Project,
  type Task,
  type TaskStatus,
} from "../../lib/perkosApi";
import { KanbanBoard } from "../../components/KanbanBoard";
import {
  SearchInput,
  matchesQuery,
} from "../../components/SearchInput";
import { EmptyState } from "../../components/EmptyState";
import { ConfirmDialog } from "../../components/ConfirmDialog";

type EnrichedTask = {
  task: Task;
  projectId: string;
  projectName: string;
};

export default function TasksPage() {
  const { address } = useConnection();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const searchParams = useSearchParams();
  // Status filter via ?status=. Values:
  //   "active" → In progress + Review
  //   "done"   → Done
  // Anything else is ignored. The dashboard's StatCards send these.
  const statusFilter = searchParams.get("status");
  // Project filter via ?project=<projectId>. Set by the project picker
  // next to the search bar; cleared by the project filter pill ×.
  const projectFilter = searchParams.get("project");

  const projectsQuery = useQuery({
    queryKey: ["wallet-projects", address],
    queryFn: () => getWalletProjects(address!),
    enabled: Boolean(address),
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
      enabled: Boolean(address),
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

  // Project filter from the URL. Applied first so the status / text
  // filters compose on top.
  const projectFiltered = projectFilter
    ? allTasks.filter((t) => t.projectId === projectFilter)
    : allTasks;

  // Status filter from the URL — applied before the text-search filter so
  // the empty-state copy can refer to the correct slice.
  const statusFiltered = projectFiltered.filter(({ task }) => {
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

  // --- bulk selection (cross-project: carry each task's projectId) --------
  const selectedItems = kanbanItems.filter((i) => selected.has(i.id));
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const clear = () => setSelected(new Set());

  const summarize = (results: PromiseSettledResult<unknown>[]) => {
    const failed = results.filter((r) => r.status === "rejected").length;
    return { ok: results.length - failed, failed };
  };
  const invalidateAffected = () => {
    const pids = new Set(selectedItems.map((i) => i.projectId));
    for (const pid of pids) {
      queryClient.invalidateQueries({ queryKey: ["wallet-project", address, pid] });
    }
    queryClient.invalidateQueries({ queryKey: ["wallet-projects", address] });
  };

  const moveMut = useMutation({
    mutationFn: (status: TaskStatus) =>
      Promise.allSettled(
        selectedItems.map((i) =>
          updateTask({ walletAddress: address!, projectId: i.projectId, taskId: i.id, patch: { status } })
        )
      ),
    onSuccess: (results) => {
      invalidateAffected();
      const { ok, failed } = summarize(results);
      if (failed) toast.error(`Moved ${ok}, ${failed} failed`);
      else toast.success(`Moved ${ok} task${ok === 1 ? "" : "s"}`);
      clear();
    },
    onError: (e: Error) => toast.error("Bulk move failed", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: () =>
      Promise.allSettled(
        selectedItems.map((i) =>
          deleteTask({ walletAddress: address!, projectId: i.projectId, taskId: i.id })
        )
      ),
    onSuccess: (results) => {
      invalidateAffected();
      const { ok, failed } = summarize(results);
      if (failed) toast.error(`Deleted ${ok}, ${failed} failed`);
      else toast.success(`Deleted ${ok} task${ok === 1 ? "" : "s"}`);
      setConfirmDelete(false);
      clear();
    },
    onError: (e: Error) => {
      toast.error("Bulk delete failed", { description: e.message });
      setConfirmDelete(false);
    },
  });

  const mutating = moveMut.isPending || deleteMut.isPending;

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search tasks by name, agent, project, or status…"
            />
          </div>
          <ProjectFilter
            projects={projects}
            selected={projectFilter}
            statusFilter={statusFilter}
          />
        </div>
      ) : null}

      {(statusFilter || projectFilter) ? (
        <div className="flex flex-wrap items-center gap-2">
          {statusFilter ? (
            <FilterPill
              label={`status: ${statusFilter === "active" ? "in progress" : statusFilter}`}
              clearHref={buildTasksHref({ project: projectFilter })}
            />
          ) : null}
          {projectFilter ? (
            <FilterPill
              label={`project: ${
                projects.find((p) => p.id === projectFilter)?.name ?? projectFilter
              }`}
              clearHref={buildTasksHref({ status: statusFilter })}
            />
          ) : null}
        </div>
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
          {selectedItems.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-card/60 px-3 py-2">
              <span className="text-xs font-medium text-foreground">
                {selectedItems.length} selected
              </span>
              <span className="text-[11px] text-muted-foreground">Move to:</span>
              <Button size="xs" variant="outline" disabled={mutating} onClick={() => moveMut.mutate("Backlog")}>
                To do
              </Button>
              <Button size="xs" variant="outline" disabled={mutating} onClick={() => moveMut.mutate("In progress")}>
                In progress
              </Button>
              <Button size="xs" variant="outline" disabled={mutating} onClick={() => moveMut.mutate("Done")}>
                Done
              </Button>
              <Button size="xs" variant="destructive" disabled={mutating} onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <Button size="xs" variant="ghost" disabled={mutating} onClick={clear}>
                Clear
              </Button>
            </div>
          ) : null}

          <KanbanBoard
            items={kanbanItems}
            onMove={(itemId, nextStatus) => {
              // eslint-disable-next-line no-console
              console.info("[Kanban Global] move", { itemId, nextStatus });
            }}
            renderCard={({ item }) => (
              <div className="group relative">
                <div className="absolute left-2.5 top-3 z-10">
                  <Checkbox
                    checked={selected.has(item.id)}
                    onCheckedChange={(on) => toggle(item.id, on)}
                    aria-label={`Select ${item.task.name}`}
                  />
                </div>
                <Link
                  href={`/projects/${encodeURIComponent(item.projectId)}/tasks/${encodeURIComponent(item.id)}`}
                  className="glow-card flex flex-col gap-2 rounded-md border border-primary/25 bg-card px-4 py-3 pl-9 transition-colors hover:border-primary/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm text-foreground">{item.task.name}</span>
                    <PriorityBadge priority={item.task.priority} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 truncate">
                      <Folder className="h-3 w-3" />
                      <span className="truncate">{item.projectName}</span>
                    </span>
                    <span className="shrink-0">Agent: {item.task.agent || "—"}</span>
                  </div>
                </Link>
              </div>
            )}
          />
          <p className="text-[10px] text-muted-foreground">
            Drag-and-drop is local for now. Backend sync coming with the next
            release.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selectedItems.length} task${selectedItems.length === 1 ? "" : "s"}?`}
        description="The selected tasks (across projects) and their history will be removed. This can't be undone."
        confirmLabel="Delete"
        destructive
        pending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
      />
    </div>
  );
}

/**
 * Build a /tasks URL keeping the filters you pass in and dropping
 * everything else. Used by the FilterPill ×-buttons to clear one
 * filter at a time without losing the rest.
 */
function buildTasksHref({
  status,
  project,
}: {
  status?: string | null;
  project?: string | null;
}): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (project) params.set("project", project);
  const qs = params.toString();
  return qs ? `/tasks?${qs}` : "/tasks";
}

function FilterPill({
  label,
  clearHref,
}: {
  label: string;
  clearHref: string;
}) {
  return (
    <Link
      href={clearHref}
      className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/15"
      aria-label={`Clear ${label}`}
    >
      {label}
      <X className="h-3 w-3" aria-hidden />
    </Link>
  );
}

/**
 * Project picker that sits next to the search bar. Re-uses the URL as
 * state so refreshes + back-button navigation keep the selection, and
 * so deep links from elsewhere (dashboard, conductor) compose.
 */
function ProjectFilter({
  projects,
  selected,
  statusFilter,
}: {
  projects: Project[];
  selected: string | null;
  statusFilter: string | null;
}) {
  const router = useRouter();
  return (
    <div className="relative shrink-0">
      <Folder
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <select
        aria-label="Filter tasks by project"
        value={selected ?? ""}
        onChange={(e) => {
          router.push(
            buildTasksHref({
              status: statusFilter,
              project: e.target.value || null,
            }),
          );
        }}
        className="h-10 w-full appearance-none rounded-md border border-input bg-card pl-9 pr-8 text-sm text-foreground transition-colors hover:border-primary/40 focus:border-primary focus:outline-none sm:w-56"
      >
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p.id ?? p.name} value={p.id ?? ""}>
            {p.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
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

