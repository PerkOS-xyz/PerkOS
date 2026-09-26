import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Embers } from "@/app/runtime/Embers";

type SeenCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let reduced = false;
let frames: FrameRequestCallback[] = [];
let seen: SeenCallback | null = null;
const unobserve = vi.fn();
const cancel = vi.fn();
const ctx = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillStyle: "",
  shadowColor: "",
  shadowBlur: 0,
};

beforeEach(() => {
  reduced = false;
  frames = [];
  seen = null;
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce") }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", cancel);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: SeenCallback) {
        seen = callback;
      }
      observe() {}
      disconnect = unobserve;
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Embers", () => {
  it("draws nothing for a visitor who asks for less motion", () => {
    reduced = true;
    const { container } = render(<Embers count={5} />);
    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
  });

  it("draws every ember while on screen, and stops when scrolled away or removed", () => {
    const { unmount } = render(<Embers count={5} />);
    expect(frames).toHaveLength(0);

    seen!([{ isIntersecting: true }]);
    expect(frames).toHaveLength(1);
    frames[0]!(16.7);
    expect(ctx.arc).toHaveBeenCalledTimes(5);
    expect(frames).toHaveLength(2);

    seen!([{ isIntersecting: false }]);
    expect(cancel).toHaveBeenCalled();

    unmount();
    expect(unobserve).toHaveBeenCalled();
  });
});
