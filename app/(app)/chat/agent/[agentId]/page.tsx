"use client";

import Link from "next/link";
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";

import { Button } from "@/components/ui/button";

import { ensureAgentConv } from "../../../../lib/perkosApi";

type PageProps = {
  params: Promise<{ agentId: string }>;
};

/**
 * Compatibility entrypoint for agent cards and old deep links.
 *
 * Agent chat used to render a second, localStorage-only conversation here.
 * That history could not appear in the Chat sidebar and the New conversation
 * flow created a different kind of thread. Resolve the agent's canonical
 * conversation instead, then hand off to the shared `/chat/[convId]` UI where
 * history, the sidebar, pin/archive/delete, and new chats all stay in sync.
 */
export default function AgentChatRoute({ params }: PageProps) {
  const { agentId } = use(params);
  return <AgentChatRedirect agentId={agentId} />;
}

export function AgentChatRedirect({ agentId }: { agentId: string }) {
  const router = useRouter();
  const { address, isConnected } = useConnection();

  const conversation = useQuery({
    queryKey: ["agent-conv", agentId, address],
    queryFn: () => ensureAgentConv({ agentId }),
    enabled: isConnected && Boolean(address),
    staleTime: 5 * 60 * 1000,
  });

  const convId = conversation.data?.convId;
  useEffect(() => {
    if (!convId) return;
    router.replace(`/chat/${encodeURIComponent(convId)}`);
  }, [convId, router]);

  if (!isConnected || !address) {
    return (
      <RouteState>
        <p>Connect your wallet to open this conversation.</p>
      </RouteState>
    );
  }

  if (conversation.isError) {
    return (
      <RouteState>
        <p className="text-destructive">Couldn&apos;t open this conversation.</p>
        <p className="max-w-md text-xs text-muted-foreground">
          {conversation.error.message}
        </p>
        <Button render={<Link href="/chat" />} variant="outline" size="sm">
          Back to Chat
        </Button>
      </RouteState>
    );
  }

  return (
    <RouteState>
      <p>Opening conversation…</p>
    </RouteState>
  );
}

function RouteState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
