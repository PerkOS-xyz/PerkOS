"use client";

import Link from "next/link";
import { ArtizenWorkLink } from "@/app/components/ArtizenProjectBoard";
import { ArtizenFailureLabel, ArtizenRunFailure, isArtizenUnsuccessful } from "@/app/components/ArtizenRunFailure";
import { TaskAgentCard, taskAgentName } from "@/app/components/TaskAgentCard";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccount } from "../../../../../lib/useAppAccount";
import { useActiveOrg } from "../../../../../lib/useActiveOrg";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Terminal,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  deleteTask,
  getWalletProject,
} from "../../../../../lib/perkosApi";
import { ConfirmDialog } from "../../../../../components/ConfirmDialog";
import { EditTaskDialog } from "../../../../../components/EditTaskDialog";
import {
  DeliverableSheet,
  PendingDeliverable,
  TaskMobileSummary,
  TaskRail,
  type TaskPeople,
} from "../../../../../components/TaskDetailLayout";
import { TaskAttachmentList } from "../../../../../components/TaskAttachments";
import { TaskRetryButton } from "../../../../../components/TaskRetryButton";

type PageProps = {
  params: Promise<{ projectId: string; taskId: string }>;
};

export default function TaskDetailPage({ params }: PageProps) {
  const { projectId, taskId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address } = useAppAccount();
  const searchParams = useSearchParams();
  const { activeOrg } = useActiveOrg();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Projects live under their OWNER's wallet, which for an org project is not
  // the caller. Reading the caller's subtree made every task a member opened
  // report "Project not found". Same resolution order as the project page: the
  // link's owner param, then the active org's owner, then your own wallet.
  const ownerParam = searchParams.get("owner");
  const ownerWallet = ownerParam || activeOrg?.ownerWallet || address;

  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-project", ownerWallet, projectId],
    queryFn: () =>
      getWalletProject({ walletAddress: ownerWallet!, projectId }),
    enabled: Boolean(ownerWallet) && Boolean(projectId),
    // Until the result lands, poll so the page shows progress, retries and
    // the deliverable on its own; no manual refresh.
    refetchInterval: (q) => {
      const current = q.state.data?.tasks.find((t) => t.id === taskId);
      return current && current.status !== "Done" && !current.result ? 10_000 : false;
    },
  });

  const task = data?.tasks.find((t) => t.id === taskId);
  const assignedAgent = data?.taskAgents?.find(a => a.name === task?.agent);
  const projectName = data?.project.name;

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!ownerWallet) throw new Error("Connect a wallet.");
      return deleteTask({ walletAddress: ownerWallet, projectId, taskId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["wallet-project", ownerWallet, projectId],
      });
      toast.success("Task deleted");
      router.replace(`/projects/${projectId}`);
    },
    onError: (err: Error) => {
      toast.error("Couldn't delete task", { description: err.message });
      setDeleteOpen(false);
    },
  });

  if (isLoading) {
    return <DetailSkeleton projectId={projectId} />;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink projectId={projectId} projectName={null} />
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(error as Error).message}
        </p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink projectId={projectId} projectName={projectName} />
        <div className="rounded-md border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          Task not found in this project.
        </div>
      </div>
    );
  }

  const onDemand = task.executionMode === "artizen-on-demand";
  const people: TaskPeople = {
    agentName: task.agent || null,
    agentLabel: task.agent ? taskAgentName(task.agent, onDemand, assignedAgent) : null,
    runtime: onDemand ? "On-demand Hermes" : assignedAgent?.runtime ?? null,
    projectId,
    projectName,
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <BackLink projectId={projectId} projectName={projectName} />

      <header className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-1 duration-500 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {onDemand && isArtizenUnsuccessful({ ...task, phase: task.executionPhase }) ? <ArtizenFailureLabel /> : <TaskStatusBadge status={task.status} />}
            <PriorityBadge priority={task.priority} />
          </div>
          <h1 className="text-balance text-2xl font-medium leading-tight text-foreground md:text-3xl">
            {task.name}
          </h1>
        </div>
        {onDemand ? <ArtizenWorkLink projectId={projectId} /> : <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-1.5"
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="gap-1.5"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>}
      </header>

      <TaskMobileSummary people={people} prompt={task.prompt} className="lg:hidden" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {task.result ? (
            <DeliverableSheet result={task.result} title={task.name} agentLabel={people.agentLabel} />
          ) : onDemand ? (
            <ArtizenRunFailure run={{ ...task, phase: task.executionPhase }} />
          ) : (
            <PendingDeliverable
              status={task.status}
              progress={task}
              retryAction={
                <TaskRetryButton
                  walletAddress={ownerWallet}
                  projectId={projectId}
                  taskId={taskId}
                  taskName={task.name}
                  agent={task.agent}
                  agentLabel={people.agentLabel}
                />
              }
            />
          )}

          {onDemand && task.agent ? (
            <TaskAgentCard name={task.agent} onDemand agent={assignedAgent} />
          ) : null}

          <TaskAttachmentList attachments={task.attachments ?? []} />

          {task.logs && task.logs.length > 0 ? (
            <LogsSection logs={task.logs} />
          ) : null}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <TaskRail people={people} prompt={task.prompt} />
          </div>
        </aside>
      </div>

      {ownerWallet ? (
        <EditTaskDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          task={task}
          projectId={projectId}
          // The task lives under the project OWNER, so an editor in a shared
          // org project has to patch there, not under their own wallet.
          walletAddress={ownerWallet}
        />
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
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

function BackLink({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string | null | undefined;
}) {
  return (
    <Link
      href={`/projects/${projectId}`}
      className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to {projectName ?? "project"}
    </Link>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Done"
      ? "bg-emerald-500/20 text-emerald-300"
      : status === "In progress" || status === "Review"
      ? "bg-amber-500/20 text-amber-300"
      : "bg-muted text-muted-foreground";
  return (
    <Badge variant="secondary" className={cn("border-0", tone)}>
      {status || "Backlog"}
    </Badge>
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
    <Badge variant="secondary" className={cn("border-0", tone)}>
      {priority || "Medium"}
    </Badge>
  );
}

function LogsSection({ logs }: { logs: string[] }) {
  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium text-foreground marker:content-none">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        Runtime logs
        <span className="text-xs font-normal text-muted-foreground">({logs.length})</span>
      </summary>
      <div className="border-t border-border px-4 py-3">
        <ul className="flex flex-col gap-2 overflow-x-auto font-mono text-xs text-muted-foreground">
          {logs.map((line, idx) => (
            <li
              key={idx}
              className="rounded-sm border-l-2 border-primary/40 bg-muted/40 px-3 py-2 leading-relaxed"
            >
              {line}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function DetailSkeleton({ projectId }: { projectId: string }) {
  return (
    <div className="flex flex-col gap-6">
      <BackLink projectId={projectId} projectName={null} />
      <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-10 w-72 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="h-96 animate-pulse rounded-xl border border-border bg-card" />
        <div className="hidden flex-col gap-4 lg:flex">
          <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
          <div className="h-56 animate-pulse rounded-xl border border-border bg-card" />
        </div>
      </div>
    </div>
  );
}
