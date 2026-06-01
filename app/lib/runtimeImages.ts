"use client";

import { authedFetch } from "./apiClient";
import type { AgentRuntime } from "./perkosApi";

export type RuntimeChannel = "public" | "beta" | "hidden";

export type RuntimeImage = {
  runtime: AgentRuntime;
  /** Stable tag that PerkOS-Admin pinned active. Used by /api/agents/launch
   *  to provision the exact image. */
  primaryTag: string;
  /** Admin-curated label. Falls back to primaryTag in the UI if null. */
  displayName: string | null;
  /** Optional notes shown next to the runtime card. */
  notes: string | null;
  /** Release channel. "beta" images are only returned to testers; the wizard
   *  shows a BETA badge for them. Defaults to "public" for older API builds. */
  channel?: RuntimeChannel;
  /** Human-readable upstream version ("v0.9.2" or a short digest), or null
   *  when the API/build predates version capture. */
  upstreamVersion?: string | null;
};

/**
 * Fetch every active runtime image the admin has approved, grouped by
 * AgentRuntime kind. Used by the agent wizard to decide which runtime
 * options to render in step 2.
 *
 * Returns empty arrays if nothing is active — the caller renders an
 * empty-state telling the user to contact admin.
 */
export async function fetchActiveRuntimes(): Promise<{
  openclaw: RuntimeImage[];
  hermes: RuntimeImage[];
}> {
  const res = await authedFetch("/api/runtimes");
  if (!res.ok) {
    throw new Error(`Failed to load runtimes (${res.status})`);
  }
  const { runtimes } = (await res.json()) as { runtimes: RuntimeImage[] };

  const grouped: { openclaw: RuntimeImage[]; hermes: RuntimeImage[] } = {
    openclaw: [],
    hermes: [],
  };
  for (const r of runtimes) {
    if (r.runtime === "OpenClaw") grouped.openclaw.push(r);
    else grouped.hermes.push(r);
  }
  return grouped;
}
