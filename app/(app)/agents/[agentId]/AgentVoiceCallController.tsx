"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Room, RoomEvent, Track } from "livekit-client";
import { AgentVoiceCallCard } from "./AgentVoiceCallCard";
import type { AgentVoiceState } from "../../../lib/agentVoice";
import { startCallStartTone, type CallStartTone } from "../../../lib/callStartTone";
import {
  cancelVoiceSessionApi, createMeetingJoinSessionApi, createProjectMeetingApi, createVoiceSessionApi,
  endProjectMeetingApi, ensureAgentConv, getAgentVoiceCapabilityApi, getVoiceSessionApi, startProjectMeetingApi,
  type ProjectDetail, type ProjectMeeting, type VoiceSessionApi,
} from "../../../lib/perkosApi";

export function AgentVoiceCallController({ agentId, agentName, project, chatCommitScopeKind = "direct", chatConversationId }: { agentId: string; agentName: string; project?: ProjectDetail; chatCommitScopeKind?: "direct" | "project"; chatConversationId?: string }) {
  const [callState, setCallState] = useState<AgentVoiceState | null>(null); const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<VoiceSessionApi | null>(null);
  const [remoteAudioStatus, setRemoteAudioStatus] = useState<string | null>(null);
  const [activeCallMode, setActiveCallMode] = useState<"working" | "private" | null>(null);
  const [muted, setMuted] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const roomRef = useRef<Room | null>(null); const meetingRef = useRef<ProjectMeeting | null>(null); const sessionRef = useRef<VoiceSessionApi | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioTrackRef = useRef<{ detach: (element?: HTMLMediaElement) => HTMLMediaElement[] } | null>(null);
  const callStartToneRef = useRef<CallStartTone | null>(null);
  const reconnectGenerationRef = useRef(0);
  const mutedRef = useRef(false);
  const projectId = project?.project.id ?? "";
  const capability = useQuery({ queryKey: ["agent-voice-capability", projectId, agentId], queryFn: () => getAgentVoiceCapabilityApi({ projectId, agentId }), enabled: Boolean(projectId), refetchInterval: 15_000 });
  const directConversation = useQuery({
    queryKey: ["agent-conv", agentId, "voice-chat-commit"],
    queryFn: () => ensureAgentConv({ agentId }),
    enabled: chatCommitScopeKind === "direct" && (capability.data?.supportsFinalChatMirror === true || capability.data?.available === true),
    staleTime: 5 * 60 * 1000,
  });
  const capabilityState: AgentVoiceState = !projectId || capability.isError
    ? "unavailable"
    : capability.isFetching && !capability.data
      ? "checking"
      : capability.data?.available && capability.data.status === "ready" ? "ready" : "unavailable";
  const state = callState ?? capabilityState;
  const resolvedConversationId = chatCommitScopeKind === "direct"
    ? directConversation.data?.convId
    : chatConversationId;
  // Platform feature: Working Call (final_pair). Prefer explicit capability flag when present;
  // also allow when voice is ready so older gateways without the flag still unlock Working once chat exists.
  const platformSupportsMirror = capability.data?.supportsFinalChatMirror === true
    || (capability.data?.available === true && capability.data.status === "ready");
  const chatMirrorAvailable = platformSupportsMirror && Boolean(resolvedConversationId);
  const chatMirrorPreparing = platformSupportsMirror
    && chatCommitScopeKind === "direct"
    && !resolvedConversationId
    && (directConversation.isFetching || directConversation.isLoading);
  useEffect(() => {
    const session = activeSession; const meeting = meetingRef.current;
    if (!session || !meeting || !["connecting", "reconnecting"].includes(state)) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await getVoiceSessionApi({ projectId, meetingId: meeting.id, sessionId: session.id, agentId });
        sessionRef.current = next;
        setActiveSession(next);
        if (next.status === "joined") { callStartToneRef.current?.stop(); callStartToneRef.current = null; setCallState("in-call"); setCallStartedAt((current) => current ?? Date.now()); }
        if (["failed", "cancelled", "expired"].includes(next.status)) { callStartToneRef.current?.stop(); callStartToneRef.current = null; setError(`Voice session ${next.status}.`); setCallState("failed"); window.clearInterval(timer); }
      } catch { setCallState("reconnecting"); }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [activeSession, agentId, projectId, state]);
  useEffect(() => {
    if (!callStartedAt || state !== "in-call") return;
    const tick = () => setDurationSeconds(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1_000)));
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [callStartedAt, state]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  const cleanupRemoteAudio = useCallback(() => {
    const audio = remoteAudioRef.current;
    if (audio) {
      remoteAudioTrackRef.current?.detach(audio);
      audio.pause();
      audio.remove();
    }
    remoteAudioRef.current = null;
    remoteAudioTrackRef.current = null;
  }, []);
  useEffect(() => () => { reconnectGenerationRef.current += 1; callStartToneRef.current?.stop(); cleanupRemoteAudio(); void roomRef.current?.disconnect(); }, [cleanupRemoteAudio]);

  const start = async (mode: "working" | "private") => {
    if (!project) return;
    if (mode === "working" && !chatMirrorAvailable) {
      setError(chatMirrorPreparing ? "Preparing chat for Working call…" : "Working call needs a chat conversation.");
      return;
    }
    callStartToneRef.current?.stop(); callStartToneRef.current = startCallStartTone(); setError(null); setRemoteAudioStatus(null); setMuted(false); setCallStartedAt(null); setDurationSeconds(0); setActiveCallMode(mode); setCallState("connecting");
    try {
      const created = await createProjectMeetingApi({ projectId, title: `${agentName} voice call`, pmAgent: project.project.pmAgent || agentName, saveTranscript: false });
      const meeting = await startProjectMeetingApi({ projectId, meetingId: created.id }); meetingRef.current = meeting;
      const human = await createMeetingJoinSessionApi({ projectId, meetingId: meeting.id, displayName: "Project member", voiceProcessingConsent: true });
      const room = new Room({ adaptiveStream: true, dynacast: true }); roomRef.current = room;
      const reconnectGeneration = reconnectGenerationRef.current + 1;
      reconnectGenerationRef.current = reconnectGeneration;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        cleanupRemoteAudio();
        const audio = document.createElement("audio");
        audio.autoplay = true; (audio as HTMLAudioElement & { playsInline: boolean }).playsInline = true; audio.controls = false; audio.muted = false;
        track.attach(audio); document.body.appendChild(audio);
        remoteAudioRef.current = audio; remoteAudioTrackRef.current = track;
        setRemoteAudioStatus("Remote audio connected.");
        void Promise.resolve(audio.play())
          .then(() => setRemoteAudioStatus("Remote audio playing."))
          .catch(() => setRemoteAudioStatus("Remote audio playback needs browser permission."));
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => { if (track === remoteAudioTrackRef.current) { cleanupRemoteAudio(); setRemoteAudioStatus(null); } });
      room.on(RoomEvent.Reconnecting, () => {
        if (!sessionRef.current) return;
        setCallState("reconnecting");
        setRemoteAudioStatus("Network changed. Reconnecting call…");
      });
      room.on(RoomEvent.Reconnected, () => {
        if (!sessionRef.current) return;
        setCallState("in-call");
        setRemoteAudioStatus(remoteAudioRef.current ? "Remote audio connected." : "Call reconnected. Waiting for remote audio.");
      });
      room.on(RoomEvent.Disconnected, () => {
        if (!sessionRef.current || reconnectGenerationRef.current !== reconnectGeneration) return;
        setCallState("reconnecting");
        setRemoteAudioStatus("Connection lost. Restoring the call…");
        void (async () => {
          for (const delayMs of [0, 1_000, 2_000, 4_000, 8_000, 15_000]) {
            if (!sessionRef.current || reconnectGenerationRef.current !== reconnectGeneration) return;
            if (delayMs) await new Promise((resolve) => window.setTimeout(resolve, delayMs));
            if (!sessionRef.current || reconnectGenerationRef.current !== reconnectGeneration) return;
            if (typeof navigator !== "undefined" && navigator.onLine === false) continue;
            try {
              const fresh = await createMeetingJoinSessionApi({ projectId, meetingId: meeting.id, displayName: "Project member", voiceProcessingConsent: true });
              await room.connect(fresh.url, fresh.token);
              await room.localParticipant.setMicrophoneEnabled(!mutedRef.current, {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              });
              if (!sessionRef.current || reconnectGenerationRef.current !== reconnectGeneration) return;
              setCallState("in-call");
              setRemoteAudioStatus("Call reconnected. Waiting for remote audio.");
              return;
            } catch { /* retry with a fresh short-lived grant */ }
          }
          if (!sessionRef.current || reconnectGenerationRef.current !== reconnectGeneration) return;
          setError("The network connection could not be restored. The call was ended safely.");
          setCallState("failed");
          const active = sessionRef.current;
          sessionRef.current = null;
          setActiveSession(null);
          try { await cancelVoiceSessionApi({ projectId, meetingId: meeting.id, sessionId: active.id, agentId }); } catch { /* lease remains fail closed */ }
          cleanupRemoteAudio();
          try { await endProjectMeetingApi({ projectId, meetingId: meeting.id, notes: "", proposals: [] }); } catch { /* original failure remains visible */ }
        })();
      });
      await room.connect(human.url, human.token);
      await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      const mirrorEnabled = mode === "working" && chatMirrorAvailable && Boolean(resolvedConversationId);
      const session = await createVoiceSessionApi({
        projectId,
        meetingId: meeting.id,
        agentId,
        chatCommit: mirrorEnabled
          ? {
              policy: "final_pair",
              consent: true,
              scope: { kind: chatCommitScopeKind, conversationId: resolvedConversationId! },
            }
          : { policy: "none" },
      });
      sessionRef.current = session;
      setActiveSession(session);
    } catch (cause) {
      callStartToneRef.current?.stop(); callStartToneRef.current = null;
      setError(cause instanceof Error ? cause.message : "Voice call failed."); setCallState("failed");
      const meeting = meetingRef.current; const session = sessionRef.current;
      sessionRef.current = null;
      setActiveSession(null);
      try { if (meeting && session) await cancelVoiceSessionApi({ projectId, meetingId: meeting.id, sessionId: session.id, agentId }); } catch { /* already fail closed */ }
      try { await roomRef.current?.disconnect(); } catch { /* already fail closed */ }
      cleanupRemoteAudio();
      try { if (meeting) await endProjectMeetingApi({ projectId, meetingId: meeting.id, notes: "", proposals: [] }); } catch { /* surface original failure */ }
      roomRef.current = null; meetingRef.current = null;
    }
  };
  const end = async () => {
    reconnectGenerationRef.current += 1;
    callStartToneRef.current?.stop(); callStartToneRef.current = null;
    const meeting = meetingRef.current; const session = sessionRef.current;
    try {
      if (meeting && session) await cancelVoiceSessionApi({ projectId, meetingId: meeting.id, sessionId: session.id, agentId });
      sessionRef.current = null;
      setActiveSession(null);
      await roomRef.current?.disconnect();
      cleanupRemoteAudio();
      if (meeting) await endProjectMeetingApi({ projectId, meetingId: meeting.id, notes: "", proposals: [] });
      setCallState("ended"); setError(null); setCallStartedAt(null); setDurationSeconds(0); setMuted(false); setActiveCallMode(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not end voice call."); setCallState("failed"); }
    finally { roomRef.current = null; meetingRef.current = null; sessionRef.current = null; setActiveSession(null); }
  };
  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room || state !== "in-call") return;
    try {
      const next = !muted;
      await room.localParticipant.setMicrophoneEnabled(!next);
      setMuted(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change microphone state.");
    }
  };
  return <AgentVoiceCallCard
    agentName={agentName}
    capability={capability.data ?? null}
    callState={state}
    onStart={project ? (mode) => void start(mode) : undefined}
    onEnd={() => void end()}
    error={error}
    remoteAudioStatus={remoteAudioStatus}
    muted={muted}
    durationSeconds={durationSeconds}
    onToggleMute={() => void toggleMute()}
    chatMirrorAvailable={chatMirrorAvailable}
    chatMirrorPreparing={chatMirrorPreparing}
    activeCallMode={activeCallMode}
  />;
}
