import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toggle = vi.fn();
let spotlight = false;

vi.mock("../app/components/ChatbotProvider", () => ({
  useChatbot: () => ({ open: false, toggle, spotlight }),
}));

import { ChatbotTrigger } from "../app/components/ChatbotTrigger";

const LABEL = "Open your PerkOS assistant";

/**
 * The trigger used to hide itself by route prefix. That list only ever grew —
 * every time the fixed disc landed on a card another path was added, until it
 * covered /agents, /chat, /projects, /tasks, /wallet, /dashboard and /settings,
 * which is nearly the whole product. Visibility now follows what is on screen:
 * the bubble appears only where an empty state says there is nothing to cover,
 * and the header button carries the assistant everywhere else.
 */
describe("ChatbotTrigger visibility", () => {
  beforeEach(() => {
    toggle.mockReset();
    spotlight = false;
  });

  it("shows the bubble on an empty screen, which has nothing to cover", () => {
    spotlight = true;
    render(<ChatbotTrigger />);
    expect(screen.getByRole("button", { name: LABEL })).toBeVisible();
  });

  it("stays out of the way once a screen has content", () => {
    spotlight = false;
    render(<ChatbotTrigger />);
    expect(screen.queryByRole("button", { name: LABEL })).toBeNull();
  });

  it("does not depend on the route to decide", () => {
    // The same screen is allowed the bubble whatever its path is: an empty
    // /agents and an empty /wallet behave identically, which is what the old
    // prefix list could never express.
    spotlight = true;
    const { unmount } = render(<ChatbotTrigger />);
    expect(screen.getByRole("button", { name: LABEL })).toBeVisible();
    unmount();

    spotlight = false;
    render(<ChatbotTrigger />);
    expect(screen.queryByRole("button", { name: LABEL })).toBeNull();
  });

  it("keeps one fixed position instead of dodging a per-page rail", () => {
    spotlight = true;
    render(<ChatbotTrigger />);
    const cls = screen.getByRole("button", { name: LABEL }).className;
    // lg:right-[322px] inset the disc past a 280px rail that only some pages
    // have, so on every other page it floated far from the edge.
    expect(cls).not.toContain("right-[322px]");
    expect(cls).toContain("right-4");
  });
});
