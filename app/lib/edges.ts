"use client";

/**
 * Entity graph edges — typed relations between the things in a workspace:
 *
 *   { from: "user:0x…"|"agent:Name"|"task:id"|"doc:id"|"project:id",
 *     rel:  "mentions" | "assigned_to" | "authored",
 *     to:   same key format }
 *
 * Stored per wallet at /wallets/{addr}/edges with a DETERMINISTIC doc id
 * (hash of from+rel+to+sourceRef), so re-sending the same message or
 * re-saving the same task never duplicates an edge. This is the data layer
 * behind the backlinks panel and the project context map; the same one-hop
 * expansion can later feed agent context retrieval.
 *
 * Keys are flattened to `fromKey`/`toKey` strings so both directions are a
 * single equality query (no composite indexes needed — recency is sorted
 * client-side).
 */

import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from "firebase/firestore";

import { firebaseDb } from "./firebase";

export type EdgeRel = "mentions" | "assigned_to" | "authored";

export type Edge = {
  id: string;
  fromKey: string;
  toKey: string;
  rel: EdgeRel | string;
  projectId?: string;
  /** Where the edge was observed (message id, task id, doc id). */
  sourceRef?: string;
  /** Optional display label for the source (e.g. task name). */
  sourceLabel?: string;
  tsMs: number;
};

/** Entity key helpers — single format across writers and readers. */
export const entityKey = {
  agent: (name: string) => `agent:${name}`,
  user: (wallet: string) => `user:${wallet.toLowerCase()}`,
  task: (projectId: string, taskId: string) => `task:${projectId}/${taskId}`,
  doc: (projectId: string, docId: string) => `doc:${projectId}/${docId}`,
  project: (projectId: string) => `project:${projectId}`,
};

/** djb2 — tiny, stable, good enough for idempotent doc ids. */
function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36) + "-" + s.length.toString(36);
}

function edgesCol(walletAddress: string) {
  return collection(
    firebaseDb(),
    "wallets",
    walletAddress.toLowerCase(),
    "edges",
  );
}

/**
 * Idempotent fire-and-forget edge upsert. Graph writes must never break the
 * action they decorate — errors are swallowed.
 */
export function writeEdge(
  walletAddress: string | null | undefined,
  edge: {
    fromKey: string;
    toKey: string;
    rel: EdgeRel;
    projectId?: string;
    sourceRef?: string;
    sourceLabel?: string;
  },
): void {
  if (!walletAddress || !edge.fromKey || !edge.toKey) return;
  try {
    const id = hashId(
      [edge.fromKey, edge.rel, edge.toKey, edge.sourceRef ?? ""].join("|"),
    );
    const clean = Object.fromEntries(
      Object.entries(edge).filter(([, v]) => v !== undefined && v !== ""),
    );
    void setDoc(
      doc(edgesCol(walletAddress), id),
      { ...clean, ts: serverTimestamp() },
      { merge: true },
    ).catch(() => {});
  } catch {
    // Never let graph writes break the action they decorate.
  }
}

function toMs(value: unknown): number {
  if (!value) return 0;
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().getTime();
  }
  return 0;
}

function mapEdges(
  docs: { id: string; data: () => Record<string, unknown> }[],
): Edge[] {
  return docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        fromKey: String(data.fromKey ?? ""),
        toKey: String(data.toKey ?? ""),
        rel: String(data.rel ?? ""),
        projectId: typeof data.projectId === "string" ? data.projectId : undefined,
        sourceRef: typeof data.sourceRef === "string" ? data.sourceRef : undefined,
        sourceLabel:
          typeof data.sourceLabel === "string" ? data.sourceLabel : undefined,
        tsMs: toMs(data.ts),
      };
    })
    .sort((a, b) => b.tsMs - a.tsMs);
}

/** All edges pointing AT an entity ("mentioned in", "assigned …"). */
export async function getEdgesTo(
  walletAddress: string,
  toKey: string,
  max = 50,
): Promise<Edge[]> {
  const snap = await getDocs(
    query(edgesCol(walletAddress), where("toKey", "==", toKey), fsLimit(max)),
  );
  return mapEdges(snap.docs);
}

/** All edges originating FROM an entity. */
export async function getEdgesFrom(
  walletAddress: string,
  fromKey: string,
  max = 50,
): Promise<Edge[]> {
  const snap = await getDocs(
    query(edgesCol(walletAddress), where("fromKey", "==", fromKey), fsLimit(max)),
  );
  return mapEdges(snap.docs);
}

/** One-hop neighborhood for a project (context map): all project-scoped edges. */
export async function getProjectEdges(
  walletAddress: string,
  projectId: string,
  max = 200,
): Promise<Edge[]> {
  const snap = await getDocs(
    query(
      edgesCol(walletAddress),
      where("projectId", "==", projectId),
      fsLimit(max),
    ),
  );
  return mapEdges(snap.docs);
}
