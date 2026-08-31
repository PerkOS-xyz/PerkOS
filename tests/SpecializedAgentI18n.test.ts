import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

describe("specialized agent detail i18n", () => {
  it("keeps specialized English and Spanish catalogs in parity", () => {
    const en = JSON.parse(readFileSync(resolve(root, "app/i18n/locales/en.json"), "utf8"));
    const es = JSON.parse(readFileSync(resolve(root, "app/i18n/locales/es.json"), "utf8"));
    for (const section of ["voice", "voiceController", "invitedCredential", "voiceCredential"]) {
      expect(Object.keys(es.agentDetail[section]).sort(), section).toEqual(
        Object.keys(en.agentDetail[section]).sort(),
      );
    }
  });

  it("localizes voice and credential presentation", () => {
    const card = readFileSync(resolve(root, "app/(app)/agents/[agentId]/AgentVoiceCallCard.tsx"), "utf8");
    const delivery = readFileSync(resolve(root, "app/(app)/agents/[agentId]/VoiceCredentialDeliveryPanel.tsx"), "utf8");
    expect(card).toContain("agentDetail.voice.");
    expect(card).not.toContain(">Working Call<");
    expect(delivery).toContain("toLocaleString(i18n.language)");
    expect(delivery).not.toContain("Delivery pending for Bragi</p>");
  });
});
