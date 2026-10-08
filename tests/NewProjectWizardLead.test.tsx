import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

beforeEach(() => {
  mock.push.mockReset();
  mock.launchTeam.mockReset();
});

describe("NewProjectWizard team lead", () => {
  it("shows who leads the team and lets the owner pick another lead", async () => {
    mock.launchTeam.mockResolvedValue({ projectId: "p-2" });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NewProjectWizard />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText("Pick your roles"));
    fireEvent.click(screen.getByRole("button", { name: /Researcher/ }));
    fireEvent.click(screen.getByRole("button", { name: /Analyst/ }));

    const leads = screen.getAllByRole("button", { name: "Lead" });
    expect(leads).toHaveLength(2);
    expect(leads[0]).toHaveAttribute("aria-pressed", "true");
    expect(leads[1]).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(leads[1]!);
    const after = screen.getAllByRole("button", { name: "Lead" });
    expect(after[0]).toHaveAttribute("aria-pressed", "false");
    expect(after[1]).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByLabelText("Name your project"), { target: { value: "Riverside Dental" } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.click(screen.getByRole("button", { name: /Start your team/ }));
    await waitFor(() => expect(mock.launchTeam).toHaveBeenCalled());
    const sent = mock.launchTeam.mock.calls[0]![0] as { roles: Array<{ lead: boolean }> };
    expect(sent.roles.map((r) => r.lead)).toEqual([false, true]);
  });
});
