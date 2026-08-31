import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const audited = [
  "page.tsx",
  "AutoWakeBanner.tsx",
  "AgentChatPanel.tsx",
  "VoiceHealthPanel.tsx",
  "WebhookPanel.tsx",
  "TeamPanel.tsx",
  "HibernationPanel.tsx",
];

describe("agent detail i18n audit", () => {
  it("routes audited UI components through the agentDetail catalog", () => {
    for (const file of audited) {
      const source = readFileSync(resolve(root, "app/(app)/agents/[agentId]", file), "utf8");
      expect(source, file).toContain("agentDetail.");
    }
  });

  it("keeps the audited English and Spanish namespaces in parity", () => {
    const en = JSON.parse(readFileSync(resolve(root, "app/i18n/locales/en.json"), "utf8"));
    const es = JSON.parse(readFileSync(resolve(root, "app/i18n/locales/es.json"), "utf8"));
    const sections = ["common", "view", "voiceCall", "header", "status", "metadata", "channels", "wake", "chat", "webhook", "team", "hibernation", "voiceHealth"];
    for (const section of sections) {
      expect(Object.keys(es.agentDetail[section]).sort(), section).toEqual(
        Object.keys(en.agentDetail[section]).sort(),
      );
    }
  });
});
