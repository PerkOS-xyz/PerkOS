"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { Loader2, MessageSquare, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  ensureAgentAwakeApi,
  ensureAgentConv,
  type HibernationStatus,
} from "../../../lib/perkosApi";
import { useChatPerkosClient } from "../../../lib/useChatPerkosClient";
import { getHibernationStatusApi } from "../../../lib/perkosApi";

type Props = {
  agentId: string;
  agentName: string;
  /** Whether the agent is ECS-deployed. When false we render a polite
   *  placeholder instead of trying to open a WS conv. */
  ecsDeployed: boolean;
};

type Bubble = {
  id: string;
  role: "user" | "agent";
  text: string;
  ts?: number;
};

export function AgentChatPanel({ agentId, agentName, ecsDeployed }: Props) {
  const { address, isConnected } = useConnection();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [awaitingReply, setAwaitingReply] = useState(false);

  // Track ids we just sent so the WS echo (chat_message broadcast back
  // to all participants, including us) doesn't render a duplicate
  // bubble. Same pattern the platform Assistant panel uses.
  const sentIdsRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyPulledRef = useRef(false);

  // Resolve the conv id once per (agentId, wallet) pair. The server
  // route is idempotent — repeated calls land on the same Firestore
  // conv doc via the transactional create-if-absent in the route.
  const convQuery = useQuery({
    queryKey: ["agent-conv", agentId, address],
    queryFn: () => ensureAgentConv({ agentId }),
    enabled: ecsDeployed && isConnected && Boolean(address),
    staleTime: 5 * 60 * 1000,
  });
  const convId = convQuery.data?.convId ?? null;

  // Watch hibernation state so the input can disable / warn when the
  // agent isn't actually online. We poll briefly (every 5s) only while
  // the state is transient — same pattern as the auto-wake banner.
  const hibernationQuery = useQuery<HibernationStatus>({
    queryKey: ["agent-hibernation", agentId],
    queryFn: () => getHibernationStatusApi({ agentId }),
    enabled: ecsDeployed,
    refetchInterval: (q) => {
      const s = (q.state.data as HibernationStatus | undefined)?.state;
      return s === "hibernating" || s === "waking" ? 5_000 : false;
    },
  });
  const hibernation = hibernationQuery.data;

  const chat = useChatPerkosClient({
    convId,
    enabled: ecsDeployed && isConnected && Boolean(convId),
    onMessage: (msg) => {
      if (sentIdsRef.current.has(msg.id)) {
        sentIdsRef.current.delete(msg.id);
        return;
      }
      const isFromAgent = msg.from.startsWith("agent:");
      setMessages((prev) => [
        ...prev,
        {
          id: msg.id,
          role: isFromAgent ? "agent" : "user",
          text: msg.text,
          ts: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
        },
      ]);
      if (isFromAgent) setAwaitingReply(false);
    },
    onHistory: (chunk) => {
      // history_chunk is oldest-first within the chunk. Dedup by id +
      // prepend so re-pulls don't double-render. The Set check below
      // is simple and correct for the < ~50 msg pages we pull.
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const incoming: Bubble[] = chunk.messages
          .filter((m) => !seen.has(m.id))
          .map((m) => ({
            id: m.id,
            role: m.from.startsWith("agent:") ? "agent" : "user",
            text: m.text,
            ts: m.timestamp ? new Date(m.timestamp).getTime() : Date.now(),
          }));
        return [...incoming, ...prev];
      });
    },
  });

  // One-shot history pull once we're authed + have a convId.
  // Destructure to placate exhaustive-deps without re-running the
  // effect on every chat-state change.
  const { authed: chatAuthed, requestHistory } = chat;
  useEffect(() => {
    if (!chatAuthed || historyPulledRef.current || !convId) return;
    if (requestHistory({ limit: 50 })) {
      historyPulledRef.current = true;
    }
  }, [chatAuthed, requestHistory, convId]);

  // Reset history-pulled flag when convId changes (different agent or
  // different wallet) so the next active conv pulls fresh.
  useEffect(() => {
    historyPulledRef.current = false;
  }, [convId]);

  // Derive "show typing indicator" rather than syncing state — avoids
  // a setState-in-effect (project ESLint config rejects it) and the
  // semantics are cleaner: if the WS drops we hide the typing bubble
  // immediately without a render cycle's lag.
  const showTyping = awaitingReply && chatAuthed;

  // Auto-scroll to bottom on new messages / typing indicator changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, showTyping]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    if (!isConnected || !address) {
      setError("Connect a wallet to chat with this agent.");
      return;
    }
    if (!convId) {
      setError("Still opening the conversation, try again in a moment.");
      return;
    }

    // If the agent is hibernated, wake it before we send so the
    // message actually lands (the bridge is offline while desiredCount
    // is 0). waitForRunning=false → we kick off the wake and let the
    // hibernation poll update the UI; the send below will queue.
    if (
      hibernation &&
      (hibernation.state === "hibernated" || hibernation.state === "hibernating")
    ) {
      try {
        await ensureAgentAwakeApi({ agentId, waitForRunning: false });
        queryClient.invalidateQueries({ queryKey: ["agent-hibernation", agentId] });
      } catch (err) {
        setError(
          `Couldn't wake the agent: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }
    }

    const id = chat.send(trimmed);
    sentIdsRef.current.add(id);
    setMessages((prev) => [
      ...prev,
      { id, role: "user", text: trimmed, ts: Date.now() },
    ]);
    setDraft("");
    setAwaitingReply(true);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void send(draft);
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  }

  if (!ecsDeployed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Chat
          </CardTitle>
          <CardDescription>
            Chat opens once the agent is provisioned and running.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const connError = chat.error ?? error;
  const wsBadge = chat.authed ? (
    <span className="text-xs text-emerald-300">Connected</span>
  ) : convQuery.isFetching || !convId ? (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      Opening…
    </span>
  ) : (
    <span className="text-xs text-amber-300">Connecting…</span>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-primary" />
              Chat with {agentName}
            </CardTitle>
            <CardDescription>
              Direct conversation routed through chat.perkos.xyz. The
              agent receives messages via its bridge sidecar and replies
              with the runtime&apos;s configured LLM.
            </CardDescription>
          </div>
          {wsBadge}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          ref={scrollRef}
          className="flex max-h-96 min-h-48 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-background/40 p-3"
        >
          {messages.length === 0 && !showTyping ? (
            <p className="my-auto text-center text-sm text-muted-foreground">
              No messages yet. Say hello.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-primary/15 text-foreground"
                      : "border border-border bg-card text-foreground",
                  )}
                >
                  <pre className="whitespace-pre-wrap break-words font-sans">
                    {m.text}
                  </pre>
                </div>
              </div>
            ))
          )}
          {showTyping ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {agentName} is thinking…
              </div>
            </div>
          ) : null}
        </div>

        {connError ? (
          <p className="text-xs text-destructive">{connError}</p>
        ) : null}

        <form className="flex flex-col gap-2" onSubmit={onSubmit}>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${agentName}…`}
            rows={2}
            onKeyDown={onKey}
            disabled={!chat.authed && (convQuery.isFetching || !convId)}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {hibernation?.state === "hibernated" ? (
                <>Agent is hibernated — sending will wake it.</>
              ) : hibernation?.state === "waking" ? (
                <>Agent is waking up…</>
              ) : hibernation?.state === "hibernating" ? (
                <>Agent is hibernating; message will queue.</>
              ) : (
                <>Enter to send · Shift+Enter for a new line</>
              )}
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={!draft.trim() || (!chat.authed && !convId)}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
