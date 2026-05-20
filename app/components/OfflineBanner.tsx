"use client";

import { WifiOff } from "lucide-react";

type Props = {
  /** Identity string of the host agent ("agent:apollo") for context. */
  historyHost?: string;
  /** True when the cached view is what's being shown. */
  fromCache?: boolean;
};

/**
 * Surfaced when chat.perkos.xyz reports HOST_OFFLINE for the history request.
 * The user can still see the IndexedDB-cached transcript and send messages
 * (which queue on the relay until the agent reconnects), but they should
 * know the canonical store is unreachable.
 */
export function OfflineBanner({ historyHost, fromCache }: Props) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200"
    >
      <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">
          {historyHost
            ? `Host agent (${historyHost.replace(/^agent:/, "")}) is offline.`
            : "Host agent is offline."}
        </span>
        <span className="text-amber-300/70">
          {fromCache
            ? "Showing locally-cached messages. New ones from the agent will appear when it reconnects."
            : "Your messages will be delivered when the agent reconnects."}
        </span>
      </div>
    </div>
  );
}
