"use client";

import { Loader2, Mic, MicOff } from "lucide-react";

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

export function AgentVoiceCallCard({
  agentName,
  capability,
  callState,
  onStart,
}: {
  agentName: string;
  capability?: AgentVoiceCapability | null;
  callState?: AgentVoiceState;
  onStart?: () => void;
}) {
  const state = callState ?? resolveAgentVoiceState(capability);
  const busy = BUSY_STATES.includes(state);
  const enabled = canStartAgentVoiceCall(state) && Boolean(onStart);

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
        <Button className="gap-2" disabled={!enabled || busy} aria-disabled={!enabled || busy} onClick={onStart}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          {state === "failed" || state === "ended" ? "Retry voice call" : `Call ${agentName}`}
        </Button>
        {state === "unavailable" ? (
          <p className="text-xs text-amber-300">
            Pending gateway capability and speech-provider configuration.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
