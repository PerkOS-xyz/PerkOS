"use client";

import { collection, onSnapshot, type Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";

import { firebaseDb } from "./firebase";
import { externalRuntimeAvailability } from "./agentHostingPolicy";
import {useAgentPresence} from "./useAgentPresence";

export type AgentLiveStatus = {
  shared?:boolean;
  presenceExpiresAt?:number;
  presenceUnavailable?:boolean;
  id: string; // the agent doc id (for wake/hibernate calls)
  name: string;
  status: string; // top-level provision/heartbeat status (ready | provisioning | …)
  runtime?: string;
  hibernationState?: string; // active | hibernating | hibernated | waking
  bridgeConnected?: boolean;
  lastBridgeSeenMs?: number; // last heartbeat (epoch ms)
  wakeStartedMs?: number; // last wake-from-sleep (epoch ms)
  presetId?: string; // role preset — drives the AgentOrb hue/glyph
  role?: string; // role label — keyword-matched orb when no presetId
  external?: boolean;
  runtimeStatus?: "healthy" | "unreachable" | "unknown" | null;
  runtimeHealthCheckedAt?: string | null;
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
  const presence=useAgentPresence(walletAddress,Object.values(state.byName).filter(a=>!a.shared).map(a=>a.id));

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
    const unsubscribe = onSnapshot(
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
            presetId:
              typeof data.presetId === "string" ? (data.presetId as string) : undefined,
            role: typeof data.role === "string" ? (data.role as string) : undefined,
            external:
              data.external === true ||
              ["invited", "self-hosted", "imported"].includes(String(data.deployMode ?? "")),
            runtimeStatus:
              data.runtimeStatus === "healthy" ||
              data.runtimeStatus === "unreachable" ||
              data.runtimeStatus === "unknown"
                ? data.runtimeStatus
                : null,
            runtimeHealthCheckedAt: tsToIsoOrNull(data.runtimeHealthCheckedAt),
            presenceExpiresAt:typeof data.presenceExpiresAt==="number"?data.presenceExpiresAt:undefined,
          };
        });
        setState((prev) => ({
          // Keep whatever shared agents were merged in below; the snapshot only
          // ever describes the caller's own subtree.
          byName: { ...prev.byName, ...byName },
          loaded: true,
        }));
      },
      () => setState((prev) => ({ ...prev, loaded: true }))
    );

    // Agents shared in through an organization live under their owner's wallet,
    // which this subscription cannot see — the Firestore rules keep it closed.
    // Without them the dashboard reported "No agents registered yet" while the
    // Agents page listed several: two answers to the same question. They have no
    // realtime channel here, so they are fetched once per wallet and refreshed
    // on the same cadence as the freshness tick.
    let cancelled = false;
    let hasShared=false;
    async function mergeSharedAgents() {
      try {
        const { authedFetch } = await import("./apiClient");
        const res = await authedFetch("/api/agents");
        if (!res.ok) return;
        const body = (await res.json()) as {
          agents?: Array<Record<string, unknown> & { shared?: boolean }>;
        };
        const shared = (body.agents ?? []).filter((a) => a.shared === true);
        hasShared=shared.length>0;
        if (cancelled) return;
        setState((prev) => {
          const byName = Object.fromEntries(Object.entries(prev.byName).filter(([,a])=>!a.shared));
          for (const a of shared) {
            const name = (a.name as string) ?? "";
            if (!name || (byName[name]&&!byName[name].shared)) continue;
            byName[name] = {
              id: (a.id as string) ?? name,
              shared:true,
              presenceExpiresAt:typeof a.presenceExpiresAt==="number"?a.presenceExpiresAt:undefined,
              presenceUnavailable:a.presenceUnavailable===true,
              name,
              status: (a.status as string) ?? "unknown",
              runtime: (a.runtime as string | undefined) ?? undefined,
              hibernationState: undefined,
              bridgeConnected: a.bridgeConnected === true,
              lastBridgeSeenMs: toMs(a.lastBridgeSeenAt),
              wakeStartedMs: 0,
              presetId: undefined,
              role: undefined,
              external: a.external === true,
              runtimeStatus:
                a.runtimeStatus === "healthy" ||
                a.runtimeStatus === "unreachable" ||
                a.runtimeStatus === "unknown"
                  ? (a.runtimeStatus as AgentLiveStatus["runtimeStatus"])
                  : null,
              runtimeHealthCheckedAt:
                typeof a.runtimeHealthCheckedAt === "string"
                  ? (a.runtimeHealthCheckedAt as string)
                  : null,
            };
          }
          return { byName, loaded: true };
        });
      } catch {
        // A failure here leaves the caller's own agents intact.
      }
    }
    void mergeSharedAgents();
    const sharedTimer=window.setInterval(()=>{if(hasShared&&!document.hidden)void mergeSharedAgents();},60_000);
    const freshnessTimer = window.setInterval(() => {
      setState((current) => ({ ...current, byName: { ...current.byName } }));
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(freshnessTimer);
      window.clearInterval(sharedTimer);
      unsubscribe();
    };
  }, [walletAddress]);

  return {...state,byName:Object.fromEntries(Object.entries(state.byName).map(([name,a])=>{
    const live=presence[a.id];
    return [name,live?{...a,...live,lastBridgeSeenMs:toMs(live.lastBridgeSeenAt)}:a];
  }))};
}

