import { describe, expect, it, vi } from "vitest";

import i18n from "../app/lib/i18n";
import { logActivity, verbPhrase } from "../app/lib/activityEvents";

// i18n is initialized at lng:"en" in tests/setup.ts, so verbPhrase(verb, t)
// resolves to the English source phrases.
const t = i18n.t.bind(i18n);

// firebaseDb throws in this suite — logActivity must swallow it (logging can
// never break the action it decorates).
vi.mock("../app/lib/firebase", () => ({
  firebaseDb: () => {
    throw new Error("no firebase in tests");
  },
}));

describe("verbPhrase", () => {
  it("maps every known verb to a plain-language phrase", () => {
    expect(verbPhrase("created_task", t)).toBe("created");
    expect(verbPhrase("moved_task", t)).toBe("moved");
    expect(verbPhrase("started_task", t)).toBe("started working on");
    expect(verbPhrase("completed_task", t)).toBe("completed");
    expect(verbPhrase("retried_task", t)).toBe("sent back for another pass:");
    expect(verbPhrase("planned", t)).toBe("planned");
    expect(verbPhrase("proposed_plan", t)).toBe("proposed a plan in");
    expect(verbPhrase("approved_plan", t)).toBe("approved the plan in");
    expect(verbPhrase("goal_done", t)).toBe("reached the goal of");
    expect(verbPhrase("launched_agent", t)).toBe("launched");
    expect(verbPhrase("agent_online", t)).toBe("came online");
    expect(verbPhrase("agent_failed", t)).toBe("failed to start");
    expect(verbPhrase("created_project", t)).toBe("created");
  });

  it("falls back to a readable form for unknown verbs", () => {
    expect(verbPhrase("did_something_new", t)).toBe("did something new");
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
