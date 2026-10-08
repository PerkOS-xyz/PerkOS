import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  findLiveAgent,
  ProjectTeamPanel,
} from "../app/components/ProjectChatTab";
import type { AgentLiveStatus } from "../app/lib/useWalletAgents";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const liveAgents: Record<string, AgentLiveStatus> = {
  Bragi: {
    id: "agent-bragi-id",
    name: "Bragi",
    status: "ready",
    runtime: "OpenClaw",
    bridgeConnected: true,
    lastBridgeSeenMs: Date.now(),
  },
  Alice: {
    id: "agent-alice-id",
    name: "Alice",
    status: "ready",
    runtime: "OpenClaw",
    bridgeConnected: false,
    lastBridgeSeenMs: Date.now() - 3_600_000,
  },
};

const participants = [
  { id: "user:0xabababababababababababababababababababab", label: "Julio", kind: "human" as const },
  { id: "agent:bragi", label: "bragi", kind: "agent" as const },
  { id: "agent:Alice", label: "Alice", kind: "agent" as const },
];

describe("ProjectTeamPanel", () => {
  it("matches live status case-insensitively", () => {
    expect(findLiveAgent("bragi", liveAgents)?.id).toBe("agent-bragi-id");
  });

  it("renders contact-style participant cards with real agent presence", () => {
    render(
      <ProjectTeamPanel
        participants={participants}
        liveAgents={liveAgents}
        pmAgent="Bragi"
        currentWallet="0xAbAbAbAbAbAbAbAbAbAbAbAbAbAbAbAbAbAbAbAb"
        chatConnected
        onDesignatePm={vi.fn()}
      />,
    );

    expect(screen.getByText("1 of 2 agents available")).toBeInTheDocument();
    expect(screen.getByText("Julio")).toBeInTheDocument();
    expect(screen.getByText("You · Project member")).toBeInTheDocument();
    expect(screen.getByText("In this chat")).toBeInTheDocument();
    // Sparky coordinates; the lead is a teammate with a Lead badge.
    expect(screen.getAllByText("OpenClaw · Agent")).toHaveLength(2);
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText(/^Offline · seen /)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open chat with bragi" })).toHaveAttribute(
      "href",
      "/chat/agent/agent-bragi-id",
    );
  });
});
