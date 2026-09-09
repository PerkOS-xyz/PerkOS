"use client";

import {
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";
import { useEffect, useState } from "react";

import { firebaseDb } from "./firebase";
import type { Task } from "./perkosApi";
import { taskConverter } from "./projectTaskConverter";

type State = {
  tasks: Task[];
  loaded: boolean;
  error: Error | null;
};

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
      ).withConverter(taskConverter)
    );

    return onSnapshot(
      ref,
      (snap) => {
        const tasks = snap.docs.map((d) => d.data());
        setState({ tasks, loaded: true, error: null });
      },
      (error) => {
        setState({ tasks: [], loaded: true, error });
      }
    );
  }, [walletAddress, projectId]);

  return state;
}
