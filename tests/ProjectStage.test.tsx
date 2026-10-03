import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectStage } from "../app/components/ProjectStage";

describe("ProjectStage", () => {
  it("puts the lead first and groups work under its assigned agent", () => {
    render(
      <ProjectStage
        projectId="project-1"
        projectName="Seoul Coffee Growth"
        pmAgent="Maya"
        agentNames={["Leo", "Maya"]}
        liveAgents={{ Maya: { id: "maya", name: "Maya", status: "ready", bridgeConnected: true } }}
        tasks={[
          { id: "task-1", name: "Create loyalty offers", status: "In progress", priority: "High", agent: "Maya" },
          { id: "task-2", name: "Review campaign", status: "Review", priority: "Medium", agent: "Leo" },
        ]}
      />,
    );

    const agents = screen.getAllByTestId(/^stage-agent-/);
    expect(agents[0]).toHaveAttribute("data-testid", "stage-agent-Maya");
    expect(agents[0]).toHaveTextContent("Create loyalty offers");
    expect(agents[1]).toHaveTextContent("Review campaign");
    expect(screen.getByRole("link", { name: /Create loyalty offers/i })).toHaveAttribute("href", "/projects/project-1/tasks/task-1");
  });

  it("keeps unassigned work visible", () => {
    render(
      <ProjectStage
        projectId="project-1"
        projectName="Launch"
        agentNames={["Maya"]}
        liveAgents={{}}
        tasks={[{ id: "task-3", name: "Choose launch date", status: "Backlog", priority: "Low", agent: "" }]}
      />,
    );

    expect(screen.getByTestId("stage-agent-Unassigned")).toHaveTextContent("Choose launch date");
  });
});
