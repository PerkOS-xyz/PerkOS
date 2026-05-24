"use client";

/**
 * Alpha-only floating badge that surfaces the auth signals the rest of
 * the app uses to decide where to route the user. Visible on every
 * page so we can read it directly off the screen while debugging Base
 * App / Farcaster flows.
 *
 * Shows:
 *   - miniapp:  result of sdk.isInMiniApp() — null while resolving,
 *               then true (miniapp embed) or false (regular browser
 *               or in-app browser)
 *   - wallet :  wagmi's isConnected
 *   - session:  useWalletSession status (signed-in / not-allowlisted /
 *               syncing / signed-out / loading / error)
 *   - ua     :  last 32 chars of the user-agent string, so we can tell
 *               Base App's in-app browser apart from regular Safari
 *
 * Remove or gate behind an env flag once the alpha auth flow stabilises.
 */

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { useIsInMiniApp } from "../lib/useIsInMiniApp";
import { useWalletSession } from "../lib/useWalletSession";

export function DevAuthIndicator() {
  const isInMiniApp = useIsInMiniApp();
  const { isConnected } = useAccount();
  const session = useWalletSession();
  const [ua, setUa] = useState<string>("");

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const full = navigator.userAgent;
      setUa(full.length > 36 ? `…${full.slice(-36)}` : full);
    }
  }, []);

  const miniappLabel =
    isInMiniApp === null ? "?" : isInMiniApp ? "yes" : "no";
  const miniappColor =
    isInMiniApp === null
      ? "text-amber-300"
      : isInMiniApp
        ? "text-emerald-300"
        : "text-rose-300";

  return (
    <div
      className="pointer-events-none fixed right-2 top-2 z-[100] flex flex-col items-end gap-0.5 rounded-md border border-primary/30 bg-black/70 px-2 py-1.5 font-mono text-[10px] leading-tight text-white shadow-lg backdrop-blur-sm"
      aria-hidden
    >
      <span>
        miniapp: <span className={miniappColor}>{miniappLabel}</span>
      </span>
      <span>
        wallet:{" "}
        <span className={isConnected ? "text-emerald-300" : "text-rose-300"}>
          {isConnected ? "connected" : "off"}
        </span>
      </span>
      <span>
        session: <span className="text-primary">{session.status}</span>
      </span>
      {ua ? <span className="max-w-[180px] truncate text-white/60">{ua}</span> : null}
    </div>
  );
}
