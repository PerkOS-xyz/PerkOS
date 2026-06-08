"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

import { firebaseDb } from "./firebase";

export type AgentLiveStatus = {
  name: string;
  status: string; // ready | provisioning | active | hibernating | hibernated | waking | …
  runtime?: string;
};

type State = {
  byName: Record<string, AgentLiveStatus>;
  loaded: boolean;
};

/**
 * Realtime subscription to the wallet's agents subcollection, keyed by name,
 * so the project Agents list can show each agent's live status dot without a
 * manual refresh (mirrors the task/chat live hooks).
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
          byName[name] = {
            name,
            status: (data.status as string) ?? "unknown",
            runtime: (data.runtime as string | undefined) ?? undefined,
          };
        });
        setState({ byName, loaded: true });
      },
      () => setState({ byName: {}, loaded: true })
    );
  }, [walletAddress]);

  return state;
}

/** Map an agent status to a small UI descriptor (dot color + label). */
export function agentStatusBadge(status: string | undefined): {
  color: string;
  label: string;
} {
  switch ((status ?? "").toLowerCase()) {
    case "ready":
    case "active":
    case "running":
      return { color: "bg-emerald-400", label: "Online" };
    case "provisioning":
    case "waking":
      return { color: "bg-amber-400 animate-pulse", label: "Starting" };
    case "hibernating":
      return { color: "bg-amber-400", label: "Hibernating" };
    case "hibernated":
    case "stopped":
      return { color: "bg-[#7975a8]", label: "Hibernated" };
    case "provision-failed":
    case "error":
      return { color: "bg-red-500", label: "Error" };
    default:
      return { color: "bg-[#7975a8]", label: status || "Unknown" };
  }
}
