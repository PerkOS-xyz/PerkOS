"use client";

import { useEffect } from "react";

/**
 * Signals the Farcaster / Base App Mini App host that this app has
 * finished its initial mount and the splash screen can be dismissed.
 *
 * Without this call the platform keeps showing the configured
 * `splashImageUrl` on top of the iframe indefinitely (the Farcaster
 * dev panel surfaces this as "Ready not called").
 *
 * Imported with `await import()` so the SDK isn't pulled into the
 * non-MiniApp browser bundle. The call is also a safe no-op when the
 * page isn't running inside a MiniApp host.
 *
 * Mounted from `app/layout.tsx` so every route benefits — including
 * cold-loads via deep links.
 */
export function MiniAppReady() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        if (cancelled) return;
        await sdk.actions.ready();
      } catch {
        // Outside a MiniApp host (regular browser) the SDK still loads
        // but ready() may throw. Swallow — there's no host listening.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
