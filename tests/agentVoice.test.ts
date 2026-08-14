import { describe, expect, it } from "vitest";

import {
  AGENT_VOICE_STATE_LABELS,
  canStartAgentVoiceCall,
  resolveAgentVoiceState,
  type AgentVoiceState,
} from "../app/lib/agentVoice";

describe("agent voice availability", () => {
  it("defaults to unavailable without an established capability response", () => {
    expect(resolveAgentVoiceState()).toBe("unavailable");
  });

  it("only becomes ready from an explicit ready and available response", () => {
    expect(resolveAgentVoiceState({ available: false, status: "ready" })).toBe("unavailable");
    expect(resolveAgentVoiceState({ available: true, status: "unavailable" })).toBe("unavailable");
    expect(resolveAgentVoiceState({ available: false, status: "pending" })).toBe("checking");
    expect(resolveAgentVoiceState({ available: true, status: "ready" })).toBe("ready");
  });

  it("defines a user-facing label for every lifecycle state", () => {
    const states: AgentVoiceState[] = [
      "unavailable",
      "checking",
      "connecting",
      "ready",
      "in-call",
      "reconnecting",
      "failed",
      "ended",
    ];
    expect(states.every((state) => AGENT_VOICE_STATE_LABELS[state].length > 0)).toBe(true);
  });

  it("never enables a call from unavailable or transitional state", () => {
    expect(canStartAgentVoiceCall("unavailable")).toBe(false);
    expect(canStartAgentVoiceCall("checking")).toBe(false);
    expect(canStartAgentVoiceCall("connecting")).toBe(false);
    expect(canStartAgentVoiceCall("reconnecting")).toBe(false);
    expect(canStartAgentVoiceCall("ready")).toBe(true);
  });
});
