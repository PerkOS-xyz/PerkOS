import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ProjectProgress, projectProgress } from "../app/components/ProjectProgress";
import type { ProjectDetail, Task } from "../app/lib/perkosApi";

const href = (id: string) => `/projects/p1/tasks/${id}`;
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, name: `Task ${id}`, status: "Backlog", priority: "Medium", agent: "Maya", ...extra });

describe("projectProgress", () => {
  it("asks the owner to approve a proposed plan", () => {
    const view = projectProgress({ phase: "awaiting_approval", tasks: [], taskHref: href });
    expect(view.step).toBe(1);
    expect(view.tone).toBe("attention");
    expect(view.needs.map((n) => n.key)).toEqual(["approve"]);
  });

  it("counts delivered work while the team runs and lists paused tasks", () => {
    const view = projectProgress({
      phase: "running",
      taskHref: href,
      tasks: [
        task("a", { status: "Done" }),
        task("b", { status: "In progress" }),
        task("c", { dispatchStuck: true }),
      ],
    });
    expect(view.step).toBe(2);
    expect(view.line).toBe("1 working · 1 of 3 tasks delivered");
    expect(view.needs).toEqual([{ key: "paused-c", text: "Task c is paused. Open it to retry", href: "/projects/p1/tasks/c" }]);
  });

  it("summarizes a finished project by deliveries and teammates", () => {
    const view = projectProgress({
      phase: "complete",
      taskHref: href,
      tasks: [task("a", { status: "Done", agent: "Maya" }), task("b", { status: "Done", agent: "Leo" }), task("c", { status: "Done", agent: "Leo" })],
    });
    expect(view).toMatchObject({ step: 3, tone: "done", line: "3 tasks delivered by 2 teammates", needs: [] });
  });

  it("explains a planning retry with the server's reason", () => {
    const view = projectProgress({ phase: "planning_failed", failureReason: "PerkOS usage limit reached while planning.", tasks: [], taskHref: href });
    expect(view.line).toBe("PerkOS usage limit reached while planning.");
    expect(view.needs[0]?.key).toBe("replan");
  });
});

describe("ProjectProgress", () => {
  it("renders the steps and reassures when nothing needs the owner", () => {
    const detail = {
      project: { id: "p1", name: "Launch", workflow: { phase: "running" } },
      tasks: [task("a", { status: "In progress" })],
    } as unknown as ProjectDetail;
    render(<ProjectProgress detail={detail} projectId="p1" />);
    expect(screen.getByRole("list", { name: "Project steps" })).toHaveTextContent("Work");
    expect(screen.getByText("Nothing needs you right now. The team keeps going on its own.")).toBeInTheDocument();
  });
});
