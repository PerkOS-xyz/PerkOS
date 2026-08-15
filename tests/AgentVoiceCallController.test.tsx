import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createMeeting: vi.fn(), startMeeting: vi.fn(), joinMeeting: vi.fn(), createSession: vi.fn(),
  getSession: vi.fn(), cancelSession: vi.fn(), endMeeting: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), microphone: vi.fn(),
  handlers: new Map<string, (track: unknown) => void>(),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { available: true, status: "ready" }, isError: false, isFetching: false }) }));
vi.mock("livekit-client", () => ({
  Track: { Kind: { Audio: "audio" } },
  RoomEvent: { TrackSubscribed: "subscribed", TrackUnsubscribed: "unsubscribed", Disconnected: "disconnected" },
  Room: class { localParticipant = { setMicrophoneEnabled: mocks.microphone }; on(event: string, handler: (track: unknown) => void) { mocks.handlers.set(event, handler); return this; } connect = mocks.connect; disconnect = mocks.disconnect; },
}));
vi.mock("../app/lib/perkosApi", () => ({
  createProjectMeetingApi: mocks.createMeeting, startProjectMeetingApi: mocks.startMeeting,
  createMeetingJoinSessionApi: mocks.joinMeeting, createVoiceSessionApi: mocks.createSession,
  getVoiceSessionApi: mocks.getSession, cancelVoiceSessionApi: mocks.cancelSession,
  endProjectMeetingApi: mocks.endMeeting, getAgentVoiceCapabilityApi: vi.fn(),
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
    fireEvent.click(screen.getByRole("button", { name: "Call Bragi" }));
    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledOnce());

    mocks.handlers.get("subscribed")?.(track);
    expect(await screen.findByRole("status")).toHaveTextContent("Remote audio playing.");
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
    fireEvent.click(screen.getByRole("button", { name: "Call Bragi" }));

    await waitFor(() => expect(mocks.microphone).toHaveBeenCalledWith(true, {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }));
  });

  it("fails closed when microphone audio processing cannot be enabled", async () => {
    mocks.microphone.mockRejectedValueOnce(new Error("Microphone unavailable"));
    const project = { project: { id: "project-1", pmAgent: "Bragi" } } as never;
    render(<AgentVoiceCallController agentId="bragi-enrollment" agentName="Bragi" project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Call Bragi" }));

    expect(await screen.findByText("Microphone unavailable")).toBeVisible();
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(mocks.endMeeting).toHaveBeenCalledOnce();
  });

  afterEach(() => vi.useRealTimers());

  it("polls after session creation and shows End call when the gateway joins", async () => {
    const project = { project: { id: "project-1", pmAgent: "Bragi" } } as never;
    render(<AgentVoiceCallController agentId="bragi-enrollment" agentName="Bragi" project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Call Bragi" }));
    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(1_000);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalledWith({
      projectId: "project-1", meetingId: "meeting-1", sessionId: "session-1", agentId: "bragi-enrollment",
    }));
    expect(await screen.findByRole("button", { name: "End call" })).toBeVisible();
  });
});
