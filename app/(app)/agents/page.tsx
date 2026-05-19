"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { Bot, Plus } from "lucide-react";
import { getWalletAgents, type Agent } from "../../lib/perkosApi";
import {
  SearchInput,
  matchesQuery,
} from "../../components/SearchInput";
import { EmptyState } from "../../components/EmptyState";

export default function AgentsPage() {
  const { address, isConnected } = useConnection();
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-agents", address],
    queryFn: () => getWalletAgents(address!),
    enabled: isConnected && Boolean(address),
  });

  const allAgents = data ?? [];
  const agents = allAgents.filter((a) =>
    matchesQuery(query, [a.name, a.runtime, a.status, ...a.plugins])
  );
  const hasAgents = allAgents.length > 0;
  const noResults = hasAgents && agents.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium text-[#ececff]">Agent team</h1>
          <p className="max-w-xl text-sm text-[#7975a8]">
            Connect your agents, assign them to projects, and put them to work.
          </p>
        </div>
        <Link
          href="/agents/new"
          className="flex items-center justify-center gap-2 rounded-md bg-[#ec1b69] px-5 py-2.5 text-sm font-medium text-[#ececff] transition-opacity hover:opacity-90"
        >
          <PlusIcon />
          Register agent
        </Link>
      </header>

      {hasAgents ? (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search agents by name, runtime, or capability…"
        />
      ) : null}

      {isLoading ? <SkeletonGrid /> : null}
      {error ? <ErrorBanner message={(error as Error).message} /> : null}

      {!isLoading && !error && agents.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </ul>
      ) : null}

      {!isLoading && !error && noResults ? (
        <p className="rounded-md border border-dashed border-[#1b1833] px-6 py-10 text-center text-sm text-[#7975a8]">
          No agents match &quot;{query}&quot;.
        </p>
      ) : null}

      {!isLoading && !error && !hasAgents ? <EmptyHint /> : null}
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <li>
      <Link
        href={`/agents/${encodeURIComponent(agent.id)}`}
        className="flex flex-col gap-3 rounded-md border border-[#1b1833] bg-[#0e0716] p-4 transition-colors hover:border-[#530922]"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ec1b69]/20 text-xs font-medium text-[#ec1b69]">
              {initials(agent.name)}
            </span>
            <div className="flex flex-col">
              <span className="text-sm text-[#ececff]">{agent.name}</span>
              <span className="text-xs text-[#7975a8]">{agent.runtime}</span>
            </div>
          </div>
          <StatusBadge status={agent.status} />
        </div>

        <p className="text-xs leading-relaxed text-[#7975a8]">
          {agent.plugins.length > 0
            ? `Capabilities: ${agent.plugins.join(", ")}`
            : "No capabilities configured yet."}
        </p>

        <div className="flex items-center justify-between text-xs text-[#7975a8]">
          <span>Projects: 0</span>
          <span>Capabilities: {agent.plugins.length}</span>
        </div>
      </Link>
    </li>
  );
}

function StatusBadge({ status }: { status: Agent["status"] }) {
  const tone =
    status === "ready"
      ? "bg-emerald-500/20 text-emerald-300"
      : status === "failed"
      ? "bg-[#ec1b69]/20 text-[#ec1b69]"
      : "bg-amber-500/20 text-amber-300";
  const label =
    status === "ready"
      ? "Online"
      : status === "failed"
      ? "Failed"
      : status === "provisioning"
      ? "Provisioning"
      : "Unknown";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

function EmptyHint() {
  return (
    <EmptyState
      icon={Bot}
      title="No agents yet"
      description="Launch a Hermes or OpenClaw agent and assign it to your projects."
      actions={[
        {
          label: "Launch agent",
          href: "/agents/new",
          icon: Plus,
        },
      ]}
    />
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-md border border-[#1b1833] bg-[#0e0716]"
        />
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-[#ec1b69]/40 bg-[#ec1b69]/10 px-4 py-3 text-sm text-[#ec1b69]">
      {message}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 3.333v9.334M3.333 8h9.334"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
