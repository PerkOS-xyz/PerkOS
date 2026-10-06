import { describe, expect, it } from "vitest";
import {
  AGENT_AVATAR_IDENTITY_VERSION,
  AGENT_AVATAR_ARCHETYPES,
  allocateAgentAvatarIdentity,
  deriveAgentAvatarIdentity,
  type AgentAvatarIdentity,
} from "../app/lib/agentAvatarIdentity";

describe("agent avatar identity", () => {
  it("derives a stable versioned identity from a role seed", () => {
    const first = deriveAgentAvatarIdentity("artizen-creator-update:3:creator-update");
    expect(first).toEqual(
      deriveAgentAvatarIdentity("artizen-creator-update:3:creator-update"),
    );
    expect(first.version).toBe(AGENT_AVATAR_IDENTITY_VERSION);
    expect(first.seed).toBe("artizen-creator-update:3:creator-update");
    expect(first.accentHue).toBeGreaterThanOrEqual(0);
    expect(first.accentHue).toBeLessThan(360);
    expect(first.assetPath).toMatch(/^\/agents\/avatar-v3\/\d{2}-.+\.webp$/);
  });

  it("ships 30 immutable base archetypes", () => {
    expect(AGENT_AVATAR_ARCHETYPES).toHaveLength(30);
    expect(new Set(AGENT_AVATAR_ARCHETYPES.map((item) => item.id)).size).toBe(30);
    expect(new Set(AGENT_AVATAR_ARCHETYPES.map((item) => item.assetPath)).size).toBe(30);
  });

  it("keeps distinct project roles visually distinguishable", () => {
    const lead = deriveAgentAvatarIdentity("small-business:1:lead");
    const researcher = deriveAgentAvatarIdentity("small-business:1:researcher");
    expect(researcher).not.toEqual(lead);
  });

  it("rejects an empty seed instead of generating a shared fallback", () => {
    expect(() => deriveAgentAvatarIdentity("   ")).toThrow(
      "Agent avatar seed is required",
    );
  });

  it("allocates a stable roster of 50 agents without visual-signature collisions", () => {
    const roster: AgentAvatarIdentity[] = [];
    for (let index = 0; index < 50; index += 1) {
      roster.push(allocateAgentAvatarIdentity({
        seed: `workspace:agent:${index}`,
        role: "Research specialist",
        existing: roster,
      }));
    }
    expect(new Set(roster.map((identity) => identity.visualSignature)).size).toBe(50);
    expect(roster[0]).toEqual(allocateAgentAvatarIdentity({
      seed: "workspace:agent:0",
      role: "Research specialist",
      existing: [],
    }));
  });
});
