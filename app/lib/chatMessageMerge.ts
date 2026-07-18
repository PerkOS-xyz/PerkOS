import type { ChatMessage } from "./chatClient";

/**
 * Upsert a live frame without losing metadata when Chat emits the same
 * message id more than once (for example chat_message followed by the richer
 * chat_deliver frame carrying a workflow event).
 */
export function upsertLiveMessage(
  list: ChatMessage[],
  incoming: ChatMessage,
): ChatMessage[] {
  const index = list.findIndex((message) => message.id === incoming.id);
  if (index >= 0) {
    const current = list[index];
    const merged: ChatMessage = {
      ...current,
      ...incoming,
      replyTo: incoming.replyTo ?? current.replyTo,
      toolCalls: incoming.toolCalls ?? current.toolCalls,
      event: incoming.event ?? current.event,
    };
    const next = [...list];
    next[index] = merged;
    return next.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  if (list.length === 0) return [incoming];
  if (incoming.timestamp >= list[list.length - 1].timestamp) {
    return [...list, incoming];
  }
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].timestamp <= incoming.timestamp) lo = mid + 1;
    else hi = mid;
  }
  return [...list.slice(0, lo), incoming, ...list.slice(lo)];
}

/** Merge local accepted sends with host history without dropping either side. */
export function mergeChatHistory(
  cached: ChatMessage[],
  server: ChatMessage[],
): ChatMessage[] {
  return server.reduce(upsertLiveMessage, cached);
}
