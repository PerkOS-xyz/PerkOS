import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentVoiceCallCard } from "../app/(app)/agents/[agentId]/AgentVoiceCallCard";

describe("AgentVoiceCallCard", () => {
  it("shows a truthful unavailable state and disables calling without capability evidence", () => {
    render(<AgentVoiceCallCard agentName="Bragi" />);

    expect(screen.getAllByText("Voice unavailable")[0]).toBeVisible();
    expect(screen.getByText(/has not reported a verified voice gateway and speech provider/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Working call Bragi" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Private call Bragi" })).toBeDisabled();
  });

  it("does not enable a ready-looking action without an implemented start handler", () => {
    render(<AgentVoiceCallCard
      agentName="Bragi"
      capability={{ available: true, status: "ready" }}
      chatMirrorAvailable
    />);
    expect(screen.getAllByText("Ready for voice")[0]).toBeVisible();
    expect(screen.getByRole("button", { name: "Working call Bragi" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Private call Bragi" })).toBeDisabled();
  });

  it("renders reconnecting and failed lifecycle states", () => {
    const { rerender } = render(<AgentVoiceCallCard agentName="Bragi" callState="reconnecting" chatMirrorAvailable />);
    expect(screen.getAllByText("Reconnecting voice call")[0]).toBeVisible();
    rerender(<AgentVoiceCallCard agentName="Bragi" callState="failed" chatMirrorAvailable onStart={() => undefined} />);
    expect(screen.getAllByText("Voice call failed")[0]).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry working call" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Retry private call" })).toBeEnabled();
  });

  it("uses two explicit start buttons instead of a single phone control", () => {
    render(<AgentVoiceCallCard agentName="Bragi" callState="ready" chatMirrorAvailable onStart={() => undefined} />);

    expect(screen.getByTestId("voice-call-mode-actions")).toBeVisible();
    expect(screen.getByRole("button", { name: "Working call Bragi" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Private call Bragi" })).toBeEnabled();
    expect(screen.getByText("Working Call")).toBeVisible();
    expect(screen.getByText("Private Call")).toBeVisible();
    expect(screen.getByTestId("agent-voice-card")).toHaveClass("gap-0", "py-0", "xl:gap-4", "xl:py-4");
    expect(screen.getByTestId("desktop-voice-heading")).toHaveClass("hidden");
    expect(screen.getByTestId("mobile-voice-header")).toHaveTextContent("BragiReady for voice");
  });

  it("keeps Working disabled while chat scope is preparing", () => {
    render(
      <AgentVoiceCallCard
        agentName="Bragi"
        callState="ready"
        chatMirrorAvailable={false}
        chatMirrorPreparing
        onStart={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Working call Bragi" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Private call Bragi" })).toBeEnabled();
    expect(screen.getByText(/Preparing chat/i)).toBeVisible();
  });

  it("shows a compact connecting indicator without starting another call", () => {
    render(<AgentVoiceCallCard agentName="Bragi" callState="connecting" chatMirrorAvailable onStart={() => undefined} />);

    expect(screen.getByRole("button", { name: "Connecting working call" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Connecting private call" })).toBeDisabled();
    expect(screen.getAllByText("Connecting voice call").length).toBeGreaterThan(0);
  });

  it("renders only safe remote audio status", () => {
    render(<AgentVoiceCallCard agentName="Bragi" callState="in-call" remoteAudioStatus="Remote audio playing." />);
    expect(screen.getByRole("status")).toHaveTextContent("Remote audio playing.");
  });

  it("makes the active call unmistakable with duration, mute, end, mode label, and activity bars", () => {
    render(
      <AgentVoiceCallCard
        agentName="Bragi"
        callState="in-call"
        durationSeconds={65}
        muted
        activeCallMode="working"
        remoteAudioStatus="Remote audio playing."
        onToggleMute={() => undefined}
      />,
    );

    expect(screen.getByText("Live with Bragi")).toBeVisible();
    expect(screen.getByLabelText("Call duration 01:05")).toBeVisible();
    expect(screen.getByRole("button", { name: "Unmute" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "End call" })).toBeVisible();
    expect(screen.getByRole("button", { name: "End call" })).toHaveClass("size-11", "xl:size-12", "rounded-full", "bg-red-600");
    expect(screen.getByText("Call settings")).toBeVisible();
    expect(screen.getByTestId("mobile-voice-header")).toHaveTextContent("BragiVoice call in progress · Working01:05");
    expect(screen.getAllByTestId("voice-activity").length).toBeGreaterThan(0);
  });
});
