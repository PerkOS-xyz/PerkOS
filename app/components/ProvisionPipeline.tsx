"use client";

/**
 * "What happens next" pipeline for an agent boot. Async provisioning takes
 * ~2-3 minutes — a numbered sequence with a live current-step highlight sets
 * expectations far better than a lone spinner.
 *
 * Steps are derived from the agent doc: status (provisioning → ready) plus
 * the bridge heartbeat (the real "online" signal).
 */

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type StepState = "done" | "active" | "pending" | "failed";

const STEPS: { label: string; hint: string }[] = [
  {
    label: "Provisioning infrastructure",
    hint: "Spinning up the agent's container on PerkOS infra.",
  },
  {
    label: "Booting the runtime",
    hint: "Loading the persona, skills, and model connection.",
  },
  {
    label: "Connecting to PerkOS",
    hint: "The agent phones home — then it's ready for work.",
  },
];

export function ProvisionPipeline({
  status,
  bridgeConnected,
  className,
}: {
  status: string;
  bridgeConnected?: boolean;
  className?: string;
}) {
  const failed = status === "provision-failed" || status === "failed";
  // Current step index: 0 while provisioning, 1 once ready but no heartbeat,
  // 2 done when the bridge connected.
  const stepStates: StepState[] = (() => {
    if (failed) return ["failed", "pending", "pending"];
    if (status === "provisioning") return ["active", "pending", "pending"];
    if (bridgeConnected) return ["done", "done", "done"];
    return ["done", "active", "pending"];
  })();

  const allDone = stepStates.every((s) => s === "done");
  if (allDone) return null;

  return (
    <ol className={cn("flex flex-col gap-2", className)}>
      {STEPS.map((step, i) => {
        const state = stepStates[i];
        const Icon =
          state === "done"
            ? CheckCircle2
            : state === "failed"
              ? XCircle
              : state === "active"
                ? Loader2
                : Circle;
        return (
          <li key={step.label} className="flex items-start gap-2.5">
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                state === "done" && "text-emerald-300",
                state === "active" && "animate-spin text-amber-300",
                state === "failed" && "text-destructive",
                state === "pending" && "text-muted-foreground/40",
              )}
            />
            <span className="flex flex-col">
              <span
                className={cn(
                  "text-xs font-medium",
                  state === "pending" ? "text-muted-foreground/60" : "text-foreground",
                )}
              >
                {i + 1}. {step.label}
                {state === "failed" ? " — failed" : null}
              </span>
              {state === "active" ? (
                <span className="text-[11px] text-muted-foreground">{step.hint}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
