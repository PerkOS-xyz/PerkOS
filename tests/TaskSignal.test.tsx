import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TaskSignal, taskSignal } from "../app/components/TaskSignal";

describe("taskSignal", () => {
  it("follows the task from pickup to delivery", () => {
    expect(taskSignal({ status: "Backlog", dispatchState: "starting" })).toBe("pickedUp");
    expect(taskSignal({ status: "In progress", dispatchState: "working" })).toBe("working");
    expect(taskSignal({ status: "Done", dispatchState: "completed" })).toBe("delivered");
  });

  it("calls out retries, paused tasks and waiting ones", () => {
    expect(taskSignal({ status: "In progress", dispatchState: "retrying" })).toBe("retrying");
    expect(taskSignal({ status: "In progress", dispatchStuck: true })).toBe("paused");
    expect(taskSignal({ status: "Backlog", dispatchState: "waiting_on_dependency" })).toBe("waiting");
    expect(taskSignal({ status: "Backlog" })).toBeNull();
  });
});

describe("TaskSignal", () => {
  it("shows a working chip with its clock", () => {
    const dispatchedAt = new Date(Date.now() - 65_000).toISOString();
    render(<TaskSignal task={{ status: "In progress", dispatchState: "working", dispatchedAt }} />);
    expect(screen.getByText("Working")).toBeInTheDocument();
    expect(screen.getByText(/1m/)).toBeInTheDocument();
  });

  it("renders nothing for a task nobody picked up yet", () => {
    const { container } = render(<TaskSignal task={{ status: "Backlog" }} />);
    expect(container.firstChild).toBeNull();
  });
});
