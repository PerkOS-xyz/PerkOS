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

  it("leaves the conversation in document flow on wide desktop", () => {
    // Pinning it to `100dvh - <magic>` at xl put the composer out of reach:
    // the app header, working-now strip, back link and title block all sit
    // above the conversation, so the box started below that offset and its
    // bottom fell past the viewport — and overflow-hidden meant you could not
    // scroll to it. The page scroll is the reliable one, and with the
    // history's own cap removed it is the only one.
    expect(agentDetailResponsiveLayout.conversationBase).toContain("xl:flex");
    expect(agentDetailResponsiveLayout.conversationActive).toContain("xl:h-auto");
    expect(agentDetailResponsiveLayout.conversationActive).toContain(
      "xl:overflow-visible",
    );
    expect(agentDetailResponsiveLayout.conversationActive).not.toContain(
      "xl:h-[calc(",
    );
  });

  it("presents text chat before optional voice controls", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../app/(app)/agents/[agentId]/page.tsx"), "utf8");
    const chat = source.indexOf("<AgentChatPanel");
    const voice = source.indexOf("<AgentVoiceCallController", chat);
    expect(chat).toBeGreaterThan(-1);
    expect(voice).toBeGreaterThan(chat);
    expect(source.slice(chat, voice)).toContain("<details");
    expect(source.slice(chat, voice)).toContain("<summary");
  });
});
