import { describe, expect, it } from "vitest";
import type { ExecutionEventV1 } from "@perkos/shared-types";

import { hasExecutionSequenceGap } from "../app/lib/useProjectExecutionEvents";

function event(sequence: number): ExecutionEventV1 {
  return {
    schemaVersion: 1,
    eventId: `event-${sequence}`,
    type: "task.started",
    wallet: "0xabc",
    projectId: "project-1",
    runId: "run-1",
    traceId: "trace-1",
    spanId: `span-${sequence}`,
    sequence,
    occurredAt: "2026-10-07T03:00:00.000Z",
    recordedAt: "2026-10-07T03:00:00.100Z",
    source: "tools",
    actor: { type: "agent", id: "worker" },
    subject: { type: "task", id: "task-1" },
    status: "running",
    visibility: "project",
    dedupeKey: `event:${sequence}`,
    payload: { taskId: "task-1" },
  };
}

describe("execution event stream", () => {
  it("accepts a contiguous replay", () => {
    expect(hasExecutionSequenceGap([event(0), event(1), event(2)])).toBe(false);
  });

  it("detects a missing event instead of showing a false history", () => {
    expect(hasExecutionSequenceGap([event(0), event(2)])).toBe(true);
  });
});
