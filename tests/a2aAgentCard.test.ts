import { describe, expect, it } from "vitest";

import { GET } from "../app/.well-known/agent-card.json/route";

/**
 * The card is a promise: another agent reads it and calls what it advertises.
 * These pin the parts that would strand a caller if they drifted.
 */
describe("A2A agent card", () => {
  it("advertises an endpoint on this origin", async () => {
    const card = await GET().json();
    expect(card.url).toMatch(/\/api\/a2a$/);
    expect(card.name).toBe("PerkOS");
  });

  it("declares the transport, not just a bare url", async () => {
    const card = await GET().json();
    // `url` alone leaves a caller guessing which protocol is spoken there, and
    // the spec rejects a card without this.
    expect(card.supportedInterfaces).toHaveLength(1);
    expect(card.supportedInterfaces[0].transport).toBe("JSONRPC");
    expect(card.supportedInterfaces[0].url).toBe(card.url);
  });

  it("does not claim capabilities the endpoint lacks", async () => {
    const card = await GET().json();
    // The endpoint implements message/send only. Advertising streaming would
    // have callers open a stream that never arrives.
    expect(card.capabilities.streaming).toBe(false);
    expect(card.capabilities.pushNotifications).toBe(false);
  });

  it("points auth at the flow that exists, not at an OAuth issuer", async () => {
    const card = await GET().json();
    expect(card.securitySchemes.bearer.scheme).toBe("bearer");
    // There is no OAuth server on this origin; naming one would send the
    // caller to a discovery document that 404s.
    expect(JSON.stringify(card)).not.toContain("oauth");
    expect(card.securitySchemes.bearer.description).toContain("auth.md");
  });

  it("lists skills the assistant actually answers", async () => {
    const card = await GET().json();
    const ids = card.skills.map((s: { id: string }) => s.id);
    expect(ids).toContain("perkos-app-help");
    // Every skill carries examples, so a caller can tell whether its question
    // is in scope before spending a request on a refusal.
    for (const skill of card.skills) {
      expect(skill.examples.length).toBeGreaterThan(0);
      expect(skill.description.length).toBeGreaterThan(20);
    }
  });
});
