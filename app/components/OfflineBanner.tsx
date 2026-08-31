"use client";

import Link from "next/link";
import { Loader2, Moon, RotateCcw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatAgentOperationalState } from "../lib/chatAgentStatus";

type Props = {
  /** Identity string of the host agent ("agent:apollo") for context. */
  historyHost?: string;
  /** True when the cached view is what's being shown. */
  fromCache?: boolean;
  agentName?: string;
  agentState?: ChatAgentOperationalState;
  managed?: boolean;
  waking?: boolean;
  onWake?: () => void;
};

/**
 * Surfaced when chat.perkos.xyz reports HOST_OFFLINE for the history request.
 * The user can still see the IndexedDB-cached transcript and send messages
 * (which queue on the relay until the agent reconnects), but they should
 * know the canonical store is unreachable.
 */
export function OfflineBanner({
  historyHost,
  fromCache,
  agentName,
  agentState = "unavailable",
  managed = false,
  waking = false,
  onWake,
}: Props) {
  const name = agentName || historyHost?.replace(/^agent:/, "") || "Agent";
  const sleeping = agentState === "sleeping";
  const starting = agentState === "waking" || waking;
  const Icon = sleeping ? Moon : starting ? Loader2 : WifiOff;
  const heading = sleeping
    ? `${name} is sleeping to save resources.`
    : starting
      ? `Waking ${name}…`
      : `${name} is unavailable.`;
  const detail = sleeping
    ? "Wake it to process your messages. Messages written now will remain queued."
    : starting
      ? "This usually takes 30–60 seconds. You can keep this page open."
      : fromCache
        ? "Showing locally-cached messages. New messages will appear when the agent reconnects."
        : "Messages will remain queued until the agent reconnects.";
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200"
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${starting ? "animate-spin" : ""}`} aria-hidden />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{heading}</span>
          <span className="text-amber-300/70">{detail}</span>
        </div>
      </div>
      {managed && onWake ? (
        <Button type="button" size="sm" variant="outline" disabled={starting} onClick={onWake} className="h-8 shrink-0 gap-1.5">
          {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          {starting ? "Waking…" : sleeping ? "Wake agent" : "Try again"}
        </Button>
      ) : !managed ? (
        <Button render={<Link href="/settings" />} size="sm" variant="outline" className="h-8 shrink-0">
          Connection settings
        </Button>
      ) : null}
    </div>
  );
}
