import { describe, expect, it } from "vitest";

import type { ChatMessage } from "../app/lib/chatClient";
import { upsertLiveMessage } from "../app/lib/chatMessageMerge";

const base: ChatMessage = {
  id: "m1",
  convId: "project-1",
  from: "agent:pm",
  text: "Plan proposed",
  timestamp: "2026-07-18T10:00:00.000Z",
  replyTo: null,
};

describe("upsertLiveMessage", () => {
  it("enriches a duplicate frame with its workflow event", () => {
    const event = {
      domain: "project_workflow" as const,
      type: "plan_proposed" as const,
      projectId: "p1",
      phase: "awaiting_approval",
      planId: "plan-1",
    };
    const result = upsertLiveMessage([base], { ...base, event });

    expect(result).toHaveLength(1);
    expect(result[0].event).toEqual(event);
  });

  it("does not erase metadata when a poorer duplicate arrives later", () => {
    const rich = {
      ...base,
      event: {
        domain: "project_workflow" as const,
        type: "plan_proposed" as const,
        projectId: "p1",
        phase: "awaiting_approval",
        planId: "plan-1",
      },
    };
    expect(upsertLiveMessage([rich], base)[0].event).toEqual(rich.event);
  });
});
