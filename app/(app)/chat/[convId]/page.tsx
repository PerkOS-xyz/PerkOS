"use client";

import { notFound, useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAppAccount } from "../../../lib/useAppAccount";

import { useConversation } from "../../../lib/useConversation";
import {
  useChatClient,
  useChatClientStatus,
  useChatHistory,
  useConversationLiveMessages,
} from "../../../lib/useChatClient";
import { ConversationHeader } from "../../../components/ConversationHeader";
import {
  ConversationMessages,
  type OptimisticMessage,
} from "../../../components/ConversationMessages";
import { ConversationComposer } from "../../../components/ConversationComposer";
import { OfflineBanner } from "../../../components/OfflineBanner";
import { uploadAttachment } from "../../../lib/uploadAttachment";
import { useWalletAgents } from "../../../lib/useWalletAgents";
import {
  chatAgentOperationalState,
  findConversationAgent,
} from "../../../lib/chatAgentStatus";
import { ensureAgentAwakeApi } from "../../../lib/perkosApi";

export default function ConversationPage() {
  const params = useParams<{ convId: string }>();
  const convId = params?.convId ?? null;
  const { address, isConnected } = useAppAccount();

  const { conversation, loading: convLoading, error: convError } = useConversation(
    address,
    convId,
  );

  const { status } = useChatClientStatus();
  const { byName: liveAgents } = useWalletAgents(address);
  const client = useChatClient();
  const live = useConversationLiveMessages(convId);
  const {
    history,
    loadingInitial,
    loadingMore,
    hasMore,
    loadOlder,
    error: historyError,
    hostOffline,
    fromCache,
  } = useChatHistory(convId);

  // Optimistic local messages — added immediately when the user hits send,
  // dropped when the server echoes them back (matching id).
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);

  const conversationAgent = useMemo(
    () => conversation
      ? findConversationAgent(liveAgents, conversation.historyHost, conversation.participants)
      : undefined,
    [conversation, liveAgents],
  );
  const agentState = chatAgentOperationalState(conversationAgent);
  const wakeMutation = useMutation({
    mutationFn: async () => {
      if (!conversationAgent) throw new Error("Agent status is not available yet.");
      return ensureAgentAwakeApi({ agentId: conversationAgent.id, waitForRunning: false });
    },
    onError: (error: Error) => toast.error("Couldn’t wake the agent", { description: error.message }),
  });

  // Drop optimistic entries that have been confirmed via the live channel.
  const liveIds = useMemo(() => new Set(live.map((m) => m.id)), [live]);
  const pending = useMemo(
    () => optimistic.filter((m) => !liveIds.has(m.id)),
    [optimistic, liveIds],
  );

  const onSend = useCallback(
    (text: string) => {
      if (!client || !convId || !address) return;
      const id = client.send({
        convId,
        text,
        onAck: (ack) => {
          // Some agent bridges persist the user's message but only broadcast
          // the agent reply back to the sender. Keep the optimistic row until
          // history/live can coalesce it, but stop showing "sending…" as soon
          // as the chat server acknowledges delivery.
          setOptimistic((prev) =>
            prev.map((message) =>
              message.id === ack.id
                ? { ...message, pending: false }
                : message,
            ),
          );
        },
      });
      const msg: OptimisticMessage = {
        id,
        convId,
        from: `user:${address.toLowerCase()}`,
        text,
        timestamp: new Date().toISOString(),
        replyTo: null,
        pending: true,
      };
      setOptimistic((prev) => [...prev, msg]);
    },
    [client, convId, address],
  );

  // ─────────────────────────────────────────────────────────────────────
  // Render guards
  // ─────────────────────────────────────────────────────────────────────

  if (!isConnected || !address) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
        Sign in with your wallet to view this conversation.
      </div>
    );
  }

  if (convLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading conversation…
      </div>
    );
  }

  if (convError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm text-destructive">Couldn&apos;t load this conversation.</p>
        <p className="max-w-xs text-xs text-muted-foreground">{convError.message}</p>
      </div>
    );
  }

  if (!conversation) {
    notFound();
  }

  const composerDisabled =
    status !== "connected" && status !== "authing";
  const composerReason =
    status === "auth-error"
      ? "Authentication failed. Sign out and back in."
      : status === "disconnected"
      ? "Reconnecting to chat…"
      : status === "idle"
      ? "Chat is offline."
      : undefined;

  // Convert live (ChatMessage[]) to OptimisticMessage[] so the merged sort works.
  const liveTyped: OptimisticMessage[] = live;
  const historyTyped: OptimisticMessage[] = history;

  return (
    <>
      <ConversationHeader
        conversation={conversation}
        walletAddress={address}
        agentState={agentState}
      />
      {agentState !== "online" && (agentState !== "checking" || hostOffline) ? (
        <OfflineBanner
          historyHost={conversation.historyHost}
          fromCache={fromCache}
          agentName={conversationAgent?.name}
          agentState={wakeMutation.isPending ? "waking" : agentState}
          managed={Boolean(conversationAgent && !conversationAgent.external)}
          waking={wakeMutation.isPending}
          onWake={conversationAgent && !conversationAgent.external ? () => wakeMutation.mutate() : undefined}
        />
      ) : null}
      <ConversationMessages
        history={historyTyped}
        live={liveTyped}
        pending={pending}
        walletAddress={address}
        loadingInitial={loadingInitial}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadOlder={loadOlder}
        error={historyError}
      />
      <ConversationComposer
        onSend={onSend}
        disabled={composerDisabled}
        disabledReason={composerReason}
        uploadFile={
          address && convId
            ? (file, index) =>
                uploadAttachment({
                  file,
                  walletAddress: address,
                  conversationId: convId,
                  index,
                })
            : undefined
        }
      />
    </>
  );
}
