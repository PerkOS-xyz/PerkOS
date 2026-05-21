import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ActiveAgentsPanel } from "../app/components/ActiveAgentsPanel";
import type { Agent } from "../app/lib/perkosApi";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));

function agent(over: Partial<Agent> = {}): Agent {
  return {
    id: "ag1",
    name: "Apollo",
    runtime: "OpenClaw",
    status: "ready",
    walletAddress: "0xabc",
    plugins: [],
    ...over,
  };
}

describe("ActiveAgentsPanel", () => {
  it("shows an empty-state CTA when no agents", () => {
    render(<ActiveAgentsPanel agents={[]} />);
    expect(
      screen.getByText(/No agents registered yet/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Register agent/i })).toHaveAttribute(
      "href",
      "/agents/new",
    );
  });

  it("renders an avatar per agent and counts the roster", () => {
    render(
      <ActiveAgentsPanel
        agents={[
          agent({ id: "1", name: "Apollo", status: "ready" }),
          agent({ id: "2", name: "Hermes", status: "ready" }),
          agent({ id: "3", name: "Loki", status: "failed" }),
        ]}
      />,
    );
    // Roster count chip
    expect(screen.getByText("3")).toBeInTheDocument();
    // Avatar labels
    expect(screen.getByText("Apollo")).toBeInTheDocument();
    expect(screen.getByText("Hermes")).toBeInTheDocument();
    expect(screen.getByText("Loki")).toBeInTheDocument();
    // Footer summary: 2 of 3 ready
    expect(screen.getByText(/2 of 3 ready/)).toBeInTheDocument();
  });

  it("computes the online percentage of ready agents", () => {
    render(
      <ActiveAgentsPanel
        agents={[
          agent({ id: "1", status: "ready" }),
          agent({ id: "2", status: "ready" }),
          agent({ id: "3", status: "ready" }),
          agent({ id: "4", status: "provisioning" }),
        ]}
      />,
    );
    expect(screen.getByText(/75% online/)).toBeInTheDocument();
  });

  it("shows a loading state when isLoading", () => {
    render(<ActiveAgentsPanel agents={[]} isLoading />);
    expect(screen.getByText(/Loading roster/i)).toBeInTheDocument();
  });

  it("labels avatars with status text", () => {
    render(
      <ActiveAgentsPanel
        agents={[
          agent({ id: "1", name: "A", status: "ready" }),
          agent({ id: "2", name: "B", status: "provisioning" }),
          agent({ id: "3", name: "C", status: "failed" }),
        ]}
      />,
    );
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("Booting")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
