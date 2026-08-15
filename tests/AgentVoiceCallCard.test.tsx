import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentVoiceCallCard } from "../app/(app)/agents/[agentId]/AgentVoiceCallCard";

describe("AgentVoiceCallCard", () => {
  it("shows a truthful unavailable state and disables calling without capability evidence", () => {
    render(<AgentVoiceCallCard agentName="Bragi" />);

    expect(screen.getAllByText("Voice unavailable")[0]).toBeVisible();
    expect(screen.getByText(/has not reported a verified voice gateway and speech provider/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Call Bragi" })).toBeDisabled();
  });

  it("does not enable a ready-looking action without an implemented start handler", () => {
    render(<AgentVoiceCallCard
      agentName="Bragi"
      capability={{ available: true, status: "ready" }}
    />);
    expect(screen.getAllByText("Ready for voice")[0]).toBeVisible();
    expect(screen.getByRole("button", { name: "Call Bragi" })).toBeDisabled();
  });

  it("renders reconnecting and failed lifecycle states", () => {
    const { rerender } = render(<AgentVoiceCallCard agentName="Bragi" callState="reconnecting" />);
    expect(screen.getAllByText("Reconnecting voice call")[0]).toBeVisible();
    rerender(<AgentVoiceCallCard agentName="Bragi" callState="failed" />);
    expect(screen.getAllByText("Voice call failed")[0]).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry voice call" })).toBeDisabled();
  });

  it("renders only safe remote audio status", () => {
    render(<AgentVoiceCallCard agentName="Bragi" callState="in-call" remoteAudioStatus="Remote audio playing." />);
    expect(screen.getByRole("status")).toHaveTextContent("Remote audio playing.");
  });

  it("shows default-on final-turn history with a private opt-out", () => {
    render(<AgentVoiceCallCard
      agentName="Bragi"
      callState="ready"
      chatMirrorAvailable
      chatMirrorEnabled
      onChatMirrorEnabledChange={() => undefined}
    />);

    expect(screen.getByRole("checkbox", { name: "Save final voice turns to direct chat" })).toBeChecked();
    expect(screen.getByText("Normal · Save final turns")).toBeVisible();
    expect(screen.getByRole("button", { name: /Private · Don't save/i })).toBeVisible();
    expect(screen.getByText(/no final text, raw audio, or interim speech is persisted/i)).toBeVisible();
  });

  it("makes the active call unmistakable with duration, mute, end, and settings", () => {
    render(<AgentVoiceCallCard agentName="Bragi" callState="in-call" durationSeconds={65} muted onToggleMute={() => undefined} />);

    expect(screen.getByText("Live with Bragi")).toBeVisible();
    expect(screen.getByLabelText("Call duration 01:05")).toBeVisible();
    expect(screen.getByRole("button", { name: "Unmute" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "End call" })).toBeVisible();
    expect(screen.getByText("Call settings")).toBeVisible();
  });
});
