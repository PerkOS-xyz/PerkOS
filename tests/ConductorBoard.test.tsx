import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  ConductorBoard,
  agentNameOf,
  inProgressCountByHandle,
} from "../app/components/ConductorBoard";
import type { Task } from "../app/lib/perkosApi";
import type { SwarmDefinition } from "../app/lib/swarm";

// next/link renders an <a> in tests — no real router needed for these renders.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

// @dnd-kit registers heavy listeners on mount; we don't exercise drag here.
// The board still renders; just keep it deterministic.
const SWARM: SwarmDefinition = {
  version: "1",
  name: "Mobile",
  roster: [
    {
      handle: "builder-1",
      agent: "agent:openclaw-alice",
      role: "builder",
      description: "Implements features",
    },
    {
      handle: "reviewer",
      agent: "agent:hermes-bob",
      role: "reviewer",
    },
  ],
};

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    name: "Task",
    status: "Backlog",
    priority: "Medium",
    agent: "builder-1",
    ...over,
  };
}

describe("ConductorBoard rendering", () => {
  it("shows the roster panel when a swarm is provided", () => {
    render(<ConductorBoard projectId="p1" tasks={[]} swarm={SWARM} />);
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.getByText("builder-1")).toBeInTheDocument();
    // "reviewer" appears as both handle and role — at least one match is enough
    expect(screen.getAllByText("reviewer").length).toBeGreaterThanOrEqual(1);
    // Roles render as uppercase tracking labels.
    expect(screen.getAllByText("builder", { exact: false })).not.toHaveLength(0);
  });

  it("renders an empty-roster hint when no swarm is provided", () => {
    render(<ConductorBoard projectId="p1" tasks={[]} />);
    expect(
      screen.getByText(/No swarm defined for this project/i),
    ).toBeInTheDocument();
  });

  it("maps a task agent='handle' to the roster member chip", () => {
    render(
      <ConductorBoard
        projectId="p1"
        tasks={[task({ id: "t1", name: "Wire API", agent: "builder-1" })]}
        swarm={SWARM}
      />,
    );
    // Card shows "builder-1 · builder" (handle · role).
    expect(screen.getByText(/builder-1 · builder/)).toBeInTheDocument();
  });

  it("falls back to free-text agent when no roster match", () => {
    render(
      <ConductorBoard
        projectId="p1"
        tasks={[task({ id: "t1", name: "Standalone", agent: "Solo" })]}
        swarm={SWARM}
      />,
    );
    expect(screen.getByText("Solo")).toBeInTheDocument();
  });

  it("counts only in_progress tasks per handle in the roster badge", () => {
    render(
      <ConductorBoard
        projectId="p1"
        tasks={[
          task({ id: "a", agent: "builder-1", status: "In progress" }),
          task({ id: "b", agent: "builder-1", status: "Review" }), // Review → in_progress
          task({ id: "c", agent: "builder-1", status: "Done" }), // not counted
          task({ id: "d", agent: "reviewer", status: "Backlog" }), // not counted
        ]}
        swarm={SWARM}
      />,
    );
    // builder-1 should show "2"; reviewer should show "0".
    expect(screen.getByTitle("2 in progress")).toBeInTheDocument();
    expect(screen.getByTitle("0 in progress")).toBeInTheDocument();
  });

  it("renders task names from the tasks prop", () => {
    render(
      <ConductorBoard
        projectId="p1"
        tasks={[task({ id: "t1", name: "Make it ship" })]}
        swarm={SWARM}
      />,
    );
    expect(screen.getByText("Make it ship")).toBeInTheDocument();
  });
});

describe("agentNameOf", () => {
  it("strips the agent: prefix and lowercases", () => {
    expect(agentNameOf("agent:Apollo")).toBe("apollo");
  });
  it("returns the input lowercased when no prefix", () => {
    expect(agentNameOf("Bob")).toBe("bob");
  });
});

describe("inProgressCountByHandle", () => {
  it("counts only in_progress items that carry a handle", () => {
    const counts = inProgressCountByHandle([
      { id: "1", status: "in_progress", task: task(), handle: "a" },
      { id: "2", status: "in_progress", task: task(), handle: "a" },
      { id: "3", status: "todo", task: task(), handle: "a" }, // wrong status
      { id: "4", status: "in_progress", task: task(), handle: undefined }, // no handle
      { id: "5", status: "in_progress", task: task(), handle: "b" },
    ]);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
    expect(counts.get("c")).toBeUndefined();
  });
});
