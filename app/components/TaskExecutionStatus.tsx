import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, RotateCcw } from "lucide-react";
import type { Task } from "../lib/perkosApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ExecutionPresentation = {
  label: string;
  description: string;
  kind: "pending" | "active" | "failed" | "complete";
  canRetry: boolean;
};

export function friendlyDispatchError(error?: string): string {
  const detail = error?.toLowerCase() ?? "";
  if (/\b(408|504)\b|timed?\s*out|timeout/.test(detail)) {
    return "The agent took too long to respond. Retry the task to continue.";
  }
  if (/\b(410|502|503)\b|unavailable|connection refused|econnrefused|gone/.test(detail)) {
    return "The assigned agent is temporarily unavailable. Retry the task when it is ready.";
  }
  return "The task could not be delivered to the assigned agent. You can safely retry it.";
}

export function executionPresentation(task: Task): ExecutionPresentation {
  if (task.status === "Done" || task.dispatchState === "completed") {
    return { label: "Completed", description: "The agent finished this task.", kind: "complete", canRetry: false };
  }
  if (task.dispatchStuck || task.dispatchState === "failed") {
    return {
      label: "Needs attention",
      description: friendlyDispatchError(task.lastDispatchError),
      kind: "failed",
      canRetry: true,
    };
  }
  if (task.dispatchState === "payment-required") {
    return { label: "Payment required", description: "Execution is waiting for payment authorization.", kind: "failed", canRetry: false };
  }
  if (task.dispatchState === "waiting_on_dependency") {
    return { label: "Waiting", description: "This task is waiting for another task to finish.", kind: "pending", canRetry: false };
  }
  if (task.dispatchState === "starting") {
    return { label: "Starting agent", description: "PerkOS is waking the assigned agent and delivering the task.", kind: "active", canRetry: false };
  }
  if (task.dispatchState === "retrying") {
    return { label: "Retrying delivery", description: `PerkOS is retrying automatically${task.dispatchAttempts ? ` (attempt ${task.dispatchAttempts})` : ""}.`, kind: "active", canRetry: false };
  }
  if (task.status === "In progress" || task.status === "Review") {
    return { label: task.status === "Review" ? "Reviewing" : "Working", description: "The assigned agent is working on this task.", kind: "active", canRetry: false };
  }
  return { label: "Queued", description: "The task is registered and waiting for automatic delivery.", kind: "pending", canRetry: false };
}

export function TaskExecutionStatus({ task, retrying, onRetry }: { task: Task; retrying: boolean; onRetry: () => void }) {
  const state = executionPresentation(task);
  const Icon = state.kind === "complete" ? CheckCircle2 : state.kind === "failed" ? AlertTriangle : state.kind === "active" ? LoaderCircle : Clock3;
  return (
    <Card aria-label="Task execution">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={state.kind === "active" ? "h-4 w-4 animate-spin text-amber-300" : state.kind === "failed" ? "h-4 w-4 text-destructive" : state.kind === "complete" ? "h-4 w-4 text-emerald-300" : "h-4 w-4 text-muted-foreground"} />
          Execution · {state.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{state.description}</p>
        {state.canRetry ? (
          <Button size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" />
            {retrying ? "Retrying…" : "Retry"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
