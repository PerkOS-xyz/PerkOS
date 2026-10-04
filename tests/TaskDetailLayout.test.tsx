import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DeliverableSheet,
  PendingDeliverable,
  TaskMobileSummary,
  TaskRail,
  readingStats,
  type TaskPeople,
} from "../app/components/TaskDetailLayout";
import "../app/lib/i18n";

const people: TaskPeople = {
  agentName: "Seoul-Beans-Social-Media-Manager",
  agentLabel: "Seoul-Beans-Social-Media-Manager",
  runtime: "OpenClaw",
  projectId: "p1",
  projectName: "Seoul Beans",
};

describe("readingStats", () => {
  it("counts English words and rounds reading time up to a minute", () => {
    expect(readingStats("Cold brew launches in Seoul next week.")).toEqual({ words: 7, minutes: 1 });
  });

  it("counts Korean words instead of treating a sentence as one word", () => {
    const { words } = readingStats("서울 성수동 콜드브루 카페에서 만나요");
    expect(words).toBeGreaterThanOrEqual(4);
  });

  it("returns zero for an empty result", () => {
    expect(readingStats("   ")).toEqual({ words: 0, minutes: 0 });
  });
});

describe("DeliverableSheet", () => {
  it("puts the result first with its author and reading length", async () => {
    render(
      <DeliverableSheet
        result={"## Week one\n\n- Monday teaser reel"}
        title="Create week one of ready-to-post social content"
        agentLabel="Seoul-Beans-Social-Media-Manager"
      />,
    );
    expect(screen.getByRole("region", { name: "Agent result" })).toBeInTheDocument();
    expect(screen.getByText("Seoul-Beans-Social-Media-Manager")).toBeInTheDocument();
    expect(screen.getByText(/words · 1 min read/)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: "Week one" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});

describe("PendingDeliverable", () => {
  it("says the agent is working while the task is in progress", () => {
    render(<PendingDeliverable status="In progress" />);
    expect(screen.getByText("The agent is working on this task")).toBeInTheDocument();
  });

  it("says there is no deliverable before work starts", () => {
    render(<PendingDeliverable status="Backlog" />);
    expect(screen.getByText("No deliverable yet")).toBeInTheDocument();
  });
});

describe("TaskRail", () => {
  it("shows who is assigned, the project link and the brief", () => {
    render(<TaskRail people={people} prompt="Seven days of posts." />);
    expect(screen.getByText("Assigned to")).toBeInTheDocument();
    expect(screen.getByText("OpenClaw")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Seoul Beans" })).toHaveAttribute("href", "/projects/p1");
    expect(screen.getByText("Seven days of posts.")).toBeInTheDocument();
  });

  it("folds a long brief behind a toggle", () => {
    render(<TaskRail people={people} prompt={"Acceptance criteria. ".repeat(40)} />);
    const toggle = screen.getByRole("button", { name: "Show full brief" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
  });
});

describe("TaskMobileSummary", () => {
  it("summarizes the task as chips with a foldable brief", () => {
    render(<TaskMobileSummary people={people} prompt="Seven days of posts." />);
    expect(screen.getByRole("link", { name: /Seoul Beans/ })).toHaveAttribute("href", "/projects/p1");
    expect(screen.getByText("No due date")).toBeInTheDocument();
    expect(screen.getByText("Brief").closest("details")).not.toHaveAttribute("open");
  });
});
