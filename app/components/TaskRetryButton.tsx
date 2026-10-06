"use client";

/**
 * Retry for a paused task: the dispatcher stopped trying to deliver it, and
 * this hands it straight back to its agent. The API clears the delivery
 * markers, re-registers the board, puts a paused project run back to work and
 * wakes the agent; the card or page drops its paused look right away and the
 * project data reloads behind it.
 */

import type { MouseEvent } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { useMutation, useQueryClient, type Query } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { retryTask, type ProjectDetail, type RetryTaskResult, type Task } from "../lib/perkosApi";
import { AgentOrb } from "./AgentOrb";

/** Every cached copy of this project: pages key it by owner or by caller. */
export function isProjectQuery(projectId: string) {
  return (query: Query) =>
    query.queryKey[0] === "wallet-project" && query.queryKey[2] === projectId;
}

/** The task as the board should show it the moment the retry is accepted. */
export function markTaskRetried(tasks: Task[], taskId: string, result: RetryTaskResult): Task[] {
  return tasks.map((task) =>
    task.id !== taskId
      ? task
      : {
          ...task,
          status: "Backlog",
          agent: result.agent || task.agent,
          dispatchState:
            result.task?.dispatchState ??
            (result.waitingOnDependency ? "waiting_on_dependency" : "queued"),
          dispatchStuck: undefined,
          dispatchAttempts: undefined,
          lastDispatchError: undefined,
          dispatchedAt: undefined,
        },
  );
}

export function TaskRetryButton({
  walletAddress,
  projectId,
  taskId,
  taskName,
  agent,
  agentLabel,
  variant = "panel",
  className,
}: {
  /** The project OWNER's wallet: an editor retries on the owner's board. */
  walletAddress: string | null | undefined;
  projectId: string;
  taskId: string;
  taskName: string;
  agent?: string | null;
  /** Display name for the agent when it differs from its id. */
  agentLabel?: string | null;
  /** "panel" names the agent with its orb; "card" is a compact pill. */
  variant?: "panel" | "card";
  className?: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const assignee = agent?.trim() || "";
  const label = agentLabel?.trim() || assignee;

  const mutation = useMutation({
    mutationFn: () => {
      if (!walletAddress) throw new Error(t("components.taskRetry.errors.connectWallet"));
      return retryTask({ walletAddress, projectId, taskId });
    },
    onSuccess: (result) => {
      const predicate = isProjectQuery(projectId);
      queryClient.setQueriesData<ProjectDetail>({ predicate }, (data) =>
        data ? { ...data, tasks: markTaskRetried(data.tasks, taskId, result) } : data,
      );
      void queryClient.invalidateQueries({ predicate });
      const who = result.agent && result.agent !== assignee ? result.agent : label;
      toast.success(
        who
          ? t("components.taskRetry.toast.retryingWith", { agent: who })
          : t("components.taskRetry.toast.retrying"),
        {
          description: result.waitingOnDependency
            ? t("components.taskRetry.toast.afterDependencies")
            : undefined,
          icon: who ? <AgentOrb name={who} size={18} /> : undefined,
        },
      );
    },
    onError: (err: Error) => {
      toast.error(t("components.taskRetry.toast.error"), { description: err.message });
    },
  });

  const pending = mutation.isPending;
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    // The board card is a link: retrying must not open the task as well.
    e.preventDefault();
    e.stopPropagation();
    if (!pending) mutation.mutate();
  };
  const icon = pending ? (
    <Loader2 aria-hidden className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin" />
  ) : (
    <RotateCcw
      aria-hidden
      className="h-3.5 w-3.5 shrink-0 text-primary transition-transform duration-300 motion-safe:group-hover/retry:-rotate-45"
    />
  );

  if (variant === "card") {
    const name = assignee
      ? t("components.taskRetry.ariaWith", { task: taskName, agent: label })
      : t("components.taskRetry.aria", { task: taskName });
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={name}
        title={name}
        className={cn(
          "group/retry inline-flex h-7 w-fit items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 text-[11px] font-medium text-[#ececff] transition-colors hover:border-primary/70 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70",
          className,
        )}
      >
        {icon}
        {pending ? t("components.taskRetry.retrying") : t("components.taskRetry.retry")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        "group/retry inline-flex min-h-10 max-w-full items-center gap-2.5 rounded-full border border-primary/40 bg-primary/10 py-1 pl-1 pr-4 text-sm font-medium text-foreground shadow-[0_0_24px_-12px_var(--color-primary)] transition-colors hover:border-primary/70 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70",
        !assignee && "pl-3",
        className,
      )}
    >
      {assignee ? <AgentOrb name={label} size={30} /> : null}
      {icon}
      <span className="min-w-0 truncate">
        {pending
          ? t("components.taskRetry.retrying")
          : assignee
            ? t("components.taskRetry.retryWith", { agent: label })
            : t("components.taskRetry.retry")}
      </span>
    </button>
  );
}
