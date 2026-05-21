"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

/**
 * Resolves `await sdk.isInMiniApp()` once on mount.
 *
 * Returns:
 *   - `null` while the answer is unknown (initial render + first frame)
 *   - `true` if running inside Farcaster / Base App / any Mini App host
 *   - `false` in a regular browser tab
 *
 * Components that branch on this should treat `null` as "loading" and
 * render a neutral placeholder, otherwise we'd flash the browser UI for
 * a frame inside the host.
 */
export function useIsInMiniApp(): boolean | null {
  const [state, setState] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    sdk
      .isInMiniApp()
      .then((v) => {
        if (!cancelled) setState(v);
      })
      .catch(() => {
        if (!cancelled) setState(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
