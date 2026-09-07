import { describe, expect, it } from "vitest";

import {
  hasFreshAgentHeartbeat,
  externalRuntimeAvailability,
  isAllowedAgentHosting,
} from "@/app/lib/agentHostingPolicy";
import {
  methodToDeployMode,
  stepsForMethod,
} from "@/app/(app)/agents/new/wizard/types";

describe("agent hosting policy", () => {
  it("uses a bounded presence lease instead of the legacy 90-second Firestore clock",()=>{
    const now=Date.now();
    const agent={bridgeConnected:true,lastBridgeSeenAt:new Date(now-120_000).toISOString(),
      runtimeHealthCheckedAt:new Date(now-120_000).toISOString(),runtimeStatus:"healthy" as const,presenceExpiresAt:now+60_000};
    expect(externalRuntimeAvailability(agent,now)).toBe("online");
    expect(externalRuntimeAvailability(agent,now+60_001)).toBe("offline");
    expect(externalRuntimeAvailability({...agent,runtimeStatus:"unknown"},now)).toBe("unverified");
  });
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

  it("does not confuse a fresh bridge heartbeat with a healthy runtime", () => {
    const now = Date.parse("2026-08-11T19:00:00.000Z");
    const bridge = {
      bridgeConnected: true,
      lastBridgeSeenAt: "2026-08-11T18:59:30.000Z",
      runtimeHealthCheckedAt: "2026-08-11T18:59:30.000Z",
    };
    expect(externalRuntimeAvailability({ ...bridge, runtimeStatus: "unreachable" }, now))
      .toBe("unavailable");
    expect(externalRuntimeAvailability({ ...bridge, runtimeStatus: "healthy" }, now))
      .toBe("online");
    expect(externalRuntimeAvailability({ ...bridge, runtimeStatus: "unknown" }, now))
      .toBe("unverified");
    expect(externalRuntimeAvailability({
      ...bridge,
      lastBridgeSeenAt: "2026-08-11T18:58:00.000Z",
      runtimeStatus: "healthy",
    }, now)).toBe("offline");
  });
});
