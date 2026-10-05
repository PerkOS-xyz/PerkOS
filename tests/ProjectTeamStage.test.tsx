import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectTeamStage, deriveSeats } from "../app/components/ProjectTeamStage";
import type { Task } from "../app/lib/perkosApi";

const LEAD = "Seoul-Beans-Account-Manager";
const SEO = "Seoul-Beans-SEO-Specialist";
const WRITER = "Seoul-Beans-Content-Writer";
const SOCIAL = "Seoul-Beans-Social-Media-Manager";

const tasks: Task[] = [
  { id: "t1", name: "Research keywords", agent: SEO, status: "Done", priority: "Medium" },
  { id: "t2", name: "Build the calendar", agent: WRITER, status: "In progress", priority: "Medium", parents: ["t1"], dispatchedAt: new Date(Date.now() - 72_000).toISOString() },
  { id: "t3", name: "Week one posts", agent: SOCIAL, status: "Backlog", priority: "Medium", parents: ["t2"], dispatchState: "waiting_on_dependency" },
];

describe("deriveSeats", () => {
  it("puts the lead first and derives each teammate's live state", () => {
    const seats = deriveSeats([SEO, WRITER, SOCIAL, LEAD], LEAD, tasks);
    expect(seats.map((s) => s.name)).toEqual([LEAD, SEO, WRITER, SOCIAL]);
    expect(seats.map((s) => s.state)).toEqual(["ready", "done", "working", "waiting"]);
    expect(seats[3].waitingOn).toBe(WRITER);
    expect(seats[1].doneCount).toBe(1);
  });

  it("shows a resting teammate when its runtime is hibernated", () => {
    const seats = deriveSeats([SEO], null, [], { [SEO]: { hibernationState: "hibernated" } });
    expect(seats[0].state).toBe("resting");
  });
});

describe("ProjectTeamStage", () => {
  it("renders the team with live work and a way to jump to the conversation", () => {
    const focus = vi.fn();
    render(<ProjectTeamStage agentNames={[SEO, WRITER, SOCIAL, LEAD]} pmAgent={LEAD} tasks={tasks} onFocusAgent={focus} />);
    expect(screen.getByText("Working on it")).toBeInTheDocument();
    expect(screen.getByText(`Waiting for ${WRITER}`)).toBeInTheDocument();
    expect(screen.getByText("Build the calendar")).toBeInTheDocument();
    expect(screen.getByText(/1m 1\ds|1m 12s/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /See in conversation/ })[2]);
    expect(focus).toHaveBeenCalledWith(WRITER);
  });

  it("explains an empty team", () => {
    render(<ProjectTeamStage agentNames={[]} pmAgent={null} tasks={[]} />);
    expect(screen.getByText(/No teammates yet/)).toBeInTheDocument();
  });
});
