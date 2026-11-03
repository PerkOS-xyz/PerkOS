import { describe, expect, it } from "vitest";
import type { Project, Task } from "../app/lib/perkosApi";
import { pendingProjectPlans, projectTaskAttention, taskDetailHref } from "../app/lib/projectActionItems";

const project = (id: string, phase: NonNullable<Project["workflow"]>["phase"], planId?: string): Project =>
  ({ id, name: id, status: "active", agents: 1, tasks: 0, budget: "", workflow: { phase, planId } });
const task = (id: string, status: string, extra: Partial<Task> = {}): Task =>
  ({ id, name: id, status, priority: "Medium", agent: "", ...extra });

describe("project action items", () => {
  it("uses the persisted pending plan and does not depend on recent activity", () => {
    const pending = project("pending", "awaiting_approval", "plan-1");
    const projects = [pending, project("approved", "approved", "plan-2"), project("missing", "awaiting_approval")];
    expect(pendingProjectPlans(projects, true)).toEqual([pending]);
    expect(pendingProjectPlans(projects, false)).toEqual([]);
  });

  it("distinguishes review, dispatch failures and automatic retries without flagging finished work", () => {
    expect(projectTaskAttention([
      task("review", "Review", { result: "Draft" }),
      task("blocked", "In progress", { dispatchStuck: true, dispatchState: "retrying" }),
      task("retry", "In progress", { dispatchState: "retrying" }),
      task("done", "Done", { dispatchStuck: true }),
      task("normal", "In progress"),
    ]).map(({ task, kind }) => [task.id, kind])).toEqual([
      ["review", "review"], ["blocked", "blocked"], ["retry", "retrying"],
    ]);
  });

  it("preserves the owner when opening a task from a shared project", () => {
    expect(taskDetailHref("my project", "task/1", "owner+1"))
      .toBe("/projects/my%20project/tasks/task%2F1?owner=owner%2B1");
  });
});
