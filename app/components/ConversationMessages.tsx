"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ChatMessage } from "../lib/chatClient";
import { Markdown } from "./Markdown";

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
      className="flex-1 overflow-y-auto px-4 py-4"
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
          <MessageRow key={m.id} message={m} walletAddress={walletAddress} />
        ))}
      </div>
    </div>
  );
}

function MessageRow({
  message,
  walletAddress,
}: {
  message: OptimisticMessage;
  walletAddress: string;
}) {
  const me = `user:${walletAddress.toLowerCase()}`;
  const fromMe = message.from === me;
  const fromAgent = message.from.startsWith("agent:");
  const label = fromMe ? "you" : message.from.replace(/^(?:user|agent):/, "");

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        fromMe ? "items-end" : "items-start",
      )}
    >
      <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
        {fromAgent ? " · agent" : ""}
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
