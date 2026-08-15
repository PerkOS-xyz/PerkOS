import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentVoiceCallCard } from "../app/(app)/agents/[agentId]/AgentVoiceCallCard";

describe("AgentVoiceCallCard", () => {
  it("shows a truthful unavailable state and disables calling without capability evidence", () => {
    render(<AgentVoiceCallCard agentName="Bragi" />);

    expect(screen.getByText("Voice unavailable")).toBeVisible();
    expect(screen.getByText(/has not reported a verified voice gateway and speech provider/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Call Bragi" })).toBeDisabled();
  });

  it("does not enable a ready-looking action without an implemented start handler", () => {
    render(<AgentVoiceCallCard
      agentName="Bragi"
      capability={{ available: true, status: "ready" }}
    />);
    expect(screen.getByText("Ready for voice")).toBeVisible();
    expect(screen.getByRole("button", { name: "Call Bragi" })).toBeDisabled();
  });

  it("renders reconnecting and failed lifecycle states", () => {
    const { rerender } = render(<AgentVoiceCallCard agentName="Bragi" callState="reconnecting" />);
    expect(screen.getByText("Reconnecting voice call")).toBeVisible();
    rerender(<AgentVoiceCallCard agentName="Bragi" callState="failed" />);
    expect(screen.getByText("Voice call failed")).toBeVisible();
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
    expect(screen.getByText(/turn this off for a private, non-transcribed call/i)).toBeVisible();
    expect(screen.getByText(/no raw audio or interim text is saved/i)).toBeVisible();
  });
});
