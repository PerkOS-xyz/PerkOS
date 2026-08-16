import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/app/lib/perkosApi", () => ({
  getAgentVoiceHealthApi: vi.fn(async () => ({
    health: {
      available: true,
      status: "unavailable",
      ready: false,
      codes: ["runtime_not_ready"],
      checkedAt: "2026-08-16T12:00:00.000Z",
      source: "doctor",
      playbooks: [
        {
          code: "runtime_not_ready",
          title: "Agent runtime not ready for voice",
          ownerActions: ["Verify authenticated runtime probe."],
          platformNotes: ["Call UI shows Voice unavailable."],
        },
      ],
      capabilityAvailable: false,
      capabilityStatus: "unavailable",
      capabilityReason: "gateway_pending",
    },
    recent: [
      {
        ready: false,
        codes: ["runtime_not_ready"],
        recordedAt: "2026-08-16T12:00:00.000Z",
        source: "doctor",
        playbooks: [],
      },
    ],
  })),
}));

import { VoiceHealthPanel } from "../app/(app)/agents/[agentId]/VoiceHealthPanel";

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("VoiceHealthPanel", () => {
  it("renders nothing for non-owners", () => {
    const { container } = wrap(<VoiceHealthPanel agentId="a1" agentName="Alice" owner={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows codes and playbooks for owners", async () => {
    wrap(<VoiceHealthPanel agentId="a1" agentName="Alice" owner />);
    expect(await screen.findByTestId("voice-health-panel")).toBeVisible();
    expect(await screen.findByTestId("voice-health-playbooks")).toBeVisible();
    expect(await screen.findByText("Agent runtime not ready for voice")).toBeVisible();
    expect(await screen.findByText(/Verify authenticated runtime probe/)).toBeVisible();
    expect(screen.getAllByText(/runtime_not_ready/).length).toBeGreaterThan(0);
  });
});
