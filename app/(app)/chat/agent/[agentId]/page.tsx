"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { ArrowLeft, MoreVertical, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  assistantChat,
  getWalletAgents,
  type Agent,
} from "../../../../lib/perkosApi";
import {
  genMessageId,
  useAgentChatHistory,
  type AgentChatMessage,
} from "../../../../lib/useAgentChatHistory";
import { ChatComposer } from "../../../../components/ChatComposer";
import { Markdown } from "../../../../components/Markdown";

type PageProps = {
  params: Promise<{ agentId: string }>;
};

function initials(name: string): string {
  return name
    .split(/\s+|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function AgentChatPage({ params }: PageProps) {
  const { agentId } = use(params);
  const { address, isConnected } = useConnection();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const agentsQuery = useQuery({
    queryKey: ["wallet-agents", address],
    queryFn: () => getWalletAgents(address!),
    enabled: Boolean(address),
  });

  const agent = agentsQuery.data?.find((a) => a.id === agentId);

  const { messages, append, clear } = useAgentChatHistory(agentId);

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      if (!isConnected || !address) {
        throw new Error("Connect a wallet to chat with this agent.");
      }
      const history = messages.map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.text,
      }));
      return assistantChat({
        walletAddress: address,
        message: text,
        history,
        agentId,
      });
    },
    onSuccess: (data) => {
      append({
        id: genMessageId(),
        role: "agent",
        text: data.reply,
        createdAt: Date.now(),
      });
    },
    onError: (error: Error) => {
      append({
        id: genMessageId(),
        role: "agent",
        text: `⚠ ${error.message}`,
        createdAt: Date.now(),
      });
    },
  });

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;
    append({
      id: genMessageId(),
      role: "user",
      text: trimmed,
      createdAt: Date.now(),
    });
    setDraft("");
    mutation.mutate(trimmed);
  }

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, mutation.isPending]);

  if (!isConnected) {
    return (
      <div className="rounded-md border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        Connect your wallet to chat with this agent.
      </div>
    );
  }

  if (agentsQuery.isLoading) {
    return <SkeletonChat />;
  }

  if (!agent) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <div className="rounded-md border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          Agent not found in your team.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:h-[calc(100vh-9rem)]">
      <BackLink />

      <ChatHeader agent={agent} onReset={clear} hasMessages={messages.length > 0} />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-md border border-border bg-card/50 p-4"
      >
        {messages.length === 0 ? (
          <EmptyConversation agent={agent} />
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} agent={agent} />
            ))}
            {mutation.isPending ? <TypingBubble /> : null}
          </ul>
        )}
      </div>

      <ChatComposer
        value={draft}
        onChange={setDraft}
        onSend={send}
        sending={mutation.isPending}
        placeholder={`Message ${agent.name}…`}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/chat"
      className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Chat
    </Link>
  );
}

function ChatHeader({
  agent,
  onReset,
  hasMessages,
}: {
  agent: Agent;
  onReset: () => void;
  hasMessages: boolean;
}) {
  const presence =
    agent.status === "ready"
      ? "bg-emerald-400"
      : agent.status === "failed"
      ? "bg-destructive"
      : "bg-amber-400";

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3">
      <Link href={`/agents/${encodeURIComponent(agent.id)}`}>
        <div className="relative">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-xs font-medium text-primary">
            {initials(agent.name)}
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 grid h-2.5 w-2.5 place-items-center rounded-full ring-2 ring-card",
              presence
            )}
            aria-hidden
          />
        </div>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={`/agents/${encodeURIComponent(agent.id)}`}
          className="truncate text-sm font-medium text-foreground hover:underline"
        >
          {agent.name}
        </Link>
        <span className="text-xs text-muted-foreground">
          {agent.runtime}
          <span className="px-1.5">·</span>
          {agent.status === "ready" ? "Online" : agent.status}
        </span>
      </div>
      {hasMessages ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear
        </Button>
      ) : null}
      <Link
        href={`/agents/${encodeURIComponent(agent.id)}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Agent details"
      >
        <MoreVertical className="h-4 w-4" />
      </Link>
    </div>
  );
}

function MessageBubble({
  message,
  agent,
}: {
  message: AgentChatMessage;
  agent: Agent;
}) {
  if (message.role === "user") {
    return (
      <li className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary/15 px-3 py-2 text-sm text-foreground">
          {message.text}
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
        {initials(agent.name)}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {agent.name}
        </span>
        <Markdown className="leading-relaxed">{message.text}</Markdown>
      </div>
    </li>
  );
}

function TypingBubble() {
  return (
    <li className="flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
    </li>
  );
}

function EmptyConversation({ agent }: { agent: Agent }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="relative">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-sm font-medium text-primary">
          {initials(agent.name)}
        </div>
        <Image
          src="/avatar.png"
          alt=""
          width={20}
          height={20}
          className="absolute -bottom-1 -right-1 rounded-full bg-card p-0.5"
        />
      </div>
      <h2 className="text-base font-medium text-foreground">
        Chat with {agent.name}
      </h2>
      <p className="max-w-xs text-xs text-muted-foreground">
        Send the first message. Replies use the agent runtime
        <Badge variant="secondary" className="mx-1 border-0 bg-muted">
          {agent.runtime}
        </Badge>
        with whatever LLM key it&apos;s configured for.
      </p>
    </div>
  );
}

function SkeletonChat() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
      <div className="h-16 animate-pulse rounded-md border border-border bg-card" />
      <div className="h-64 animate-pulse rounded-md border border-border bg-card" />
      <div className="h-14 animate-pulse rounded-md border border-border bg-card" />
    </div>
  );
}
