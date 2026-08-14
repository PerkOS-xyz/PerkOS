"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Room, RoomEvent, Track } from "livekit-client";
import { AgentVoiceCallCard } from "./AgentVoiceCallCard";
import type { AgentVoiceState } from "../../../lib/agentVoice";
import {
  cancelVoiceSessionApi, createMeetingJoinSessionApi, createProjectMeetingApi, createVoiceSessionApi,
  endProjectMeetingApi, getAgentVoiceCapabilityApi, getVoiceSessionApi, startProjectMeetingApi,
  type ProjectDetail, type ProjectMeeting, type VoiceSessionApi,
} from "../../../lib/perkosApi";

export function AgentVoiceCallController({ agentId, agentName, project }: { agentId: string; agentName: string; project?: ProjectDetail }) {
  const [callState, setCallState] = useState<AgentVoiceState | null>(null); const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null); const meetingRef = useRef<ProjectMeeting | null>(null); const sessionRef = useRef<VoiceSessionApi | null>(null);
  const projectId = project?.project.id ?? "";
  const capability = useQuery({ queryKey: ["agent-voice-capability", projectId, agentId], queryFn: () => getAgentVoiceCapabilityApi({ projectId, agentId }), enabled: Boolean(projectId), refetchInterval: 15_000 });
  const capabilityState: AgentVoiceState = !projectId || capability.isError
    ? "unavailable"
    : capability.isFetching && !capability.data
      ? "checking"
      : capability.data?.available && capability.data.status === "ready" ? "ready" : "unavailable";
  const state = callState ?? capabilityState;
  useEffect(() => {
    const session = sessionRef.current; const meeting = meetingRef.current;
    if (!session || !meeting || !["connecting", "reconnecting"].includes(state)) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await getVoiceSessionApi({ projectId, meetingId: meeting.id, sessionId: session.id, agentId });
        sessionRef.current = next;
        if (next.status === "joined") setCallState("in-call");
        if (["failed", "cancelled", "expired"].includes(next.status)) { setError(`Voice session ${next.status}.`); setCallState("failed"); window.clearInterval(timer); }
      } catch { setCallState("reconnecting"); }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [agentId, projectId, state]);
  useEffect(() => () => { void roomRef.current?.disconnect(); }, []);

  const start = async () => {
    if (!project) return; setError(null); setCallState("connecting");
    try {
      const created = await createProjectMeetingApi({ projectId, title: `${agentName} voice call`, pmAgent: project.project.pmAgent || agentName, saveTranscript: false });
      const meeting = await startProjectMeetingApi({ projectId, meetingId: created.id }); meetingRef.current = meeting;
      const human = await createMeetingJoinSessionApi({ projectId, meetingId: meeting.id, displayName: "Project member", voiceProcessingConsent: true });
      const room = new Room({ adaptiveStream: true, dynacast: true }); roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === Track.Kind.Audio) document.body.appendChild(track.attach()); });
      room.on(RoomEvent.TrackUnsubscribed, (track) => { track.detach().forEach((element) => element.remove()); });
      room.on(RoomEvent.Disconnected, () => { if (sessionRef.current) setCallState("reconnecting"); });
      await room.connect(human.url, human.token); await room.localParticipant.setMicrophoneEnabled(true);
      sessionRef.current = await createVoiceSessionApi({ projectId, meetingId: meeting.id, agentId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Voice call failed."); setCallState("failed");
      const meeting = meetingRef.current; const session = sessionRef.current;
      sessionRef.current = null;
      try { if (meeting && session) await cancelVoiceSessionApi({ projectId, meetingId: meeting.id, sessionId: session.id, agentId }); } catch { /* already fail closed */ }
      try { await roomRef.current?.disconnect(); } catch { /* already fail closed */ }
      try { if (meeting) await endProjectMeetingApi({ projectId, meetingId: meeting.id, notes: "", proposals: [] }); } catch { /* surface original failure */ }
      roomRef.current = null; meetingRef.current = null;
    }
  };
  const end = async () => {
    const meeting = meetingRef.current; const session = sessionRef.current;
    try {
      if (meeting && session) await cancelVoiceSessionApi({ projectId, meetingId: meeting.id, sessionId: session.id, agentId });
      sessionRef.current = null;
      await roomRef.current?.disconnect();
      if (meeting) await endProjectMeetingApi({ projectId, meetingId: meeting.id, notes: "", proposals: [] });
      setCallState("ended"); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not end voice call."); setCallState("failed"); }
    finally { roomRef.current = null; meetingRef.current = null; sessionRef.current = null; }
  };
  return <AgentVoiceCallCard agentName={agentName} capability={capability.data ?? null} callState={state} onStart={project ? () => void start() : undefined} onEnd={() => void end()} error={error} />;
}
