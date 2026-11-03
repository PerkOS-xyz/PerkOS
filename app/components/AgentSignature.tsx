"use client";

import { useTranslation } from "react-i18next";
import type { RegisteredAgentAppearance } from "../lib/agentAvatarIdentity";
import { AgentOrb } from "./AgentOrb";

export function AgentSignature({ agent, size = 44, origin = false }: {
  agent: RegisteredAgentAppearance & { runtime?: string; external?: boolean; role?: string };
  size?: number;
  origin?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AgentOrb name={agent.name} agent={agent} size={size} />
      <div className="min-w-0 space-y-0.5">
        <p className="break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
          {agent.displayName || agent.name}
        </p>
        {agent.role && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{agent.role}</p>}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {origin && <span>{agent.external ? t("agents.card.external") : t("agentAppearance.perkos")}</span>}
          {agent.runtime && <span>{agent.runtime}</span>}
        </div>
      </div>
    </div>
  );
}
