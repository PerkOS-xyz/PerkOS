"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquarePlus, Play } from "lucide-react";
import { toast } from "sonner";
import { useConnection } from "wagmi";

import { Button } from "@/components/ui/button";

import type { ProjectDetail } from "../lib/perkosApi";
import {
  approvePlan,
  createProjectChatThread,
  ensureProjectChat,
  mentionAgent,
  notifyProjectMention,
  pmTurn,
} from "../lib/perkosApi";
import type { ChatIdentity } from "../lib/chatClient";
import {
  useChatClient,
  useChatClientStatus,
  useChatHistory,
  useConversationLiveMessages,
} from "../lib/useChatClient";
import { extractMentions } from "../lib/mentions";
import { useMentionParticipants } from "../lib/useMentionParticipants";
import { entityKey, writeEdge } from "../lib/edges";
import { uploadAttachment } from "../lib/uploadAttachment";
import { ChatComposer } from "./ChatComposer";
import {
  ConversationMessages,
  type OptimisticMessage,
} from "./ConversationMessages";
import { OfflineBanner } from "./OfflineBanner";

export function ProjectChatTab({
  detail,
  projectId,
  ownerWallet,
  onDesignatePm,
}: {
  detail: ProjectDetail;
  projectId: string;
  ownerWallet?: string;
  onDesignatePm: () => void;
}) {
  const { address, isConnected } = useConnection();
  const client = useChatClient();
  const { status } = useChatClientStatus();
  const [draft, setDraft] = useState("");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const shared = Boolean(
    ownerWallet && ownerWallet.toLowerCase() !== (address ?? "").toLowerCase(),
  );
  const owner = shared ? ownerWallet : undefined;
  const participants = useMentionParticipants(detail, projectId);
  const pmAgent = detail.project.pmAgent ?? null;

  const conversationQuery = useQuery({
    queryKey: ["project-chat", projectId, owner],
    queryFn: () => ensureProjectChat({ projectId, owner }),
    enabled: Boolean(address),
  });
  const convId = activeConvId ?? conversationQuery.data?.convId ?? null;
  const live = useConversationLiveMessages(convId);
  const historyState = useChatHistory(convId);
  const liveIds = useMemo(() => new Set(live.map((message) => message.id)), [live]);
  const pending = useMemo(
    () => optimistic.filter((message) => !liveIds.has(message.id)),
    [optimistic, liveIds],
  );

  const newChat = useMutation({
    mutationFn: () => createProjectChatThread({ projectId, owner }),
    onSuccess: ({ convId: next }) => {
      setActiveConvId(next);
      setOptimistic([]);
      setSendError(null);
      toast.success("New project chat started");
    },
    onError: (error: Error) => toast.error("Couldn't start a new chat", { description: error.message }),
  });

  const startPlanning = useMutation({
    mutationFn: () => pmTurn({ projectId, trigger: "run-button", owner }),
    onSuccess: () => toast.success("PM is preparing a plan for approval"),
    onError: (error: Error) => toast.error("Couldn't start planning", { description: error.message }),
  });

  const approve = useMutation({
    mutationFn: (planId: string) => approvePlan({ projectId, docId: planId, owner }),
    onSuccess: ({ created }) => toast.success(
      `Plan approved · ${created} task${created === 1 ? "" : "s"} started`,
    ),
    onError: (error: Error) => toast.error("Couldn't approve the plan", { description: error.message }),
  });

  function send(text: string) {
    if (!client || !convId || !address || status !== "connected") return;
    setSendError(null);
    const mentions = extractMentions(text, participants) as ChatIdentity[];
    const targets: ChatIdentity[] | undefined =
      mentions.length > 0
        ? mentions
        : pmAgent
          ? [`agent:${pmAgent}`]
          : undefined;
    const id = client.send({
      convId,
      text,
      targets,
      onAck: (ack) => {
        setOptimistic((prev) =>
          prev.map((message) =>
            message.id === ack.id ? { ...message, pending: false } : message,
          ),
        );
        // A resting PerkOS agent has no chat socket. Wake/deliver through A2A
        // only when PerkOS-Chat confirms that no target socket received it.
        if (ack.delivered === 0 && pmAgent && mentions.length === 0) {
          void mentionAgent({ projectId, agentName: pmAgent, text, owner });
        }
      },
    });
    setOptimistic((prev) => [
      ...prev,
      {
        id,
        convId,
        from: `user:${address.toLowerCase()}`,
        text,
        timestamp: new Date().toISOString(),
        pending: true,
      },
    ]);
    setDraft("");

    for (const identity of mentions) {
      void writeEdge(ownerWallet ?? address, {
        fromKey: entityKey.user(address),
        toKey: identity,
        rel: "mentions",
        projectId,
        sourceRef: id,
        sourceLabel: text.slice(0, 80),
      });
      if (identity.startsWith("user:") && identity !== `user:${address.toLowerCase()}`) {
        void notifyProjectMention({
          projectId,
          target: identity.slice("user:".length),
          title: "You were mentioned in a project chat",
          body: text.slice(0, 200),
          href: `/projects/${projectId}?tab=chat`,
          owner,
        });
      }
    }
  }

  const disabled = !isConnected || !convId || status !== "connected";
  const disabledReason = conversationQuery.isLoading
    ? "Opening project chat…"
    : status !== "connected"
      ? "Connecting to PerkOS Chat…"
      : !pmAgent
        ? "Designate a PM or mention an agent"
        : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
      <section className="flex h-[64vh] min-h-[520px] min-w-0 flex-col overflow-hidden rounded-md border border-border bg-background">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium"># {detail.project.name}</p>
            <p className="text-xs text-muted-foreground">
              {pmAgent ? `${pmAgent} coordinates this project` : "No PM designated"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={newChat.isPending}
              onClick={() => newChat.mutate()}
            >
              {newChat.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquarePlus className="h-3.5 w-3.5" />}
              New chat
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!pmAgent || startPlanning.isPending}
              onClick={() => startPlanning.mutate()}
            >
              {startPlanning.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Start
            </Button>
          </div>
        </header>
        {historyState.hostOffline && convId ? (
          <OfflineBanner historyHost={`agent:${pmAgent ?? "unknown"}`} fromCache={historyState.fromCache} />
        ) : null}
        <ConversationMessages
          history={historyState.history}
          live={live}
          pending={pending}
          walletAddress={address ?? ""}
          loadingInitial={conversationQuery.isLoading || historyState.loadingInitial}
          loadingMore={historyState.loadingMore}
          hasMore={historyState.hasMore}
          onLoadOlder={historyState.loadOlder}
          error={conversationQuery.error as Error | null ?? historyState.error}
          onApprovePlan={(planId) => approve.mutate(planId)}
          approvingPlanId={approve.isPending ? approve.variables ?? null : null}
        />
        {sendError ? <p className="px-4 py-2 text-xs text-destructive">{sendError}</p> : null}
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSend={send}
          disabled={disabled}
          placeholder={disabledReason ?? `Message ${pmAgent ?? "the project team"}…`}
          uploadFile={
            address && convId
              ? (file, index) => uploadAttachment({ file, walletAddress: address, conversationId: convId, index })
              : undefined
          }
          className="border-t border-border p-3"
        />
      </section>

      <aside className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Project team</span>
          <span className="text-xs text-muted-foreground">{participants.length}</span>
        </div>
        {!pmAgent ? (
          <Button size="sm" variant="outline" onClick={onDesignatePm}>Designate PM</Button>
        ) : null}
        <ul className="flex flex-col gap-2">
          {participants.map((participant) => (
            <li key={participant.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{participant.label}</span>
              <span className="text-[10px] uppercase text-muted-foreground">{participant.kind}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
