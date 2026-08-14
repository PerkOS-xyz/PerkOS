import { describe, expect, it } from "vitest";
import { canStartAgentVoiceCall, resolveAgentVoiceState } from "../app/lib/agentVoice";

describe("verified voice capability gating", () => {
  it("enables only a verified ready capability", () => {
    expect(resolveAgentVoiceState({ available: true, status: "ready" })).toBe("ready");
    expect(canStartAgentVoiceCall("ready")).toBe(true);
    expect(resolveAgentVoiceState({ available: false, status: "unavailable", reason: "provider_pending" })).toBe("unavailable");
    expect(canStartAgentVoiceCall("unavailable")).toBe(false);
  });
});
