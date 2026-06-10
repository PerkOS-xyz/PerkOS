"use client";

import { collection, onSnapshot, type Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";

import { firebaseDb } from "./firebase";

export type AgentLiveStatus = {
  id: string; // the agent doc id (for wake/hibernate calls)
  name: string;
  status: string; // top-level provision/heartbeat status (ready | provisioning | …)
  runtime?: string;
  hibernationState?: string; // active | hibernating | hibernated | waking
  bridgeConnected?: boolean;
  lastBridgeSeenMs?: number; // last heartbeat (epoch ms)
  wakeStartedMs?: number; // last wake-from-sleep (epoch ms)
};

type State = {
  byName: Record<string, AgentLiveStatus>;
  loaded: boolean;
};

/** Coerce a Firestore Timestamp | ISO string | epoch number → epoch ms. */
function toMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().getTime();
  }
  return 0;
}

/**
 * Realtime subscription to the wallet's agents subcollection, keyed by name.
 * Reads the live fields needed for an accurate status dot — the hibernation
 * lifecycle (`hibernation.state`/`wakeStartedAt`, written by wake/hibernate)
 * plus the bridge heartbeat (`bridgeConnected`/`lastBridgeSeenAt`, written when
 * the bridge phones home on boot) — NOT just the static top-level `status`,
 * which lags reality (an agent woken from sleep keeps its old "ready" until the
 * bridge reconnects).
 */
export function useWalletAgents(
  walletAddress: string | null | undefined
): State {
  const [state, setState] = useState<State>({ byName: {}, loaded: false });

  useEffect(() => {
    if (!walletAddress) {
      setState({ byName: {}, loaded: false });
      return;
    }
    const ref = collection(
      firebaseDb(),
      "wallets",
      walletAddress.toLowerCase(),
      "agents"
    );
    return onSnapshot(
      ref,
      (snap) => {
        const byName: Record<string, AgentLiveStatus> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          const name = (data.name as string) ?? d.id;
          const hib = (data.hibernation ?? {}) as Record<string, unknown>;
          byName[name] = {
            id: d.id,
            name,
            status: (data.status as string) ?? "unknown",
            runtime: (data.runtime as string | undefined) ?? undefined,
            hibernationState:
              typeof hib.state === "string" ? (hib.state as string) : undefined,
            bridgeConnected: data.bridgeConnected === true,
            lastBridgeSeenMs: toMs(data.lastBridgeSeenAt),
            wakeStartedMs: toMs(hib.wakeStartedAt),
          };
        });
        setState({ byName, loaded: true });
      },
      () => setState({ byName: {}, loaded: true })
    );
  }, [walletAddress]);

  return state;
}

/**
 * Derive the live status dot from the agent's hibernation lifecycle + heartbeat.
 * Order matters: explicit hibernation states win; a freshly-woken agent that
 * hasn't phoned home SINCE the wake is "Starting" (not "Online"); only a
 * heartbeat that post-dates the last wake counts as truly connected.
 */
export function realtimeAgentStatus(a?: AgentLiveStatus): {
  color: string;
  label: string;
} {
  if (!a) return { color: "bg-[#7975a8]", label: "Unknown" };
  const hs = (a.hibernationState ?? "").toLowerCase();
  if (hs === "hibernated")
    return { color: "bg-[#7975a8]", label: "Hibernated" };
  if (hs === "hibernating")
    return { color: "bg-amber-400", label: "Hibernating" };

  const seen = a.lastBridgeSeenMs ?? 0;
  const woke = a.wakeStartedMs ?? 0;
  // Woken from sleep but the bridge hasn't reconnected since → still booting.
  if (hs === "waking" && seen <= woke)
    return { color: "bg-amber-400 animate-pulse", label: "Starting" };
  if ((a.status ?? "").toLowerCase() === "provisioning")
    return { color: "bg-amber-400 animate-pulse", label: "Starting" };

  // Connected: phoned home, and — if it was ever woken — since that wake.
  // "Online" REQUIRES a real bridge heartbeat — do NOT infer it from
  // status:"ready" alone. A registered-but-never-provisioned doc (no ECS
  // service, e.g. a launch that didn't enqueue a provision job) sits at
  // status:"ready" forever with no bridge; treating that as Online showed
  // ghost agents as live (and made hibernation look broken). Such agents now
  // correctly read "Offline" until a bridge actually connects.
  if (a.bridgeConnected && seen > 0 && seen >= woke)
    return { color: "bg-emerald-400", label: "Online" };

  if ((a.status ?? "").toLowerCase() === "provision-failed" ||
      (a.status ?? "").toLowerCase() === "error")
    return { color: "bg-red-500", label: "Error" };
  return { color: "bg-[#7975a8]", label: "Offline" };
}
