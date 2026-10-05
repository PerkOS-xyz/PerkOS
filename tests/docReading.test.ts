import { describe, expect, it } from "vitest";

import { docToMarkdown, readDoc, RESULT_OWNER, splitResult } from "../app/lib/docReading";
import type { PlanBlock, Task } from "../app/lib/perkosApi";

const group: PlanBlock = { id: "g1", type: "planGroup", order: 0, title: "Launch in 30 days", owner: "agent:Lead" };
const research: PlanBlock = {
  id: "t1",
  type: "planTask",
  order: 1,
  owner: "agent:Lead",
  title: "Research search keywords",
  desc: "Find the top **cold brew** searches.",
  acceptance: "A ranked list of 20 keywords.",
  suggestedAgent: "Researcher",
  materializedTaskId: "task-a",
};
const copy: PlanBlock = {
  id: "t2",
  type: "planTask",
  order: 2,
  owner: "agent:Lead",
  title: "Write launch copy",
  suggestedAgent: "Writer",
  materializedTaskId: "task-b",
};
const draft: PlanBlock = { id: "t3", type: "planTask", order: 3, owner: "agent:Lead", title: "Plan the tasting" };
const note: PlanBlock = { id: "n1", type: "note", order: 4, owner: "user:0xabc", text: "Keep the budget under $500." };
const resultForA: PlanBlock = {
  id: "task-result-task-a",
  type: "note",
  order: 5,
  owner: RESULT_OWNER,
  sourceTaskId: "task-a",
  text: "## Research search keywords\n\nConsolidated keywords.",
};
const orphanResult: PlanBlock = {
  id: "task-result-task-z",
  type: "note",
  order: 6,
  owner: RESULT_OWNER,
  text: "## Old deliverable\n\nKept for the record.",
};

const tasks: Task[] = [
  { id: "task-a", name: "Research search keywords", status: "Done", agent: "Researcher-2", result: "1. cold brew seoul" } as Task,
  { id: "task-b", name: "Write launch copy", status: "In progress", agent: "Writer" } as Task,
];

describe("splitResult", () => {
  it("takes the first line as the title and the rest as the body", () => {
    expect(splitResult("## Title\n\nBody text")).toEqual({ title: "Title", body: "Body text" });
  });

  it("falls back when the note is empty", () => {
    expect(splitResult("   ", "Result")).toEqual({ title: "Result", body: "   " });
  });
});

describe("readDoc", () => {
  const reading = readDoc([group, research, copy, draft, note, resultForA, orphanResult], tasks);

  it("numbers plan tasks and counts board progress", () => {
    expect(reading.taskCount).toBe(3);
    expect(reading.onBoard).toBe(2);
    expect(reading.delivered).toBe(1);
    expect(reading.active).toBe(1);
    const numbers = reading.items.flatMap((i) => (i.kind === "task" ? [i.view.number] : []));
    expect(numbers).toEqual([1, 2, 3]);
  });

  it("puts the live board result and assignee on the plan task", () => {
    const first = reading.items.find((i) => i.kind === "task" && i.view.block.id === "t1");
    expect(first?.kind === "task" && first.view.result).toBe("1. cold brew seoul");
    expect(first?.kind === "task" && first.view.agent).toBe("Researcher-2");
  });

  it("falls back to the consolidated note when the board has no result", () => {
    const reading2 = readDoc([research, resultForA], [{ ...tasks[0]!, result: undefined }]);
    const item = reading2.items[0];
    expect(item?.kind === "task" && item.view.result).toBe("Consolidated keywords.");
  });

  it("keeps the lead's suggestion until the task reaches the board", () => {
    const third = reading.items.find((i) => i.kind === "task" && i.view.block.id === "t3");
    expect(third?.kind === "task" && third.view.task).toBeUndefined();
    expect(third?.kind === "task" && third.view.agent).toBeUndefined();
  });

  it("folds matched results into their task and keeps orphans", () => {
    const kinds = reading.items.map((i) => i.kind);
    expect(kinds).toEqual(["group", "task", "task", "task", "note", "result"]);
    const orphan = reading.items.at(-1);
    expect(orphan?.kind === "result" && orphan.parts.title).toBe("Old deliverable");
  });
});

describe("docToMarkdown", () => {
  it("writes the plan as one readable Markdown file", () => {
    const reading = readDoc([group, research, note], tasks);
    const md = docToMarkdown("Seoul launch", reading.items, {
      doneWhen: "Done when",
      assignedTo: "Assigned to",
      result: "Result",
    });
    expect(md).toBe(
      [
        "# Seoul launch",
        "## Launch in 30 days",
        "### 1. Research search keywords",
        "Find the top **cold brew** searches.",
        "**Done when:** A ranked list of 20 keywords.",
        "**Assigned to:** Researcher-2",
        "#### Result",
        "1. cold brew seoul",
        "Keep the budget under $500.",
      ].join("\n\n") + "\n",
    );
  });
});
