import { describe, expect, it } from "vitest";

import { parseProjectWorkflow } from "../app/lib/perkosApi";

describe("parseProjectWorkflow", () => {
  it("preserves canonical execution identity from Firestore", () => {
    expect(parseProjectWorkflow({
      phase: "running",
      planId: "plan-1",
      runId: "plan:plan-1:r2",
      traceId: "trace-1",
      taskIds: ["task-1", 42, "task-2"],
    })).toEqual({
      phase: "running",
      planId: "plan-1",
      runId: "plan:plan-1:r2",
      traceId: "trace-1",
      taskIds: ["task-1", "task-2"],
      planningAttempt: undefined,
      planningMaxAttempts: undefined,
      failureReason: undefined,
    });
  });

  it("returns undefined when no workflow object exists", () => {
    expect(parseProjectWorkflow(undefined)).toBeUndefined();
  });
});
