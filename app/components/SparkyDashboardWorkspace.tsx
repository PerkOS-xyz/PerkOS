"use client";

import Link from "next/link";
import { ArrowUpRight, MessageCircle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Agent, Project } from "../lib/perkosApi";
import type { AgentLiveStatus } from "../lib/useWalletAgents";
import { realtimeAgentStatus, STATUS_AVAILABLE } from "../lib/useWalletAgents";
import { AgentOrb } from "./AgentOrb";
import { useChatbot } from "./ChatbotProvider";
import { OrganizationKnowledgeGraph } from "./ProjectContextMap";

const copy = (es: boolean) =>
  es
    ? {
        ready: "Sparky está listo",
        intro: "Cuéntame qué resultado necesitas. Convertiré la conversación en contexto organizado para tu equipo.",
        empty: "Tu conversación con Sparky comenzará aquí.",
        open: "Escribirle a Sparky",
        knowledge: "Conocimiento y equipo",
        agents: "Agentes del workspace",
        noAgents: "Todavía no hay agentes activos. Sparky puede ayudarte a formar el primer equipo.",
        create: "Crear el primer equipo",
      }
    : {
        ready: "Sparky is ready",
        intro: "Tell me the outcome you need. I’ll turn the conversation into organized context for your team.",
        empty: "Your conversation with Sparky will begin here.",
        open: "Message Sparky",
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
  const chat = useChatbot();
  const visibleMessages = chat.messages.slice(-4);
  return (
    <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.55fr)]" aria-label="Sparky and knowledge workspace">
      <article className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-xl border border-primary/30 bg-[radial-gradient(circle_at_top,rgba(236,27,105,.14),transparent_45%),rgba(14,7,22,.76)] shadow-[0_0_32px_-24px_rgba(236,27,105,.95)]">
        <header className="flex items-center gap-3 border-b border-border/70 p-4">
          <div className="relative">
            <AgentOrb name="Sparky" presetId="assistant" identitySeed="perkos:sparky:v1" size={58} status="available" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground">Sparky</h1>
            <p className="text-xs text-emerald-300">{text.ready}</p>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
          <div className="rounded-2xl rounded-tl-sm border border-primary/20 bg-primary/[0.07] p-3 text-sm leading-relaxed text-foreground">
            {text.intro}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" aria-live="polite">
            {visibleMessages.length === 0 ? (
              <p className="m-auto max-w-[220px] text-center text-xs leading-relaxed text-muted-foreground">
                {text.empty}
              </p>
            ) : (
              visibleMessages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    message.role === "user"
                      ? "ml-auto rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm border border-border bg-card text-foreground"
                  }`}
                >
                  {message.text}
                </div>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => chat.setOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-primary/35 bg-background/70 px-3 py-3 text-left text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
          >
            <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" />{text.open}</span>
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </article>

      <div className="flex min-w-0 flex-col gap-3">
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
        <OrganizationKnowledgeGraph
          organizationName={organizationName}
          ownerWallet={ownerWallet}
          projects={projects}
          agents={agents}
        />
      </div>
    </section>
  );
}
