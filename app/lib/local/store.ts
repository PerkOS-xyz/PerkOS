import { randomUUID } from "crypto";

import type {
  LocalConversation,
  LocalMessage,
  LocalVertical,
  OfferedSlot,
} from "./types";

/**
 * In-memory store for the WhatsApp pilot.
 * Replace with Postgres / platform API before multi-tenant production.
 */

type VerticalState = {
  conversations: Map<string, LocalConversation>;
  offeredByConversation: Map<string, OfferedSlot[]>;
};

const state: Record<LocalVertical, VerticalState> = {
  barbershop: { conversations: new Map(), offeredByConversation: new Map() },
  restaurant: { conversations: new Map(), offeredByConversation: new Map() },
};

function conversationKey(waId: string): string {
  return waId;
}

export function getOrCreateConversation(args: {
  vertical: LocalVertical;
  waId: string;
  profileName?: string;
}): LocalConversation {
  const bucket = state[args.vertical];
  const key = conversationKey(args.waId);
  const existing = bucket.conversations.get(key);
  if (existing) return existing;

  const created: LocalConversation = {
    id: randomUUID(),
    vertical: args.vertical,
    contact: { waId: args.waId, profileName: args.profileName },
    status: "bot",
    stage: "new",
    messages: [],
    updatedAt: new Date().toISOString(),
  };
  bucket.conversations.set(key, created);
  return created;
}

export function appendMessage(
  vertical: LocalVertical,
  waId: string,
  message: Omit<LocalMessage, "id" | "createdAt"> & { id?: string; createdAt?: string },
): LocalConversation {
  const conv = getOrCreateConversation({ vertical, waId });
  const full: LocalMessage = {
    id: message.id ?? randomUUID(),
    createdAt: message.createdAt ?? new Date().toISOString(),
    direction: message.direction,
    body: message.body,
    fromAi: message.fromAi,
  };
  conv.messages.push(full);
  conv.updatedAt = full.createdAt;
  state[vertical].conversations.set(conversationKey(waId), conv);
  return conv;
}

export function setOfferedSlots(
  vertical: LocalVertical,
  waId: string,
  slots: OfferedSlot[],
): void {
  state[vertical].offeredByConversation.set(conversationKey(waId), slots);
}

export function getOfferedSlots(vertical: LocalVertical, waId: string): OfferedSlot[] {
  return state[vertical].offeredByConversation.get(conversationKey(waId)) ?? [];
}

export function setConversationStatus(
  vertical: LocalVertical,
  waId: string,
  status: LocalConversation["status"],
): void {
  const conv = getOrCreateConversation({ vertical, waId });
  conv.status = status;
  conv.updatedAt = new Date().toISOString();
}

export function listConversations(vertical?: LocalVertical): LocalConversation[] {
  const verticals: LocalVertical[] = vertical
    ? [vertical]
    : ["barbershop", "restaurant"];
  const all: LocalConversation[] = [];
  for (const v of verticals) {
    all.push(...state[v].conversations.values());
  }
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Test helper */
export function __resetLocalStoreForTests(): void {
  for (const v of ["barbershop", "restaurant"] as LocalVertical[]) {
    state[v].conversations.clear();
    state[v].offeredByConversation.clear();
  }
}
