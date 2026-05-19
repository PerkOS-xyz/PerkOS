"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  addProjectMessage,
  deleteProject,
  deleteTask,
  getWalletProject,
  type ChatMessage,
  type ProjectDetail,
  type Task,
} from "../../../lib/perkosApi";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { EditProjectDialog } from "../../../components/EditProjectDialog";
import { EditTaskDialog } from "../../../components/EditTaskDialog";
import { Bot, Plus } from "lucide-react";

import { ChatComposer } from "../../../components/ChatComposer";
import { Markdown } from "../../../components/Markdown";
import { KanbanBoard } from "../../../components/KanbanBoard";
import { EmptyState } from "../../../components/EmptyState";
import { formatAddress } from "../../../lib/format";
import { useProjectMessages } from "../../../lib/useProjectMessages";

type Tab = "tasks" | "agents" | "chat";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = use(params);
  const searchParams = useSearchParams();
  const { address, isConnected } = useConnection();
  const initialTab = (searchParams.get("tab") as Tab) || "tasks";
  const [tab, setTab] = useState<Tab>(
    initialTab === "agents" || initialTab === "chat" ? initialTab : "tasks"
  );

  // Keep tab in sync if user lands via a deep link.
  useEffect(() => {
    const next = searchParams.get("tab");
    if (next === "tasks" || next === "agents" || next === "chat") {
      setTab(next);
    }
  }, [searchParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-project", address, projectId],
    queryFn: () =>
      getWalletProject({ walletAddress: address!, projectId }),
    enabled: isConnected && Boolean(address) && Boolean(projectId),
  });

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
      {data ? (
        <>
          <DetailHeader detail={data} />
          <Tabs current={tab} onChange={setTab} />
          {tab === "tasks" ? (
            <TasksTab tasks={data.tasks} projectId={projectId} />
          ) : null}
          {tab === "agents" ? <AgentsTab detail={data} /> : null}
          {tab === "chat" ? (
            <ChatTab detail={data} projectId={projectId} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function DetailHeader({ detail }: { detail: ProjectDetail }) {
  const { project, tasks } = detail;
  const inProgress = tasks.filter((t) => t.status === "In progress").length;
  const done = tasks.filter((t) => t.status === "Done").length;

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
      queryClient.invalidateQueries({ queryKey: ["wallet-projects", address] });
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-medium text-[#ececff]">{project.name}</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#7975a8]">
            {project.budget || "0 USDC"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Edit project"
            title="Edit project"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            aria-label="Delete project"
            title="Delete project"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {project.goal ? (
        <p className="max-w-2xl text-sm text-[#7975a8]">{project.goal}</p>
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

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-[#530922] bg-[#0e0716] px-4 py-3">
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
    { id: "agents", label: "Agents" },
    { id: "chat", label: "Project chat" },
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

const KANBAN_TO_BACKEND: Record<"todo" | "in_progress" | "done", string> = {
  todo: "Backlog",
  in_progress: "In progress",
  done: "Done",
};

function TasksTab({
  tasks,
  projectId,
}: {
  tasks: Task[];
  projectId: string;
}) {
  const newTaskHref = `/tasks/new?projectId=${encodeURIComponent(projectId)}`;

  // Map tasks to KanbanItem shape; carry the original task in `task` for renderCard.
  const kanbanItems = tasks
    .filter((t): t is Task & { id: string } => Boolean(t.id))
    .map((task) => ({
      id: task.id,
      status: BACKEND_TO_KANBAN[task.status] ?? "todo",
      task,
    }));

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
      <KanbanBoard
        items={kanbanItems}
        emptyMessage="Drag a task here or create one."
        columnExtras={createTaskCtaByColumn}
        onMove={(itemId, nextStatus) => {
          // Local-only for now. Will wire to `PATCH /tasks/:id/status` later.
          // eslint-disable-next-line no-console
          console.info("[Kanban] move", {
            projectId,
            taskId: itemId,
            nextStatus: KANBAN_TO_BACKEND[nextStatus],
          });
        }}
        renderCard={({ item }) => (
          <TaskCard task={item.task} projectId={projectId} />
        )}
      />
      <p className="text-[10px] text-muted-foreground">
        Drag-and-drop is local for now. Backend sync coming with the next
        release.
      </p>
    </div>
  );
}

function TaskCard({ task, projectId }: { task: Task; projectId: string }) {
  const queryClient = useQueryClient();
  const { address } = useConnection();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!address || !task.id) throw new Error("Missing wallet or task id.");
      return deleteTask({
        walletAddress: address,
        projectId,
        taskId: task.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["wallet-project", address, projectId],
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
    "relative flex flex-col gap-2 rounded-md border border-[#1b1833] bg-[#0e0716] px-4 py-3 transition-colors hover:border-[#530922]";

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

  if (!task.id) {
    return (
      <li>
        <div className={cardClass}>{inner}</div>
      </li>
    );
  }

  return (
    <li className="relative">
      <Link
        href={`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(task.id)}`}
        className={cardClass}
      >
        {inner}
      </Link>
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 [li:hover_&]:opacity-100">
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
      {address ? (
        <EditTaskDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          task={task}
          projectId={projectId}
          walletAddress={address}
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
    </li>
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
  const agentNames = uniqueAgents(detail.tasks, detail.project.agentIds ?? []);

  if (agentNames.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="No agents on this project"
        description="Assign agents from your team or launch a new one to start working on tasks."
        actions={[
          { label: "Browse agents", href: "/agents", variant: "outline" },
          { label: "Launch agent", href: "/agents/new", icon: Plus },
        ]}
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {agentNames.map((name) => (
        <li
          key={name}
          className="flex items-center gap-3 rounded-md border border-[#1b1833] bg-[#0e0716] px-4 py-3"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ec1b69]/20 text-xs font-medium text-[#ec1b69]">
            {initials(name)}
          </span>
          <div className="flex flex-col">
            <span className="text-sm text-[#ececff]">{name}</span>
            <span className="text-xs text-[#7975a8]">
              {countTasksFor(name, detail.tasks)} task
              {countTasksFor(name, detail.tasks) === 1 ? "" : "s"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ChatTab({
  detail,
  projectId,
}: {
  detail: ProjectDetail;
  projectId: string;
}) {
  const { address, isConnected } = useConnection();
  const [draft, setDraft] = useState("");

  const participants = projectParticipants(detail, address);

  // Realtime subscription to the messages subcollection — no manual refetch
  // needed after a send, the snapshot listener delivers the new doc.
  const { messages } = useProjectMessages(address, projectId);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!isConnected || !address) {
        throw new Error("Connect a wallet to send messages.");
      }
      return addProjectMessage({
        walletAddress: address,
        projectId,
        text,
        from: "user",
      });
    },
    onSuccess: () => {
      setDraft("");
    },
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
      <div className="flex h-[calc(100vh-18rem)] min-h-[420px] flex-col gap-3 rounded-md border border-[#1b1833] bg-[#0e0716] p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#ececff]">
            # {detail.project.name}
          </span>
          <span className="text-xs text-[#7975a8]">
            {participants.length} member{participants.length === 1 ? "" : "s"}
          </span>
        </div>

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

type Participant = {
  id: string;
  label: string;
  kind: "human" | "agent";
};

function projectParticipants(
  detail: ProjectDetail,
  ownerWallet?: string
): Participant[] {
  const agents = new Set<string>();
  for (const t of detail.tasks) {
    if (t.agent) agents.add(t.agent);
  }
  for (const a of detail.project.agentIds ?? []) {
    agents.add(a);
  }
  const out: Participant[] = [];
  if (ownerWallet) {
    out.push({
      id: `human:${ownerWallet}`,
      label: `You (${formatAddress(ownerWallet)})`,
      kind: "human",
    });
  }
  for (const name of agents) {
    out.push({ id: `agent:${name}`, label: name, kind: "agent" });
  }
  return out;
}

function ProjectMessageBubble({
  message,
  isMine,
}: {
  message: ChatMessage;
  isMine: boolean;
}) {
  if (isMine) {
    return (
      <li className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary/15 px-3 py-2 text-sm text-foreground">
          {message.text}
        </div>
      </li>
    );
  }
  return (
    <li className="flex items-start gap-2">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#ec1b69]/20 text-[10px] font-medium text-[#ec1b69]">
        {initials(message.agentName || "Agent")}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {message.agentName || "Agent"}
        </span>
        <Markdown className="leading-relaxed">{message.text}</Markdown>
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

