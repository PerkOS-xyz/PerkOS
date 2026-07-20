export type AgentHostingFlags = {
  managed?: boolean;
  selfHosted?: boolean;
  invited?: boolean;
};

/** User-visible agents may run on PerkOS ECS, the user's VPS, or by invite. */
export function isAllowedAgentHosting(agent: AgentHostingFlags): boolean {
  return agent.managed === true || agent.selfHosted === true || agent.invited === true;
}

export function hasFreshAgentHeartbeat(
  agent: { bridgeConnected?: boolean; lastBridgeSeenAt?: string | null },
  now = Date.now(),
): boolean {
  if (agent.bridgeConnected !== true || !agent.lastBridgeSeenAt) return false;
  const seen = Date.parse(agent.lastBridgeSeenAt);
  return !Number.isNaN(seen) && now - seen <= 90_000;
}
