"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Captions, Check, CircleStop, Loader2, Mic, MicOff, Plus, Video, VideoOff } from "lucide-react";
import { Participant, Room, RoomEvent, Track } from "livekit-client";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  approveMeetingProposalsApi,
  createMeetingJoinSessionApi,
  createProjectMeetingApi,
  endProjectMeetingApi,
  listProjectMeetingsApi,
  startProjectMeetingApi,
  type ProjectMeeting,
} from "../lib/perkosApi";

type Phase = "setup" | "connecting" | "live" | "review";
type PmState = "joining" | "listening" | "thinking" | "speaking" | "offline";

function pmState(participant: Participant | undefined, offline: boolean): PmState {
  if (offline) return "offline";
  if (!participant) return "joining";
  if (participant.isSpeaking || participant.attributes["lk.agent.state"] === "speaking") return "speaking";
  if (participant.attributes["lk.agent.state"] === "thinking") return "thinking";
  return "listening";
}

function PmAvatar({ name, state, level = 0 }: { name: string; state: PmState; level?: number }) {
  const labels: Record<PmState, string> = {
    joining: "joining…",
    listening: "listening",
    thinking: "thinking…",
    speaking: "speaking",
    offline: "offline · notes-only",
  };
  return (
    <div className="relative flex min-h-48 flex-col items-center justify-center overflow-hidden rounded-xl border border-primary/35 bg-gradient-to-br from-primary/10 to-[#0e0716] p-5">
      <div className={cn("absolute h-28 w-28 rounded-full border transition-shadow motion-reduce:transition-none", state === "speaking" ? "border-primary shadow-[0_0_38px_rgba(236,27,105,.3)]" : "border-primary/35")} />
      <div className="relative grid h-20 w-20 place-items-center rounded-full bg-primary/15"><Bot className="h-10 w-10 text-primary" /></div>
      <div className="relative mt-4 flex h-7 items-center gap-1" aria-hidden="true">
        {[0.55, 0.9, 0.7, 1, 0.6].map((factor, index) => <span key={index} className="w-1 rounded-full bg-primary transition-[height] motion-reduce:transition-none" style={{ height: state === "speaking" ? `${Math.max(5, 6 + level * 42 * factor)}px` : "5px" }} />)}
      </div>
      <strong className="mt-2 text-sm text-foreground">{name}</strong>
      <span aria-live="polite" className="text-xs text-muted-foreground">AI · PM Agent · {labels[state]}</span>
    </div>
  );
}

function HumanTile({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const video = participant.getTrackPublication(Track.Source.Camera)?.track;
    const audio = participant.getTrackPublication(Track.Source.Microphone)?.track;
    const videoElement = videoRef.current;
    const audioElement = audioRef.current;
    if (video && videoElement) video.attach(videoElement);
    if (audio && audioElement && !participant.isLocal) audio.attach(audioElement);
    return () => {
      if (video && videoElement) video.detach(videoElement);
      if (audio && audioElement) audio.detach(audioElement);
    };
  }, [participant]);
  const hasVideo = Boolean(participant.getTrackPublication(Track.Source.Camera)?.track);
  const label = participant.name || (participant.isLocal ? "You" : participant.identity);
  return (
    <div className={cn("relative min-h-48 overflow-hidden rounded-xl border bg-[#0e0716]", participant.isSpeaking ? "border-primary" : "border-border")}>
      {hasVideo ? <video ref={videoRef} autoPlay playsInline muted={participant.isLocal} className="h-full w-full object-cover" /> : <div className="grid h-full min-h-48 place-items-center text-3xl font-semibold text-muted-foreground">{label.slice(0, 2).toUpperCase()}</div>}
      <audio ref={audioRef} autoPlay />
      <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs text-white">{label}</span>
    </div>
  );
}

