"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import { Pencil, Trash2, Sparkles, Compass, Users, Zap, Play, Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import {
  addProjectMessage,
  assignAgentsToProject,
  deleteProject,
  deleteTask,
  getUserProfile,
  getWalletAgents,
  getWalletProject,
  hibernateAgentApi,
  notifyProjectMention,
  pmTurn,
  setProjectPm,
  updateTask,
  wakeAgentApi,
  wakeProjectTeam,
  type ChatMessage,
  type ProjectDetail,
  type Task,
  type TaskStatus,
} from "../../../lib/perkosApi";
import { PmSessionBanner } from "../../../components/PmSessionBanner";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { EditProjectDialog } from "../../../components/EditProjectDialog";
import { EditTaskDialog } from "../../../components/EditTaskDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bot, Loader2, Plus } from "lucide-react";

import { ChatComposer } from "../../../components/ChatComposer";
import { Markdown } from "../../../components/Markdown";
import { KanbanBoard } from "../../../components/KanbanBoard";
import { ConductorBoard } from "../../../components/ConductorBoard";
import type { SwarmDefinition } from "../../../lib/swarm";
import { EmptyState } from "../../../components/EmptyState";
import { formatAddress } from "../../../lib/format";
import { useProjectMessages } from "../../../lib/useProjectMessages";
import { DocsTab } from "../../../components/DocsTab";
import { MentionText } from "../../../components/MentionText";
import { extractMentions, type MentionParticipant } from "../../../lib/mentions";
import { uploadAttachment } from "../../../lib/uploadAttachment";
import { useProjectTasks } from "../../../lib/useProjectTasks";
import { useWalletAgents, realtimeAgentStatus, type AgentLiveStatus } from "../../../lib/useWalletAgents";
import { MembersPanel } from "../../../components/MembersPanel";

