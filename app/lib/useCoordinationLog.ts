"use client";

import { normalizeWalletAddress } from "@perkos/shared-types";
import {
  collection,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useState } from "react";

import type { ChatIdentity } from "./chatClient";
import { firebaseDb } from "./firebase";

export type CoordinationKind = "goal" | "assignment" | "reply" | "result" | "system";

/** A coordination log entry shaped like a chat message so one thread shows both. */
export type CoordinationMessage = {
  id: string;
  convId: string;
  from: ChatIdentity;
  text: string;
  timestamp: string;
  coordination: {
    kind: CoordinationKind;
    to: string;
    taskId?: string;
    ok?: boolean;
  };
};

const KINDS = new Set<CoordinationKind>(["goal", "assignment", "reply", "result", "system"]);
const LIMIT = 300;

function identity(value: unknown): ChatIdentity {
  const raw = typeof value === "string" ? value : "";
  if (raw.startsWith("agent:") || raw.startsWith("user:") || raw.startsWith("service:")) {
    return raw as ChatIdentity;
  }
  // "sparky" and "system" are PerkOS coordination voices.
  return `service:${raw || "system"}`;
}

export function toCoordinationMessage(
  id: string,
  projectId: string,
  data: DocumentData,
): CoordinationMessage | null {
  const kind = data.kind as CoordinationKind;
  if (!KINDS.has(kind) || typeof data.text !== "string" || !data.text.trim()) return null;
  const ts = data.ts as { toDate?: () => Date } | null | undefined;
  const date = ts && typeof ts.toDate === "function" ? ts.toDate() : new Date();
  return {
    id: `coordination:${id}`,
    convId: `project-${projectId}`,
    from: identity(data.from),
    text: data.text,
    timestamp: date.toISOString(),
    coordination: {
      kind,
      to: typeof data.to === "string" ? data.to : "",
      ...(typeof data.taskId === "string" ? { taskId: data.taskId } : {}),
      ...(typeof data.ok === "boolean" ? { ok: data.ok } : {}),
    },
  };
}

type State = { key: string | null; messages: CoordinationMessage[]; loaded: boolean };

/**
 * Live coordination log of a project: Sparky handing the goal to the lead,
 * task assignments, teammates' results and short system notes. Written by the
 * PerkOS API under the project owner's wallet.
 */
export function useCoordinationLog(
  ownerWallet: string | null | undefined,
  projectId: string | null | undefined,
): { messages: CoordinationMessage[]; loaded: boolean } {
  const wallet = ownerWallet ? normalizeWalletAddress(ownerWallet) : null;
  const key = wallet && projectId ? `${wallet}/${projectId}` : null;
  const [state, setState] = useState<State>({ key: null, messages: [], loaded: false });

  useEffect(() => {
    if (!wallet || !projectId || !key) return;
    const ref = query(
      collection(firebaseDb(), "wallets", wallet, "projects", projectId, "coordination"),
      orderBy("ts", "asc"),
      limitToLast(LIMIT),
    );
    return onSnapshot(
      ref,
      (snap) => {
        const messages = snap.docs
          .map((doc) => toCoordinationMessage(doc.id, projectId, doc.data({ serverTimestamps: "estimate" })))
          .filter((m): m is CoordinationMessage => m !== null);
        setState({ key, messages, loaded: true });
      },
      () => setState({ key, messages: [], loaded: true }),
    );
  }, [wallet, projectId, key]);

  return state.key === key ? state : { messages: [], loaded: false };
}
