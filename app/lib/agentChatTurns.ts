export type ChatProgressPhase = "accepted" | "running" | "recovering" | "completed" | "uncertain";
export type AgentChatProgress = { from: string; replyTo: string | null; state: "start" | "stop"; phase?: ChatProgressPhase };
export type PendingChatTurn = { id: string; sentAt: number; updatedAt: number; phase: ChatProgressPhase; slow?: boolean };
export type ChatTurnsState = { pending: PendingChatTurn[]; completed: string[] };
export const emptyChatTurns: ChatTurnsState = { pending: [], completed: [] };

export function applyChatProgress(state: ChatTurnsState, progress: AgentChatProgress, now: number): ChatTurnsState {
  if (!progress.from.startsWith("agent:") || !progress.replyTo || state.completed.includes(progress.replyTo)) return state;
  const existing = state.pending.find((turn) => turn.id === progress.replyTo);
  // A completion notification is not the final bubble. Keep reconciling until it arrives.
  const phase = progress.phase === "completed" ? "recovering" : progress.phase ?? (progress.state === "start" ? "running" : "recovering");
  return { ...state, pending: [
    ...state.pending.filter((turn) => turn.id !== progress.replyTo),
    { ...existing, id: progress.replyTo, sentAt: existing?.sentAt ?? now, updatedAt: now, phase },
  ] };
}

export function completeChatTurn(state: ChatTurnsState, message: {
  from: string; replyTo?: string | null; timestamp: string; event?: { domain?: string } | null;
}): ChatTurnsState {
  if (!message.from.startsWith("agent:") || message.event?.domain === "voice" || message.event?.domain === "voice_session") return state;
  // Older plugins lack replyTo. Only resolve an unambiguous pending turn; don't
  // let old history or an unrelated voice message clear a newer request.
  const id = message.replyTo ?? (state.pending.length === 1 && Date.parse(message.timestamp) >= state.pending[0].sentAt
    ? state.pending[0].id : null);
  if (!id) return state;
  return { pending: state.pending.filter((turn) => turn.id !== id), completed: [...new Set([...state.completed, id])].slice(-500) };
}

export function mergeAgentChatBubbles<T extends { id: string; ts?: number }>(existing: T[], incoming: T[]): T[] {
  const byId = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, { ...byId.get(message.id), ...message });
  return [...byId.values()].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0) || a.id.localeCompare(b.id));
}
