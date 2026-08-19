/**
 * Which org an agent belongs to on /agents.
 *
 * Owned agents sit in the caller's active org. Shared agents arrive through
 * `sharedVia` (the org name). The roster used to hide that, so you could not
 * tell which org the list belonged to.
 */
export type AgentOrgFilter = "all" | "org" | "shared";

export function agentMatchesOrgFilter(
  agent: { shared?: boolean; sharedVia?: string | null },
  orgName: string | undefined,
  filter: AgentOrgFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "shared") return Boolean(agent.shared);
  if (!agent.shared) return true;
  if (!orgName) return false;
  return (agent.sharedVia ?? "").trim().toLowerCase() === orgName.trim().toLowerCase();
}
