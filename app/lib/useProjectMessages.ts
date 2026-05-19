"use client";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";

import { firebaseDb } from "./firebase";
import type { ChatMessage } from "./perkosApi";

type State = {
  messages: ChatMessage[];
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

/**
 * Realtime subscription to a project's chat messages. The hook returns an
 * always-current ordered list — no manual refetch needed when someone (you
 * or an agent) appends a new message.
 *
 * Pass `null` / `undefined` for walletAddress or projectId to keep the
 * subscription dormant (useful during route transitions).
 */
export function useProjectMessages(
  walletAddress: string | null | undefined,
  projectId: string | null | undefined
): State {
  const [state, setState] = useState<State>({
    messages: [],
    loading: Boolean(walletAddress && projectId),
    error: null,
  });

  useEffect(() => {
    if (!walletAddress || !projectId) {
      setState({ messages: [], loading: false, error: null });
      return;
    }

    const ref = query(
      collection(
        firebaseDb(),
        "wallets",
        walletAddress.toLowerCase(),
        "projects",
        projectId,
        "messages"
      ),
      orderBy("createdAt", "asc")
    );

    setState((s) => ({ ...s, loading: true, error: null }));

    return onSnapshot(
      ref,
      (snap) => {
        const messages: ChatMessage[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            from: (data.from as ChatMessage["from"]) ?? "user",
            text: (data.text as string) ?? "",
            agentName: (data.agentName as string | undefined) ?? undefined,
            createdAt: tsToIso(data.createdAt),
          };
        });
        setState({ messages, loading: false, error: null });
      },
      (error) => {
        setState({ messages: [], loading: false, error });
      }
    );
  }, [walletAddress, projectId]);

  return state;
}
