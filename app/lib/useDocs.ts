"use client";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";

import { firebaseDb } from "./firebase";
import type { ChatMessage, Doc, PlanBlock } from "./perkosApi";

function tsToIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }
  return undefined;
}

/**
 * Live `project.activePlanId`. Listens to the project doc so the Docs tab
 * picks up the plan doc the moment the PM creates it (or a human does via
 * ensureProjectPlan). Returns null until a plan exists.
 */
export function useActivePlanId(
  walletAddress: string | null | undefined,
  projectId: string | null | undefined
): string | null {
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress || !projectId) {
      setPlanId(null);
      return;
    }
    const ref = doc(
      firebaseDb(),
      "wallets",
      walletAddress.toLowerCase(),
      "projects",
      projectId
    );
    return onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        setPlanId(
          data && typeof data.activePlanId === "string"
            ? data.activePlanId
            : null
        );
      },
      () => setPlanId(null)
    );
  }, [walletAddress, projectId]);

  return planId;
}

type DocsState = { docs: Doc[]; loading: boolean; error: Error | null };

/** Realtime list of the project's docs (the tree), ordered by `order`. */
export function useDocs(
  walletAddress: string | null | undefined,
  projectId: string | null | undefined
): DocsState {
  const [state, setState] = useState<DocsState>({
    docs: [],
    loading: Boolean(walletAddress && projectId),
    error: null,
  });

  useEffect(() => {
    if (!walletAddress || !projectId) {
      setState({ docs: [], loading: false, error: null });
      return;
    }
    const ref = query(
      collection(
        firebaseDb(),
        "wallets",
        walletAddress.toLowerCase(),
        "projects",
        projectId,
        "docs"
      ),
      orderBy("order", "asc")
    );
    setState((s) => ({ ...s, loading: true, error: null }));
    return onSnapshot(
      ref,
      (snap) => {
        const docs: Doc[] = snap.docs.map((d) => {
          const v = d.data();
          return {
            id: d.id,
            type: (v.type as Doc["type"]) ?? "note",
            title: (v.title as string | null) ?? null,
            status: (v.status as string | null) ?? null,
            parentId: (v.parentId as string | null) ?? null,
            draft: v.draft === true,
            order: (v.order as number) ?? 0,
            createdBy: (v.createdBy as string | null) ?? null,
            updatedAt: tsToIso(v.updatedAt),
          };
        });
        setState({ docs, loading: false, error: null });
      },
      (error) => setState({ docs: [], loading: false, error })
    );
  }, [walletAddress, projectId]);

  return state;
}

type DocState = {
  doc: Doc | null;
  blocks: PlanBlock[];
  loading: boolean;
  error: Error | null;
};

/**
 * Realtime subscription to a single doc + its ordered blocks. Two listeners:
 * the doc meta (type/status), and the `blocks` subcollection ordered by
 * `order`. Block-level ownership means humans + the PM write disjoint blocks.
 */
export function useDoc(
  walletAddress: string | null | undefined,
  projectId: string | null | undefined,
  docId: string | null | undefined
): DocState {
  const [state, setState] = useState<DocState>({
    doc: null,
    blocks: [],
    loading: Boolean(walletAddress && projectId && docId),
    error: null,
  });

  useEffect(() => {
    if (!walletAddress || !projectId || !docId) {
      setState({ doc: null, blocks: [], loading: false, error: null });
      return;
    }
    const wallet = walletAddress.toLowerCase();
    const base = ["wallets", wallet, "projects", projectId, "docs", docId];

    const docRef = doc(firebaseDb(), base[0], ...base.slice(1));
    const blocksRef = query(
      collection(firebaseDb(), base[0], ...base.slice(1), "blocks"),
      orderBy("order", "asc")
    );

    setState((s) => ({ ...s, loading: true, error: null }));
    const onErr = (error: Error) =>
      setState((s) => ({ ...s, loading: false, error }));

    const unsubDoc = onSnapshot(
      docRef,
      (snap) => {
        const v = snap.data();
        setState((s) => ({
          ...s,
          loading: false,
          doc: v
            ? {
                id: snap.id,
                type: (v.type as Doc["type"]) ?? "note",
                title: (v.title as string | null) ?? null,
                status: (v.status as string | null) ?? null,
                parentId: (v.parentId as string | null) ?? null,
                draft: v.draft === true,
                revision: (v.revision as number) ?? 0,
                updatedAt: tsToIso(v.updatedAt),
              }
            : null,
        }));
      },
      onErr
    );

    const unsubBlocks = onSnapshot(
      blocksRef,
      (snap) => {
        const blocks: PlanBlock[] = snap.docs.map((d) => {
          const b = d.data();
          return {
            id: d.id,
            type: (b.type as PlanBlock["type"]) ?? "note",
            order: (b.order as number) ?? 0,
            owner: (b.owner as string | null) ?? null,
            text: (b.text as string | null) ?? null,
            title: (b.title as string | null) ?? null,
            groupId: (b.groupId as string | null) ?? null,
            desc: (b.desc as string | null) ?? null,
            suggestedAgent: (b.suggestedAgent as string | null) ?? null,
            acceptance: (b.acceptance as string | null) ?? null,
            deps: Array.isArray(b.deps) ? (b.deps as string[]) : [],
            materializedTaskId: (b.materializedTaskId as string | null) ?? null,
            updatedAt: tsToIso(b.updatedAt),
          };
        });
        setState((s) => ({ ...s, loading: false, blocks }));
      },
      onErr
    );

    return () => {
      unsubDoc();
      unsubBlocks();
    };
  }, [walletAddress, projectId, docId]);

  return state;
}

type DocMessagesState = {
  messages: ChatMessage[];
  loading: boolean;
  error: Error | null;
};

/** Realtime subscription to a doc's own discussion (per-doc chat). */
export function useDocMessages(
  walletAddress: string | null | undefined,
  projectId: string | null | undefined,
  docId: string | null | undefined
): DocMessagesState {
  const [state, setState] = useState<DocMessagesState>({
    messages: [],
    loading: Boolean(walletAddress && projectId && docId),
    error: null,
  });

  useEffect(() => {
    if (!walletAddress || !projectId || !docId) {
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
        "docs",
        docId,
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
      (error) => setState({ messages: [], loading: false, error })
    );
  }, [walletAddress, projectId, docId]);

  return state;
}
