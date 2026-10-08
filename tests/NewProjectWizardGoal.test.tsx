import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mock = vi.hoisted(() => ({ push: vi.fn(), launchTeam: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock("../app/lib/useAppAccount", () => ({
  useAppAccount: () => ({ address: "0x00000000000000000000000000000000c0ffee01" }),
}));
vi.mock("../app/lib/useActiveOrg", () => ({ useActiveOrg: () => ({ activeOrgId: "org-1" }) }));
vi.mock("../app/lib/llmAccess", () => ({ fetchLlmAccess: async () => ({ allowed: true }) }));
vi.mock("../app/lib/ecsAccess", () => ({ fetchEcsAccess: async () => ({ allowed: true }) }));
vi.mock("../app/lib/analytics", () => ({ trackEvent: () => undefined }));
vi.mock("../app/components/ProjectTemplateWizard", () => ({ ProjectTemplateGallery: () => null }));
vi.mock("../app/lib/runtimeImages", () => ({
  fetchActiveRuntimes: async () => ({ OpenClaw: [{ runtime: "OpenClaw", primaryTag: "oc-7" }] }),
}));
vi.mock("../app/lib/teamLaunch", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  launchTeam: mock.launchTeam,
}));
vi.mock("../app/lib/perkosApi", () => ({
  listTeamTemplates: async () => [],
  getWalletAgents: async () => [],
  deleteTeamTemplate: async () => undefined,
  saveTeamTemplate: async () => undefined,
  inviteAgent: vi.fn(),
  createWalletProject: vi.fn(),
  launchAgent: vi.fn(),
  assignAgentsToProject: vi.fn(),
  setProjectPm: vi.fn(),
}));

import NewProjectWizard from "../app/components/NewProjectWizard";

describe("NewProjectWizard goal", () => {
  it("counts the goal against the 250 characters the project keeps", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NewProjectWizard />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText("Pick your roles"));
    const goal = screen.getByRole("textbox", { name: /achieve|goal/i });
    expect(goal).toHaveAttribute("maxLength", "250");
    expect(screen.getByText("0/250")).toBeInTheDocument();
    fireEvent.change(goal, { target: { value: "Plan a simulated limited drop." } });
    expect(screen.getByText("30/250")).toBeInTheDocument();
  });
});
