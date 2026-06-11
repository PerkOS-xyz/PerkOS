import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  ActivityHeatmap,
  agentColor,
  BarList,
  DonutChart,
} from "../app/components/charts";

describe("agentColor", () => {
  it("is deterministic for the same agent name", () => {
    expect(agentColor("Researcher")).toBe(agentColor("Researcher"));
  });

  it("differs between different agents", () => {
    expect(agentColor("Researcher")).not.toBe(agentColor("Copywriter"));
  });

  it("applies the requested alpha", () => {
    expect(agentColor("Maya", 0.25)).toContain("0.25)");
  });
});

describe("DonutChart", () => {
  it("renders the center stat and an accessible label", () => {
    render(
      <DonutChart
        segments={[
          { label: "A", value: 3, color: "red" },
          { label: "B", value: 1, color: "blue" },
        ]}
        centerValue="4"
        centerLabel="tasks"
      />,
    );
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("tasks")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4 tasks" })).toBeInTheDocument();
  });

  it("renders with zero totals without dividing by zero", () => {
    render(
      <DonutChart segments={[]} centerValue="0" centerLabel="tasks" />,
    );
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});

describe("BarList", () => {
  it("renders one row per entry with its value", () => {
    render(
      <BarList
        rows={[
          { label: "Researcher", value: 3, color: "red" },
          { label: "Copywriter", value: 1, color: "blue", hint: "/4" },
        ]}
      />,
    );
    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.getByText("Copywriter")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("/4")).toBeInTheDocument();
  });
});

describe("ActivityHeatmap", () => {
  it("renders a cell per day with the count in the tooltip", () => {
    const today = new Date().toISOString().slice(0, 10);
    const { container } = render(
      <ActivityHeatmap counts={{ [today]: 5 }} weeks={2} />,
    );
    // 2 weeks → 14 day cells.
    expect(container.querySelectorAll("span[title]").length).toBe(14);
    expect(
      container.querySelector(`span[title="${today}: 5 events"]`),
    ).not.toBeNull();
  });
});
