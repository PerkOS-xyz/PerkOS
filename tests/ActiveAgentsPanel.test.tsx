import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ActiveAgentsPanel } from "../app/components/ActiveAgentsPanel";
import {
  STATUS_AVAILABLE,
  STATUS_RESTING,
  type AgentLiveStatus,
} from "../app/lib/useWalletAgents";
import type { Agent } from "../app/lib/perkosApi";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));

// The panel reads the connected wallet + the live heartbeat subscription.
// Both are external systems — stub them so tests drive the live statuses.
vi.mock("wagmi", () => ({
  useConnection: () => ({ address: "0xabc" }),
}));

let mockByName: Record<string, AgentLiveStatus> = {};
vi.mock("../app/lib/useWalletAgents", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../app/lib/useWalletAgents")>();
  return {
    ...actual,
    useWalletAgents: () => ({ byName: mockByName, loaded: true }),
  };
});

function agent(over: Partial<Agent> = {}): Agent {
  return {
    id: "ag1",
    name: "Apollo",
    runtime: "OpenClaw",
    status: "ready",
    walletAddress: "0xabc",
    plugins: [],
    ...over,
  } as Agent;
}

function live(over: Partial<AgentLiveStatus> = {}): AgentLiveStatus {
  return {
    id: "ag1",
    name: "Apollo",
    status: "ready",
    ...over,
  };
}

describe("ActiveAgentsPanel", () => {
  it("shows an empty-state CTA when no agents", () => {
    mockByName = {};
    render(<ActiveAgentsPanel agents={[]} />);
    expect(screen.getByText(/No agents registered yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Register agent/i }),
    ).toHaveAttribute("href", "/agents/new");
  });

  it("renders an avatar per agent and counts the roster", () => {
    mockByName = {};
    render(
      <ActiveAgentsPanel
        agents={[
          agent({ id: "1", name: "Apollo" }),
          agent({ id: "2", name: "Hermes" }),
          agent({ id: "3", name: "Loki" }),
        ]}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Apollo")).toBeInTheDocument();
    expect(screen.getByText("Hermes")).toBeInTheDocument();
    expect(screen.getByText("Loki")).toBeInTheDocument();
  });

  it("counts available agents from the live heartbeat, not the static status", () => {
    // 2 of 3 have a real bridge heartbeat; the third is status:"ready" but
    // never connected (a ghost) — it must NOT count as online.
    mockByName = {
      Apollo: live({ name: "Apollo", bridgeConnected: true, lastBridgeSeenMs: Date.now() }),
      Hermes: live({ id: "ag2", name: "Hermes", bridgeConnected: true, lastBridgeSeenMs: Date.now() }),
      Loki: live({ id: "ag3", name: "Loki" }),
    };
    render(
      <ActiveAgentsPanel
        agents={[
          agent({ id: "1", name: "Apollo" }),
          agent({ id: "2", name: "Hermes" }),
          agent({ id: "3", name: "Loki" }),
        ]}
      />,
    );
    expect(screen.getByText(/2 of 3 available/)).toBeInTheDocument();
    expect(screen.getByText(/67% available/)).toBeInTheDocument();
  });

  it("shows a loading state when isLoading", () => {
    mockByName = {};
    render(<ActiveAgentsPanel agents={[]} isLoading />);
    expect(screen.getByText(/Loading roster/i)).toBeInTheDocument();
  });

  it("labels avatars with live status text", () => {
    mockByName = {
      A: live({ name: "A", bridgeConnected: true, lastBridgeSeenMs: Date.now() }),
      B: live({ id: "b", name: "B", hibernationState: "hibernated" }),
      // C has no live record → Unknown.
    };
    render(
      <ActiveAgentsPanel
        agents={[
          agent({ id: "1", name: "A" }),
          agent({ id: "2", name: "B" }),
          agent({ id: "3", name: "C" }),
        ]}
      />,
    );
    expect(screen.getByText(STATUS_AVAILABLE)).toBeInTheDocument();
    expect(screen.getByText(STATUS_RESTING)).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("shows when an offline agent was last seen", () => {
    mockByName = {
      Apollo: live({
        name: "Apollo",
        bridgeConnected: false,
        lastBridgeSeenMs: Date.now() - 2 * 60 * 60 * 1000,
      }),
    };
    render(<ActiveAgentsPanel agents={[agent({ id: "1", name: "Apollo" })]} />);
    expect(screen.getByText("Offline")).toBeInTheDocument();
    // formatRelativeShort renders something like "2h ago".
    expect(screen.getByText(/2h/)).toBeInTheDocument();
  });

  it("treats a stale connected heartbeat as offline", () => {
    mockByName = {
      Apollo: live({
        name: "Apollo",
        bridgeConnected: true,
        lastBridgeSeenMs: Date.now() - 2 * 60 * 1000,
      }),
    };
    render(<ActiveAgentsPanel agents={[agent({ id: "1", name: "Apollo" })]} />);
    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.getByText(/0 of 1 available/)).toBeInTheDocument();
  });
});
