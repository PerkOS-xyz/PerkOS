"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Agent, Project } from "../lib/perkosApi";
import type { AgentLiveStatus } from "../lib/useWalletAgents";
import { realtimeAgentStatus, STATUS_AVAILABLE } from "../lib/useWalletAgents";
import { AgentOrb } from "./AgentOrb";
import { ChatbotPanel } from "./ChatbotPanel";
import { OrganizationKnowledgeGraph } from "./ProjectContextMap";

const copy = (es: boolean) =>
  es
    ? {
        knowledge: "Conocimiento y equipo",
        agents: "Agentes del workspace",
        noAgents: "Todavía no hay agentes activos. Sparky puede ayudarte a formar el primer equipo.",
        create: "Crear el primer equipo",
      }
    : {
        knowledge: "Knowledge and team",
        agents: "Workspace agents",
        noAgents: "There are no active agents yet. Sparky can help assemble the first team.",
        create: "Create the first team",
      };

export function SparkyDashboardWorkspace({
  organizationName,
  ownerWallet,
  projects,
  agents,
  liveAgents,
}: {
  organizationName: string;
  ownerWallet?: string | null;
  projects: Project[];
  agents: Agent[];
  liveAgents: Record<string, AgentLiveStatus>;
}) {
  const { i18n } = useTranslation();
  const text = copy(i18n.language.startsWith("es"));
  return (
    <section className="flex min-w-0 flex-col gap-4 lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[minmax(300px,.78fr)_minmax(0,1.22fr)]" aria-label="Sparky and knowledge workspace">
      <ChatbotPanel embedded />

      <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
        <div className="rounded-xl border border-primary/25 bg-card/60 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" />{text.knowledge}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{text.agents}</p>
            </div>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">{agents.length}</span>
          </div>
          {agents.length > 0 ? (
            <ul className="flex gap-3 overflow-x-auto pb-1">
              {agents.slice(0, 10).map((agent) => {
                const live = realtimeAgentStatus(liveAgents[agent.name]);
                return (
                  <li key={agent.id} className="flex min-w-[70px] flex-col items-center gap-1 text-center">
                    <Link href={`/agents/${encodeURIComponent(agent.id)}`} aria-label={`${agent.name}: ${live.label}`}>
                      <AgentOrb
                        name={agent.name}
                        role={agent.name}
                        identitySeed={`agent:${agent.id || agent.name}`}
                        size={50}
                        status={live.label === STATUS_AVAILABLE ? "available" : "resting"}
                      />
                    </Link>
                    <span className="max-w-[78px] truncate text-[10px] font-medium text-foreground">{agent.name}</span>
                    <span className="text-[9px] text-muted-foreground">{live.label}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-3">
              <p className="max-w-xl text-xs text-muted-foreground">{text.noAgents}</p>
              <Link href="/projects/new" className="text-xs font-medium text-primary hover:underline">{text.create}</Link>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 lg:[&>section]:h-full">
          <OrganizationKnowledgeGraph
            organizationName={organizationName}
            ownerWallet={ownerWallet}
            projects={projects}
            agents={agents}
            compact
          />
        </div>
      </div>
    </section>
  );
}
