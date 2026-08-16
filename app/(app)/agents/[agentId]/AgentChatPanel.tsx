"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccount } from "../../../lib/useAppAccount";
import { Loader2, MessageSquare, Mic2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  recordAgentActivityApi,
  type HibernationStatus,
} from "../../../lib/perkosApi";
import { useChatPerkosClient } from "../../../lib/useChatPerkosClient";
import { getHibernationStatusApi } from "../../../lib/perkosApi";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import type { ExternalRuntimeAvailability } from "../../../lib/agentHostingPolicy";

type Props = {
  agentId: string;
  agentName: string;
  /** Whether this agent is ready for a direct WebSocket conversation. */
  chatEnabled: boolean;
  /** PerkOS-managed ECS agents can hibernate. External agents cannot. */
  hibernationEnabled: boolean;
  /** External runtimes are operated by their owner, not by PerkOS. */
  externalAgent?: boolean;
  /** User-facing runtime label, for example OpenClaw. */
  runtimeKind?: string;
  /** Execution readiness, independent from this browser's chat websocket. */
  runtimeAvailability?: ExternalRuntimeAvailability;
};

type Bubble = {
  id: string;
  role: "user" | "agent";
  text: string;
  ts?: number;
  voice?: boolean;
};

function isPersistedVoiceMessage(event?: { domain?: string; type?: string } | null): boolean {
  return event?.domain === "voice" || event?.domain === "voice_session";
}

/** Short local time (HH:MM) for a message timestamp. */
function formatTime(ts?: number): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function agentResponseTimeoutMessage(input: {
  agentName: string;
  externalAgent: boolean;
  runtimeKind?: string;
}): string {
  if (input.externalAgent) {
    const runtime = input.runtimeKind?.trim();
    return (
      `No response from ${input.agentName} after 90s. ` +
      `The external${runtime ? ` ${runtime}` : ""} agent is connected but did not return a reply. ` +
      "Check the external runtime/plugin logs or model routing."
    );
  }
  return (
    `No response from ${input.agentName} after 90s. ` +
    "If the agent was hibernated, give it another moment to wake — " +
    "your message should land once the runtime is online."
  );
}

