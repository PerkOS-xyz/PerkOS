"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  Calendar,
  Folder,
  Pencil,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import {
  deleteTask,
  getWalletProject,
  type Task,
} from "../../../../../lib/perkosApi";
import { ConfirmDialog } from "../../../../../components/ConfirmDialog";
import { EditTaskDialog } from "../../../../../components/EditTaskDialog";
import { Markdown } from "../../../../../components/Markdown";

type PageProps = {
  params: Promise<{ projectId: string; taskId: string }>;
};

function initials(name: string): string {
  return name
    .split(/\s+|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function TaskDetailPage({ params }: PageProps) {
  const { projectId, taskId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address } = useConnection();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-project", address, projectId],
    queryFn: () =>
      getWalletProject({ walletAddress: address!, projectId }),
    enabled: Boolean(address) && Boolean(projectId),
  });

  const task = data?.tasks.find((t) => t.id === taskId);
  const projectName = data?.project.name;

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!address) throw new Error("Connect a wallet.");
      return deleteTask({ walletAddress: address, projectId, taskId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["wallet-project", address, projectId],
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

  return (
    <div className="flex flex-col gap-6">
      <BackLink projectId={projectId} projectName={projectName} />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          <h1 className="text-3xl font-medium leading-tight text-foreground">
            {task.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          {task.prompt?.trim() ? (
            <Markdown>{task.prompt}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">
              No description was provided when this task was created.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetaTile
          label="Project"
          value={projectName ?? "—"}
          Icon={Folder}
          href={`/projects/${projectId}`}
        />
        <MetaTile label="Due date" value="Not set" Icon={Calendar} muted />
        <MetaTile
          label="Assigned agent"
          value={task.agent || "—"}
          Icon={Bot}
        />
      </section>

      {task.agent ? (
        <AgentCard agentName={task.agent} agentRuntime={undefined} />
      ) : null}

      {task.logs && task.logs.length > 0 ? (
        <LogsSection logs={task.logs} />
      ) : null}

      {task.result ? <ResultSection result={task.result} /> : null}

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

function MetaTile({
  label,
  value,
  Icon,
  muted,
  href,
}: {
  label: string;
  value: string;
  Icon: typeof Folder;
  muted?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <span
        className={cn(
          "truncate text-sm",
          muted ? "text-muted-foreground" : "text-foreground"
        )}
        title={value}
      >
        {value}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex flex-col gap-1 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-card px-4 py-3">
      {content}
    </div>
  );
}

function AgentCard({
  agentName,
  agentRuntime,
}: {
  agentName: string;
  agentRuntime?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agent on this task</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <div className="relative">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-sm font-medium text-primary">
            {initials(agentName)}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 grid h-2.5 w-2.5 place-items-center rounded-full bg-emerald-400 ring-2 ring-card" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {agentName}
          </span>
          <span className="text-xs text-muted-foreground">
            {agentRuntime ?? "Online"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function LogsSection({ logs }: { logs: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          Runtime logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 font-mono text-xs text-muted-foreground">
          {logs.map((line, idx) => (
            <li
              key={idx}
              className="rounded-sm border-l-2 border-primary/40 bg-muted/40 px-3 py-2 leading-relaxed"
            >
              {line}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ResultSection({ result }: { result: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Agent result
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Markdown>{result}</Markdown>
      </CardContent>
    </Card>
  );
}

function DetailSkeleton({ projectId }: { projectId: string }) {
  return (
    <div className="flex flex-col gap-6">
      <BackLink projectId={projectId} projectName={null} />
      <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-10 w-72 animate-pulse rounded-md bg-muted" />
      <div className="h-32 animate-pulse rounded-md border border-border bg-card" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-md border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}
