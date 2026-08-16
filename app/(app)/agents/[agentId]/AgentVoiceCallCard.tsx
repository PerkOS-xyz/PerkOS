"use client";

import { Briefcase, ChevronDown, Headphones, Loader2, Mic, MicOff, Phone, PhoneOff, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
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

export type VoiceCallStartMode = "working" | "private";

const BAR_DELAYS_MS = [0, 120, 240, 360, 480] as const;

function VoiceActivityBars({ active, muted }: { active: boolean; muted?: boolean }) {
  return (
    <div
      data-testid="voice-activity"
      className={`flex h-10 items-end justify-center gap-1 ${muted ? "opacity-40" : ""}`}
      aria-hidden="true"
    >
      {BAR_DELAYS_MS.map((delay, index) => (
        <span
          key={index}
          className={`w-1.5 rounded-full bg-emerald-400 ${
            active && !muted ? "h-5 animate-bounce" : "h-2 opacity-50"
          }`}
          style={active && !muted ? { animationDelay: `${delay}ms`, animationDuration: "900ms" } : undefined}
        />
      ))}
    </div>
  );
}

export function AgentVoiceCallCard({
  agentName,
  capability,
  callState,
  onStart,
  onEnd,
  error,
  remoteAudioStatus,
  chatMirrorAvailable = false,
  chatMirrorPreparing = false,
  activeCallMode = null,
  muted = false,
  durationSeconds = 0,
  onToggleMute,
}: {
  agentName: string;
  capability?: AgentVoiceCapability | null;
  callState?: AgentVoiceState;
  onStart?: (mode: VoiceCallStartMode) => void;
  onEnd?: () => void;
  error?: string | null;
  remoteAudioStatus?: string | null;
  chatMirrorAvailable?: boolean;
  /** True while final-turn chat scope is still resolving (Working Call waits). */
  chatMirrorPreparing?: boolean;
  activeCallMode?: VoiceCallStartMode | null;
  muted?: boolean;
  durationSeconds?: number;
  onToggleMute?: () => void;
}) {
  const state = callState ?? resolveAgentVoiceState(capability);
  const busy = BUSY_STATES.includes(state);
  const canStart = canStartAgentVoiceCall(state) && Boolean(onStart);
  const duration = `${String(Math.floor(durationSeconds / 60)).padStart(2, "0")}:${String(durationSeconds % 60).padStart(2, "0")}`;
  const active = state === "in-call";
  const audioLive =
    active &&
    Boolean(
      remoteAudioStatus?.toLowerCase().includes("playing") ||
        remoteAudioStatus?.toLowerCase().includes("connected"),
    );

  return (
    <Card
      data-testid="agent-voice-card"
      className={
        active
          ? "shrink-0 gap-0 overflow-hidden border-emerald-400/40 bg-gradient-to-br from-emerald-500/10 via-card to-card py-0 shadow-lg shadow-emerald-950/20 xl:gap-4 xl:py-4"
          : "shrink-0 gap-0 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card py-0 xl:gap-4 xl:py-4"
      }
    >
      <CardHeader data-testid="desktop-voice-heading" className="hidden gap-2 xl:grid xl:gap-3 xl:p-6 xl:pb-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="flex items-center gap-2 text-base xl:text-2xl">
              <span className={active ? "relative flex h-3 w-3" : "hidden"} aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
              </span>
              {state === "unavailable" ? <MicOff className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
              {active ? `Live with ${agentName}` : `Call ${agentName}`}
            </CardTitle>
            <CardDescription className="mt-1 text-sm" aria-live="polite">
              {AGENT_VOICE_STATE_LABELS[state]}
              {active && activeCallMode ? ` · ${activeCallMode === "working" ? "Working call" : "Private call"}` : ""}
            </CardDescription>
          </div>
          {active ? <VoiceActivityBars active={audioLive || active} muted={muted} /> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-2 xl:space-y-4 xl:p-6 xl:pt-0">
        {state === "unavailable" ? (
          <p className="hidden text-sm text-muted-foreground xl:block">
            {agentName} has not reported a verified voice gateway and speech provider. Chat availability does not enable
            voice.
          </p>
        ) : null}

        {active ? (
          <div
            data-testid="mobile-voice-header"
            className="flex min-h-11 items-center gap-2 xl:min-h-14 xl:gap-3 xl:rounded-xl xl:border xl:border-border/60 xl:bg-background/40 xl:p-3"
          >
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="size-11 shrink-0 rounded-full bg-red-600 text-white shadow-sm hover:bg-red-500 focus-visible:border-red-300 focus-visible:ring-red-400/50 dark:bg-red-600 dark:hover:bg-red-500 xl:size-12"
              onClick={onEnd}
              aria-label="End call"
              title="End call"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{agentName}</p>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {AGENT_VOICE_STATE_LABELS[state]}
                {activeCallMode ? ` · ${activeCallMode === "working" ? "Working" : "Private"}` : ""}
              </p>
            </div>
            <VoiceActivityBars active={audioLive || active} muted={muted} />
            <span className="font-mono text-sm font-semibold tabular-nums" aria-label={`Call duration ${duration}`}>
              {duration}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0 rounded-full"
              onClick={onToggleMute}
              aria-pressed={muted}
              aria-label={muted ? "Unmute" : "Mute"}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          </div>
        ) : (
          <>
            <div
              data-testid="mobile-voice-header"
              className="flex min-h-11 items-center gap-2 xl:min-h-14 xl:gap-3 xl:rounded-xl xl:border xl:border-border/60 xl:bg-background/40 xl:p-3"
            >
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-full xl:size-12 ${
                  canStart ? "bg-emerald-600/20 text-emerald-400" : "bg-muted text-muted-foreground"
                }`}
                aria-hidden="true"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Phone className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{agentName}</p>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {AGENT_VOICE_STATE_LABELS[state]}
                </p>
              </div>
            </div>

            <div
              data-testid="voice-call-mode-actions"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              aria-label="Start voice call"
            >
              <Button
                type="button"
                className="h-12 min-h-12 w-full justify-start gap-3 rounded-xl bg-emerald-600 px-3 text-left text-white hover:bg-emerald-500 disabled:bg-muted disabled:text-muted-foreground"
                disabled={!canStart || busy || !chatMirrorAvailable}
                aria-disabled={!canStart || busy || !chatMirrorAvailable}
                aria-label={
                  busy
                    ? `Connecting working call`
                    : state === "failed" || state === "ended"
                      ? "Retry working call"
                      : `Working call ${agentName}`
                }
                title={
                  !chatMirrorAvailable
                    ? chatMirrorPreparing
                      ? "Preparing chat for Working call…"
                      : "Working call needs a chat conversation"
                    : "Working call — save final turns to chat"
                }
                onClick={() => onStart?.("working")}
              >
                <Briefcase className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight">Working Call</span>
                  <span className="block text-[11px] font-normal leading-tight opacity-90">
                    {chatMirrorPreparing && !chatMirrorAvailable ? "Preparing chat…" : "Saves final turns to chat"}
                  </span>
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 min-h-12 w-full justify-start gap-3 rounded-xl border-border/80 bg-background/40 px-3 text-left hover:bg-background/70"
                disabled={!canStart || busy}
                aria-disabled={!canStart || busy}
                aria-label={
                  busy
                    ? `Connecting private call`
                    : state === "failed" || state === "ended"
                      ? "Retry private call"
                      : `Private call ${agentName}`
                }
                title="Private call — nothing saved to chat"
                onClick={() => onStart?.("private")}
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight">Private Call</span>
                  <span className="block text-[11px] font-normal leading-tight text-muted-foreground">
                    No chat save · no audio kept
                  </span>
                </span>
              </Button>
            </div>
          </>
        )}

        {error ? (
          <p className="text-xs text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        {remoteAudioStatus ? (
          <p className="text-xs text-muted-foreground" role="status">
            {remoteAudioStatus}
          </p>
        ) : null}
        {state === "unavailable" ? (
          <p className="hidden text-xs text-amber-300 xl:block">
            Pending gateway capability and speech-provider configuration.
          </p>
        ) : null}
        <details className="group hidden rounded-lg border border-border/60 bg-background/30 px-3 py-2 md:block">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
            Call settings <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:grid-cols-2">
            <p>
              <strong className="text-foreground">Working Call:</strong> final user and agent text is written to chat after
              each turn. Raw audio is never saved.
            </p>
            <p>
              <strong className="text-foreground">Private Call:</strong> no final text, raw audio, or interim speech is
              persisted.
            </p>
            <p>
              <strong className="text-foreground">Audio:</strong> echo cancellation, noise suppression, and automatic gain
              control.
            </p>
            <p>
              <strong className="text-foreground">Barge-in:</strong> speaking interrupts the current agent reply.
            </p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
