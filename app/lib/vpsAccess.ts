"use client";

import { authedFetch } from "./apiClient";

export type VpsAccessReason = "super-admin" | "allowlist" | "denied";

export type VpsAccess = {
  allowed: boolean;
  reason: VpsAccessReason;
};

/**
 * Asks the server whether the current Firebase user is allowed to pick the
 * "Your VPS (self-hosted)" deploy mode in the agent wizard. Gated behind
 * `/vps_allowlist` (or super-admin) while the self-hosted flow is being tested
 * — shown-but-blocked otherwise, mirroring the ECS rollout. Fails closed
 * (denied) on error so the wizard keeps the "Coming soon" badge.
 */
export async function fetchVpsAccess(): Promise<VpsAccess> {
  try {
    const res = await authedFetch("/api/access/vps-check");
    if (!res.ok) return { allowed: false, reason: "denied" };
    return (await res.json()) as VpsAccess;
  } catch {
    return { allowed: false, reason: "denied" };
  }
}
