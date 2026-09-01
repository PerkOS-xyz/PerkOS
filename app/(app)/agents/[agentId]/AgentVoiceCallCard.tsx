"use client";

import { Briefcase, ChevronDown, Headphones, Loader2, Mic, MicOff, Phone, PhoneOff, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  canStartAgentVoiceCall,
  resolveAgentVoiceState,
  type AgentVoiceCapability,
  type AgentVoiceState,
} from "../../../lib/agentVoice";
import { speechVoiceChipLabel } from "../../../lib/speechVoiceLabels";
import type { SpeechVoice } from "../../../lib/perkosApi";

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
  speechVoice = null,
  ending = false,
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
  /** Owner-selected TTS voice for the next/active call (presentation only). */
  speechVoice?: SpeechVoice | string | null;
  /** True while hang-up is in flight (disables re-taps; shows Ending…). */
  ending?: boolean;
}) {
  const { t } = useTranslation();
  const state = callState ?? resolveAgentVoiceState(capability);
  const busy = BUSY_STATES.includes(state);
  const canStart = canStartAgentVoiceCall(state) && Boolean(onStart);
  const duration = `${String(Math.floor(durationSeconds / 60)).padStart(2, "0")}:${String(durationSeconds % 60).padStart(2, "0")}`;
  const voiceChip = speechVoiceChipLabel(speechVoice as SpeechVoice | null | undefined);
  const active = state === "in-call" || ending;
  const audioLive =
    state === "in-call" &&
    !ending &&
    Boolean(
      remoteAudioStatus?.toLowerCase().includes("playing") ||
        remoteAudioStatus?.toLowerCase().includes("connected"),
    );
  const [endPressed, setEndPressed] = useState(false);
  const endBusy = ending || endPressed;

  useEffect(() => {
    if (!active || (!ending && state !== "in-call")) setEndPressed(false);
  }, [active, ending, state]);

  const handleEnd = () => {
    if (endBusy || !onEnd) return;
    setEndPressed(true);
    onEnd();
  };

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
              <span className={active && !endBusy ? "relative flex h-3 w-3" : "hidden"} aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
              </span>
              {state === "unavailable" ? <MicOff className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
              {active ? t("agentDetail.voice.liveWith", { name: agentName }) : t("agentDetail.voice.callAgent", { name: agentName })}
            </CardTitle>
            <CardDescription className="mt-1 text-sm" aria-live="polite">
              {endBusy ? t("agentDetail.voice.endingCall") : t(`agentDetail.voice.state.${state}`)}
              {active && activeCallMode ? ` · ${activeCallMode === "working" ? t("agentDetail.voice.workingCall") : t("agentDetail.voice.privateCall")}` : ""}
              {voiceChip ? ` · ${t("agentDetail.voice.voice", { voice: voiceChip })}` : ""}
            </CardDescription>
          </div>
          {active ? <VoiceActivityBars active={audioLive || (active && !endBusy)} muted={muted || endBusy} /> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-2 xl:space-y-4 xl:p-6 xl:pt-0">
        {state === "unavailable" ? (
          <p className="hidden text-sm text-muted-foreground xl:block">
            {t("agentDetail.voice.unavailableDescription", { name: agentName })}
          </p>
        ) : null}

        {active ? (
          <div className="space-y-2" data-testid="active-call-controls">
            <div
              data-testid="mobile-voice-header"
              className="flex min-h-12 items-center gap-2 xl:min-h-14 xl:gap-3 xl:rounded-xl xl:border xl:border-border/60 xl:bg-background/40 xl:p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{agentName}</p>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {endBusy ? t("agentDetail.voice.endingCall") : t(`agentDetail.voice.state.${state}`)}
                  {activeCallMode ? ` · ${activeCallMode === "working" ? t("agentDetail.voice.working") : t("agentDetail.voice.private")}` : ""}
                  {voiceChip ? ` · ${voiceChip}` : ""}
                </p>
              </div>
              <VoiceActivityBars active={audioLive || (active && !endBusy)} muted={muted || endBusy} />
              <span className="font-mono text-sm font-semibold tabular-nums" aria-label={t("agentDetail.voice.duration", { duration })}>
                {duration}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-12 shrink-0 rounded-full xl:size-12"
                onClick={onToggleMute}
                disabled={endBusy}
                aria-pressed={muted}
                aria-label={muted ? t("agentDetail.voice.unmute") : t("agentDetail.voice.mute")}
                title={muted ? t("agentDetail.voice.unmute") : t("agentDetail.voice.mute")}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
            </div>

            <Button
              type="button"
              variant="destructive"
              data-testid="voice-end-call"
              className="h-14 min-h-14 w-full gap-2 rounded-2xl bg-red-600 text-base font-semibold text-white shadow-md shadow-red-950/30 hover:bg-red-500 focus-visible:border-red-300 focus-visible:ring-red-400/50 active:scale-[0.99] disabled:opacity-80 dark:bg-red-600 dark:hover:bg-red-500 xl:h-16 xl:min-h-16 xl:text-lg"
              onClick={handleEnd}
              disabled={endBusy || !onEnd}
              aria-busy={endBusy}
              aria-label={endBusy ? t("agentDetail.voice.endingCall") : t("agentDetail.voice.endCall")}
              title={endBusy ? t("agentDetail.voice.endingCall") : t("agentDetail.voice.endCall")}
            >
              {endBusy ? (
                <Loader2 className="h-6 w-6 shrink-0 animate-spin xl:h-7 xl:w-7" />
              ) : (
                <PhoneOff className="h-6 w-6 shrink-0 xl:h-7 xl:w-7" />
              )}
              {endBusy ? t("agentDetail.voice.ending") : t("agentDetail.voice.endCall")}
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
                <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="voice-speech-chip">
                  {t(`agentDetail.voice.state.${state}`)}
                  {voiceChip ? ` · ${voiceChip}` : ""}
                </p>
              </div>
            </div>

            <div
              data-testid="voice-call-mode-actions"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              aria-label={t("agentDetail.voice.start")}
            >
              <Button
                type="button"
                className="h-12 min-h-12 w-full justify-start gap-3 rounded-xl bg-emerald-600 px-3 text-left text-white hover:bg-emerald-500 disabled:bg-muted disabled:text-muted-foreground"
                disabled={!canStart || busy || !chatMirrorAvailable}
                aria-disabled={!canStart || busy || !chatMirrorAvailable}
                aria-label={
                  busy
                    ? t("agentDetail.voice.connectingWorking")
                    : state === "failed" || state === "ended"
                      ? t("agentDetail.voice.retryWorking")
                      : t("agentDetail.voice.workingWith", { name: agentName })
                }
                title={
                  !chatMirrorAvailable
                    ? chatMirrorPreparing
                      ? t("agentDetail.voice.preparingChatWorking")
                      : t("agentDetail.voice.workingNeedsChat")
                    : t("agentDetail.voice.workingTitle")
                }
                onClick={() => onStart?.("working")}
              >
                <Briefcase className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight">{t("agentDetail.voice.workingCall")}</span>
                  <span className="block text-[11px] font-normal leading-tight opacity-90">
                    {chatMirrorPreparing && !chatMirrorAvailable ? t("agentDetail.voice.preparingChat") : t("agentDetail.voice.savesTurns")}
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
                    ? t("agentDetail.voice.connectingPrivate")
                    : state === "failed" || state === "ended"
                      ? t("agentDetail.voice.retryPrivate")
                      : t("agentDetail.voice.privateWith", { name: agentName })
                }
                title={t("agentDetail.voice.privateTitle")}
                onClick={() => onStart?.("private")}
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight">{t("agentDetail.voice.privateCall")}</span>
                  <span className="block text-[11px] font-normal leading-tight text-muted-foreground">
                    {t("agentDetail.voice.privateSummary")}
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
        {remoteAudioStatus && !endBusy ? (
          <p className="text-xs text-muted-foreground" role="status">
            {remoteAudioStatus}
          </p>
        ) : null}
        {state === "unavailable" ? (
          <p className="hidden text-xs text-amber-300 xl:block">
            {t("agentDetail.voice.pendingCapability")}
          </p>
        ) : null}
        <details className="group hidden rounded-lg border border-border/60 bg-background/30 px-3 py-2 md:block">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
            {t("agentDetail.voice.settings")} <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:grid-cols-2">
            <p>
              <strong className="text-foreground">{t("agentDetail.voice.workingCall")}:</strong> {t("agentDetail.voice.workingDetails")}
            </p>
            <p>
              <strong className="text-foreground">{t("agentDetail.voice.privateCall")}:</strong> {t("agentDetail.voice.privateDetails")}
            </p>
            <p>
              <strong className="text-foreground">{t("agentDetail.voice.audio")}:</strong> {t("agentDetail.voice.audioDetails")}
            </p>
            <p>
              <strong className="text-foreground">{t("agentDetail.voice.bargeIn")}:</strong> {t("agentDetail.voice.bargeInDetails")}
            </p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
