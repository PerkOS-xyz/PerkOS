import { describe, expect, it, vi } from "vitest";

import { logActivity, verbPhrase } from "../app/lib/activityEvents";

// firebaseDb throws in this suite — logActivity must swallow it (logging can
// never break the action it decorates).
vi.mock("../app/lib/firebase", () => ({
  firebaseDb: () => {
    throw new Error("no firebase in tests");
  },
}));

describe("verbPhrase", () => {
  it("maps every known verb to a plain-language phrase", () => {
    expect(verbPhrase("created_task")).toBe("created");
    expect(verbPhrase("moved_task")).toBe("moved");
    expect(verbPhrase("started_task")).toBe("started working on");
    expect(verbPhrase("completed_task")).toBe("completed");
    expect(verbPhrase("retried_task")).toBe("sent back for another pass:");
    expect(verbPhrase("planned")).toBe("planned");
    expect(verbPhrase("proposed_plan")).toBe("proposed a plan in");
    expect(verbPhrase("approved_plan")).toBe("approved the plan in");
    expect(verbPhrase("goal_done")).toBe("reached the goal of");
    expect(verbPhrase("launched_agent")).toBe("launched");
    expect(verbPhrase("agent_online")).toBe("came online");
    expect(verbPhrase("agent_failed")).toBe("failed to start");
    expect(verbPhrase("created_project")).toBe("created");
  });

  it("falls back to a readable form for unknown verbs", () => {
    expect(verbPhrase("did_something_new")).toBe("did something new");
  });
});

describe("logActivity", () => {
  it("is a no-op without a wallet", () => {
    expect(() =>
      logActivity(null, {
        actorType: "user",
        actor: "You",
        verb: "created_task",
        object: "x",
      }),
    ).not.toThrow();
  });

  it("swallows backend errors instead of breaking the caller", () => {
    expect(() =>
      logActivity("0xABC", {
        actorType: "agent",
        actor: "Maya",
        verb: "completed_task",
        object: "Write copy",
        projectId: "p1",
        taskId: "t1",
      }),
    ).not.toThrow();
  });
});
