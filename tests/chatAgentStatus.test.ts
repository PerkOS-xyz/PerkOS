import { describe, expect, it } from "vitest";
import {
  chatAgentOperationalState,
  findConversationAgent,
} from "../app/lib/chatAgentStatus";
import type { AgentLiveStatus } from "../app/lib/useWalletAgents";

function agent(overrides: Partial<AgentLiveStatus> = {}): AgentLiveStatus {
  return {
    id: "agent-1",
    name: "DevE2Ops",
    status: "ready",
    bridgeConnected: true,
    lastBridgeSeenMs: 200,
    wakeStartedMs: 100,
    ...overrides,
  };
}

describe("chat agent operational state", () => {
  it("uses one canonical lifecycle mapping", () => {
    expect(chatAgentOperationalState(agent())).toBe("online");
    expect(chatAgentOperationalState(agent({ hibernationState: "hibernated" }))).toBe("sleeping");
    expect(chatAgentOperationalState(agent({ hibernationState: "waking", lastBridgeSeenMs: 50 }))).toBe("waking");
    expect(chatAgentOperationalState(agent({ bridgeConnected: false }))).toBe("unavailable");
    expect(chatAgentOperationalState()).toBe("checking");
  });

  it("matches the history host case-insensitively", () => {
    const dev = agent();
    expect(findConversationAgent({ DevE2Ops: dev }, "agent:deve2ops", [])).toBe(dev);
  });
});
