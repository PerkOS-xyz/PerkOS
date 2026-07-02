"use client";

/**
 * Activity events — the append-only "what happened" stream behind the
 * dashboard feed, KPI strip, and heatmap.
 *
 * One event = one plain-language line: actor (agent/user/system) + verb +
 * object. Stored per wallet at /wallets/{addr}/activity_events (owner-only via
 * the workspace wildcard rule). Server-side writers (PM worker, dispatcher,
 * heartbeat, provisioning — Admin SDK) append the agent-driven events; this
 * module appends the user-driven ones (manual task moves, launches, approvals)
 * and is the single read path for the UI.
 */

import {
  addDoc,
  collection,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import type { TFunction } from "i18next";
import { useEffect, useState } from "react";

import { firebaseDb } from "./firebase";

/** Verbs are shared with the server writers — keep in sync with PerkOS-API. */
export type ActivityVerb =
  | "created_task"
  | "moved_task"
  | "started_task"
  | "completed_task"
  | "retried_task"
  | "planned"
  | "proposed_plan"
  | "approved_plan"
  | "goal_done"
  | "launched_agent"
  | "agent_online"
  | "agent_failed"
  | "created_project"
  | "flagged_contention";

export type ActivityEvent = {
  id: string;
  /** "agent" | "user" | "system" */
  actorType: string;
  /** Agent name, wallet address, or "PerkOS". */
  actor: string;
  verb: ActivityVerb | string;
  /** Human label of the object, e.g. the task name. */
  object: string;
  objectType?: "task" | "project" | "agent" | "plan" | string;
  /** Deep-link target ids. */
  projectId?: string;
  taskId?: string;
  agentId?: string;
  /** Extra context shown after the object ("→ Done", "round 2", …). */
  detail?: string;
  tsMs: number;
};

type ActivityInput = Omit<ActivityEvent, "id" | "tsMs">;

/**
 * Fire-and-forget append. Activity logging must never break the action it
 * decorates — all errors are swallowed.
 */
export function logActivity(
  walletAddress: string | null | undefined,
  event: ActivityInput,
): void {
  if (!walletAddress) return;
  try {
    const col = collection(
      firebaseDb(),
      "wallets",
      walletAddress.toLowerCase(),
      "activity_events",
    );
    // Strip undefined optional fields — Firestore rejects undefined values.
    const clean = Object.fromEntries(
      Object.entries(event).filter(([, v]) => v !== undefined && v !== ""),
    );
    void addDoc(col, { ...clean, ts: serverTimestamp() }).catch(() => {});
  } catch {
    // Never let activity logging break the action it decorates.
  }
}

function toMs(value: unknown): number {
  if (!value) return 0;
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().getTime();
  }
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

/**
 * Live feed of the wallet's most recent events, newest first. A snapshot
 * listener so the dashboard narrates agent work as it happens.
 */
export function useActivityFeed(
  walletAddress: string | null | undefined,
  max = 40,
): { events: ActivityEvent[]; loaded: boolean } {
  // State is tagged with the wallet it belongs to, so a wallet switch
  // invalidates by derivation (no synchronous setState inside the effect).
  const [state, setState] = useState<{
    wallet: string;
    events: ActivityEvent[];
    loaded: boolean;
  }>({ wallet: "", events: [], loaded: false });

  useEffect(() => {
    if (!walletAddress) return;
    const wallet = walletAddress.toLowerCase();
    const q = query(
      collection(firebaseDb(), "wallets", wallet, "activity_events"),
      orderBy("ts", "desc"),
      fsLimit(max),
    );
    return onSnapshot(
      q,
      (snap) => {
        const events = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            actorType: String(data.actorType ?? "system"),
            actor: String(data.actor ?? "PerkOS"),
            verb: String(data.verb ?? ""),
            object: String(data.object ?? ""),
            objectType: data.objectType as ActivityEvent["objectType"],
            projectId: typeof data.projectId === "string" ? data.projectId : undefined,
            taskId: typeof data.taskId === "string" ? data.taskId : undefined,
            agentId: typeof data.agentId === "string" ? data.agentId : undefined,
            detail: typeof data.detail === "string" ? data.detail : undefined,
            tsMs: toMs(data.ts),
          };
        });
        setState({ wallet, events, loaded: true });
      },
      () => setState({ wallet, events: [], loaded: true }),
    );
  }, [walletAddress, max]);

  const current = state.wallet === (walletAddress ?? "").toLowerCase();
  return {
    events: current ? state.events : [],
    loaded: current ? state.loaded : false,
  };
}

/** Maps each activity verb to its i18n key under `components.activityFeed.verbs`. */
const VERB_KEYS: Record<string, string> = {
  created_task: "created",
  moved_task: "moved",
  started_task: "startedWorkingOn",
  completed_task: "completed",
  retried_task: "sentBack",
  planned: "planned",
  proposed_plan: "proposedPlanIn",
  approved_plan: "approvedPlanIn",
  goal_done: "reachedGoalOf",
  launched_agent: "launched",
  agent_online: "cameOnline",
  agent_failed: "failedToStart",
  created_project: "createdProject",
  flagged_contention: "flaggedOverlapOn",
};

/**
 * Plain-language phrasing per verb, e.g. "Scholar completed Write menu copy".
 * Translated via i18n; pass the caller's `t` (from useTranslation). Unknown
 * verbs fall back to the de-underscored verb string.
 */
export function verbPhrase(verb: string, t: TFunction): string {
  const key = VERB_KEYS[verb];
  return key
    ? t(`components.activityFeed.verbs.${key}`)
    : verb.replace(/_/g, " ");
}
