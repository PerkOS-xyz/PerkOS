import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

import { ProjectLiveLayout } from "../app/components/ProjectLiveLayout";

function layout(workFocus: number) {
  return (
    <ProjectLiveLayout
      conversation={<div>Conversation</div>}
      stage={() => <div>Stage</div>}
      work={<div>Members list</div>}
      counts={{ working: 0, done: 0, total: 0 }}
      workFocus={workFocus}
    />
  );
}

describe("ProjectLiveLayout work links", () => {
  it("shows and scrolls to the work area when a link opens a work tab", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = render(layout(0));
    const work = screen.getByRole("region", { name: "Project work" });
    const rail = work.closest("aside");
    expect(rail).not.toBeNull();
    expect(rail?.className).toContain("hidden");
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(layout(1));
    await act(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    expect(rail?.className).toContain("block");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});
