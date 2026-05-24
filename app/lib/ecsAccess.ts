"use client";

import { authedFetch } from "./apiClient";

export type EcsAccessReason = "super-admin" | "allowlist" | "denied";

export type EcsAccess = {
  allowed: boolean;
  reason: EcsAccessReason;
};

/**
 * Asks the server whether the current Firebase user is allowed to pick the
 * "PerkOS infra (ECS Fargate)" deploy mode in the agent wizard. The wallet
 * is resolved server-side from the Firebase ID token — callers can't probe
 * other addresses.
 *
 * Returns { allowed: false, reason: "denied" } on any error so the wizard
 * fails closed and keeps the "Coming soon" badge visible.
 */
export async function fetchEcsAccess(): Promise<EcsAccess> {
  try {
    const res = await authedFetch("/api/access/ecs-check");
    if (!res.ok) return { allowed: false, reason: "denied" };
    return (await res.json()) as EcsAccess;
  } catch {
    return { allowed: false, reason: "denied" };
  }
}
