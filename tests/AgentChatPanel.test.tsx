import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import type { AgentChatProgress } from "../app/lib/agentChatTurns";
import type { ChatPerkosMessage, ChatPerkosHistoryChunk } from "../app/lib/useChatPerkosClient";

const mocks = vi.hoisted(() => ({
  ensureAgentAwakeApi: vi.fn(),
  recordAgentActivityApi: vi.fn(),
  chatSend: vi.fn(() => "message-1"),
  authed: true,
  requestHistory: vi.fn(() => "history-fixture"),
  chatOptions: null as null | { onMessage: (message: ChatPerkosMessage) => void; onHistory?: (chunk: ChatPerkosHistoryChunk) => void; onProgress?: (progress: AgentChatProgress) => void },
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
    authed: mocks.authed,
    error: null,
    requestHistory: mocks.requestHistory,
    send: mocks.chatSend,
    });
  },
}));

import {
  AgentChatPanel,
  type AgentChatPanelHandle,
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
    mocks.authed = true;
    mocks.requestHistory.mockClear();
  });
  afterEach(() => { vi.useRealTimers(); });

  it("keeps a 90-second wait nonterminal and clears it on a deduplicated late final", async () => {
    vi.useFakeTimers();
    render(<AgentChatPanel agentId="fixture" agentName="Fixture" chatEnabled hibernationEnabled={false} />);
    fireEvent.change(screen.getByPlaceholderText("Message Fixture…"), { target: { value: "Long task" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(90_001); });
    expect(screen.getByRole("status")).toHaveTextContent("this wait does not cancel the work");
    expect(screen.queryByText(/connected but did not/i)).not.toBeInTheDocument();
    act(() => {
      const message = { id: "final-fixture", from: "agent:fixture", text: "Final answer", replyTo: "message-1", timestamp: new Date().toISOString() };
      mocks.chatOptions?.onMessage(message);
      mocks.chatOptions?.onMessage(message);
      mocks.chatOptions?.onHistory?.({ requestId: "history-fixture", hasMore: false, messages: [message] });
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getAllByText("Final answer")).toHaveLength(1);
  });

  it("requests fresh history after a socket reconnect", () => {
    const props = { agentId: "fixture", agentName: "Fixture", chatEnabled: true, hibernationEnabled: false };
    const view = render(<AgentChatPanel {...props} />);
    expect(mocks.requestHistory).toHaveBeenCalledTimes(1);
    act(() => mocks.chatOptions?.onHistory?.({ requestId: "history-fixture", hasMore: false, messages: [] }));
    mocks.authed = false;
    view.rerender(<AgentChatPanel {...props} />);
    mocks.authed = true;
    view.rerender(<AgentChatPanel {...props} />);
    expect(mocks.requestHistory).toHaveBeenCalledTimes(2);
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

  it("exposes one canonical sender for confirmed settings actions", async () => {
    const ref = createRef<AgentChatPanelHandle>();
    render(
      <AgentChatPanel
        ref={ref}
        agentId="athena"
        agentName="Athena"
        chatEnabled
        hibernationEnabled={false}
        externalAgent
        runtimeKind="Hermes"
        runtimeAvailability="online"
      />,
    );

    expect(ref.current?.canSendMessage()).toBe(true);
    await act(async () => {
      expect(await ref.current!.sendMessage("PERKOS_VOICE_PROBE")).toBe(true);
    });
    expect(mocks.chatSend).toHaveBeenCalledWith("PERKOS_VOICE_PROBE");
    expect(screen.getByText("PERKOS_VOICE_PROBE")).toBeVisible();
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

  it("does not misdiagnose a long external turn as a runtime failure", () => {
    const message = agentResponseTimeoutMessage({
      agentName: "Alice",
      externalAgent: true,
      runtimeKind: "OpenClaw",
    });
    expect(message).toBe(
      "Still waiting for Alice's final reply. Longer tasks can take several minutes; this wait does not cancel the work.",
    );
    expect(message).not.toMatch(/hibernat|container|wake/i);
  });

  it("uses nonterminal waiting guidance for managed agents too", () => {
    expect(agentResponseTimeoutMessage({ agentName: "Managed", externalAgent: false }))
      .toContain("this wait does not cancel the work");
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

  it("keeps the composer fixed while only the history scrolls", () => {
    render(<AgentChatPanel agentId="alice" agentName="Alice" chatEnabled hibernationEnabled={false} />);

    const history = screen.getByTestId("agent-chat-history");
    expect(history).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
    expect(screen.getByTestId("agent-chat-composer")).toHaveClass("shrink-0");
  });

  it("lets the bounded workspace own history scrolling on wide desktop", () => {
    render(<AgentChatPanel agentId="alice" agentName="Alice" chatEnabled hibernationEnabled={false} />);

    // The parent conversation workspace owns the height. The history fills its
    // remaining space and scrolls while the composer stays visible.
    const cls = screen.getByTestId("agent-chat-history").className;
    expect(cls).not.toContain("xl:max-h-[42rem]");
    expect(cls).not.toContain("xl:flex-none");
  });
});
