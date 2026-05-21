"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { ArrowRight, Bot, Folder, Plus, Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  getWalletAgents,
  getWalletProjects,
  type Agent,
  type Project,
} from "../../lib/perkosApi";
import { useChatbot } from "../../components/ChatbotProvider";
import {
  SearchInput,
  matchesQuery,
} from "../../components/SearchInput";
import { EmptyState } from "../../components/EmptyState";

function initials(name: string): string {
  return name
    .split(/\s+|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function ChatHubPage() {
  const { address, isConnected } = useConnection();
  const { setOpen } = useChatbot();
  const [query, setQuery] = useState("");

  const agentsQuery = useQuery({
    queryKey: ["wallet-agents", address],
    queryFn: () => getWalletAgents(address!),
    enabled: isConnected && Boolean(address),
  });

  const projectsQuery = useQuery({
    queryKey: ["wallet-projects", address],
    queryFn: () => getWalletProjects(address!),
    enabled: isConnected && Boolean(address),
  });

  const allAgents = agentsQuery.data ?? [];
  const allProjects = projectsQuery.data?.projects ?? [];

  const agents = allAgents.filter((a) =>
    matchesQuery(query, [a.name, a.runtime, a.status])
  );
  const projects = allProjects.filter((p) =>
    matchesQuery(query, [p.name, p.goal, p.status])
  );

  const showSearch = allAgents.length + allProjects.length > 3;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium text-foreground">Chat</h1>
        <p className="text-sm text-muted-foreground">
          Talk one-on-one with your agents or step into a project channel where
          you and your assigned agents work together.
        </p>
      </header>

      <PerkOSAgentRow onOpen={() => setOpen(true)} />

      {showSearch ? (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search agents or project channels…"
        />
      ) : null}

      <Section
        title="Your agents"
        description="One-on-one chat with each agent you've registered."
        actionHref="/agents/new"
        actionLabel="Register agent"
      >
        {agentsQuery.isLoading ? (
          <SkeletonList rows={2} />
        ) : agents.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No agents to chat with"
            description="Launch your first agent and start a 1-on-1 conversation."
            actions={[{ label: "Launch agent", href: "/agents/new", icon: Plus }]}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {agents.map((a) => (
              <AgentChatRow key={a.id} agent={a} />
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Project channels"
        description="Group chat with the humans and agents assigned to each project."
        actionHref="/projects/new"
        actionLabel="Create project"
      >
        {projectsQuery.isLoading ? (
          <SkeletonList rows={2} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={Folder}
            title="No project channels yet"
            description="Project chats appear here once you create a project."
            actions={[{ label: "Create project", href: "/projects/new", icon: Plus }]}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {projects.map((p) => (
              <ProjectChannelRow key={p.id ?? p.name} project={p} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function PerkOSAgentRow({ onOpen }: { onOpen: () => void }) {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          PerkOS Agent
        </CardTitle>
        <CardDescription>
          Your guide. Ask about the platform, navigate flows, and spin up
          projects or agents from a single conversation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
        >
          <div className="relative">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/85">
              <Image
                src="/avatar.png"
                alt=""
                width={24}
                height={24}
              />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 grid h-2.5 w-2.5 place-items-center rounded-full bg-emerald-400 ring-2 ring-card" />
          </div>
          <span className="text-sm text-foreground">Open PerkOS Agent</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  description,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-base font-medium text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Link
          href={actionHref}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          {actionLabel}
        </Link>
      </div>
      <Separator className="bg-border" />
      {children}
    </section>
  );
}

function AgentChatRow({ agent }: { agent: Agent }) {
  const presence =
    agent.status === "ready"
      ? "bg-emerald-400"
      : agent.status === "failed"
      ? "bg-destructive"
      : "bg-amber-400";

  return (
    <li>
      <Link
        href={`/chat/agent/${encodeURIComponent(agent.id)}`}
        className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
      >
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
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm text-foreground">{agent.name}</span>
          <span className="text-xs text-muted-foreground">{agent.runtime}</span>
        </div>
        <Bot className="h-4 w-4 text-muted-foreground" />
      </Link>
    </li>
  );
}

function ProjectChannelRow({ project }: { project: Project }) {
  return (
    <li>
      <Link
        href={`/projects/${encodeURIComponent(project.id ?? "")}?tab=chat`}
        className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
          <Folder className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm text-foreground">
            # {project.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {project.agents} agent{project.agents === 1 ? "" : "s"}
            <span className="px-2">·</span>
            {project.tasks} task{project.tasks === 1 ? "" : "s"}
          </span>
        </div>
        {project.status?.toLowerCase() === "active" ? (
          <Badge
            variant="secondary"
            className="border-0 bg-emerald-500/20 text-emerald-300"
          >
            Active
          </Badge>
        ) : null}
      </Link>
    </li>
  );
}

function SkeletonList({ rows }: { rows: number }) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {Array.from({ length: rows * 2 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-md border border-border bg-card"
        />
      ))}
    </div>
  );
}
