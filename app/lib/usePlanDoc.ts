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
import type { PlanBlock, PlanDoc } from "./perkosApi";

type State = {
  plan: PlanDoc | null;
  blocks: PlanBlock[];
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
 * Live `project.activePlanId`. Listens to the project doc so the Plan tab
 * picks up a plan the moment the PM creates it (or a human does via
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

/**
 * Realtime subscription to a project's plan doc + its ordered blocks. Two
 * listeners: one on the plan doc (status/revision), one on the `blocks`
 * subcollection ordered by `order`. Block-level ownership means humans and
 * the PM write disjoint blocks, so updates stream in without conflicts.
 *
 * Pass `null` for any id (incl. a not-yet-created planId) to stay dormant.
 */
export function usePlanDoc(
  walletAddress: string | null | undefined,
  projectId: string | null | undefined,
  planId: string | null | undefined
): State {
  const [state, setState] = useState<State>({
    plan: null,
    blocks: [],
    loading: Boolean(walletAddress && projectId && planId),
    error: null,
  });

  useEffect(() => {
    if (!walletAddress || !projectId || !planId) {
      setState({ plan: null, blocks: [], loading: false, error: null });
      return;
    }
    const wallet = walletAddress.toLowerCase();

    const planRef = doc(
      firebaseDb(),
      "wallets",
      wallet,
      "projects",
      projectId,
      "plan",
      planId
    );
    const blocksRef = query(
      collection(
        firebaseDb(),
        "wallets",
        wallet,
        "projects",
        projectId,
        "plan",
        planId,
        "blocks"
      ),
      orderBy("order", "asc")
    );

    setState((s) => ({ ...s, loading: true, error: null }));

    const onErr = (error: Error) =>
      setState((s) => ({ ...s, loading: false, error }));

    const unsubPlan = onSnapshot(
      planRef,
      (snap) => {
        const data = snap.data();
        setState((s) => ({
          ...s,
          loading: false,
          plan: data
            ? {
                id: snap.id,
                status: (data.status as string) ?? "draft",
                title: (data.title as string | null) ?? null,
                revision: (data.revision as number) ?? 0,
                approvedBy: (data.approvedBy as string | null) ?? null,
                approvedAt: tsToIso(data.approvedAt),
                createdAt: tsToIso(data.createdAt),
                updatedAt: tsToIso(data.updatedAt),
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
            materializedTaskId:
              (b.materializedTaskId as string | null) ?? null,
            updatedAt: tsToIso(b.updatedAt),
          };
        });
        setState((s) => ({ ...s, loading: false, blocks }));
      },
      onErr
    );

    return () => {
      unsubPlan();
      unsubBlocks();
    };
  }, [walletAddress, projectId, planId]);

  return state;
}
