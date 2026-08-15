"use client";

import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";

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
}) {
  const state = callState ?? resolveAgentVoiceState(capability);
  const busy = BUSY_STATES.includes(state);
  const enabled = canStartAgentVoiceCall(state) && Boolean(onStart);
  const mirrorLocked = busy || state === "in-call";
  const mirrorDestination = chatMirrorScope === "project" ? "project chat" : "direct chat";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {state === "unavailable" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          Voice call
        </CardTitle>
        <CardDescription aria-live="polite">
          {AGENT_VOICE_STATE_LABELS[state]}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {state === "unavailable"
            ? `${agentName} has not reported a verified voice gateway and speech provider. Text availability does not enable voice.`
            : "Voice calls use an active project meeting and temporary microphone processing consent."}
        </p>
        {chatMirrorAvailable ? (
          <div className="rounded-md border border-border/70 p-3">
            <div className="flex items-start gap-2">
              <Checkbox
                aria-label={`Save final voice turns to ${mirrorDestination}`}
                checked={chatMirrorEnabled}
                disabled={mirrorLocked}
                onCheckedChange={(checked) => onChatMirrorEnabledChange?.(checked === true)}
              />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Save final voice turns to {mirrorDestination}
                </p>
                <p className="text-xs text-muted-foreground">
                  On by default. Turn this off for a private, non-transcribed call. No raw audio or interim text is saved.
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground" role="status">
              {chatMirrorEnabled
                ? `Final user and agent text will be saved to ${mirrorDestination}.`
                : "Private call: no final user or agent text will be saved."}
            </p>
          </div>
        ) : null}
        {state === "in-call" ? <Button variant="destructive" className="gap-2" onClick={onEnd}><PhoneOff className="h-4 w-4" />End call</Button> : <Button className="gap-2" disabled={!enabled || busy} aria-disabled={!enabled || busy} onClick={onStart}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          {state === "failed" || state === "ended" ? "Retry voice call" : `Call ${agentName}`}
        </Button>}
        {error ? <p className="text-xs text-red-300" role="alert">{error}</p> : null}
        {remoteAudioStatus ? <p className="text-xs text-muted-foreground" role="status">{remoteAudioStatus}</p> : null}
        {state === "unavailable" ? (
          <p className="text-xs text-amber-300">
            Pending gateway capability and speech-provider configuration.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
