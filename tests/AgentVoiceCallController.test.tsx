import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createMeeting: vi.fn(), startMeeting: vi.fn(), joinMeeting: vi.fn(), createSession: vi.fn(),
  getSession: vi.fn(), cancelSession: vi.fn(), endMeeting: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), microphone: vi.fn(),
  handlers: new Map<string, (track: unknown) => void>(),
  startTone: vi.fn(), stopTone: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => queryKey[0] === "agent-conv"
    ? { data: { convId: "canonical-direct-conv" }, isError: false, isFetching: false, isLoading: false }
    : { data: { available: true, status: "ready", supportsFinalChatMirror: true }, isError: false, isFetching: false },
}));
vi.mock("livekit-client", () => ({
  Track: { Kind: { Audio: "audio" } },
  RoomEvent: { TrackSubscribed: "subscribed", TrackUnsubscribed: "unsubscribed", Reconnecting: "reconnecting", Reconnected: "reconnected", Disconnected: "disconnected" },
  Room: class { localParticipant = { setMicrophoneEnabled: mocks.microphone }; on(event: string, handler: (track: unknown) => void) { mocks.handlers.set(event, handler); return this; } connect = mocks.connect; disconnect = mocks.disconnect; },
}));
vi.mock("../app/lib/perkosApi", () => ({
  createProjectMeetingApi: mocks.createMeeting, startProjectMeetingApi: mocks.startMeeting,
  createMeetingJoinSessionApi: mocks.joinMeeting, createVoiceSessionApi: mocks.createSession,
  getVoiceSessionApi: mocks.getSession, cancelVoiceSessionApi: mocks.cancelSession,
  endProjectMeetingApi: mocks.endMeeting, getAgentVoiceCapabilityApi: vi.fn(),
  ensureAgentConv: vi.fn(),
}));
vi.mock("../app/lib/callStartTone", () => ({
  startCallStartTone: mocks.startTone,
  playCallEndTone: vi.fn(() => ({ stop: mocks.stopTone })),
}));

import { AgentVoiceCallController } from "../app/(app)/agents/[agentId]/AgentVoiceCallController";

