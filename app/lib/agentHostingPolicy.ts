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

export type ExternalRuntimeAvailability =
  | "online"
  | "unavailable"
  | "unverified"
  | "offline";

/**
 * A live bridge proves transport connectivity, not execution readiness.
 * Runtime evidence is intentionally tri-state so legacy clients cannot be
 * silently promoted to healthy merely because they omitted the new field.
 */
export function externalRuntimeAvailability(
  agent: {
    bridgeConnected?: boolean;
    lastBridgeSeenAt?: string | null;
    runtimeStatus?: "healthy" | "unreachable" | "unknown" | null;
    runtimeHealthCheckedAt?: string | null;
  },
  now = Date.now(),
): ExternalRuntimeAvailability {
  if (!hasFreshAgentHeartbeat(agent, now)) return "offline";
  const checked = agent.runtimeHealthCheckedAt
    ? Date.parse(agent.runtimeHealthCheckedAt)
    : NaN;
  if (Number.isNaN(checked) || now - checked > 90_000) return "unverified";
  if (agent.runtimeStatus === "healthy") return "online";
  if (agent.runtimeStatus === "unreachable") return "unavailable";
  return "unverified";
}
