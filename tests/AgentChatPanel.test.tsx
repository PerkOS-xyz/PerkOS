import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureAgentAwakeApi: vi.fn(),
  recordAgentActivityApi: vi.fn(),
  chatSend: vi.fn(() => "message-1"),
}));

vi.mock("wagmi", async () => {
  const actual = await vi.importActual<typeof import("wagmi")>("wagmi");
  return {
    ...actual,
    useConnection: () => ({ address: "0xabc", isConnected: true }),
  };
});

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
    useQuery: ({ queryKey }: { queryKey: string[] }) =>
      queryKey[0] === "agent-conv"
        ? { data: { convId: "conv-morpheus" }, isFetching: false }
        : { data: { state: "hibernated" }, isFetching: false },
  };
});

vi.mock("../app/lib/perkosApi", () => ({
  ensureAgentAwakeApi: mocks.ensureAgentAwakeApi,
  ensureAgentConv: vi.fn(),
  getHibernationStatusApi: vi.fn(),
  recordAgentActivityApi: mocks.recordAgentActivityApi,
}));

vi.mock("../app/lib/useChatPerkosClient", () => ({
  useChatPerkosClient: () => ({
    authed: true,
    error: null,
    requestHistory: vi.fn(() => false),
    send: mocks.chatSend,
  }),
}));

import { AgentChatPanel } from "../app/(app)/agents/[agentId]/AgentChatPanel";

describe("AgentChatPanel hibernation policy", () => {
  beforeEach(() => {
    mocks.ensureAgentAwakeApi.mockReset();
    mocks.ensureAgentAwakeApi.mockResolvedValue({ ok: true });
    mocks.recordAgentActivityApi.mockReset();
    mocks.recordAgentActivityApi.mockResolvedValue(undefined);
    mocks.chatSend.mockClear();
  });

  it("sends directly to an invited agent without trying to wake it", async () => {
    render(
      <AgentChatPanel
        agentId="morpheus"
        agentName="Morpheus"
        chatEnabled
        hibernationEnabled={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Message Morpheus…"), {
      target: { value: "hello external agent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(mocks.chatSend).toHaveBeenCalledWith("hello external agent"));
    expect(mocks.ensureAgentAwakeApi).not.toHaveBeenCalled();
    expect(screen.getByText("Enter to send · Shift+Enter for a new line")).toBeVisible();
  });

  it("still wakes a managed agent before sending", async () => {
    render(
      <AgentChatPanel
        agentId="managed-agent"
        agentName="Managed"
        chatEnabled
        hibernationEnabled
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Message Managed…"), {
      target: { value: "wake and send" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(mocks.ensureAgentAwakeApi).toHaveBeenCalledWith({
        agentId: "managed-agent",
        waitForRunning: false,
      }),
    );
    expect(mocks.chatSend).toHaveBeenCalledWith("wake and send");
  });
});
