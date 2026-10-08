import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ProjectLiveLayout } from "../app/components/ProjectLiveLayout";

type View = "tasks" | "workflow" | "knowledge" | "docs";

function layout(requestedStage: View | undefined, stageRequestId: number) {
  return (
    <ProjectLiveLayout
      conversation={<div>Conversation</div>}
      stage={(view) => <div>Showing {view}</div>}
      work={<div>Members list</div>}
      counts={{ working: 0, done: 0, total: 0 }}
      requestedStage={requestedStage}
      stageRequestId={stageRequestId}
    />
  );
}

describe("ProjectLiveLayout stage requests", () => {
  it("opens Docs when a link asks for it, and again after the owner browsed elsewhere", () => {
    const { rerender } = render(layout(undefined, 0));
    expect(screen.getByText("Showing tasks")).toBeInTheDocument();

    rerender(layout("docs", 1));
    expect(screen.getByText("Showing docs")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Tasks/ })[0]!);
    expect(screen.getByText("Showing tasks")).toBeInTheDocument();

    rerender(layout("docs", 2));
    expect(screen.getByText("Showing docs")).toBeInTheDocument();
  });
});
