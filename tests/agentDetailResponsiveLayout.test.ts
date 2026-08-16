import { describe, expect, it } from "vitest";

import { agentDetailResponsiveLayout } from "../app/(app)/agents/[agentId]/page";

describe("agent detail responsive layout", () => {
  it("keeps phone and tablet in the tabbed single-viewport layout", () => {
    expect(agentDetailResponsiveLayout.tabs).toBe("xl:hidden");
    expect(agentDetailResponsiveLayout.conversationActive).toContain(
      "h-[calc(100svh-18rem)]",
    );
    expect(agentDetailResponsiveLayout.conversationActive).toContain(
      "md:h-[calc(100dvh-13rem)]",
    );
    expect(agentDetailResponsiveLayout.settingsBase).toContain("xl:flex");
    expect(agentDetailResponsiveLayout.settingsBase).not.toContain("md:flex");
  });

  it("returns to document flow only on wide desktop", () => {
    expect(agentDetailResponsiveLayout.conversationBase).toContain("xl:flex");
    expect(agentDetailResponsiveLayout.conversationActive).toContain("xl:h-auto");
    expect(agentDetailResponsiveLayout.conversationActive).toContain(
      "xl:overflow-visible",
    );
  });
});