describe("AgentVoiceCallController", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.values(mocks).forEach((mock) => { if (typeof mock === "function" && "mockReset" in mock) mock.mockReset(); });
    mocks.handlers.clear();
    mocks.createMeeting.mockResolvedValue({ id: "meeting-1" });
    mocks.startMeeting.mockResolvedValue({ id: "meeting-1", status: "live" });
    mocks.joinMeeting.mockResolvedValue({ url: "wss://media.invalid", token: "human-token" });
    mocks.createSession.mockResolvedValue({ id: "session-1", status: "pending" });
    mocks.getSession.mockResolvedValue({ id: "session-1", status: "joined" });
    mocks.connect.mockResolvedValue(undefined); mocks.microphone.mockResolvedValue(undefined);
    mocks.startTone.mockReturnValue({ stop: mocks.stopTone });
  });

  it("plays remote audio explicitly and removes it when unsubscribed", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const attached: HTMLMediaElement[] = [];
    const track = {
      kind: "audio",
      attach: vi.fn((element: HTMLMediaElement) => { attached.push(element); return element; }),
      detach: vi.fn((element?: HTMLMediaElement) => element ? [element] : attached),
    };
    const project = { project: { id: "project-1", pmAgent: "Bragi" } } as never;
    render(<AgentVoiceCallController agentId="bragi-enrollment" agentName="Bragi" project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Working call Bragi" }));
    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledOnce());

    mocks.handlers.get("subscribed")?.(track);
    expect(await screen.findByText("Remote audio playing.")).toBeVisible();
    const audio = attached[0] as HTMLAudioElement;
    expect(audio).toMatchObject({ autoplay: true, playsInline: true, controls: false, muted: false });
    expect(play).toHaveBeenCalled();

    mocks.handlers.get("unsubscribed")?.(track);
    expect(track.detach).toHaveBeenCalledWith(audio);
    expect(pause).toHaveBeenCalled();
    expect(audio.isConnected).toBe(false);
    play.mockRestore(); pause.mockRestore();
  });

  it("enables the microphone with browser audio processing", async () => {
    const project = { project: { id: "project-1", pmAgent: "Bragi" } } as never;
    render(<AgentVoiceCallController agentId="bragi-enrollment" agentName="Bragi" project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Working call Bragi" }));

    await waitFor(() => expect(mocks.microphone).toHaveBeenCalledWith(true, {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }));
  });

  it("starts a Working call with final_pair chat commit", async () => {
    const project = { project: { id: "project-1", pmAgent: "Bragi" } } as never;
    render(<AgentVoiceCallController agentId="bragi-enrollment" agentName="Bragi" project={project} />);

    fireEvent.click(screen.getByRole("button", { name: "Working call Bragi" }));

    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledWith({
      projectId: "project-1",
      meetingId: "meeting-1",
      agentId: "bragi-enrollment",
      chatCommit: {
        policy: "final_pair",
        consent: true,
        scope: { kind: "direct", conversationId: "canonical-direct-conv" },
      },
    }));
  });

  it("starts a Private call with an explicit off policy", async () => {
    const project = { project: { id: "project-1", pmAgent: "Bragi" } } as never;
    render(<AgentVoiceCallController agentId="bragi-enrollment" agentName="Bragi" project={project} />);

    fireEvent.click(screen.getByRole("button", { name: "Private call Bragi" }));

    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledWith({
      projectId: "project-1",
      meetingId: "meeting-1",
      agentId: "bragi-enrollment",
      chatCommit: { policy: "none" },
    }));
  });

  it("preserves an explicit project-chat scope in the Working call payload", async () => {
    const project = { project: { id: "project-1", pmAgent: "Bragi" } } as never;
    render(<AgentVoiceCallController
      agentId="bragi-enrollment"
      agentName="Bragi"
      project={project}
      chatCommitScopeKind="project"
      chatConversationId="canonical-project-conv"
    />);

    fireEvent.click(screen.getByRole("button", { name: "Working call Bragi" }));

    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({
      chatCommit: {
        policy: "final_pair",
        consent: true,
        scope: { kind: "project", conversationId: "canonical-project-conv" },
      },
    })));
  });

  it("fails chat persistence closed when project scope has no canonical conversation", async () => {
    const project = { project: { id: "project-1", pmAgent: "Bragi" } } as never;
    render(<AgentVoiceCallController
      agentId="bragi-enrollment"
      agentName="Bragi"
      project={project}
      chatCommitScopeKind="project"
    />);

    expect(screen.getByRole("button", { name: "Working call Bragi" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Private call Bragi" }));
    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({
      chatCommit: { policy: "none" },
    })));
  });

  it("fails closed when microphone audio processing cannot be enabled", async () => {
    mocks.microphone.mockRejectedValueOnce(new Error("Microphone unavailable"));
    const project = { project: { id: "project-1", pmAgent: "Bragi" } } as never;
    render(<AgentVoiceCallController agentId="bragi-enrollment" agentName="Bragi" project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Working call Bragi" }));

    expect(await screen.findByText("Microphone unavailable")).toBeVisible();
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(mocks.endMeeting).toHaveBeenCalledOnce();
  });

  afterEach(() => vi.useRealTimers());

  it("polls after session creation and shows End call when the gateway joins", async () => {
    const project = { project: { id: "project-1", pmAgent: "Bragi" } } as never;
    render(<AgentVoiceCallController agentId="bragi-enrollment" agentName="Bragi" project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Working call Bragi" }));
    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(1_000);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalledWith({
      projectId: "project-1", meetingId: "meeting-1", sessionId: "session-1", agentId: "bragi-enrollment",
    }));
    expect(await screen.findByRole("button", { name: "End call" })).toBeVisible();
    expect(mocks.startTone).toHaveBeenCalledOnce();
    expect(mocks.stopTone).toHaveBeenCalledOnce();
  });

  it("mutes and unmutes the live microphone without creating another session", async () => {
    const project = { project: { id: "project-1", pmAgent: "Bragi" } } as never;
    render(<AgentVoiceCallController agentId="bragi-enrollment" agentName="Bragi" project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Working call Bragi" }));
    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(1_000);
    const mute = await screen.findByRole("button", { name: "Mute" });
    fireEvent.click(mute);
    await waitFor(() => expect(mocks.microphone).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
    await waitFor(() => expect(mocks.microphone).toHaveBeenLastCalledWith(true));
    expect(mocks.createSession).toHaveBeenCalledOnce();
  });

  it("surfaces SDK reconnection and returns to the active call", async () => {
    const project = { project: { id: "project-1", pmAgent: "Bragi" } } as never;
    render(<AgentVoiceCallController agentId="bragi-enrollment" agentName="Bragi" project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Working call Bragi" }));
    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await screen.findByRole("button", { name: "End call" })).toBeVisible();
    mocks.handlers.get("reconnecting")?.(undefined);
    expect(await screen.findByText("Network changed. Reconnecting call…")).toBeVisible();
    mocks.handlers.get("reconnected")?.(undefined);
    expect(await screen.findByText("Call reconnected. Waiting for remote audio.")).toBeVisible();
    expect(screen.getByRole("button", { name: "End call" })).toBeVisible();
  });

  it("uses a fresh media grant after automatic reconnect is exhausted", async () => {
    const project = { project: { id: "project-1", pmAgent: "Bragi" } } as never;
    render(<AgentVoiceCallController agentId="bragi-enrollment" agentName="Bragi" project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Working call Bragi" }));
    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(1_000);
    mocks.joinMeeting.mockResolvedValueOnce({ url: "wss://media.invalid", token: "fresh-human-token" });
    mocks.handlers.get("disconnected")?.(undefined);
    await waitFor(() => expect(mocks.joinMeeting).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.connect).toHaveBeenLastCalledWith("wss://media.invalid", "fresh-human-token"));
    expect(await screen.findByText("Call reconnected. Waiting for remote audio.")).toBeVisible();
    expect(mocks.createSession).toHaveBeenCalledOnce();
  });
});
