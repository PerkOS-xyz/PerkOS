import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { SKILLS, skillByName, skillDigest, skillUrl } from "../app/lib/agentSkills";
import { GET as indexGET } from "../app/.well-known/agent-skills/index.json/route";

/**
 * The digest is the whole point of the index: it lets a caller verify it got
 * the skill the index promised. A pinned hash is correct exactly once and then
 * lies silently, so it is computed from the served text.
 */
describe("agent skills", () => {
  it("publishes a digest that matches the text actually served", async () => {
    const body = await indexGET().json();
    for (const entry of body.skills) {
      const skill = skillByName(entry.name);
      expect(skill).toBeTruthy();
      expect(entry.sha256).toBe(createHash("sha256").update(skill!.body, "utf8").digest("hex"));
    }
  });

  it("carries the fields the discovery RFC requires", async () => {
    const body = await indexGET().json();
    expect(body.$schema).toContain("agentskills.io");
    expect(body.skills.length).toBeGreaterThan(0);
    for (const entry of body.skills) {
      expect(entry.name).toBeTruthy();
      expect(entry.type).toBe("skill-md");
      expect(entry.description.length).toBeGreaterThan(20);
      expect(entry.url).toMatch(/\/SKILL\.md$/);
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("only points at surfaces that exist on this origin", () => {
    // A skill describing a call the platform does not answer is worse than no
    // skill: the agent follows it and blames itself for the failure.
    const joined = SKILLS.map((s) => s.body).join("\n");
    expect(joined).not.toContain("oauth");
    expect(joined).not.toContain("api-key");
    // Cross-references between skills must resolve.
    for (const match of joined.matchAll(/agent-skills\/([a-z-]+)\/SKILL\.md/g)) {
      expect(skillByName(match[1]!), `dangling link to ${match[1]}`).toBeTruthy();
    }
  });

  it("gives each skill a stable url derived from its name", () => {
    for (const skill of SKILLS) {
      expect(skillUrl(skill)).toContain(skill.name);
      expect(skillDigest(skill)).toHaveLength(64);
    }
  });
});
