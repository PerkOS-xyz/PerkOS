import {
  realtimeAgentStatus,
  STATUS_AVAILABLE,
  STATUS_GETTING_READY,
  STATUS_GOING_TO_REST,
  STATUS_RESTING,
  STATUS_RUNTIME_UNAVAILABLE,
  STATUS_RUNTIME_UNVERIFIED,
  type AgentLiveStatus,
} from "./useWalletAgents";

export type ChatAgentOperationalState =
  | "online"
  | "sleeping"
  | "waking"
  | "unavailable"
  | "checking";

export function findConversationAgent(
  byName: Record<string, AgentLiveStatus>,
  historyHost?: string | null,
  participants: string[] = [],
): AgentLiveStatus | undefined {
  const host = historyHost?.replace(/^agent:/i, "");
  const participant = participants.find((value) => /^agent:/i.test(value))?.replace(/^agent:/i, "");
  const wanted = (host || participant || "").trim().toLowerCase();
  if (!wanted) return undefined;
  return Object.values(byName).find((agent) => agent.name.trim().toLowerCase() === wanted);
}

export function chatAgentOperationalState(agent?: AgentLiveStatus): ChatAgentOperationalState {
  if (!agent) return "checking";
  const status = realtimeAgentStatus(agent).label;
  if (status === STATUS_AVAILABLE) return "online";
  if (status === STATUS_RESTING || status === STATUS_GOING_TO_REST) return "sleeping";
  if (status === STATUS_GETTING_READY) return "waking";
  if (status === STATUS_RUNTIME_UNVERIFIED || status === "Unknown") return "checking";
  if (status === STATUS_RUNTIME_UNAVAILABLE || status === "Offline" || status === "Needs attention") return "unavailable";
  return "checking";
}

export const chatAgentStateLabel: Record<ChatAgentOperationalState, string> = {
  online: "Online",
  sleeping: "Sleeping",
  waking: "Waking",
  unavailable: "Unavailable",
  checking: "Checking status",
};