export function AgentChatPanel({
  agentId,
  agentName,
  chatEnabled,
  hibernationEnabled,
  externalAgent = false,
  runtimeKind,
  runtimeAvailability,
}: Props) {
  const { address, isConnected } = useAppAccount();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

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
    enabled: chatEnabled && isConnected && Boolean(address),
    staleTime: 5 * 60 * 1000,
  });
  const convId = convQuery.data?.convId ?? null;

  // Watch hibernation state so the input can disable / warn when the
  // agent isn't actually online. We poll briefly (every 5s) only while
  // the state is transient — same pattern as the auto-wake banner.
  const hibernationQuery = useQuery<HibernationStatus>({
    queryKey: ["agent-hibernation", agentId],
    queryFn: () => getHibernationStatusApi({ agentId }),
    enabled: hibernationEnabled,
    refetchInterval: (q) => {
      const s = (q.state.data as HibernationStatus | undefined)?.state;
      return s === "hibernating" || s === "waking" ? 5_000 : false;
    },
  });
  const hibernation = hibernationQuery.data;

  const chat = useChatPerkosClient({
    convId,
    enabled: chatEnabled && isConnected && Boolean(convId),
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
          voice: isPersistedVoiceMessage(msg.event),
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
            voice: isPersistedVoiceMessage(m.event),
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
  const runtimeBlocked = externalAgent &&
    (runtimeAvailability === "offline" || runtimeAvailability === "unavailable");

  // Auto-scroll to bottom on new messages / typing indicator changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, showTyping]);

  // Timeout fallback for the "thinking…" indicator. Managed runtimes may be
  // waking from hibernation; external runtimes instead need their own plugin
  // and model-routing diagnostics. Never suggest PerkOS container lifecycle
  // actions for infrastructure the owner operates.
  useEffect(() => {
    if (!awaitingReply) return;
    const timer = setTimeout(() => {
      setAwaitingReply(false);
      setError(agentResponseTimeoutMessage({ agentName, externalAgent, runtimeKind }));
    }, 90_000);
    return () => clearTimeout(timer);
  }, [awaitingReply, agentName, externalAgent, runtimeKind]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    if (!isConnected || !address) {
      setError("Connect a wallet to chat with this agent.");
      return;
    }
    if (runtimeBlocked) {
      setError(
        runtimeAvailability === "unavailable"
          ? `${agentName}'s bridge is connected, but its external runtime is unavailable.`
          : `${agentName}'s external runtime is offline.`,
      );
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
      hibernationEnabled &&
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

    // Stamp real user activity so the curator's idle timer resets on use.
    // Fire-and-forget — a missed ping never breaks the send.
    void recordAgentActivityApi({ agentId }).catch(() => {});
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

  // Clear the conversation from THIS view. The chat backend keeps the
  // history (the WS client exposes no delete), so we just empty the local
  // thread + stop the one-shot history pull from re-populating it this
  // session. Reloading re-syncs from the server — the confirm says so.
  function clearChat() {
    setMessages([]);
    sentIdsRef.current.clear();
    historyPulledRef.current = true;
    setAwaitingReply(false);
    setError(null);
    setConfirmClearOpen(false);
    toast.success("Conversation cleared");
  }

  if (!chatEnabled) {
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
  const wsBadge = chat.authed && externalAgent ? (
    runtimeAvailability === "online" ? (
      <span className="text-xs text-emerald-300">Agent connected</span>
    ) : runtimeAvailability === "unavailable" ? (
      <span className="text-xs text-red-300">Runtime unavailable</span>
    ) : runtimeAvailability === "offline" ? (
      <span className="text-xs text-muted-foreground">Agent offline</span>
    ) : (
      <span className="text-xs text-amber-300">Runtime unverified</span>
    )
  ) : chat.authed ? (
    <span className="text-xs text-emerald-300">Chat service connected</span>
  ) : convQuery.isFetching || !convId ? (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      Opening…
    </span>
  ) : (
    <span className="text-xs text-amber-300">Connecting…</span>
  );

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/80 bg-card/80 shadow-sm">
      <CardHeader data-testid="desktop-chat-heading" className="hidden shrink-0 xl:grid xl:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-4 w-4 text-primary" />
              Chat with {agentName}
            </CardTitle>
            <CardDescription>Messages and completed saved voice turns share this conversation.</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {messages.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmClearOpen(true)}
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
            {wsBadge}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] xl:gap-3 xl:p-6 xl:pt-0">
        <div
          ref={scrollRef}
          data-testid="agent-chat-history"
          aria-label={`Conversation history with ${agentName}`}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain rounded-xl border border-border bg-background/50 p-3 sm:p-5 xl:min-h-[28rem] xl:max-h-[42rem] xl:flex-none"
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
                    "max-w-[92%] rounded-2xl px-4 py-3 text-base leading-7 sm:max-w-[78%]",
                    m.role === "user"
                      ? "bg-primary/15 text-foreground"
                      : "border border-border bg-card text-foreground",
                  )}
                >
                  {m.voice ? (
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary">
                      <Mic2 className="h-3 w-3" aria-hidden="true" /> Saved voice turn
                    </span>
                  ) : null}
                  <pre className="whitespace-pre-wrap break-words font-sans">
                    {m.text}
                  </pre>
                  {m.ts ? (
                    <span
                      className={cn(
                        "mt-1 block text-[10px] leading-none text-muted-foreground",
                        m.role === "user" ? "text-right" : "text-left",
                      )}
                    >
                      {formatTime(m.ts)}
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {showTyping ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {agentName} is responding live…
              </div>
            </div>
          ) : null}
        </div>

        {connError ? (
          <p className="text-xs text-destructive">{connError}</p>
        ) : null}

        {externalAgent && runtimeAvailability === "unavailable" ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            The bridge is connected to PerkOS, but the external runtime did not
            answer its health probe. Start or repair the owner-operated runtime
            before sending messages.
          </p>
        ) : null}

        <form data-testid="agent-chat-composer" className="shrink-0 border-t border-border/60 bg-card/95 pt-2 supports-[backdrop-filter]:backdrop-blur" onSubmit={onSubmit}>
          <div className="flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${agentName}…`}
              rows={2}
              onKeyDown={onKey}
              disabled={runtimeBlocked || (!chat.authed && (convQuery.isFetching || !convId))}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {hibernationEnabled && hibernation?.state === "hibernated" ? (
                  <>Agent is hibernated — sending will wake it.</>
                ) : hibernationEnabled && hibernation?.state === "waking" ? (
                  <>Agent is waking up…</>
                ) : hibernationEnabled && hibernation?.state === "hibernating" ? (
                  <>Agent is hibernating; message will queue.</>
                ) : (
                  <>Enter to send · Shift+Enter for a new line</>
                )}
              </p>
              <Button
                type="submit"
                size="sm"
                disabled={runtimeBlocked || !draft.trim() || (!chat.authed && !convId)}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </Button>
            </div>
          </div>
        </form>
      </CardContent>

      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title="Clear conversation?"
        description="Removes the messages from this view. The agent and its server-side history are unaffected — reloading the page re-syncs them."
        confirmLabel="Clear"
        onConfirm={clearChat}
      />
    </Card>
  );
}
