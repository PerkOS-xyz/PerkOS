import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureAgentAwakeApi: vi.fn(),
  recordAgentActivityApi: vi.fn(),
  chatSend: vi.fn(() => "message-1"),
  chatOptions: null as null | { onMessage: (message: { id: string; from: string; text: string; timestamp: string; event?: { domain?: string } }) => void },
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
  useChatPerkosClient: (options: typeof mocks.chatOptions) => {
    mocks.chatOptions = options;
    return ({
    authed: true,
    error: null,
    requestHistory: vi.fn(() => false),
    send: mocks.chatSend,
    });
  },
}));

import {
  AgentChatPanel,
  agentResponseTimeoutMessage,
} from "../app/(app)/agents/[agentId]/AgentChatPanel";

describe("AgentChatPanel hibernation policy", () => {
  beforeEach(() => {
    mocks.ensureAgentAwakeApi.mockReset();
    mocks.ensureAgentAwakeApi.mockResolvedValue({ ok: true });
    mocks.recordAgentActivityApi.mockReset();
    mocks.recordAgentActivityApi.mockResolvedValue(undefined);
    mocks.chatSend.mockClear();
    mocks.chatOptions = null;
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

  it("does not expose a live-runtime chat state when only the bridge is connected", () => {
    render(
      <AgentChatPanel
        agentId="ghost"
        agentName="Ghost"
        chatEnabled
        hibernationEnabled={false}
        externalAgent
        runtimeKind="OpenClaw"
        runtimeAvailability="unavailable"
      />,
    );

    expect(screen.getByText("Runtime unavailable")).toBeVisible();
    expect(screen.getByText(/bridge is connected to PerkOS/i)).toBeVisible();
    expect(screen.getByPlaceholderText("Message Ghost…")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("does not show a warning when a connected legacy client simply omits runtime health evidence", () => {
    render(
      <AgentChatPanel
        agentId="alice"
        agentName="Alice"
        chatEnabled
        hibernationEnabled={false}
        externalAgent
        runtimeKind="OpenClaw"
        runtimeAvailability="unverified"
      />,
    );
    expect(screen.queryByText(/legacy client/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/runtime unavailable/i)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Message Alice…")).toBeEnabled();
  });

  it("directs external OpenClaw timeouts to plugin and model routing logs", () => {
    const message = agentResponseTimeoutMessage({
      agentName: "Alice",
      externalAgent: true,
      runtimeKind: "OpenClaw",
    });
    expect(message).toBe(
      "No response from Alice after 90s. The external OpenClaw agent is connected but did not return a reply. Check the external runtime/plugin logs or model routing.",
    );
    expect(message).not.toMatch(/hibernat|container|wake/i);
  });

  it("keeps the managed-agent hibernation guidance", () => {
    expect(agentResponseTimeoutMessage({ agentName: "Managed", externalAgent: false }))
      .toContain("If the agent was hibernated");
  });

  it("distinguishes persisted final voice messages from live response status", () => {
    render(<AgentChatPanel agentId="morpheus" agentName="Morpheus" chatEnabled hibernationEnabled={false} />);
    act(() => {
      mocks.chatOptions?.onMessage({
        id: "voice-message",
        from: "agent:Morpheus",
        text: "A completed response",
        timestamp: new Date().toISOString(),
        event: { domain: "voice_session" },
      });
    });

    expect(screen.getByText("Saved voice turn")).toBeVisible();
    expect(screen.getByText("A completed response")).toBeVisible();
    expect(screen.queryByText(/responding live/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("desktop-chat-heading")).toHaveClass("hidden", "xl:grid");
  });

  it("keeps the tablet composer fixed while only the history scrolls", () => {
    render(<AgentChatPanel agentId="alice" agentName="Alice" chatEnabled hibernationEnabled={false} />);

    expect(screen.getByTestId("agent-chat-history")).toHaveClass(
      "min-h-0",
      "flex-1",
      "overflow-y-auto",
      "xl:min-h-[28rem]",
    );
    expect(screen.getByTestId("agent-chat-composer")).toHaveClass("shrink-0");
  });
});
