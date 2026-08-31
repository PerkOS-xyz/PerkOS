import { describe, expect, it } from "vitest";

import {
  realtimeAgentStatus,
  STATUS_AVAILABLE,
} from "@/app/lib/useWalletAgents";

describe("managed agent realtime status", () => {
  it("keeps a relay-connected managed agent available without expiring its boot timestamp", () => {
    expect(realtimeAgentStatus({
      id: "agent-1",
      name: "Relay Agent",
      status: "ready",
      bridgeConnected: true,
      lastBridgeSeenMs: Date.parse("2026-08-31T11:00:00.000Z"),
    }).label).toBe(STATUS_AVAILABLE);
  });

  it("does not promote ready documents without a relay session", () => {
    expect(realtimeAgentStatus({
      id: "agent-1",
      name: "Relay Agent",
      status: "ready",
      bridgeConnected: false,
    }).label)
      .toBe("Offline");
  });
});