/**
 * Derive the live status dot from the agent's hibernation lifecycle + heartbeat.
 * Order matters: explicit hibernation states win; a freshly-woken agent that
 * hasn't phoned home SINCE the wake is "Starting" (not "Online"); only a
 * heartbeat that post-dates the last wake counts as truly connected.
 */
// Customer-facing status labels use TEAM language, not infra language
// ("Resting", not "Hibernated") — part of the fear-reduction redesign for
// non-technical users. Code that branches on a status must compare against
// these exported constants, never string literals.
export const STATUS_AVAILABLE = "Available";
export const STATUS_RESTING = "Resting";
export const STATUS_GOING_TO_REST = "Going to rest";
export const STATUS_GETTING_READY = "Getting ready";
export const STATUS_RUNTIME_UNAVAILABLE = "Runtime unavailable";
export const STATUS_RUNTIME_UNVERIFIED = "Runtime unverified";

function tsToIsoOrNull(value: unknown): string | null {
  const ms = toMs(value);
  return ms > 0 ? new Date(ms).toISOString() : null;
}

export function realtimeAgentStatus(a?: AgentLiveStatus): {
  color: string;
  label: string;
  /** False when we have no status for the agent yet (see below). */
  known?: boolean;
} {
  // No status entry means we have not heard from the agent yet. That is worth
  // saying in an accessible label ("Alice (Unknown)"), but not worth printing
  // as a bare "Unknown ·" in front of the real information on a card. `known`
  // lets each caller choose: keep the word where a label is required, drop the
  // segment where it is just noise.
  if (!a) return { color: "bg-[#7975a8]", label: "Unknown", known: false };
  const hs = (a.hibernationState ?? "").toLowerCase();
  if (hs === "hibernated")
    return { color: "bg-[#7975a8]", label: STATUS_RESTING };
  if (hs === "hibernating")
    return { color: "bg-amber-400", label: STATUS_GOING_TO_REST };

  const seen = a.lastBridgeSeenMs ?? 0;
  const woke = a.wakeStartedMs ?? 0;
  // Woken from sleep but the bridge hasn't reconnected since → still booting.
  if (hs === "waking" && seen <= woke)
    return { color: "bg-amber-400 animate-pulse", label: STATUS_GETTING_READY };
  if ((a.status ?? "").toLowerCase() === "provisioning")
    return { color: "bg-amber-400 animate-pulse", label: STATUS_GETTING_READY };
  if(a.presenceUnavailable)return {color:"bg-[#7975a8]",label:"Unknown",known:false};

  if (a.external) {
    const availability = externalRuntimeAvailability({
      bridgeConnected: a.bridgeConnected,
      lastBridgeSeenAt: a.lastBridgeSeenMs ? new Date(a.lastBridgeSeenMs).toISOString() : null,
      runtimeStatus: a.runtimeStatus,
      runtimeHealthCheckedAt: a.runtimeHealthCheckedAt,
      presenceExpiresAt:a.presenceExpiresAt,
    });
    if (availability === "online")
      return { color: "bg-emerald-400", label: STATUS_AVAILABLE };
    if (availability === "unavailable")
      return { color: "bg-red-500", label: STATUS_RUNTIME_UNAVAILABLE };
    if (availability === "unverified")
      return { color: "bg-amber-400", label: STATUS_RUNTIME_UNVERIFIED };
    return { color: "bg-[#7975a8]", label: "Offline" };
  }

  // Connected: the relay currently owns the bridge session and — if it was
  // ever woken — the session was established after that wake. Managed bridges
  // do not emit periodic Firestore heartbeats; the relay writes an explicit
  // disconnect instead. Applying the external-runtime 90 s freshness window
  // here therefore turns healthy managed agents Offline shortly after boot.
  // "Available" REQUIRES a real bridge heartbeat — do NOT infer it from
  // status:"ready" alone. A registered-but-never-provisioned doc (no ECS
  // service, e.g. a launch that didn't enqueue a provision job) sits at
  // status:"ready" forever with no bridge; treating that as available showed
  // ghost agents as live (and made hibernation look broken). Such agents now
  // correctly read "Offline" until a bridge actually connects.
  if (
    a.bridgeConnected &&
    (a.presenceExpiresAt===undefined || a.presenceExpiresAt>Date.now()) &&
    seen > 0 &&
    seen >= woke
  )
    return { color: "bg-emerald-400", label: STATUS_AVAILABLE };

  if ((a.status ?? "").toLowerCase() === "provision-failed" ||
      (a.status ?? "").toLowerCase() === "error")
    return { color: "bg-red-500", label: "Needs attention" };
  return { color: "bg-[#7975a8]", label: "Offline" };
}
