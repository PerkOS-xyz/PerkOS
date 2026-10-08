"use client";

/**
 * Inside a project, every teammate gets its own avatar and color, so six
 * agents never read as two. Components under the provider pick the project
 * identity by agent name; outside a project they keep the default identity.
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import {
  allocateTeamAvatarIdentities,
  deriveAgentAvatarIdentity,
  type AgentAvatarIdentity,
} from "../lib/agentAvatarIdentity";
import { teamShortLabels } from "../lib/teamLabels";

const ProjectAgentLabelContext = createContext<ReadonlyMap<string, string> | null>(null);
const ProjectAgentIdentityContext = createContext<ReadonlyMap<string, AgentAvatarIdentity> | null>(null);

export function ProjectAgentIdentityProvider({ names, children }: { names: readonly string[]; children: ReactNode }) {
  const key = names.join("\n");
  // The roster key is the only input; the array itself is rebuilt each render.
  const team = useMemo(() => allocateTeamAvatarIdentities(key ? key.split("\n") : []), [key]);
  const labels = useMemo(() => teamShortLabels(key ? key.split("\n") : []), [key]);
  return (
    <ProjectAgentIdentityContext.Provider value={team}>
      <ProjectAgentLabelContext.Provider value={labels}>{children}</ProjectAgentLabelContext.Provider>
    </ProjectAgentIdentityContext.Provider>
  );
}

/** A teammate's short name inside the project ("Market Researcher"); the full name elsewhere. */
export function useAgentLabel(): (name: string) => string {
  const labels = useContext(ProjectAgentLabelContext);
  return useCallback((name: string) => labels?.get(name) ?? name, [labels]);
}

/** The teammate's project identity, or null outside a project roster. */
export function useProjectAgentIdentity(name: string | null | undefined): AgentAvatarIdentity | null {
  const team = useContext(ProjectAgentIdentityContext);
  return (name && team?.get(name)) || null;
}

/** Color for a teammate's name and bubbles, matching its orb. */
export function useAgentHue(): (name: string, alpha?: number) => string {
  const team = useContext(ProjectAgentIdentityContext);
  return useCallback((name: string, alpha = 1) => {
    const { accentHue } = team?.get(name) ?? deriveAgentAvatarIdentity(name);
    return `hsl(${accentHue} 80% 66% / ${alpha})`;
  }, [team]);
}
