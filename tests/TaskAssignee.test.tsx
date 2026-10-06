import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { TaskAssignee } from "../app/components/TaskAssignee";

describe("TaskAssignee", () => {
  it("shows the assignee's orb and name", () => {
    const { container } = render(<TaskAssignee agent="Harbor-Researcher" />);
    expect(screen.getByText("Harbor-Researcher")).toBeInTheDocument();
    expect(screen.getByTitle("Agent: Harbor-Researcher")).toBeInTheDocument();
    expect(container.querySelector("[data-avatar-seed]")).not.toBeNull();
  });

  it("uses the same orb seed as the team seat for that agent", () => {
    const { container } = render(<TaskAssignee agent="Harbor-Analyst" />);
    const seed = container.querySelector("[data-avatar-seed]")?.getAttribute("data-avatar-seed");
    expect(seed).toBe("Harbor-Analyst");
  });

  it("shows an open seat when nobody owns the task", () => {
    const { container } = render(<TaskAssignee agent="  " />);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(container.querySelector("[data-avatar-seed]")).toBeNull();
  });
});
