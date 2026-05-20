"use client";

import { doc, onSnapshot, type FirestoreDataConverter, type Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";

import { firebaseDb } from "./firebase";
import type { Conversation, ConvIdentity, ConvKind } from "./conversationsApi";

type State = {
  conversation: Conversation | null;
  loading: boolean;
  error: Error | null;
};

function tsToIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }
  return undefined;
}

// Inline converter so this hook stays decoupled from conversationsApi internals.
const converter: FirestoreDataConverter<Conversation> = {
  toFirestore: () => ({}),
  fromFirestore(snap) {
    const data = snap.data();
    return {
      id: snap.id,
      title: (data.title as string) ?? "",
      kind: (data.kind as ConvKind) ?? "dm",
      participants: (data.participants as ConvIdentity[]) ?? [],
      historyHost:
        (data.historyHost as ConvIdentity) ?? ("agent:unknown" as ConvIdentity),
      projectId: (data.projectId as string | undefined) ?? undefined,
      lastMessageAt: tsToIso(data.lastMessageAt),
      pinned: !!data.pinned,
      archived: !!data.archived,
      createdAt: tsToIso(data.createdAt),
      updatedAt: tsToIso(data.updatedAt),
    };
  },
};

/**
 * Realtime subscription to one conversation's metadata. Returns the current
 * doc plus loading/error.
 *
 * Body content (messages) lives on the host agent, not here. To read history,
 * call the WebSocket `history` frame on `chat.perkos.xyz`.
 */
export function useConversation(
  walletAddress: string | null | undefined,
  convId: string | null | undefined,
): State {
  const [state, setState] = useState<State>({
    conversation: null,
    loading: !!(walletAddress && convId),
    error: null,
  });

  useEffect(() => {
    if (!walletAddress || !convId) {
      setState({ conversation: null, loading: false, error: null });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    const ref = doc(
      firebaseDb(),
      "wallets",
      walletAddress.toLowerCase(),
      "conversations",
      convId,
    ).withConverter(converter);

    return onSnapshot(
      ref,
      (snap) => {
        setState({
          conversation: snap.exists() ? snap.data() : null,
          loading: false,
          error: null,
        });
      },
      (error) => {
        setState({ conversation: null, loading: false, error });
      },
    );
  }, [walletAddress, convId]);

  return state;
}
