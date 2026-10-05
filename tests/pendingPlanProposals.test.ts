import { describe, expect, it } from "vitest";

import { pendingPlanProposals, type ActivityEvent } from "../app/lib/activityEvents";

const ev = (verb: string, projectId: string, tsMs: number): ActivityEvent => ({
  id: `${verb}-${projectId}-${tsMs}`,
  actorType: "agent",
  actor: "agent:Lead",
  verb,
  object: "3 tasks",
  projectId,
  tsMs,
});

describe("pendingPlanProposals", () => {
  it("keeps a proposal nobody acted on", () => {
    const events = [ev("proposed_plan", "p1", 100)];
    expect(pendingPlanProposals(events, 0)).toHaveLength(1);
  });

  it("drops a proposal once the plan is approved", () => {
    const events = [ev("approved_plan", "p1", 200), ev("proposed_plan", "p1", 100)];
    expect(pendingPlanProposals(events, 0)).toHaveLength(0);
  });

  it("drops a proposal once work started, even without an approval event", () => {
    const events = [ev("started_task", "p1", 300), ev("proposed_plan", "p1", 100)];
    expect(pendingPlanProposals(events, 0)).toHaveLength(0);
  });

  it("keeps a newer proposal after older work in the same project", () => {
    const events = [ev("proposed_plan", "p1", 400), ev("completed_task", "p1", 300)];
    expect(pendingPlanProposals(events, 0)).toHaveLength(1);
  });

  it("ignores work in other projects and proposals older than the window", () => {
    const events = [ev("started_task", "p2", 300), ev("proposed_plan", "p1", 100), ev("proposed_plan", "p3", 5)];
    expect(pendingPlanProposals(events, 50).map((e) => e.projectId)).toEqual(["p1"]);
  });
});
