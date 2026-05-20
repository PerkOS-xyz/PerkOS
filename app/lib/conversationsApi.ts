/**
 * Conversations data layer (C-hybrid privacy model).
 *
 * Firestore stores conversation **metadata only**:
 *
 *   /wallets/{walletAddress}/conversations/{convId}
 *
 * Conversation message bodies live exclusively on the host agent's
 * filesystem (`~/.perkos/conversations/{convId}/messages.jsonl`). The
 * MiniApp's UI subscribes to this collection for the sidebar and the
 * conversation header, and gets bodies live over a WebSocket to
 * `chat.perkos.xyz` (cached client-side in IndexedDB).
 *
 * Companion repos:
 *   - github.com/PerkOS-xyz/PerkOS-Chat  (the WS coordination server)
 *   - github.com/PerkOS-xyz/PerkOS-A2A   (the agent-side ChatClient)
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type FirestoreDataConverter,
  type Query,
  type QueryConstraint,
  type Timestamp,
} from "firebase/firestore";

import { firebaseDb } from "./firebase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Identity strings as they appear in the chat wire protocol and in the
 * `participants` / `historyHost` fields of a conversation document.
 */
export type ConvIdentity = `user:${string}` | `agent:${string}`;

export type ConvKind = "dm" | "channel";

export type Conversation = {
  id: string;
  /** Editable display title. Manually set by the user, or auto-generated. */
  title: string;
  kind: ConvKind;
  /** All identities that can read/write this conversation. */
  participants: ConvIdentity[];
  /** Which agent owns the canonical jsonl log. Must be in `participants`. */
  historyHost: ConvIdentity;
  /** Optional reference to a project this conv belongs to. */
  projectId?: string;
  /** Set by chat.perkos.xyz when a message is routed in this conv. */
  lastMessageAt?: string;
  pinned: boolean;
  archived: boolean;
  createdAt?: string;
  updatedAt?: string;
};

// ---------------------------------------------------------------------------
// Firestore converter
// ---------------------------------------------------------------------------

function tsToIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }
  return undefined;
}

const conversationConverter: FirestoreDataConverter<Conversation> = {
  toFirestore(c) {
    const out: Record<string, unknown> = {
      title: c.title,
      kind: c.kind,
      participants: c.participants,
      historyHost: c.historyHost,
      pinned: !!c.pinned,
      archived: !!c.archived,
    };
    if (c.projectId !== undefined) out.projectId = c.projectId;
    return out;
  },
  fromFirestore(snap) {
    const data = snap.data();
    return {
      id: snap.id,
      title: (data.title as string) ?? "",
      kind: (data.kind as ConvKind) ?? "dm",
      participants: (data.participants as ConvIdentity[]) ?? [],
      historyHost: (data.historyHost as ConvIdentity) ?? ("agent:unknown" as ConvIdentity),
      projectId: (data.projectId as string | undefined) ?? undefined,
      lastMessageAt: tsToIso(data.lastMessageAt),
      pinned: !!data.pinned,
      archived: !!data.archived,
      createdAt: tsToIso(data.createdAt),
      updatedAt: tsToIso(data.updatedAt),
    };
  },
};

// ---------------------------------------------------------------------------
// Collection helpers
// ---------------------------------------------------------------------------

function conversationsCol(walletAddress: string) {
  return collection(
    firebaseDb(),
    "wallets",
    walletAddress.toLowerCase(),
    "conversations",
  ).withConverter(conversationConverter);
}

function conversationDoc(walletAddress: string, convId: string) {
  return doc(
    firebaseDb(),
    "wallets",
    walletAddress.toLowerCase(),
    "conversations",
    convId,
  ).withConverter(conversationConverter);
}

// ---------------------------------------------------------------------------
// Identity helpers
// ---------------------------------------------------------------------------

export function userIdentity(walletAddress: string): ConvIdentity {
  return `user:${walletAddress.toLowerCase()}` as ConvIdentity;
}

export function agentIdentity(agentName: string): ConvIdentity {
  return `agent:${agentName}` as ConvIdentity;
}

export function isUserIdentity(identity: ConvIdentity): boolean {
  return identity.startsWith("user:");
}

export function isAgentIdentity(identity: ConvIdentity): boolean {
  return identity.startsWith("agent:");
}