type Tab = "tasks" | "docs" | "conductor" | "agents" | "chat" | "members";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = use(params);
  const searchParams = useSearchParams();
  const { address, isConnected } = useConnection();
  // For a SHARED project (owned by another wallet), the owner is passed as
  // ?owner=. All reads then target the owner's subtree (the membership rules
  // permit it). For own projects it's just the connected wallet.
  const ownerParam = searchParams.get("owner");
  const ownerWallet = ownerParam || address;
  const isShared = Boolean(ownerParam && ownerParam.toLowerCase() !== (address ?? "").toLowerCase());
  const initialTab = (searchParams.get("tab") as Tab) || "tasks";
  const TABS: Tab[] = ["tasks", "docs", "conductor", "agents", "chat", "members"];
  const [tab, setTab] = useState<Tab>(
    TABS.includes(initialTab) ? initialTab : "tasks"
  );

  // Keep tab in sync if user lands via a deep link.
  useEffect(() => {
    const next = searchParams.get("tab") as Tab | null;
    if (next && TABS.includes(next)) {
      setTab(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-project", ownerWallet, projectId],
    queryFn: () =>
      getWalletProject({ walletAddress: ownerWallet!, projectId }),
    enabled: Boolean(ownerWallet) && Boolean(projectId),
  });

  // Live tasks: a realtime Firestore listener so the board + the In progress /
  // Done counters move on their own as the PM/dispatcher/workers update tasks —
  // no manual refresh. Once the first snapshot lands, it's the source of truth;
  // until then we fall back to the one-shot query data.
  const { tasks: liveTasks, loaded: tasksLoaded } = useProjectTasks(
    ownerWallet,
    projectId
  );
  const liveDetail = data
    ? { ...data, tasks: tasksLoaded ? liveTasks : data.tasks }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/projects"
        className="inline-flex w-fit items-center gap-2 text-sm text-[#7975a8] hover:text-[#ececff]"
      >
        <ChevronLeftIcon />
        Go back to projects
      </Link>

      {isLoading ? <DetailSkeleton /> : null}
      {error ? <ErrorBanner message={(error as Error).message} /> : null}
      {liveDetail ? (
        <>
          <DetailHeader
            detail={liveDetail}
            ownerWallet={ownerWallet ?? undefined}
            isShared={isShared}
            onShowMembers={() => setTab("members")}
          />
          <Tabs current={tab} onChange={setTab} />
          {tab === "tasks" ? (
            <TasksTab
              tasks={liveDetail.tasks}
              projectId={projectId}
              ownerWallet={ownerWallet ?? undefined}
            />
          ) : null}
          {tab === "docs" ? (
            <DocsTab
              detail={liveDetail}
              projectId={projectId}
              ownerWallet={ownerWallet ?? undefined}
            />
          ) : null}
          {tab === "conductor" ? (
            <ConductorTab
              tasks={liveDetail.tasks}
              swarm={liveDetail.project.swarm}
              projectId={projectId}
              ownerWallet={ownerWallet ?? undefined}
            />
          ) : null}
          {tab === "agents" ? <AgentsTab detail={liveDetail} /> : null}
          {tab === "chat" ? (
            <ChatTab
              detail={liveDetail}
              projectId={projectId}
              ownerWallet={ownerWallet ?? undefined}
              onDesignatePm={() => setTab("agents")}
            />
          ) : null}
          {tab === "members" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                People with access to this project. Editors can edit the board +
                chat; viewers are read-only. (Org members already have access.)
              </p>
              <MembersPanel
                kind="project"
                id={projectId}
                canManage={!isShared}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function DetailHeader({
  detail,
  ownerWallet,
  isShared,
  onShowMembers,
}: {
  detail: ProjectDetail;
  ownerWallet?: string;
  isShared?: boolean;
  onShowMembers: () => void;
}) {
  const { project, tasks } = detail;
  const inProgress = tasks.filter((t) => t.status === "In progress").length;
  const done = tasks.filter((t) => t.status === "Done").length;

  // Principal agent: first explicit project assignment, otherwise the first
  // agent that appears on the project's tasks. Falls back to null when
  // the project has nobody assigned (shows a "no agent" pill in the header).
  const primaryAgent =
    project.agentIds?.[0] ??
    tasks.map((t) => t.agent).find((name) => name && name !== "App Agent") ??
    null;

  const router = useRouter();
  const queryClient = useQueryClient();
  const { address } = useConnection();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!address || !project.id) {
        throw new Error("Missing wallet or project id.");
      }
      return deleteProject({ walletAddress: address, projectId: project.id });
    },
    onSuccess: () => {
      // Both the projects list AND the dashboard overview (active-projects
      // count) read this data — invalidate both, or the dashboard keeps
      // showing the deleted project in "ACTIVE PROJECTS".
      queryClient.invalidateQueries({ queryKey: ["wallet-projects", address] });
      queryClient.invalidateQueries({ queryKey: ["wallet-overview", address] });
      toast.success("Project deleted", {
        description: `"${project.name}" was removed.`,
      });
      router.replace("/projects");
    },
    onError: (err: Error) => {
      toast.error("Couldn't delete project", { description: err.message });
      setConfirmOpen(false);
    },
  });

  // A PM run has no explicit "done" signal in the agent model, so an active
  // session ("working"/…) would otherwise stay set forever and wrongly keep the
  // Run-with-PM button disabled + the banner showing. Time-box it: only treat
  // the session as live if its last run was recent (the live board is the real
  // progress indicator after that).
  const pmRunRecent = (() => {
    const t = project.pmSession?.lastRunAt;
    if (!t) return false;
    const ms = new Date(t).getTime();
    return !Number.isNaN(ms) && Date.now() - ms < 15 * 60_000;
  })();
  const pmActive =
    pmRunRecent &&
    (project.pmSession?.status === "planning" ||
      project.pmSession?.status === "working" ||
      project.pmSession?.status === "reviewing");

  const runPmMutation = useMutation({
    mutationFn: () => {
      if (!project.id) throw new Error("Missing project id.");
      return pmTurn({
        projectId: project.id,
        trigger: "run-button",
        owner: isShared ? ownerWallet : undefined,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: ["wallet-project", address, project.id],
      });
      if (res.reason === "no-pm") {
        toast.error("Designate a PM agent first — see the Agents tab.");
      } else if (res.reason === "already-active") {
        toast.info("The PM is already running on this project.");
      } else if (res.status === "working") {
        toast.success(
          `PM assigned ${res.created ?? 0} task${res.created === 1 ? "" : "s"}.`,
        );
      } else if (res.status === "done") {
        toast.success("PM says the goal is already complete.");
      } else {
        toast.success("PM is on it.");
      }
    },
    onError: (err: Error) =>
      toast.error("Couldn't start the PM", { description: err.message }),
  });

  const wakeTeamMutation = useMutation({
    mutationFn: () => {
      if (!project.id) throw new Error("Missing project id.");
      return wakeProjectTeam({
        projectId: project.id,
        owner: isShared ? ownerWallet : undefined,
      });
    },
    onSuccess: (res) =>
      toast.success(
        `Waking ${res.woke} agent${res.woke === 1 ? "" : "s"}…`,
        { description: "They take ~2–3 min to boot + connect." },
      ),
    onError: (err: Error) =>
      toast.error("Couldn't wake the team", { description: err.message }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <PrimaryAgentAvatar name={primaryAgent} />
          <div className="flex flex-col">
            <h1 className="text-3xl font-medium text-[#ececff]">
              {project.name}
            </h1>
            <span className="text-xs text-muted-foreground">
              {primaryAgent
                ? `Lead: ${primaryAgent}`
                : "No primary agent assigned"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!project.pmAgent || runPmMutation.isPending || pmActive}
            onClick={() => runPmMutation.mutate()}
            title={
              project.pmAgent
                ? "Let the PM plan the goal and delegate to your workers"
                : "Designate a PM agent in the Agents tab first"
            }
          >
            {runPmMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {pmActive ? "PM running…" : "Run with PM"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={wakeTeamMutation.isPending || project.agents === 0}
            onClick={() => wakeTeamMutation.mutate()}
            title="Scale up all of this project's agents now (pre-warm the team)"
          >
            <Zap className="h-4 w-4" />
            {wakeTeamMutation.isPending ? "Waking…" : "Wake team"}
          </Button>
          <span className="mr-1 text-xs text-[#7975a8]">
            {project.budget || "0 USDC"}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onShowMembers}
            aria-label="Manage members"
            title="Share this project — invite wallets + manage access"
          >
            <Users className="h-4 w-4" />
            Members
          </Button>
          {!isShared ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                aria-label="Edit project"
                title="Edit project"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                aria-label="Delete project"
                title="Delete project"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {project.goal ? (
        <p className="max-w-2xl text-sm text-[#7975a8]">{project.goal}</p>
      ) : null}

      {project.pmSession ? (
        pmRunRecent ? (
        <PmSessionBanner session={project.pmSession} pmAgent={project.pmAgent} />
        ) : null
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Total tasks" value={tasks.length} />
        <StatTile label="In progress" value={inProgress} />
        <StatTile label="Done" value={done} />
        <StatTile label="Agents" value={project.agents} />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${project.name}"?`}
        description="This will remove the project, its tasks, and its chat history. This action can't be undone."
        confirmLabel="Delete project"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />

      {address ? (
        <EditProjectDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          project={project}
          walletAddress={address}
        />
      ) : null}
    </div>
  );
}

function PrimaryAgentAvatar({ name }: { name: string | null }) {
  if (!name) {
    return (
      <div
        className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-dashed border-border bg-card/40 text-muted-foreground"
        aria-label="No primary agent assigned"
        title="No primary agent assigned"
      >
        <Bot className="h-6 w-6" aria-hidden />
      </div>
    );
  }
  const initial = name.slice(0, 1).toUpperCase();
  // Stable hue per agent name so the avatar tint persists across renders
  // without needing a per-agent color stored in Firestore.
  const seed = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = seed % 360;
  return (
    <div
      className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-primary/50 font-mono text-xl font-medium text-foreground"
      style={{
        background: `radial-gradient(circle at 30% 30%, hsla(${hue}, 70%, 60%, 0.45), hsla(${hue}, 70%, 35%, 0.2))`,
        boxShadow: `0 0 18px -2px hsla(${hue}, 80%, 55%, 0.55)`,
      }}
      aria-label={`Primary agent: ${name}`}
      title={`Primary agent: ${name}`}
    >
      {initial}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="glow-card flex flex-col gap-1 rounded-md border border-primary/30 bg-[#0e0716] px-4 py-3">
      <span className="text-xs uppercase tracking-wide text-[#7975a8]">
        {label}
      </span>
      <span className="text-2xl font-semibold text-[#ececff]">{value}</span>
    </div>
  );
}

function Tabs({
  current,
  onChange,
}: {
  current: Tab;
  onChange: (t: Tab) => void;
}) {
  const items: { id: Tab; label: string }[] = [
    { id: "tasks", label: "Tasks" },
    { id: "docs", label: "Docs" },
    { id: "conductor", label: "Conductor" },
    { id: "agents", label: "Agents" },
    { id: "chat", label: "Project chat" },
    { id: "members", label: "Members" },
  ];

  return (
    <div
      role="tablist"
      className="flex gap-1 border-b border-[#1b1833] overflow-x-auto"
    >
      {items.map((item) => {
        const active = current === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`relative px-4 py-3 text-sm transition-colors ${
              active
                ? "text-[#ececff]"
                : "text-[#7975a8] hover:text-[#ececff]"
            }`}
          >
            {item.label}
            {active ? (
              <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-t-sm bg-[#ec1b69]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// Map between the backend's textual statuses and the kanban's ids.
const BACKEND_TO_KANBAN: Record<string, "todo" | "in_progress" | "done"> = {
  Backlog: "todo",
  "In progress": "in_progress",
  Review: "in_progress",
  Done: "done",
};

const KANBAN_TO_BACKEND: Record<"todo" | "in_progress" | "done", TaskStatus> = {
  todo: "Backlog",
  in_progress: "In progress",
  done: "Done",
};

function TasksTab({
  tasks,
  projectId,
  ownerWallet,
}: {
  tasks: Task[];
  projectId: string;
  /** For a SHARED project, the owner wallet — task writes target it (editors
   *  are permitted by the rules). Falls back to the connected wallet. */
  ownerWallet?: string;
}) {
  const { address } = useConnection();
  const effWallet = ownerWallet ?? address;
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const newTaskHref = `/tasks/new?projectId=${encodeURIComponent(projectId)}`;

  // Map tasks to KanbanItem shape; carry the original task in `task` for renderCard.
  const kanbanItems = tasks
    .filter((t): t is Task & { id: string } => Boolean(t.id))
    .map((task) => ({
      id: task.id,
      status: BACKEND_TO_KANBAN[task.status] ?? "todo",
      task,
    }));

  const visibleIds = kanbanItems.map((i) => i.id);
  const selectedIds = visibleIds.filter((id) => selected.has(id));

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
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["wallet-project", effWallet, projectId],
    });

  const moveMut = useMutation({
    mutationFn: (status: TaskStatus) =>
      Promise.allSettled(
        selectedIds.map((id) =>
          updateTask({ walletAddress: effWallet!, projectId, taskId: id, patch: { status } })
        )
      ),
    onSuccess: (results) => {
      invalidate();
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
        selectedIds.map((id) =>
          deleteTask({ walletAddress: effWallet!, projectId, taskId: id })
        )
      ),
    onSuccess: (results) => {
      invalidate();
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

  // Single-card drag persistence. The board moves the card optimistically;
  // we persist the new status and, on failure, invalidate to snap it back.
  const dragMoveMut = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTask({ walletAddress: effWallet!, projectId, taskId, patch: { status } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      toast.error("Couldn't move task", { description: e.message });
      invalidate();
    },
  });

  const handleDragMove = (taskId: string, status: TaskStatus) => {
    const current = tasks.find((t) => t.id === taskId);
    if (current && current.status === status) return; // dropped on same column
    if (!effWallet) {
      toast.error("Connect your wallet to move tasks.");
      invalidate(); // revert the optimistic card move
      return;
    }
    dragMoveMut.mutate({ taskId, status });
  };

  const mutating = moveMut.isPending || deleteMut.isPending;

  const createTaskCtaByColumn = {
    todo: (
      <Link
        href={newTaskHref}
        className="flex items-center justify-center gap-2 rounded-md border border-dashed border-[#1b1833] px-4 py-3 text-xs text-[#7975a8] transition-colors hover:border-[#530922] hover:text-[#ececff]"
      >
        <PlusIcon />
        Create task
      </Link>
    ),
  } as const;

  return (
    <div className="flex flex-col gap-3">
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-card/60 px-3 py-2">
          <span className="text-xs font-medium text-foreground">
            {selectedIds.length} selected
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
        emptyMessage="Drag a task here or create one."
        columnExtras={createTaskCtaByColumn}
        onMove={(itemId, nextStatus) =>
          handleDragMove(itemId, KANBAN_TO_BACKEND[nextStatus])
        }
        renderCard={({ item }) => (
          <TaskCard
            task={item.task}
            projectId={projectId}
            selectable
            checked={selected.has(item.id)}
            onToggle={(on) => toggle(item.id, on)}
            ownerWallet={ownerWallet}
          />
        )}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selectedIds.length} task${selectedIds.length === 1 ? "" : "s"}?`}
        description="The selected tasks and their history will be removed. This can't be undone."
        confirmLabel="Delete"
        destructive
        pending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
      />
    </div>
  );
}

function ConductorTab({
  tasks,
  swarm,
  projectId,
  ownerWallet,
}: {
  tasks: Task[];
  swarm?: SwarmDefinition;
  projectId: string;
  /** Owner wallet for a SHARED project (editors write to it). */
  ownerWallet?: string;
}) {
  const { address } = useConnection();
  const effWallet = ownerWallet ?? address;
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["wallet-project", effWallet, projectId],
    });

  const dragMoveMut = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTask({ walletAddress: effWallet!, projectId, taskId, patch: { status } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      toast.error("Couldn't move task", { description: e.message });
      invalidate();
    },
  });

  const handleDragMove = (taskId: string, status: TaskStatus) => {
    const current = tasks.find((t) => t.id === taskId);
    if (current && current.status === status) return;
    if (!effWallet) {
      toast.error("Connect your wallet to move tasks.");
      invalidate();
      return;
    }
    dragMoveMut.mutate({ taskId, status });
  };

  return (
    <div className="flex flex-col gap-3">
      <ConductorBoard
        tasks={tasks}
        swarm={swarm}
        projectId={projectId}
        onMove={(taskId, nextStatus) =>
          handleDragMove(taskId, KANBAN_TO_BACKEND[nextStatus])
        }
      />
      <p className="text-[10px] text-muted-foreground">
        Roster surfaces the active workers and their in-progress load.
      </p>
    </div>
  );
}

function TaskCard({
  task,
  projectId,
  selectable,
  checked,
  onToggle,
  ownerWallet,
}: {
  task: Task;
  projectId: string;
  selectable?: boolean;
  checked?: boolean;
  onToggle?: (on: boolean) => void;
  /** Owner wallet for a SHARED project (editors write to it). */
  ownerWallet?: string;
}) {
  const queryClient = useQueryClient();
  const { address } = useConnection();
  const effWallet = ownerWallet ?? address;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!effWallet || !task.id) throw new Error("Missing wallet or task id.");
      return deleteTask({
        walletAddress: effWallet,
        projectId,
        taskId: task.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["wallet-project", effWallet, projectId],
      });
      toast.success("Task deleted");
      setConfirmOpen(false);
    },
    onError: (err: Error) => {
      toast.error("Couldn't delete task", { description: err.message });
      setConfirmOpen(false);
    },
  });

  const cardClass =
    "glow-card relative flex flex-col gap-2 rounded-md border border-primary/25 bg-[#0e0716] px-4 py-3 transition-colors hover:border-primary/50";

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2 pr-14">
        <span className="text-sm text-[#ececff]">{task.name}</span>
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-[#7975a8]">
        <span>Agent: {task.agent || "—"}</span>
      </div>
    </>
  );

  // TaskCard is rendered inside KanbanBoard's renderCard callback, which
  // already wraps each card in an <li> (via DraggableCard). Wrapping again
  // here used to produce <li><li>…</li></li> and a hydration error. The
  // outer element is now a <div> with `group` so the row-action buttons
  // can react to its hover state via group-hover.
  if (!task.id) {
    return <div className={cardClass}>{inner}</div>;
  }

  return (
    <div className="group relative">
      {selectable ? (
        <div className="absolute left-2 top-3 z-10">
          <Checkbox
            checked={Boolean(checked)}
            onCheckedChange={(on) => onToggle?.(on)}
            aria-label={`Select ${task.name}`}
          />
        </div>
      ) : null}
      <Link
        href={`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(task.id)}`}
        className={cn(cardClass, selectable && "pl-9")}
      >
        {inner}
      </Link>
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setEditOpen(true);
          }}
          aria-label="Edit task"
          title="Edit task"
          className="grid h-6 w-6 place-items-center rounded-md text-[#7975a8] hover:bg-[#1b1833] hover:text-[#ececff]"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirmOpen(true);
          }}
          aria-label="Delete task"
          title="Delete task"
          className="grid h-6 w-6 place-items-center rounded-md text-[#7975a8] hover:bg-[#1b1833] hover:text-[#ec1b69]"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {effWallet ? (
        <EditTaskDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          task={task}
          projectId={projectId}
          walletAddress={effWallet}
        />
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${task.name}"?`}
        description="This task and its history will be removed."
        confirmLabel="Delete task"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === "High"
      ? "bg-[#ec1b69]/20 text-[#ec1b69]"
      : priority === "Low"
      ? "bg-[#1b1833] text-[#7975a8]"
      : "bg-amber-500/20 text-amber-300";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${tone}`}>
      {priority}
    </span>
  );
}

function AgentsTab({ detail }: { detail: ProjectDetail }) {
  const { address } = useConnection();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const agentNames = uniqueAgents(detail.tasks, detail.project.agentIds ?? []);
  const projectId = detail.project.id ?? "";
  const pmAgent = detail.project.pmAgent ?? null;
  // Live per-agent status (Online / Starting / Hibernated / …) so the roster
  // shows a state dot that updates on its own.
  const { byName: agentStatus } = useWalletAgents(address);

  const setPmMut = useMutation({
    mutationFn: (name: string | null) =>
      setProjectPm({ walletAddress: address!, projectId, pmAgent: name }),
    onSuccess: (_d, name) => {
      qc.invalidateQueries({ queryKey: ["wallet-project", address, projectId] });
      toast.success(name ? `${name} is now the PM` : "Cleared the project's PM");
    },
    onError: (e: Error) =>
      toast.error("Couldn't update the PM", { description: e.message }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-[#ececff]">
          {agentNames.length} agent{agentNames.length === 1 ? "" : "s"} on this project
        </h2>
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add agent
        </Button>
      </div>

      <p className="-mt-1 text-xs text-[#7975a8]">
        Designate one agent as the <span className="text-primary">PM</span> — it
        plans the goal and delegates tasks to the others when you Run with PM.
      </p>

      {agentNames.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents on this project"
          description="Add an agent from your team, or launch a new one to start working on tasks."
          actions={[
            { label: "Add existing agent", onClick: () => setAddOpen(true), icon: Plus },
            { label: "Launch agent", href: "/agents/new", variant: "outline" },
          ]}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {agentNames.map((name) => (
            <li
              key={name}
              className="flex items-center justify-between gap-3 rounded-md border border-[#1b1833] bg-[#0e0716] px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ec1b69]/20 text-xs font-medium text-[#ec1b69]">
                  {initials(name)}
                  {/* Live status dot (Online / Starting / Hibernated / …) */}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0e0716] ${realtimeAgentStatus(agentStatus[name]).color}`}
                    title={realtimeAgentStatus(agentStatus[name]).label}
                  />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-[#ececff]">{name}</span>
                  <span className="text-xs text-[#7975a8]">
                    {agentStatus[name]?.runtime
                      ? `${agentStatus[name]?.runtime} · `
                      : ""}
                    <span
                      className={
                        realtimeAgentStatus(agentStatus[name]).label ===
                        "Online"
                          ? "text-emerald-400"
                          : ""
                      }
                    >
                      {realtimeAgentStatus(agentStatus[name]).label}
                    </span>
                    {" · "}
                    {name === pmAgent ? "Orchestrator · " : "Worker · "}
                    {countTasksFor(name, detail.tasks)} task
                    {countTasksFor(name, detail.tasks) === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ProjectAgentPower live={agentStatus[name]} />
                {name === pmAgent ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <Compass className="h-3 w-3" /> PM
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="shrink-0 text-[#7975a8] hover:text-primary"
                    disabled={setPmMut.isPending || !address}
                    onClick={() => setPmMut.mutate(name)}
                    title="Make this agent the project's PM"
                  >
                    Make PM
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddAgentToProjectDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={projectId}
        existingNames={agentNames}
      />
    </div>
  );
}

// Per-agent power toggle for the project Agents tab rows. Derives the control
// from the SAME realtime label the dot shows (so an agent whose hibernation
// state lingers at "waking" but has reconnected reads as Online → Pause). The
// onSnapshot listener reflects the change automatically — no invalidation.
function ProjectAgentPower({ live }: { live?: AgentLiveStatus }) {
  const mut = useMutation({
    mutationFn: (hibernated: boolean) =>
      hibernated
        ? wakeAgentApi({ agentId: live!.id })
        : hibernateAgentApi({ agentId: live!.id }),
    onError: (e: Error) =>
      toast.error("Couldn't change power state", { description: e.message }),
  });

  if (!live?.id) return null;
  const label = realtimeAgentStatus(live).label;
  const isHibernated = label === "Hibernated";
  const isOnline = label === "Online";
  const isTransitioning = label === "Starting" || label === "Hibernating";
  // Only show for controllable PerkOS-infra states.
  if (!isHibernated && !isOnline && !isTransitioning) return null;

  const busy = mut.isPending || isTransitioning;
  const Icon = busy ? Loader2 : isHibernated ? Play : Pause;
  return (
    <button
      type="button"
      onClick={() => {
        if (!busy) mut.mutate(isHibernated);
      }}
      disabled={busy}
      aria-label={isHibernated ? `Wake ${live.name}` : `Hibernate ${live.name}`}
      title={busy ? "Working…" : isHibernated ? "Wake agent" : "Hibernate agent"}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#1b1833] text-[#7975a8] transition-colors hover:border-[#530922] hover:text-[#ececff] disabled:opacity-60"
    >
      <Icon className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
    </button>
  );
}

function AddAgentToProjectDialog({
  open,
  onOpenChange,
  projectId,
  existingNames,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  existingNames: string[];
}) {
  const { address } = useConnection();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["wallet-agents", address],
    queryFn: () => getWalletAgents(address!),
    enabled: open && Boolean(address),
  });

  const existing = new Set(existingNames.map((n) => n.toLowerCase()));
  const available = (data ?? []).filter(
    (a) => a.name && !existing.has(a.name.toLowerCase())
  );

  const addMut = useMutation({
    mutationFn: () =>
      assignAgentsToProject({
        walletAddress: address!,
        projectId,
        agentNames: [...selected],
      }),
    onSuccess: ({ added }) => {
      qc.invalidateQueries({ queryKey: ["wallet-project", address, projectId] });
      qc.invalidateQueries({ queryKey: ["wallet-projects", address] });
      toast.success(
        added > 0
          ? `Added ${added} agent${added === 1 ? "" : "s"} to the project`
          : "Those agents are already on the project"
      );
      setSelected(new Set());
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast.error("Couldn't add agents", { description: e.message }),
  });

  function toggle(name: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add agents to this project</DialogTitle>
          <DialogDescription>
            Pick agents from your team to add to this project&apos;s roster — then
            you can assign them tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-80 flex-col gap-2 overflow-auto py-1">
          {isLoading ? (
            <p className="flex items-center gap-2 text-sm text-[#7975a8]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your agents…
            </p>
          ) : available.length === 0 ? (
            <p className="text-sm text-[#7975a8]">
              {(data ?? []).length === 0
                ? "You don't have any agents yet. Create or invite one first."
                : "All your agents are already on this project."}
            </p>
          ) : (
            available.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-[#1b1833] px-3 py-2 transition-colors hover:border-[#7975a8]/40"
              >
                <Checkbox
                  checked={selected.has(a.name)}
                  onCheckedChange={(on) => toggle(a.name, on === true)}
                />
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ec1b69]/20 text-xs font-medium text-[#ec1b69]">
                  {initials(a.name)}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm text-[#ececff]">{a.name}</span>
                  <span className="text-xs text-[#7975a8]">
                    {a.runtime}
                    {a.external ? " · external" : ""}
                  </span>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={selected.size === 0 || addMut.isPending}
            onClick={() => addMut.mutate()}
          >
            {addMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Add{selected.size > 0 ? ` ${selected.size}` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChatTab({
  detail,
  projectId,
  ownerWallet,
  onDesignatePm,
}: {
  detail: ProjectDetail;
  projectId: string;
  ownerWallet?: string;
  onDesignatePm: () => void;
}) {
  const { address, isConnected } = useConnection();
  // For a shared project, the chat lives under the owner's subtree.
  const chatWallet = ownerWallet ?? address;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  // My username (for the @-mention label of my own messages).
  const { data: myProfile } = useQuery({
    queryKey: ["user-profile", address],
    queryFn: () => getUserProfile(address!),
    enabled: Boolean(address),
  });
  const participants = projectParticipants(detail, address, myProfile?.username);
  const pmAgent = detail.project.pmAgent ?? null;
  const agentIds = detail.project.agentIds ?? [];
  // The most PM-like assigned agent, for a one-click "Make PM" right here.
  const pmCandidate =
    agentIds.find((n) =>
      /(^|[^a-z])pm($|[^a-z])|manager|orchestrat|conductor/i.test(n)
    ) ??
    agentIds[0] ??
    null;

  // Realtime subscription to the messages subcollection — no manual refetch
  // needed after a send, the snapshot listener delivers the new doc.
  const { messages } = useProjectMessages(chatWallet, projectId);

  const setPmMut = useMutation({
    mutationFn: (name: string) => {
      if (!address) throw new Error("Connect a wallet first.");
      return setProjectPm({ walletAddress: address, projectId, pmAgent: name });
    },
    onSuccess: (_res, name) => {
      queryClient.invalidateQueries({
        queryKey: ["wallet-project", address, projectId],
      });
      toast.success(`${name} is now the PM`, {
        description: "Send your goal in the chat and the PM will plan + delegate.",
      });
    },
    onError: (e: Error) =>
      toast.error("Couldn't set the PM", { description: e.message }),
  });

  const sharedChat = Boolean(
    ownerWallet && ownerWallet.toLowerCase() !== (address ?? "").toLowerCase()
  );

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!isConnected || !address) {
        throw new Error("Connect a wallet to send messages.");
      }
      // For a shared project the chat lives under the owner; editors can write.
      const mentions = extractMentions(text, participants);
      const res = await addProjectMessage({
        walletAddress: chatWallet ?? address,
        projectId,
        text,
        from: "user",
        mentions,
      });
      // Ping any @-mentioned HUMAN teammate (≠ me) via a real Firestore
      // notification (server-side, cross-user). Fire-and-forget.
      const myLabel = myProfile?.username || formatAddress(address);
      for (const id of mentions) {
        if (!id.startsWith("user:")) continue;
        const target = id.slice("user:".length);
        if (target.toLowerCase() === address.toLowerCase()) continue;
        notifyProjectMention({
          projectId,
          target,
          title: `${myLabel} mentioned you`,
          body: text.slice(0, 200),
          href: `/projects/${projectId}?tab=chat`,
          owner: sharedChat ? ownerWallet : undefined,
        }).catch(() => {});
      }
      return res;
    },
    onSuccess: (res) => {
      setDraft("");
      // If this project has a PM, wake it to read + react to the message
      // (plan/delegate or just reply). Fire-and-forget — never block the send;
      // the PM's reply lands via the realtime messages subscription.
      if (pmAgent) {
        pmTurn({
          projectId,
          trigger: "chat",
          userMessageId: res?.message?.id,
          owner: sharedChat ? ownerWallet : undefined,
        }).catch(() => {});
      } else {
        // No PM designated → nothing autonomous happens. Tell the user instead
        // of silently swallowing the goal (the message still posts to chat).
        toast.info("No PM on this project yet", {
          description: agentIds.length
            ? "Designate a PM agent so it can plan your goal and delegate to the others."
            : "Add agents and designate a PM to let it plan + delegate.",
        });
      }
    },
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
      <div className="flex h-[60vh] min-h-[480px] flex-col gap-3 rounded-md border border-[#1b1833] bg-[#0e0716] p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#ececff]">
            # {detail.project.name}
          </span>
          <span className="text-xs text-[#7975a8]">
            {participants.length} member{participants.length === 1 ? "" : "s"}
          </span>
        </div>

        {!pmAgent ? (
          <div className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
            <div className="flex items-start gap-2">
              <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                No PM on this project yet. Messages here won&apos;t start any
                work until you designate a PM agent — it plans your goal and
                delegates tasks to the other agents.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {pmCandidate ? (
                <Button
                  size="sm"
                  className="h-7"
                  disabled={setPmMut.isPending || !address}
                  onClick={() => setPmMut.mutate(pmCandidate)}
                  title={`Make ${pmCandidate} the project's PM`}
                >
                  {setPmMut.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Compass className="h-3 w-3" />
                  )}
                  Make {pmCandidate} the PM
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={onDesignatePm}
              >
                {pmCandidate ? "Choose another in Agents" : "Designate in Agents"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-[#7975a8]">
              <p className="max-w-xs text-center">
                No messages yet. Start the conversation with your team and the
                agents assigned to this project.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {messages.map((m, idx) => (
                <ProjectMessageBubble
                  key={m.id ?? idx}
                  message={m}
                  isMine={m.from === "user"}
                  participants={participants}
                  meWallet={address ?? undefined}
                />
              ))}
              {sendMutation.isPending ? (
                <li className="flex items-center gap-1.5 px-1 text-muted-foreground">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                </li>
              ) : null}
            </ul>
          )}
        </div>

        {sendMutation.error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {(sendMutation.error as Error).message}
          </p>
        ) : null}

        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSend={(text) => sendMutation.mutate(text)}
          sending={sendMutation.isPending}
          placeholder={`Message #${detail.project.name}…`}
          uploadFile={
            address
              ? (file, index) =>
                  uploadAttachment({
                    file,
                    walletAddress: address,
                    conversationId: projectId,
                    index,
                  })
              : undefined
          }
        />
      </div>

      <aside className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-md border border-[#1b1833] bg-[#0e0716] p-4">
          <span className="text-sm font-medium text-[#ececff]">
            Members
          </span>
          {participants.length === 0 ? (
            <p className="text-xs text-[#7975a8]">No members yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {participants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 text-sm text-[#ececff]"
                >
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-medium ${
                      p.kind === "agent"
                        ? "bg-[#ec1b69]/20 text-[#ec1b69]"
                        : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {initials(p.label)}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{p.label}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[#7975a8]">
                      {p.kind === "agent" ? "Agent" : "Human"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </aside>
    </div>
  );
}

function projectParticipants(
  detail: ProjectDetail,
  ownerWallet?: string,
  myUsername?: string | null
): MentionParticipant[] {
  const agents = new Set<string>();
  for (const t of detail.tasks) {
    if (t.agent) agents.add(t.agent);
  }
  for (const a of detail.project.agentIds ?? []) {
    agents.add(a);
  }
  const out: MentionParticipant[] = [];
  if (ownerWallet) {
    // Identity is the wallet (collision-free); label is the username if set,
    // else the short address. This is what people type after `@`.
    out.push({
      id: `user:${ownerWallet.toLowerCase()}`,
      label: myUsername || formatAddress(ownerWallet),
      kind: "human",
    });
  }
  for (const name of agents) {
    out.push({ id: `agent:${name}`, label: name, kind: "agent" });
  }
  return out;
}

/** Clean up the chat sender label. The board MCP currently stamps agent
 * messages with the synthetic `mcp-<wallet>` conv id (and some legacy ones use
 * the raw 0x… wallet); show a friendly label instead of the ugly hash until the
 * bridge stamps the real agent name. `agent:<name>` → `<name>`. */
function senderLabel(agentName?: string): string {
  const v = (agentName ?? "").trim();
  if (!v) return "Agent";
  if (/^agent:/i.test(v)) return v.slice(v.indexOf(":") + 1) || "Agent";
  if (/^(mcp-)?0x[0-9a-fA-F]{6,}$/.test(v)) return "Agent";
  return v;
}

/** Short local time (HH:MM) for a message timestamp, or "" if absent. */
function formatMsgTime(createdAt?: string): string {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Resolve the displayed sender + body for an agent message. The board MCP still
 * stamps `agentName` with the synthetic mcp-<wallet> id, but agents are now
 * prompted to prefix their chat posts with their name ("Demo-W1: done — …").
 * When the stamped name is generic, recover the real one from that prefix and
 * strip it from the body so it isn't shown twice.
 */
function resolveAgentSender(
  agentName: string | undefined,
  text: string
): { label: string; body: string } {
  const fromStamp = senderLabel(agentName);
  if (fromStamp !== "Agent") return { label: fromStamp, body: text };
  const m = text.match(/^([A-Za-z0-9][A-Za-z0-9 _-]{1,31}):\s+([\s\S]+)$/);
  if (m) return { label: m[1]!.trim(), body: m[2]! };
  return { label: "Agent", body: text };
}

function ProjectMessageBubble({
  message,
  isMine,
  participants,
  meWallet,
}: {
  message: ChatMessage;
  isMine: boolean;
  participants: MentionParticipant[];
  meWallet?: string;
}) {
  const time = formatMsgTime(message.createdAt);
  if (isMine) {
    return (
      <li className="flex flex-col items-end gap-0.5">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary/15 px-3 py-2 text-sm text-foreground">
          <MentionText text={message.text} participants={participants} meWallet={meWallet} />
        </div>
        {time ? (
          <span className="px-1 text-[10px] text-muted-foreground">{time}</span>
        ) : null}
      </li>
    );
  }
  const { label, body } = resolveAgentSender(message.agentName, message.text);
  return (
    <li className="flex items-start gap-2">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#ec1b69]/20 text-[10px] font-medium text-[#ec1b69]">
        {initials(label)}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {time ? (
            <span className="text-[10px] text-muted-foreground/70">{time}</span>
          ) : null}
        </span>
        <MentionText
          text={body}
          participants={participants}
          meWallet={meWallet}
          className="leading-relaxed text-sm"
        />
      </div>
    </li>
  );
}

function uniqueAgents(tasks: Task[], agentIds: string[]): string[] {
  const fromTasks = tasks
    .map((t) => t.agent)
    .filter((v): v is string => Boolean(v && v.trim().length));
  const fromIds = agentIds.map((id) => id);
  return Array.from(new Set([...fromIds, ...fromTasks]));
}

function countTasksFor(name: string, tasks: Task[]): number {
  return tasks.filter((t) => t.agent === name).length;
}

function initials(name: string): string {
  return name
    .split(/\s+|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-9 w-1/2 animate-pulse rounded-md bg-[#1b1833]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-md border border-[#1b1833] bg-[#0e0716]"
          />
        ))}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-[#ec1b69]/40 bg-[#ec1b69]/10 px-4 py-3 text-sm text-[#ec1b69]">
      {message}
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 3.333 5.333 8 10 12.667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 3.333v9.334M3.333 8h9.334"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

