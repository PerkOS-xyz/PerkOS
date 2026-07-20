import { describe, expect, it } from "vitest";

import {
  hasFreshAgentHeartbeat,
  isAllowedAgentHosting,
} from "@/app/lib/agentHostingPolicy";
import {
  methodToDeployMode,
  stepsForMethod,
} from "@/app/(app)/agents/new/wizard/types";

describe("agent hosting policy", () => {
  it("supports PerkOS ECS, a user VPS, and invited agents", () => {
    expect(isAllowedAgentHosting({ managed: true })).toBe(true);
    expect(isAllowedAgentHosting({ selfHosted: true })).toBe(true);
    expect(isAllowedAgentHosting({ invited: true })).toBe(true);
    expect(isAllowedAgentHosting({})).toBe(false);
  });

  it("maps the VPS wizard path to a self-hosted launch", () => {
    expect(methodToDeployMode("vps")).toBe("self-hosted");
    expect(stepsForMethod("vps")).toEqual([
      "method",
      "template",
      "llm",
      "capabilities",
      "channels",
      "review",
    ]);
  });

  it("requires a recent heartbeat before a VPS agent is considered online", () => {
    const now = Date.parse("2026-07-20T04:00:00.000Z");
    expect(hasFreshAgentHeartbeat({ bridgeConnected: false }, now)).toBe(false);
    expect(hasFreshAgentHeartbeat({
      bridgeConnected: true,
      lastBridgeSeenAt: "2026-07-20T03:58:00.000Z",
    }, now)).toBe(false);
    expect(hasFreshAgentHeartbeat({
      bridgeConnected: true,
      lastBridgeSeenAt: "2026-07-20T03:59:30.000Z",
    }, now)).toBe(true);
  });
});