export default function ProjectMeetingsTab({
  projectId,
  projectName,
  pmAgent,
  ownerWallet,
  canManage,
}: {
  projectId: string;
  projectName: string;
  pmAgent?: string | null;
  ownerWallet?: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("setup");
  const [meeting, setMeeting] = useState<ProjectMeeting | null>(null);
  const [history, setHistory] = useState<ProjectMeeting[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [consent, setConsent] = useState(false);
  const [saveTranscript, setSaveTranscript] = useState(false);
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [captions, setCaptions] = useState(true);
  const [caption, setCaption] = useState("");
  const [notes, setNotes] = useState("## Progress\n\n## Blockers\n\n## Decisions\n");
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposals, setProposals] = useState<Array<{ title: string; description?: string }>>([]);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listProjectMeetingsApi({ projectId, owner: ownerWallet }).then(setHistory).catch(() => undefined);
  }, [ownerWallet, projectId]);
  useEffect(() => () => { void room?.disconnect(); }, [room]);

  const sync = (activeRoom: Room) => setParticipants([activeRoom.localParticipant, ...activeRoom.remoteParticipants.values()]);
  const pmParticipant = participants.find((participant) => participant.identity.startsWith("agent:") || Boolean(participant.attributes["lk.agent.state"]));
  const humans = useMemo(() => participants.filter((participant) => participant !== pmParticipant), [participants, pmParticipant]);

  useEffect(() => {
    if (phase !== "live" || providerError || pmParticipant) return;
    const timeout = window.setTimeout(() => setProviderError("PM Voice Gateway did not join"), 15_000);
    return () => window.clearTimeout(timeout);
  }, [phase, providerError, pmParticipant]);

  const start = async () => {
    if (!pmAgent || !consent) return;
    setBusy(true);
    setError(null);
    setProviderError(null);
    setPhase("connecting");
    try {
      const created = await createProjectMeetingApi({ projectId, owner: ownerWallet, title: `${projectName} stand-up`, pmAgent, saveTranscript });
      const started = await startProjectMeetingApi({ projectId, meetingId: created.id, owner: ownerWallet });
      setMeeting(started);
      try {
        const session = await createMeetingJoinSessionApi({ projectId, meetingId: created.id, owner: ownerWallet, displayName: "Project member", voiceProcessingConsent: true });
        const nextRoom = new Room({ adaptiveStream: true, dynacast: true });
        const refresh = () => sync(nextRoom);
        nextRoom.on(RoomEvent.ParticipantConnected, refresh);
        nextRoom.on(RoomEvent.ParticipantDisconnected, refresh);
        nextRoom.on(RoomEvent.TrackSubscribed, refresh);
        nextRoom.on(RoomEvent.TrackUnsubscribed, refresh);
        nextRoom.on(RoomEvent.ActiveSpeakersChanged, refresh);
        nextRoom.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
          const latest = segments.at(-1)?.text.trim();
          if (latest) setCaption(`${participant?.name || participant?.identity || "Speaker"}: ${latest}`);
        });
        await nextRoom.connect(session.url, session.token);
        await Promise.all([nextRoom.localParticipant.setCameraEnabled(camera), nextRoom.localParticipant.setMicrophoneEnabled(mic)]);
        setRoom(nextRoom);
        sync(nextRoom);
      } catch (cause) {
        setProviderError(cause instanceof Error ? cause.message : "Voice/video unavailable");
      }
      setPhase("live");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't start the meeting.");
      setPhase("setup");
    } finally {
      setBusy(false);
    }
  };

  const stopPm = async () => {
    if (!room) return;
    const encoded = new TextEncoder().encode(JSON.stringify({ type: "meeting.stop_pm", meetingId: meeting?.id }));
    const payload = new Uint8Array(encoded.byteLength);
    payload.set(encoded);
    await room.localParticipant.publishData(payload, { reliable: true, topic: "perkos.meeting.control" });
  };

  const end = async () => {
    if (!meeting) return;
    setBusy(true);
    try {
      await room?.disconnect();
      setRoom(null);
      const finished = await endProjectMeetingApi({ projectId, meetingId: meeting.id, owner: ownerWallet, notes, proposals });
      setMeeting(finished);
      setHistory((current) => [finished, ...current.filter((item) => item.id !== finished.id)]);
      setPhase("review");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't end the meeting.");
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    const proposalIds = meeting?.proposals?.filter((item) => !item.materializedTaskId).map((item) => item.id) ?? [];
    if (!meeting || proposalIds.length === 0) return;
    setBusy(true);
    try {
      await approveMeetingProposalsApi({ projectId, meetingId: meeting.id, owner: ownerWallet, proposalIds });
      await queryClient.invalidateQueries({ queryKey: ["wallet-project", ownerWallet, projectId] });
      setPhase("setup");
      setMeeting(null);
      setProposals([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't create backlog tasks.");
    } finally {
      setBusy(false);
    }
  };

  if (phase === "setup") return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <section className="glow-card rounded-xl border border-border bg-card p-5">
        <div className="grid gap-5 md:grid-cols-[220px_1fr]"><PmAvatar name={pmAgent || "Project PM"} state="listening" /><div><h2 className="text-xl font-semibold">Project stand-up</h2><p className="mt-2 text-sm text-muted-foreground">One PM Agent listens, drafts Meeting Notes, and proposes tasks. It does not wake the project team or create work without approval.</p><label className="mt-5 flex items-start gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" /><span>I allow temporary voice processing. Audio recording is off by default.</span></label><label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={saveTranscript} onChange={(event) => setSaveTranscript(event.target.checked)} /> Save transcript in Meeting Notes</label>{!pmAgent ? <p className="mt-3 text-sm text-amber-300">Designate a PM Agent in the Agents tab first.</p> : null}{error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}<Button className="mt-5 gap-2" disabled={!canManage || !pmAgent || !consent || busy} onClick={() => void start()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} Start 15-minute stand-up</Button></div></div>
      </section>
      <aside className="rounded-xl border border-border bg-card p-4"><h3 className="text-sm font-semibold">Recent meetings</h3><div className="mt-3 space-y-2">{history.length ? history.slice(0, 6).map((item) => <div key={item.id} className="rounded-lg border border-border p-3"><div className="text-sm text-foreground">{item.title}</div><div className="mt-1 text-xs capitalize text-muted-foreground">{item.status.replaceAll("_", " ")}</div></div>) : <p className="text-sm text-muted-foreground">No meetings yet.</p>}</div></aside>
    </div>
  );

  if (phase === "review") return (
    <section className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-card p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Check className="h-5 w-5 text-emerald-400" /> Meeting Notes ready</h2><p className="mt-1 text-sm text-muted-foreground">The notes are in Docs. Review proposals before adding them to Backlog.</p><div className="mt-4 space-y-2">{meeting?.proposals?.map((proposal) => <div key={proposal.id} className="rounded-lg border border-border p-3"><strong className="text-sm">{proposal.title}</strong>{proposal.desc ? <p className="mt-1 text-sm text-muted-foreground">{proposal.desc}</p> : null}</div>)}</div>{error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setPhase("setup")}>Review later</Button><Button disabled={busy || !meeting?.proposals?.length} onClick={() => void approve()}>Approve all to Backlog</Button></div></section>
  );

  return (
    <div className="grid min-h-[620px] gap-4 lg:grid-cols-[1fr_340px]">
      <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card p-3">
        {providerError ? <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-200">Voice/video unavailable: {providerError}. Continue in notes-only mode.</div> : null}
        <div className="grid min-h-0 flex-1 gap-3 overflow-auto sm:grid-cols-2"><PmAvatar name={pmAgent || "Project PM"} state={phase === "connecting" ? "joining" : pmState(pmParticipant, Boolean(providerError))} level={pmParticipant?.audioLevel} />{humans.map((participant) => <HumanTile key={participant.identity} participant={participant} />)}</div>
        {captions ? <div aria-live="polite" className="mt-3 min-h-10 rounded-lg border border-border bg-background/60 p-2 text-center text-sm text-muted-foreground">{caption || "Live captions will appear here when someone speaks."}</div> : null}
        <div className="mt-3 flex justify-center gap-2"><Button size="icon" variant="outline" aria-label={mic ? "Mute microphone" : "Unmute microphone"} onClick={() => { const next = !mic; setMic(next); void room?.localParticipant.setMicrophoneEnabled(next); }}>{mic ? <Mic /> : <MicOff />}</Button><Button size="icon" variant="outline" aria-label={camera ? "Turn camera off" : "Turn camera on"} onClick={() => { const next = !camera; setCamera(next); void room?.localParticipant.setCameraEnabled(next); }}>{camera ? <Video /> : <VideoOff />}</Button><Button size="icon" variant={captions ? "default" : "outline"} aria-label="Toggle captions" onClick={() => setCaptions((value) => !value)}><Captions /></Button><Button size="icon" variant="outline" disabled={!room || !pmParticipant} aria-label="Stop PM speaking" onClick={() => void stopPm()}><CircleStop /></Button><Button variant="destructive" disabled={busy || phase === "connecting"} onClick={() => void end()}>End</Button></div>
      </section>
      <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card"><div className="border-b border-border px-4 py-3 text-sm font-semibold">Live Notes & Proposals</div><textarea aria-label="Meeting notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-64 flex-1 resize-none bg-transparent p-4 text-sm outline-none" /><div className="border-t border-border p-3"><div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Proposed tasks · approval required</div><div className="max-h-32 space-y-1 overflow-auto">{proposals.map((proposal, index) => <div key={`${proposal.title}-${index}`} className="rounded bg-muted px-2 py-1.5 text-sm">{proposal.title}</div>)}</div><div className="mt-2 flex gap-2"><input value={proposalTitle} onChange={(event) => setProposalTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && proposalTitle.trim()) { setProposals((current) => [...current, { title: proposalTitle.trim() }]); setProposalTitle(""); } }} placeholder="Capture a proposed task" className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none" /><Button size="icon" aria-label="Add proposed task" onClick={() => { if (proposalTitle.trim()) { setProposals((current) => [...current, { title: proposalTitle.trim() }]); setProposalTitle(""); } }}><Plus /></Button></div></div></aside>
    </div>
  );
}
