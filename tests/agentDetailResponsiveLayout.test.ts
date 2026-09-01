import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  it("bounds the conversation workspace on wide desktop", () => {
    expect(agentDetailResponsiveLayout.conversationBase).toContain("xl:flex");
    expect(agentDetailResponsiveLayout.conversationActive).toContain(
      "xl:h-[min(48rem,calc(100dvh-18rem))]",
    );
    expect(agentDetailResponsiveLayout.conversationActive).toContain("xl:min-h-[32rem]");
    expect(agentDetailResponsiveLayout.conversationActive).toContain(
      "xl:overflow-hidden",
    );
  });

  it("launches voice from the header and a responsive dialog", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../app/(app)/agents/[agentId]/page.tsx"), "utf8");
    const chat = source.indexOf("<AgentChatPanel");
    expect(chat).toBeGreaterThan(-1);
    expect(source).toContain('data-testid="agent-voice-dialog"');
    expect(source).toContain('sm:top-1/2');
    expect(source).toContain('bottom-0');
    expect(source).toContain('onCall={() => setVoiceOpen(true)}');
    expect(source).not.toContain('<details className="group rounded-lg border border-border bg-card/40">');
  });
});
