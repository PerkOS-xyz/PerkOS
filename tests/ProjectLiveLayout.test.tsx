import { afterEach, describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";

import { ProjectLiveLayout } from "../app/components/ProjectLiveLayout";

function setScroll(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
}

afterEach(() => setScroll(0));

describe("ProjectLiveLayout conversation height", () => {
  it("keeps one height while the page scrolls", async () => {
    setScroll(0);
    const { container } = render(
      <ProjectLiveLayout
        conversation={<div data-testid="chat">Conversation</div>}
        stage={() => <div>Stage</div>}
        work={<div>Tasks</div>}
        counts={{ working: 0, done: 0, total: 0 }}
      />,
    );
    const cell = container.querySelector<HTMLElement>("#project-conversation")!;
    const frame = cell.firstElementChild as HTMLElement;
    // The conversation rests 260px down the page; scrolling moves it up the
    // viewport by the same amount the page scrolled.
    cell.getBoundingClientRect = () => ({ top: 260 - window.scrollY } as DOMRect);
    window.dispatchEvent(new Event("resize"));
    await act(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    const resting = frame.style.getPropertyValue("--live-chat-height");
    expect(resting).toBe(`${Math.max(448, window.innerHeight - 260 - 16)}px`);

    setScroll(700);
    window.dispatchEvent(new Event("scroll"));
    document.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
    await act(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    expect(frame.style.getPropertyValue("--live-chat-height")).toBe(resting);
  });
});
