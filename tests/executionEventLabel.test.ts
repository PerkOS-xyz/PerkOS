import { describe, expect, it } from "vitest";

import { executionEventLabel } from "../app/components/ProjectContextMap";

describe("executionEventLabel", () => {
  it("names run events in plain words", () => {
    expect(executionEventLabel("task.review_requested")).toBe("Sent for review");
    expect(executionEventLabel("task.unblocked")).toBe("Ready to start");
    expect(executionEventLabel("judge.failed")).toBe("Needs another pass");
    expect(executionEventLabel("task.failed")).toBe("Paused");
  });

  it("falls back to a readable form of an unknown type", () => {
    expect(executionEventLabel("knowledge.written")).toBe("Knowledge written");
    expect(executionEventLabel("agent.turn_started")).toBe("Agent turn started");
  });
});
