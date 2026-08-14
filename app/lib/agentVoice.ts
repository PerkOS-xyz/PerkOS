export type AgentVoiceState =
  | "unavailable"
  | "checking"
  | "connecting"
  | "ready"
  | "in-call"
  | "reconnecting"
  | "failed"
  | "ended";

/**
 * Deliberately narrow, allow-listed shape for a future platform capability
 * response. Do not infer voice readiness from chat, bridge, or runtime state.
 */
export type AgentVoiceCapability = {
  available: boolean;
  status: "pending" | "ready" | "unavailable";
  reason?: "gateway_pending" | "provider_pending" | "not_supported";
};

export function resolveAgentVoiceState(
  capability?: AgentVoiceCapability | null,
): AgentVoiceState {
  if (!capability) return "unavailable";
  if (capability.status === "pending") return "checking";
  if (capability.available && capability.status === "ready") return "ready";
  return "unavailable";
}

export function canStartAgentVoiceCall(state: AgentVoiceState): boolean {
  return state === "ready" || state === "ended" || state === "failed";
}

export const AGENT_VOICE_STATE_LABELS: Record<AgentVoiceState, string> = {
  unavailable: "Voice unavailable",
  checking: "Checking voice availability",
  connecting: "Connecting voice call",
  ready: "Ready for voice",
  "in-call": "Voice call in progress",
  reconnecting: "Reconnecting voice call",
  failed: "Voice call failed",
  ended: "Voice call ended",
};
