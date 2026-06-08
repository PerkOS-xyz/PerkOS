"use client";

import {
  collection,
  onSnapshot,
  query,
  type Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";

import { firebaseDb } from "./firebase";
import type { Task } from "./perkosApi";

type State = {
  tasks: Task[];
  loaded: boolean;
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
 * Realtime subscription to a project's tasks subcollection. Returns an
 * always-current task list so the board + the In progress/Done counters move
 * on their own as the PM/dispatcher/workers update Firestore — no manual
 * refresh. Mirrors `useProjectMessages` (the chat layer's live hook); the
 * Firestore `onSnapshot` here is the PerkOS-native equivalent of Hermes'
 * `/events` WebSocket task-board stream.
 *
 * Pass `null`/`undefined` for either arg to keep the subscription dormant.
 */
export function useProjectTasks(
  walletAddress: string | null | undefined,
  projectId: string | null | undefined
): State {
  const [state, setState] = useState<State>({
    tasks: [],
    loaded: false,
    error: null,
  });

  useEffect(() => {
    if (!walletAddress || !projectId) {
      setState({ tasks: [], loaded: false, error: null });
      return;
    }

    const ref = query(
      collection(
        firebaseDb(),
        "wallets",
        walletAddress.toLowerCase(),
        "projects",
        projectId,
        "tasks"
      )
    );

    return onSnapshot(
      ref,
      (snap) => {
        const tasks: Task[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: (data.name as string) ?? "",
            status: (data.status as Task["status"]) ?? "Backlog",
            priority: (data.priority as Task["priority"]) ?? "Medium",
            agent: (data.agent as string) ?? "",
            agentId: (data.agentId as string | undefined) ?? undefined,
            prompt: (data.prompt as string | undefined) ?? undefined,
            result: (data.result as string | undefined) ?? undefined,
            createdAt: tsToIso(data.createdAt),
            updatedAt: tsToIso(data.updatedAt),
          };
        });
        setState({ tasks, loaded: true, error: null });
      },
      (error) => {
        setState({ tasks: [], loaded: true, error });
      }
    );
  }, [walletAddress, projectId]);

  return state;
}
