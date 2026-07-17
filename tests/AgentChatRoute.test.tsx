import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const ensureAgentConv = vi.fn();

let connected = true;
let queryState: {
  data?: { convId: string };
  isError: boolean;
  error: Error;
} = {
  isError: false,
  error: new Error("failed"),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("wagmi", () => ({
  useConnection: () => ({
    address: connected ? "0x123" : undefined,
    isConnected: connected,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryFn: () => unknown; enabled: boolean }) => {
    if (options.enabled) void options.queryFn();
    return queryState;
  },
}));

vi.mock("../app/lib/perkosApi", () => ({
  ensureAgentConv: (...args: unknown[]) => ensureAgentConv(...args),
}));

import { AgentChatRedirect } from "../app/(app)/chat/agent/[agentId]/page";

describe("AgentChatRedirect", () => {
  beforeEach(() => {
    connected = true;
    queryState = {
      isError: false,
      error: new Error("failed"),
    };
    replace.mockReset();
    ensureAgentConv.mockReset();
  });

  it("resolves the canonical agent conversation and opens the shared thread", async () => {
    queryState = {
      data: { convId: "agent-wallet-Morpheus" },
      isError: false,
      error: new Error("failed"),
    };

    render(<AgentChatRedirect agentId="agent/id" />);

    expect(ensureAgentConv).toHaveBeenCalledWith({ agentId: "agent/id" });
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        "/chat/agent-wallet-Morpheus",
      );
    });
  });

  it("does not resolve a conversation until the wallet is connected", () => {
    connected = false;

    render(<AgentChatRedirect agentId="morpheus" />);

    expect(screen.getByText("Connect your wallet to open this conversation.")).toBeVisible();
    expect(ensureAgentConv).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows a recoverable error when conversation resolution fails", () => {
    queryState = {
      isError: true,
      error: new Error("Agent is unavailable"),
    };

    render(<AgentChatRedirect agentId="morpheus" />);

    expect(screen.getByText("Couldn't open this conversation.")).toBeVisible();
    expect(screen.getByText("Agent is unavailable")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Chat" })).toHaveAttribute(
      "href",
      "/chat",
    );
  });
});
