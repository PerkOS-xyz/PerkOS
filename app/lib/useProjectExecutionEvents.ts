"use client";

import {
  normalizeWalletAddress,
  parseExecutionEvent,
  type ExecutionEventV1,
} from "@perkos/shared-types";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { firebaseDb } from "./firebase";

type State = {
  events: ExecutionEventV1[];
  loaded: boolean;
  error: Error | null;
  hasSequenceGap: boolean;
};

type SubscriptionState = Omit<State, "hasSequenceGap"> & { key: string };

export function hasExecutionSequenceGap(events: readonly ExecutionEventV1[]): boolean {
  if (events.length < 2) return false;
  return events.some((event, index) => index > 0 && event.sequence !== events[index - 1]!.sequence + 1);
}

/** Live, replay-safe subscription to one canonical project execution run. */
export function useProjectExecutionEvents(
  walletAddress: string | null | undefined,
  projectId: string | null | undefined,
  runId: string | null | undefined,
  max = 500,
): State {
  const key = walletAddress && projectId && runId
    ? `${normalizeWalletAddress(walletAddress)}/${projectId}/${runId}`
    : "";
  const [subscription, setSubscription] = useState<SubscriptionState>({
    key: "",
    events: [],
    loaded: true,
    error: null,
  });

  useEffect(() => {
    if (!walletAddress || !projectId || !runId || !key) return;
    const ref = query(
      collection(
        firebaseDb(),
        "wallets",
        normalizeWalletAddress(walletAddress),
        "projects",
        projectId,
        "executionRuns",
        runId,
        "events",
      ),
      orderBy("sequence", "asc"),
      limit(Math.max(1, Math.min(max, 2_000))),
    );
    return onSnapshot(ref, (snapshot) => {
      const next = snapshot.docs.flatMap((item) => {
        const parsed = parseExecutionEvent(item.data());
        return parsed.ok ? [parsed.event] : [];
      });
      setSubscription({ key, events: next, loaded: true, error: null });
    }, (reason) => {
      setSubscription({ key, events: [], loaded: true, error: reason });
    });
  }, [key, max, projectId, runId, walletAddress]);

  const current = subscription.key === key
    ? subscription
    : { key, events: [], loaded: key === "", error: null };
  const { events, loaded, error } = current;
  const hasSequenceGap = useMemo(() => hasExecutionSequenceGap(events), [events]);
  return { events, loaded, error, hasSequenceGap };
}
