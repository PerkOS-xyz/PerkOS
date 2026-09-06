import { describe, expect, it } from "vitest";
import { applyChatProgress, completeChatTurn, emptyChatTurns, mergeAgentChatBubbles } from "../app/lib/agentChatTurns";

describe("late chat reconciliation", () => {
  it("resolves only the matching turn and ignores stale progress after its final", () => {
    let state = emptyChatTurns;
    for (const replyTo of ["one", "two"]) state = applyChatProgress(state, { from: "agent:fixture", replyTo, state: "start", phase: "running" }, 100);
    state = completeChatTurn(state, { from: "agent:fixture", replyTo: "one", timestamp: new Date(301_000).toISOString() });
    expect(state.pending.map((turn) => turn.id)).toEqual(["two"]);
    expect(applyChatProgress(state, { from: "agent:fixture", replyTo: "one", state: "start" }, 302_000)).toBe(state);
  });

  it("never treats progress or a voice turn as the final chat reply", () => {
    const state = applyChatProgress(emptyChatTurns, { from: "agent:fixture", replyTo: "one", state: "stop", phase: "completed" }, 100);
    expect(state.pending[0].phase).toBe("recovering");
    expect(completeChatTurn(state, { from: "agent:fixture", replyTo: "one", timestamp: new Date(200).toISOString(), event: { domain: "voice_session" } })).toBe(state);
  });

  it("does not let old uncorrelated history resolve a newer request", () => {
    const state = applyChatProgress(emptyChatTurns, { from: "agent:fixture", replyTo: "one", state: "start" }, 1_000);
    expect(completeChatTurn(state, { from: "agent:fixture", timestamp: new Date(100).toISOString() })).toBe(state);
  });

  it("merges live/reloaded history into one chronological bubble per stable ID", () => {
    const messages = mergeAgentChatBubbles([{ id: "final", ts: 300, text: "Late answer" }], [
      { id: "input", ts: 100, text: "Question" }, { id: "final", ts: 300, text: "Late answer" },
    ]);
    expect(messages.map((message) => message.id)).toEqual(["input", "final"]);
  });
});
