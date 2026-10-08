import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectStage } from "../app/components/ProjectStage";

const team = ["Launch-Manager", "Market-Researcher", "Brand-Strategist", "Product-Merchandiser", "Campaign-Producer", "Operations-Support"];

describe("ProjectStage layout", () => {
  it("fits six teammates in rows instead of a sideways scroll", () => {
    render(<ProjectStage projectId="p1" projectName="Northline Limited Drop" pmAgent={team[0]} agentNames={team} tasks={[]} liveAgents={{}} />);
    const column = screen.getByTestId("stage-agent-Launch-Manager");
    expect(column.className).toContain("min-w-0");
    expect(column.parentElement?.className).toContain("grid-cols-2");
    expect(column.parentElement?.parentElement?.className).not.toContain("overflow-x-auto");
  });

  it("keeps the single row for a small team", () => {
    render(<ProjectStage projectId="p1" projectName="Two-Table Cafe" pmAgent={team[0]} agentNames={team.slice(0, 3)} tasks={[]} liveAgents={{}} />);
    const column = screen.getByTestId("stage-agent-Launch-Manager");
    expect(column.className).toContain("min-w-[220px]");
    expect(column.parentElement?.className).toContain("min-w-max");
  });
});
