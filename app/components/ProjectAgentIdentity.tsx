"use client";

/**
 * Registered agents keep their identity across workspaces. Project-scoped
 * identities remain a fallback for templates and historical/unknown agents.
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import {
  allocateTeamAvatarIdentities,
  deriveAgentAvatarIdentity,
  registeredAgentAvatar,
  type AgentAvatarIdentity,
  type RegisteredAgentAppearance,
} from "../lib/agentAvatarIdentity";
import { teamShortLabels } from "../lib/teamLabels";

const ProjectAgentLabelContext = createContext<ReadonlyMap<string, string> | null>(null);
const ProjectAgentIdentityContext = createContext<ReadonlyMap<string, AgentAvatarIdentity> | null>(null);
const RegisteredAgentContext = createContext<Readonly<Record<string, RegisteredAgentAppearance>> | null>(null);

export function RegisteredAgentIdentityProvider({ agents, children }: {
  agents: Readonly<Record<string, RegisteredAgentAppearance>>;
  children: ReactNode;
}) {
  return <RegisteredAgentContext.Provider value={agents}>{children}</RegisteredAgentContext.Provider>;
}

export function useRegisteredAgent(name: string): RegisteredAgentAppearance | undefined {
  const agents = useContext(RegisteredAgentContext);
  return agents && Object.hasOwn(agents, name) ? agents[name] : undefined;
}

export function ProjectAgentIdentityProvider({ names, agents, children }: {
  names: readonly string[];
  agents?: Readonly<Record<string, RegisteredAgentAppearance>>;
  children: ReactNode;
}) {
  const key = names.join("\n");
  // The roster key is the only input; the array itself is rebuilt each render.
  const team = useMemo(() => allocateTeamAvatarIdentities(key ? key.split("\n") : []), [key]);
  const labels = useMemo(() => teamShortLabels(key ? key.split("\n") : []), [key]);
  return (
    <ProjectAgentIdentityContext.Provider value={team}>
      <ProjectAgentLabelContext.Provider value={labels}>
        {agents ? <RegisteredAgentIdentityProvider agents={agents}>{children}</RegisteredAgentIdentityProvider> : children}
      </ProjectAgentLabelContext.Provider>
    </ProjectAgentIdentityContext.Provider>
  );
}

/** A teammate's short name inside the project ("Market Researcher"); the full name elsewhere. */
export function useAgentLabel(): (name: string) => string {
  const labels = useContext(ProjectAgentLabelContext);
  const agents = useContext(RegisteredAgentContext);
  return useCallback((name: string) => {
    const agent = agents && Object.hasOwn(agents, name) ? agents[name] : undefined;
    return agent?.displayName || labels?.get(name) || name;
  }, [agents, labels]);
}

/** The teammate's project identity, or null outside a project roster. */
export function useProjectAgentIdentity(name: string | null | undefined): AgentAvatarIdentity | null {
  const team = useContext(ProjectAgentIdentityContext);
  return (name && team?.get(name)) || null;
}

/** Color for a teammate's name and bubbles, matching its orb. */
export function useAgentHue(): (name: string, alpha?: number) => string {
  const team = useContext(ProjectAgentIdentityContext);
  const agents = useContext(RegisteredAgentContext);
  return useCallback((name: string, alpha = 1) => {
    const agent = agents && Object.hasOwn(agents, name) ? agents[name] : undefined;
    const { accentHue } = agent ? registeredAgentAvatar(agent).identity : team?.get(name) ?? deriveAgentAvatarIdentity(name);
    return `hsl(${accentHue} 80% 66% / ${alpha})`;
  }, [agents, team]);
}