/**
 * For a DM, the "other" identity (the one that isn't the current user).
 * Returns null if this isn't a 1:1 conversation.
 */
export function dmCounterparty(
  conv: Conversation,
  walletAddress: string,
): ConvIdentity | null {
  if (conv.kind !== "dm") return null;
  const me = userIdentity(walletAddress);
  return conv.participants.find((p) => p !== me) ?? null;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export type CreateConversationInput = {
  walletAddress: string;
  title?: string;
  kind: ConvKind;
  /**
   * Other participants — the current user is added automatically. Pass at
   * least one agent identity.
   */
  participants: ConvIdentity[];
  /**
   * Which agent stores canonical history. Defaults to the first agent in
   * `participants`.
   */
  historyHost?: ConvIdentity;
  projectId?: string;
};

export async function createConversation(input: CreateConversationInput): Promise<Conversation> {
  const me = userIdentity(input.walletAddress);
  const others = input.participants.filter((p) => p !== me);
  const allParticipants = [me, ...others];

  const host =
    input.historyHost ??
    others.find(isAgentIdentity) ??
    null;
  if (!host) {
    throw new Error("createConversation: at least one agent participant is required");
  }

  const title =
    input.title?.trim() ||
    defaultTitleForConversation({ kind: input.kind, others });

  const payload = {
    title,
    kind: input.kind,
    participants: allParticipants,
    historyHost: host,
    pinned: false,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(input.projectId ? { projectId: input.projectId } : {}),
  };

  const ref = await addDoc(
    conversationsCol(input.walletAddress),
    payload as unknown as Conversation,
  );

  return {
    id: ref.id,
    title,
    kind: input.kind,
    participants: allParticipants,
    historyHost: host,
    pinned: false,
    archived: false,
    projectId: input.projectId,
  };
}

export async function getConversation(
  walletAddress: string,
  convId: string,
): Promise<Conversation | null> {
  const snap = await getDoc(conversationDoc(walletAddress, convId));
  return snap.exists() ? snap.data() : null;
}

export type UpdateConversationInput = {
  walletAddress: string;
  convId: string;
  title?: string;
  pinned?: boolean;
  archived?: boolean;
  historyHost?: ConvIdentity;
};

export async function updateConversation(input: UpdateConversationInput): Promise<void> {
  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (typeof input.title === "string") patch.title = input.title.trim();
  if (typeof input.pinned === "boolean") patch.pinned = input.pinned;
  if (typeof input.archived === "boolean") patch.archived = input.archived;
  if (input.historyHost) patch.historyHost = input.historyHost;

  await updateDoc(conversationDoc(input.walletAddress, input.convId), patch);
}

export async function deleteConversation(
  walletAddress: string,
  convId: string,
): Promise<void> {
  await deleteDoc(conversationDoc(walletAddress, convId));
}

// ---------------------------------------------------------------------------
// Queries (consumed by useConversations hook)
// ---------------------------------------------------------------------------

export type ConversationsFilter = {
  projectId?: string;
  archived?: boolean;
};

/**
 * Build a Firestore query for the wallet's conversations with optional
 * filters. The query is intended to be passed into `onSnapshot` for realtime
 * sidebar updates.
 */
export function conversationsQuery(
  walletAddress: string,
  filter?: ConversationsFilter,
): Query<Conversation> {
  const base = conversationsCol(walletAddress);
  const constraints: QueryConstraint[] = [];
  if (filter?.projectId) constraints.push(where("projectId", "==", filter.projectId));
  if (typeof filter?.archived === "boolean") {
    constraints.push(where("archived", "==", filter.archived));
  }
  return constraints.length === 0 ? base : query(base, ...constraints);
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultTitleForConversation(opts: {
  kind: ConvKind;
  others: ConvIdentity[];
}): string {
  if (opts.kind === "dm") {
    const agent = opts.others.find(isAgentIdentity);
    if (agent) return agent.slice("agent:".length);
    return "New conversation";
  }
  const agents = opts.others.filter(isAgentIdentity).map((a) => a.slice("agent:".length));
  if (agents.length === 0) return "New channel";
  if (agents.length === 1) return agents[0];
  if (agents.length === 2) return `${agents[0]} + ${agents[1]}`;
  return `${agents[0]} + ${agents.length - 1} more`;
}
