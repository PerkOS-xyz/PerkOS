import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: () => "The server uses the authorized project team." }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: ({ queryKey }: { queryKey: string[] }) => ({
  data: queryKey[0] === "wallet-projects" ? { projects: [{ id: "fixture-project", name: "Fixture project" }] } : [],
  isLoading: false,
}) }));
vi.mock("../app/lib/perkosApi", () => ({ getWalletAgents: vi.fn(), getWalletProjects: vi.fn() }));
vi.mock("../app/lib/conversationsApi", () => ({ createConversation: mocks.create, agentIdentity: (name: string) => `agent:${name}` }));

import { NewConversationDialog } from "../app/components/NewConversationDialog";
const wallet = `0x${"ab".repeat(20)}`;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ id: "server-created" });
});

describe("project conversation dialog", () => {
  it("uses the server team without requiring a local agent selection", async () => {
    render(<NewConversationDialog open onOpenChange={vi.fn()} walletAddress={wallet} projectId="fixture-project" />);
    expect(screen.getByText("The server uses the authorized project team.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Direct message/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "Project discussion" } });
    fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ walletAddress: wallet, kind: "channel",
      title: "Project discussion", participants: [], projectId: "fixture-project" }));
    expect(mocks.push).toHaveBeenCalledWith("/chat/server-created");
  });

  it("switches from an agent DM to the server project roster when a project is selected", async () => {
    render(<NewConversationDialog open onOpenChange={vi.fn()} walletAddress={wallet} />);
    expect(screen.getByRole("button", { name: "Start conversation" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "fixture-project" } });
    expect(screen.getByText("The server uses the authorized project team.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start conversation" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ kind: "channel", projectId: "fixture-project", participants: [] })));
  });
});
