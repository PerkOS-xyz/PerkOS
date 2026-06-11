"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import {
  useWalletAgents,
  realtimeAgentStatus,
  STATUS_AVAILABLE,
  type AgentLiveStatus,
} from "../../lib/useWalletAgents";
import { ArrowRight, Bot, Folder, Plus, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  getWalletAgents,
  getWalletProjects,
  type Agent,
  type Project,
} from "../../lib/perkosApi";
import { AgentOrb } from "../../components/AgentOrb";
import { useChatbot } from "../../components/ChatbotProvider";
import { formatRelativeShort } from "../../lib/format";
import {
  SearchInput,
  matchesQuery,
} from "../../components/SearchInput";

function initials(name: string): string {
  return name
    .split(/\s+|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function ChatHubPage() {
  const { address } = useConnection();
  const { setOpen } = useChatbot();
  const [query, setQuery] = useState("");
  // Realtime per-agent status (live hibernation + heartbeat), keyed by name.
  const { byName: liveAgents } = useWalletAgents(address);

  const agentsQuery = useQuery({
    queryKey: ["wallet-agents", address],
    queryFn: () => getWalletAgents(address!),
    enabled: Boolean(address),
  });

  const projectsQuery = useQuery({
    queryKey: ["wallet-projects", address],
    queryFn: () => getWalletProjects(address!),
    enabled: Boolean(address),
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

  // The chat layout cancels the (app) layout's px-5/md:px-8 with negative
  // margins so the sidebar can touch the left edge. Conversation pages
  // need that to render edge-to-edge, but this landing page (cards over
  // a wide pane) does not — restore matching padding + cap with a
  // max-width so the content reads at the same scale as Dashboard /
  // Projects / Tasks instead of stretching to the right edge of the
  // viewport.
  return (
    <div className="h-full overflow-y-auto p-5 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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

      {/* Project channels first — the seed project always exists on first
          load, so this row immediately reduces the "nothing here" feeling
          before the always-empty agents section. */}
      <Section
        title="Project channels"
        description="Group chat with the humans and agents assigned to each project."
        actionHref="/projects/new"
        actionLabel="Create project"
      >
        {projectsQuery.isLoading ? (
          <SkeletonList rows={2} />
        ) : projects.length === 0 ? (
          <InlineEmptyRow
            href="/projects/new"
            label="Create your first project channel to chat with assigned agents"
          />
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {projects.map((p) => (
              <ProjectChannelRow key={p.id ?? p.name} project={p} />
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Your agents"
        description="One-on-one chat with each agent you've registered."
        actionHref="/agents/new"
        actionLabel="Register agent"
      >
        {agentsQuery.isLoading ? (
          <SkeletonList rows={2} />
        ) : agents.length === 0 ? (
          <InlineEmptyRow
            href="/agents/new"
            label="Register your first agent to start a 1-on-1 conversation"
          />
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {agents.map((a) => (
              <AgentChatRow key={a.id} agent={a} live={liveAgents[a.name]} />
            ))}
          </ul>
        )}
      </Section>
      </div>
    </div>
  );
}

/**
 * Single-row inline empty state for in-page sections — keeps the same
 * visual weight as a populated row instead of stamping a full-page
 * EmptyState (with its py-12 + icon + headline + description) into a
 * sub-section, which leaves a giant void on first load.
 */
function InlineEmptyRow({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md border border-dashed border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Plus className="h-4 w-4" />
      </div>
      <span className="flex-1">{label}</span>
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
    </Link>
  );
}

function PerkOSAgentRow({ onOpen }: { onOpen: () => void }) {
  // Single-row banner that matches AgentChatRow + ProjectChannelRow height
  // so the chat landing page reads as a uniform list of entities you can
  // talk to — instead of one big featured Card sitting above two
  // smaller sections. The floating ChatbotTrigger is iconic-only, so we
  // keep this row as the place that names + explains the assistant.
  return (
    <button
      type="button"
      onClick={onOpen}
      className="glow-card flex w-full items-center gap-3 rounded-md border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 py-3 text-left transition-colors hover:border-primary/50"
    >
      <div className="relative shrink-0">
        <AgentOrb name="PerkOS Assistant" presetId="assistant" size={40} />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-card"
          aria-hidden
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          PerkOS Agent
        </span>
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          Your guide — ask about the platform, navigate flows, spin up
          projects or agents from one conversation.
        </span>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
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
        <div className="flex min-w-0 flex-col">
          <h2 className="text-base font-medium text-foreground">{title}</h2>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {description}
          </p>
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

function AgentChatRow({
  agent,
  live,
}: {
  agent: Agent;
  live?: AgentLiveStatus;
}) {
  const { color: presence, label: presenceLabel } = realtimeAgentStatus(live);

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
          <span className="text-xs text-muted-foreground">
            {agent.runtime}
            <span className="px-1.5">·</span>
            <span
              className={
                presenceLabel === STATUS_AVAILABLE ? "text-emerald-400" : undefined
              }
            >
              {presenceLabel}
            </span>
            {presenceLabel !== STATUS_AVAILABLE && live?.lastBridgeSeenMs ? (
              <span className="text-muted-foreground/70">
                {" "}
                — seen {formatRelativeShort(new Date(live.lastBridgeSeenMs))}
              </span>
            ) : null}
          </span>
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
