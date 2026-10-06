import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mock = vi.hoisted(() => ({
  push: vi.fn(),
  launchTeam: vi.fn(),
  createWalletProject: vi.fn(),
  launchAgent: vi.fn(),
  assignAgentsToProject: vi.fn(),
  setProjectPm: vi.fn(),
}));
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
  createWalletProject: mock.createWalletProject,
  launchAgent: mock.launchAgent,
  assignAgentsToProject: mock.assignAgentsToProject,
  setProjectPm: mock.setProjectPm,
}));

import NewProjectWizard from "../app/components/NewProjectWizard";

async function startCustomTeam() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NewProjectWizard />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("Pick your roles"));
  fireEvent.change(screen.getByLabelText("Name your project"), { target: { value: "Harbor Tea" } });
  // Let the access checks resolve before launching.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.click(screen.getByRole("button", { name: /Start your team/ }));
}

beforeEach(() => {
  Object.values(mock).forEach((fn) => fn.mockReset());
  mock.createWalletProject.mockResolvedValue({ project: { id: "legacy-1" } });
  mock.launchAgent.mockImplementation(async (input: { name: string }) => ({ result: { agent: { name: input.name } } }));
  mock.assignAgentsToProject.mockResolvedValue({ added: 1, total: 1 });
  mock.setProjectPm.mockResolvedValue(undefined);
});

describe("NewProjectWizard launch", () => {
  it("launches the whole team in one server call and opens the project", async () => {
    mock.launchTeam.mockResolvedValue({ projectId: "p-1" });
    await startCustomTeam();
    await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/projects/p-1"));
    const sent = mock.launchTeam.mock.calls[0]![0];
    expect(sent).toMatchObject({ name: "Harbor Tea", orgId: "org-1" });
    expect(sent.requestId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(sent.roles).toHaveLength(1);
    expect(sent.roles[0]).toMatchObject({ runtime: "OpenClaw", lead: true });
    expect(sent.roles[0].name).toMatch(/^Harbor-Tea-/);
    expect(sent.roles[0].soul).toBeTruthy();
    expect(mock.createWalletProject).not.toHaveBeenCalled();
    expect(mock.launchAgent).not.toHaveBeenCalled();
    expect(screen.queryByText("Don't close this tab until it finishes.")).toBeNull();
  });

  it("launches from the browser when the API does not have the endpoint yet", async () => {
    mock.launchTeam.mockResolvedValue(null);
    await startCustomTeam();
    await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/projects/legacy-1"));
    expect(mock.createWalletProject).toHaveBeenCalledWith(expect.objectContaining({ name: "Harbor Tea", orgId: "org-1" }));
    expect(mock.launchAgent).toHaveBeenCalledWith(expect.objectContaining({ runtime: "OpenClaw", imageTag: "oc-7" }));
    expect(mock.setProjectPm).toHaveBeenCalled();
  });
});
