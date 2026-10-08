import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectTeamStage, deriveSeats } from "../app/components/ProjectTeamStage";
import { TaskSignal, taskSignal } from "../app/components/TaskSignal";
import type { Task } from "../app/lib/perkosApi";

const RESEARCHER = "Northline-Market-Researcher";
const STRATEGIST = "Northline-Brand-Strategist";
const MERCHANDISER = "Northline-Product-Merchandiser";

describe("seat and task card agree", () => {
  it("shows a picked-up task as picked up on the seat too", () => {
    const tasks: Task[] = [
      { id: "t1", name: "Research the audience", agent: RESEARCHER, status: "Backlog", priority: "Medium", dispatchState: "starting" },
    ];
    expect(taskSignal(tasks[0]!)).toBe("pickedUp");
    expect(deriveSeats([RESEARCHER], null, tasks)[0]!.state).toBe("pickedUp");
  });

  it("shows a task the runtime is working on as working before its status moves", () => {
    const tasks: Task[] = [
      { id: "t1", name: "Research the audience", agent: RESEARCHER, status: "Backlog", priority: "Medium", dispatchState: "working" },
    ];
    expect(taskSignal(tasks[0]!)).toBe("working");
    expect(deriveSeats([RESEARCHER], null, tasks)[0]!.state).toBe("working");
  });

  it("says who delivered when a waiting task is free to start", () => {
    const tasks: Task[] = [
      { id: "t1", name: "Research the audience", agent: RESEARCHER, status: "Done", priority: "Medium", updatedAt: "2026-10-08T05:00:00.000Z" },
      { id: "t2", name: "Define the positioning", agent: STRATEGIST, status: "Backlog", priority: "Medium", parents: ["t1"] },
    ];
    const seat = deriveSeats([RESEARCHER, STRATEGIST], null, tasks)[1]!;
    expect(seat.state).toBe("ready");
    expect(seat.unblockedBy).toBe(RESEARCHER);
    render(<ProjectTeamStage agentNames={[RESEARCHER, STRATEGIST]} pmAgent={null} tasks={tasks} />);
    expect(screen.getByText(`${RESEARCHER} delivered · ready to start`)).toBeInTheDocument();
  });

  it("keeps the plain ready line for a task with no parents", () => {
    const tasks: Task[] = [{ id: "t1", name: "Build the catalog", agent: MERCHANDISER, status: "Backlog", priority: "Medium" }];
    expect(deriveSeats([MERCHANDISER], null, tasks)[0]!.unblockedBy).toBeUndefined();
  });

  it("gives a task in review its own chip", () => {
    expect(taskSignal({ status: "Review" })).toBe("review");
    render(<TaskSignal task={{ status: "Review" }} />);
    expect(screen.getByText("In review")).toBeInTheDocument();
  });
});
