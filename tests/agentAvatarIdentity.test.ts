import { describe, expect, it } from "vitest";
import {
  AGENT_AVATAR_IDENTITY_VERSION,
  deriveAgentAvatarIdentity,
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
});
