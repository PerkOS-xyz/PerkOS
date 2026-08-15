"use client";

import { ChevronDown, Headphones, Loader2, Mic, MicOff, PhoneOff, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AGENT_VOICE_STATE_LABELS,
  canStartAgentVoiceCall,
  resolveAgentVoiceState,
  type AgentVoiceCapability,
  type AgentVoiceState,
} from "../../../lib/agentVoice";

const BUSY_STATES: AgentVoiceState[] = ["checking", "connecting", "reconnecting"];

export function AgentVoiceCallCard({
  agentName,
  capability,
  callState,
  onStart,
  onEnd,
  error,
  remoteAudioStatus,
  chatMirrorAvailable = false,
  chatMirrorEnabled = false,
  chatMirrorScope = "direct",
  onChatMirrorEnabledChange,
  muted = false,
  durationSeconds = 0,
  onToggleMute,
}: {
  agentName: string;
  capability?: AgentVoiceCapability | null;
  callState?: AgentVoiceState;
  onStart?: () => void;
  onEnd?: () => void;
  error?: string | null;
  remoteAudioStatus?: string | null;
  chatMirrorAvailable?: boolean;
  chatMirrorEnabled?: boolean;
  chatMirrorScope?: "direct" | "project";
  onChatMirrorEnabledChange?: (enabled: boolean) => void;
  muted?: boolean;
  durationSeconds?: number;
  onToggleMute?: () => void;
}) {
  const state = callState ?? resolveAgentVoiceState(capability);
  const busy = BUSY_STATES.includes(state);
  const enabled = canStartAgentVoiceCall(state) && Boolean(onStart);
  const mirrorLocked = busy || state === "in-call";
  const mirrorDestination = chatMirrorScope === "project" ? "project chat" : "direct chat";
  const duration = `${String(Math.floor(durationSeconds / 60)).padStart(2, "0")}:${String(durationSeconds % 60).padStart(2, "0")}`;
  const active = state === "in-call";

  return (
    <Card className={active ? "overflow-hidden border-emerald-400/40 bg-gradient-to-br from-emerald-500/10 via-card to-card shadow-lg shadow-emerald-950/20" : "overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card"}>
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
              <span className={active ? "relative flex h-3 w-3" : "hidden"} aria-hidden="true"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" /></span>
              {state === "unavailable" ? <MicOff className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
              {active ? `Live with ${agentName}` : `Call ${agentName}`}
            </CardTitle>
            <CardDescription className="mt-1 text-sm" aria-live="polite">{AGENT_VOICE_STATE_LABELS[state]}</CardDescription>
          </div>
          {active ? <div className="font-mono text-2xl font-semibold tabular-nums" aria-label={`Call duration ${duration}`}>{duration}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === "unavailable" ? (
          <p className="text-sm text-muted-foreground">{agentName} has not reported a verified voice gateway and speech provider. Text availability does not enable voice.</p>
        ) : null}
        {chatMirrorAvailable ? (
          <div className="grid gap-2 rounded-xl border border-border/70 bg-background/50 p-3 sm:grid-cols-2" aria-label="Call privacy mode">
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${chatMirrorEnabled ? "border-primary/50 bg-primary/10" : "border-transparent"}`}>
              <Checkbox
                aria-label={`Save final voice turns to ${mirrorDestination}`}
                checked={chatMirrorEnabled}
                disabled={mirrorLocked}
                onCheckedChange={(checked) => onChatMirrorEnabledChange?.(checked === true)}
              />
              <span><span className="block text-sm font-semibold">Normal · Save final turns</span><span className="mt-1 block text-xs text-muted-foreground">Final user and agent text appears in {mirrorDestination}.</span></span>
            </label>
            <button type="button" disabled={mirrorLocked} onClick={() => onChatMirrorEnabledChange?.(false)} className={`flex items-start gap-3 rounded-lg border p-3 text-left ${!chatMirrorEnabled ? "border-primary/50 bg-primary/10" : "border-transparent"}`} aria-pressed={!chatMirrorEnabled}>
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span><span className="block text-sm font-semibold">Private · Don&apos;t save</span><span className="mt-1 block text-xs text-muted-foreground">No final text, raw audio, or interim speech is persisted.</span></span>
            </button>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
        {active ? <><Button type="button" variant="outline" className="min-h-12 flex-1 gap-2 py-3" onClick={onToggleMute} aria-pressed={muted}>{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}{muted ? "Unmute" : "Mute"}</Button><Button variant="destructive" className="min-h-12 flex-1 gap-2 py-3" onClick={onEnd}><PhoneOff className="h-5 w-5" />End call</Button></> : <Button className="min-h-12 w-full gap-2 py-3 text-base" disabled={!enabled || busy} aria-disabled={!enabled || busy} onClick={onStart}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          {state === "failed" || state === "ended" ? "Retry voice call" : `Call ${agentName}`}
        </Button>}
        </div>
        {error ? <p className="text-xs text-red-300" role="alert">{error}</p> : null}
        {remoteAudioStatus ? <p className="text-xs text-muted-foreground" role="status">{remoteAudioStatus}</p> : null}
        {state === "unavailable" ? (
          <p className="text-xs text-amber-300">
            Pending gateway capability and speech-provider configuration.
          </p>
        ) : null}
        <details className="group rounded-lg border border-border/60 bg-background/30 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">Call settings <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
          <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:grid-cols-2">
            <p><strong className="text-foreground">Audio:</strong> echo cancellation, noise suppression, and automatic gain control.</p>
            <p><strong className="text-foreground">Barge-in:</strong> speaking interrupts the current agent reply.</p>
            <p><strong className="text-foreground">Privacy:</strong> raw audio and interim speech are never saved.</p>
            <p><strong className="text-foreground">Connection:</strong> open this section for safe audio and lifecycle diagnostics.</p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
