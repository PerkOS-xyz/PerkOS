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

  it("keeps the conversation viewport-bound on wide desktop too", () => {
    // This used to assert xl:h-auto + xl:overflow-visible, i.e. the
    // conversation rejoined document flow on wide screens. Both panels are
    // visible at xl, so that put Settings UNDERNEATH the conversation and left
    // the message list scrolling inside a page that also scrolled — the
    // "two scrollbars, hard to handle" report. The conversation stays
    // viewport-bound at every size so exactly one region scrolls.
    expect(agentDetailResponsiveLayout.conversationBase).toContain("xl:flex");
    expect(agentDetailResponsiveLayout.conversationActive).toContain(
      "xl:h-[calc(100dvh-11rem)]",
    );
    expect(agentDetailResponsiveLayout.conversationActive).toContain(
      "xl:overflow-hidden",
    );
    expect(agentDetailResponsiveLayout.conversationActive).not.toContain(
      "xl:h-auto",
    );
  });
});
