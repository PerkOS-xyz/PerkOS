import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { ProjectLiveLayout } from "../app/components/ProjectLiveLayout";

describe("ProjectLiveLayout knowledge area", () => {
  it("opens project knowledge in one tap from the phone switcher", () => {
    render(
      <ProjectLiveLayout
        conversation={<div>Conversation</div>}
        stage={(view) => <div data-testid="stage-view">{view}</div>}
        work={<div>Tasks</div>}
        counts={{ working: 0, done: 3, total: 4 }}
      />,
    );
    const areas = screen.getByRole("navigation", { name: "Project areas" });
    const knowledge = within(areas).getByRole("button", { name: /Knowledge/ });
    expect(knowledge).toHaveTextContent("3 learned");
    fireEvent.click(knowledge);
    expect(knowledge).toHaveAttribute("aria-pressed", "true");
    expect(within(areas).getByRole("button", { name: /Team/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("stage-view")).toHaveTextContent("knowledge");
    expect(screen.getByRole("region", { name: "Project stage" }).className).not.toContain(" hidden");

    fireEvent.click(within(areas).getByRole("button", { name: /Team/ }));
    expect(screen.getByTestId("stage-view")).toHaveTextContent("team");
  });

  it("opens a finished project on knowledge", () => {
    render(
      <ProjectLiveLayout
        conversation={<div>Conversation</div>}
        stage={(view) => <div data-testid="stage-view">{view}</div>}
        work={<div>Tasks</div>}
        counts={{ working: 0, done: 4, total: 4 }}
      />,
    );
    expect(screen.getByTestId("stage-view")).toHaveTextContent("knowledge");
  });

  it("keeps a project with open work on the team", () => {
    render(
      <ProjectLiveLayout
        conversation={<div>Conversation</div>}
        stage={(view) => <div data-testid="stage-view">{view}</div>}
        work={<div>Tasks</div>}
        counts={{ working: 1, done: 2, total: 4 }}
      />,
    );
    expect(screen.getByTestId("stage-view")).toHaveTextContent("team");
  });
});
