"use client";

import { authedFetch } from "./apiClient";

export type LlmAccessReason = "super-admin" | "allowlist" | "denied";

export type LlmAccess = {
  allowed: boolean;
  reason: LlmAccessReason;
};

/**
 * Asks the server whether the current Firebase user is allowed to pick the
 * "PerkOS LLM service" option in the agent wizard. The wallet is resolved
 * server-side from the Firebase ID token — callers can't probe other
 * addresses.
 *
 * Returns { allowed: false, reason: "denied" } on any error so the wizard
 * fails closed and keeps the "Coming soon" badge visible.
 */
export async function fetchLlmAccess(): Promise<LlmAccess> {
  try {
    const res = await authedFetch("/api/access/llm-check");
    if (!res.ok) return { allowed: false, reason: "denied" };
    return (await res.json()) as LlmAccess;
  } catch {
    return { allowed: false, reason: "denied" };
  }
}
