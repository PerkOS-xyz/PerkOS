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
    pathname = "/organizations";
    render(<ChatbotTrigger />);
    expect(screen.getByRole("button", { name: "Open your PerkOS assistant" })).toBeVisible();
  });

  it.each(["/agents", "/projects", "/tasks"])(
    "does not cover cards or rows on list page %s",
    (route) => {
      pathname = route;
      render(<ChatbotTrigger />);
      expect(screen.queryByRole("button", { name: "Open your PerkOS assistant" })).toBeNull();
    },
  );

  it("does not cover dashboard Billing or stat tiles", () => {
    pathname = "/dashboard";
    render(<ChatbotTrigger />);
    expect(screen.queryByRole("button", { name: "Open your PerkOS assistant" })).toBeNull();
  });

  it("does not cover the Settings Update control", () => {
    pathname = "/settings";
    render(<ChatbotTrigger />);
    expect(screen.queryByRole("button", { name: "Open your PerkOS assistant" })).toBeNull();
  });

  it("does not cover the agent wizard actions", () => {
    pathname = "/agents/new";
    render(<ChatbotTrigger />);
    expect(screen.queryByRole("button", { name: "Open your PerkOS assistant" })).toBeNull();
  });

  it("does not cover direct agent chat controls", () => {
    pathname = "/agents/DWaY182NNUTg0FMWloXY";
    render(<ChatbotTrigger />);
    expect(screen.queryByRole("button", { name: "Open your PerkOS assistant" })).toBeNull();
  });

  it.each(["/chat", "/chat/agent/morpheus", "/chat/conversation-id"])(
    "does not cover chat controls on %s",
    (route) => {
      pathname = route;
      render(<ChatbotTrigger />);
      expect(screen.queryByRole("button", { name: "Open your PerkOS assistant" })).toBeNull();
    },
  );

  it.each(["/projects/new", "/projects/project-id", "/projects/project-id?tab=chat"])(
    "does not cover project controls on %s",
    (route) => {
      pathname = route;
      render(<ChatbotTrigger />);
      expect(screen.queryByRole("button", { name: "Open your PerkOS assistant" })).toBeNull();
    },
  );

  it("does not cover wallet balances or transfer controls", () => {
    pathname = "/wallet";
    render(<ChatbotTrigger />);
    expect(screen.queryByRole("button", { name: "Open your PerkOS assistant" })).toBeNull();
  });
});
