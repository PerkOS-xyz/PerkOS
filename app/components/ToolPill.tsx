"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Loader2,
  Wrench,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { ChatToolCall } from "../lib/chatClient";

type Props = {
  call: ChatToolCall;
};

/**
 * Inline pill rendered under an agent message when the agent invoked a
 * tool to produce that reply. Closed by default — clicking the header
 * reveals the structured input/output.
 *
 * Rendering goals:
 * - Recognisable at a glance: tool name + status icon.
 * - One-line summary when present, so users can read what happened
 *   without expanding (`ls -la`, `https://…`, "search docs", etc.).
 * - Expanded view is informational, not interactive — no copy buttons,
 *   no re-run, no edit. Keep the surface small until we know users
 *   want more.
 */
export function ToolPill({ call }: Props) {
  const [open, setOpen] = useState(false);
  const hasDetail =
    call.input !== undefined || call.output !== undefined || call.error;

  return (
    <div
      className={cn(
        "rounded-md border text-xs",
        statusStyles(call.status).border,
        statusStyles(call.status).bg,
      )}
    >
      <button
        type="button"
        onClick={() => hasDetail && setOpen((o) => !o)}
        disabled={!hasDetail}
        aria-expanded={open}
        aria-label={
          hasDetail
            ? `${open ? "Hide" : "Show"} tool details: ${call.name}`
            : `Tool: ${call.name}`
        }
        className={cn(
          "flex w-full items-center gap-2 px-2 py-1.5 text-left",
          hasDetail && "cursor-pointer hover:bg-muted/40",
        )}
      >
        <StatusIcon status={call.status} />
        <span
          className={cn(
            "font-mono text-[11px] font-medium",
            statusStyles(call.status).label,
          )}
        >
          {call.name}
        </span>
        {call.summary ? (
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {call.summary}
          </span>
        ) : null}
        {typeof call.durationMs === "number" ? (
          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
            {formatDuration(call.durationMs)}
          </span>
        ) : null}
        {hasDetail ? (
          open ? (
            <ChevronDown
              className={cn(
                "h-3 w-3 text-muted-foreground",
                typeof call.durationMs === "number" ? "" : "ml-auto",
              )}
              aria-hidden
            />
          ) : (
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground",
                typeof call.durationMs === "number" ? "" : "ml-auto",
              )}
              aria-hidden
            />
          )
        ) : null}
      </button>

      {open && hasDetail ? (
        <div className="border-t border-border/40 px-2 py-2 font-mono text-[11px]">
          {call.input !== undefined ? (
            <Block label="input">{formatPayload(call.input)}</Block>
          ) : null}
          {call.output !== undefined ? (
            <Block label="output">{formatPayload(call.output)}</Block>
          ) : null}
          {call.error ? (
            <Block label="error" intent="error">
              {call.error}
            </Block>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Block({
  label,
  intent,
  children,
}: {
  label: string;
  intent?: "error";
  children: ReactNode;
}) {
  return (
    <div className="mt-1.5 first:mt-0">
      <span className="block text-[9px] uppercase tracking-wider text-muted-foreground/80">
        {label}
      </span>
      <pre
        className={cn(
          "mt-0.5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-muted/60 px-2 py-1.5 text-[11px] leading-relaxed",
          intent === "error" && "border border-destructive/40 text-destructive",
        )}
      >
        {children}
      </pre>
    </div>
  );
}

function StatusIcon({ status }: { status: ChatToolCall["status"] }) {
  if (status === "pending")
    return <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />;
  if (status === "running")
    return (
      <Loader2
        className="h-3 w-3 shrink-0 animate-spin text-primary"
        aria-hidden
      />
    );
  if (status === "ok")
    return (
      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
    );
  return (
    <CircleAlert className="h-3 w-3 shrink-0 text-destructive" aria-hidden />
  );
}

function statusStyles(status: ChatToolCall["status"]) {
  switch (status) {
    case "ok":
      return {
        border: "border-emerald-500/30",
        bg: "bg-emerald-500/5",
        label: "text-emerald-400",
      };
    case "error":
      return {
        border: "border-destructive/40",
        bg: "bg-destructive/5",
        label: "text-destructive",
      };
    case "running":
      return {
        border: "border-primary/40",
        bg: "bg-primary/5",
        label: "text-primary",
      };
    default:
      return {
        border: "border-border",
        bg: "bg-muted/30",
        label: "text-foreground",
      };
  }
}

function formatPayload(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.round(s / 60)}m`;
}
