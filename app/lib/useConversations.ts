"use client";

import { onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import {
  conversationsQuery,
  type Conversation,
  type ConversationsFilter,
} from "./conversationsApi";

type State = {
  conversations: Conversation[];
  loading: boolean;
  error: Error | null;
};

/**
 * Realtime subscription to the wallet's conversation list (the chat sidebar).
 *
 * Pass `null` / `undefined` for walletAddress to keep the subscription
 * dormant — useful during route transitions or before the user has signed in.
 *
 * The hook does **not** sort. Sort in the caller — typical orders:
 *
 *   conversations.sort((a, b) => {
 *     if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
 *     return (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "");
 *   });
 */
export function useConversations(
  walletAddress: string | null | undefined,
  filter?: ConversationsFilter,
): State {
  const [state, setState] = useState<State>({
    conversations: [],
    loading: !!walletAddress,
    error: null,
  });

  // Stable filter reference for the effect dependency list.
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        projectId: filter?.projectId ?? null,
        archived: filter?.archived ?? null,
      }),
    [filter?.projectId, filter?.archived],
  );

  useEffect(() => {
    if (!walletAddress) {
      setState({ conversations: [], loading: false, error: null });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    const q = conversationsQuery(walletAddress, filter);
    return onSnapshot(
      q,
      (snap) => {
        const conversations = snap.docs.map((d) => d.data());
        setState({ conversations, loading: false, error: null });
      },
      (error) => {
        setState({ conversations: [], loading: false, error });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, filterKey]);

  return state;
}
