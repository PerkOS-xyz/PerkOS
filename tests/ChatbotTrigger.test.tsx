import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/dashboard";
const toggle = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("../app/components/ChatbotProvider", () => ({
  useChatbot: () => ({ open: false, toggle }),
}));

import { ChatbotTrigger } from "../app/components/ChatbotTrigger";

describe("ChatbotTrigger route visibility", () => {
  beforeEach(() => {
    pathname = "/dashboard";
    toggle.mockReset();
  });

  it("renders on regular app screens", () => {
    render(<ChatbotTrigger />);
    expect(screen.getByRole("button", { name: "Open your PerkOS assistant" })).toBeVisible();
  });

  it("does not cover the agent wizard actions", () => {
    pathname = "/agents/new";
    render(<ChatbotTrigger />);
    expect(screen.queryByRole("button", { name: "Open your PerkOS assistant" })).toBeNull();
  });
});
