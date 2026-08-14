"use client";

import type { User } from "firebase/auth";

export type ActivityEventType = "login" | "session_start";
export type ActivitySurface = "app" | "grow" | "minipay" | "desktop";

export function activitySessionId(surface: ActivitySurface): string {
  const key = `perkos.activity.session.${surface}`;
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Best-effort telemetry: authentication and navigation must never depend on it. */
export async function recordActivity(
  user: User,
  eventType: ActivityEventType,
  surface: ActivitySurface,
  walletAddress?: string,
): Promise<void> {
  try {
    const token = await user.getIdToken();
    await fetch("/api/platform/activity/session", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        surface,
        eventType,
        sessionId: activitySessionId(surface),
        walletAddress,
      }),
      keepalive: true,
    });
  } catch {
    // Deliberately non-blocking. Admin will show partial telemetry if the API
    // or geolocation provider is temporarily unavailable.
  }
}
