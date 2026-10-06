import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatbotProvider } from "../app/components/ChatbotProvider";
import { SparkyDashboardWorkspace } from "../app/components/SparkyDashboardWorkspace";
import type { Agent } from "../app/lib/perkosApi";

vi.mock("../app/lib/useAppAccount", () => ({
  useAppAccount: () => ({ address: "wallet-1", isConnected: true }),
}));
vi.mock("../app/components/ProjectContextMap", () => ({
  OrganizationKnowledgeGraph: ({ agents }: { agents: Agent[] }) => (
    <div data-testid="knowledge-graph">Knowledge graph · {agents.length}</div>
  ),
}));
vi.mock("../app/components/ChatbotPanel", () => ({
  ChatbotPanel: ({ embedded }: { embedded?: boolean }) => (
    <div data-testid="embedded-sparky" data-embedded={String(embedded)}>
      <h1>Sparky</h1>
      <button>Message or talk to Sparky</button>
    </div>
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "en" } }),
}));

describe("SparkyDashboardWorkspace", () => {
  it("shows Sparky beside the real agent roster and knowledge graph", () => {
    const agents = [
      { id: "agent-1", name: "Researcher", runtime: "Hermes", status: "ready", walletAddress: "wallet-1", plugins: [] },
      { id: "agent-2", name: "Writer", runtime: "Hermes", status: "unknown", walletAddress: "wallet-1", plugins: [] },
    ] satisfies Agent[];
    const { container } = render(
      <ChatbotProvider>
        <SparkyDashboardWorkspace
          organizationName="Acme"
          ownerWallet="wallet-1"
          projects={[]}
          agents={agents}
          liveAgents={{}}
        />
      </ChatbotProvider>,
    );
    expect(screen.getByRole("heading", { name: "Sparky" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Message or talk to Sparky/ })).toBeInTheDocument();
    expect(screen.getByTestId("embedded-sparky")).toHaveAttribute("data-embedded", "true");
    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.getByText("Writer")).toBeInTheDocument();
    expect(screen.getByTestId("knowledge-graph")).toHaveTextContent("2");
    expect(container.querySelectorAll("[data-avatar-kit='companion-v3']")).toHaveLength(2);
  });

  it("shows an honest empty state instead of fake active agents", () => {
    render(
      <ChatbotProvider>
        <SparkyDashboardWorkspace
          organizationName="New workspace"
          projects={[]}
          agents={[]}
          liveAgents={{}}
        />
      </ChatbotProvider>,
    );
    expect(screen.getByText(/There are no active agents yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create the first team" })).toHaveAttribute(
      "href",
      "/projects/new",
    );
  });
});
