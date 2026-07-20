"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ChatMessage } from "../lib/chatClient";
import { Markdown } from "./Markdown";
import { ToolPill } from "./ToolPill";

export type OptimisticMessage = ChatMessage & {
  /** Local-only marker for messages this client just sent. */
  pending?: boolean;
};

type Props = {
  /** Server-confirmed historical messages, ordered oldest → newest. */
  history: OptimisticMessage[];
  /** Live messages received via WS for this conv, ordered oldest → newest. */
  live: OptimisticMessage[];
  /** Optimistic messages this client just sent. Coalesced with `live` by id. */
  pending?: OptimisticMessage[];
  walletAddress: string;
  loadingInitial: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadOlder: () => void;
  error?: Error | null;
  onApprovePlan?: (planId: string) => void;
  onRequestPlanChanges?: (planId: string) => void;
  approvingPlanId?: string | null;
  /** Only the current server-authorized proposal may expose decision buttons. */
  actionablePlanId?: string | null;
};

export function ConversationMessages({
  history,
  live,
  pending,
  walletAddress,
  loadingInitial,
  loadingMore,
  hasMore,
  onLoadOlder,
  error,
  onApprovePlan,
  onRequestPlanChanges,
  approvingPlanId,
  actionablePlanId,
}: Props) {
  // Merge history + live + pending; dedupe by id, then sort.
  const merged = useMemo(() => {
    const map = new Map<string, OptimisticMessage>();
    for (const m of history) map.set(m.id, m);
    for (const m of live) map.set(m.id, m);
    if (pending) for (const m of pending) if (!map.has(m.id)) map.set(m.id, m);
    return Array.from(map.values()).sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );
  }, [history, live, pending]);
  const approvedPlanIds = useMemo(
    () =>
      new Set(
        merged.flatMap((message) =>
          message.event?.domain === "project_workflow" &&
          message.event.type === "plan_approved" &&
          message.event.planId
            ? [message.event.planId]
            : [],
        ),
      ),
    [merged],
  );
  const latestProposalMessageId = useMemo(
    () =>
      [...merged].reverse().find(
        (message) =>
          message.event?.domain === "project_workflow" &&
          message.event.type === "plan_proposed" &&
          message.event.planId === actionablePlanId,
      )?.id ?? null,
    [merged, actionablePlanId],
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastLengthRef = useRef(0);
  const stickToBottomRef = useRef(true);

  // Track whether the user is near the bottom so we can keep them anchored
  // when new messages arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distance < 80;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-scroll on new messages when at-bottom; preserve scroll on prepend.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prevLen = lastLengthRef.current;
    const nextLen = merged.length;
    lastLengthRef.current = nextLen;
    if (nextLen <= prevLen) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [merged]);

  if (loadingInitial && merged.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-3 w-3 animate-spin" aria-hidden />
        Loading conversation…
      </div>
    );
  }

  if (error && merged.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm text-destructive">Couldn&apos;t load history.</p>
        <p className="max-w-xs text-xs text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-4"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {hasMore ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onLoadOlder}
              disabled={loadingMore}
              className="h-7 gap-1 text-xs text-muted-foreground"
            >
              {loadingMore ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              Load older messages
            </Button>
          </div>
        ) : merged.length > 0 ? (
          <p className="text-center text-[11px] text-muted-foreground">
            — beginning of conversation —
          </p>
        ) : null}

        {merged.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            No messages yet. Say hi.
          </p>
        ) : null}

        {merged.map((m) => (
          <MessageRow
            key={m.id}
            message={m}
            walletAddress={walletAddress}
            onApprovePlan={onApprovePlan}
            onRequestPlanChanges={onRequestPlanChanges}
            approvingPlanId={approvingPlanId}
            planAlreadyApproved={Boolean(
              m.event?.planId && approvedPlanIds.has(m.event.planId),
            )}
            proposalActionable={m.id === latestProposalMessageId}
          />
        ))}
      </div>
    </div>
  );
}

function MessageRow({
  message,
  walletAddress,
  onApprovePlan,
  onRequestPlanChanges,
  approvingPlanId,
  planAlreadyApproved,
  proposalActionable,
}: {
  message: OptimisticMessage;
  walletAddress: string;
  onApprovePlan?: (planId: string) => void;
  onRequestPlanChanges?: (planId: string) => void;
  approvingPlanId?: string | null;
  planAlreadyApproved?: boolean;
  proposalActionable?: boolean;
}) {
  const me = `user:${walletAddress.toLowerCase()}`;
  const fromMe = message.from === me;
  const fromAgent = message.from.startsWith("agent:");
  const fromService = message.from.startsWith("service:");
  const label = fromMe
    ? "you"
    : message.from.replace(/^(?:user|agent|service):/, "");
  const proposal =
    message.event?.domain === "project_workflow" &&
    message.event.type === "plan_proposed" &&
    message.event.planId
      ? message.event.planId
      : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        fromMe ? "items-end" : "items-start",
      )}
    >
      <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
        {fromAgent ? " · agent" : fromService ? " · workflow" : ""}
        {message.pending ? " · sending…" : ""}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-lg border px-3 py-2 text-sm leading-relaxed",
          fromMe
            ? "border-primary/40 bg-primary/15 text-foreground"
            : "border-border bg-card text-foreground",
          message.pending && "opacity-70",
        )}
      >
        <Markdown>{message.text}</Markdown>
        {message.toolCalls && message.toolCalls.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {message.toolCalls.map((call) => (
              <ToolPill key={call.id} call={call} />
            ))}
          </div>
        ) : null}
        {proposal && onApprovePlan && proposalActionable && !planAlreadyApproved ? (
          <div className="mt-3 flex flex-col items-stretch gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Approval is required before tasks start.
            </span>
            <div className="flex shrink-0 gap-1.5">
              {onRequestPlanChanges ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => onRequestPlanChanges(proposal)}
                >
                  Request changes
                </Button>
              ) : null}
              <Button
              type="button"
              size="sm"
              className="h-7 shrink-0"
              disabled={approvingPlanId === proposal}
              onClick={() => onApprovePlan(proposal)}
            >
              {approvingPlanId === proposal ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Approve plan
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <span className="px-1 font-mono text-[9px] text-muted-foreground/70">
        {formatTime(message.timestamp)}
      </span>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
