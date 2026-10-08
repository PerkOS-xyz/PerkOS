import { describe, expect, it } from "vitest";

import { deriveSeats } from "../app/components/ProjectTeamStage";
import { taskSignal } from "../app/components/TaskSignal";
import type { Task } from "../app/lib/perkosApi";

const RESEARCHER = "Northline-Drop-Market-Researcher";

describe("a task the runtime accepted", () => {
  const accepted: Task = {
    id: "t1",
    name: "Profile the drop audience",
    agent: RESEARCHER,
    status: "Backlog",
    priority: "Medium",
    dispatchState: "delivered",
  };

  it("reads as picked up on the card", () => {
    expect(taskSignal(accepted)).toBe("pickedUp");
  });

  it("reads as picked up on the seat, not ready for the next assignment", () => {
    expect(deriveSeats([RESEARCHER], null, [accepted])[0]!.state).toBe("pickedUp");
  });

  it("still reads as delivered once the task is done", () => {
    expect(taskSignal({ ...accepted, status: "Done" })).toBe("delivered");
  });
});
