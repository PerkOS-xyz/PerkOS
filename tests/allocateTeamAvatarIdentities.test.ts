import { describe, expect, it } from "vitest";

import {
  AGENT_AVATAR_PALETTES,
  allocateTeamAvatarIdentities,
  deriveAgentAvatarIdentity,
} from "../app/lib/agentAvatarIdentity";

const team = [
  "Northline-Launch-Manager",
  "Northline-Market-Researcher",
  "Northline-Brand-Strategist",
  "Northline-Product-Merchandiser",
  "Northline-Campaign-Producer",
  "Northline-Operations-Support",
];

describe("allocateTeamAvatarIdentities", () => {
  it("gives six teammates six archetypes and six colors", () => {
    const identities = [...allocateTeamAvatarIdentities(team).values()];
    expect(identities).toHaveLength(6);
    expect(new Set(identities.map((i) => i.archetypeId)).size).toBe(6);
    expect(new Set(identities.map((i) => i.paletteIndex)).size).toBe(AGENT_AVATAR_PALETTES.length);
  });

  it("keeps the first teammate's usual look", () => {
    const first = allocateTeamAvatarIdentities(team).get(team[0]!)!;
    expect(first.visualSignature).toBe(deriveAgentAvatarIdentity(team[0]!, team[0]!).visualSignature);
  });

  it("is stable for the same roster and keeps each seed", () => {
    const a = allocateTeamAvatarIdentities(team);
    const b = allocateTeamAvatarIdentities(team);
    team.forEach((name) => {
      expect(a.get(name)!.visualSignature).toBe(b.get(name)!.visualSignature);
      expect(a.get(name)!.seed).toBe(name);
    });
  });

  it("still gives each teammate its own look past six", () => {
    const big = [...team, "Northline-Data-Analyst", "Northline-Copywriter"];
    const identities = [...allocateTeamAvatarIdentities(big).values()];
    expect(new Set(identities.map((i) => i.visualSignature)).size).toBe(big.length);
  });

  it("skips blanks and repeated names", () => {
    expect(allocateTeamAvatarIdentities(["Alice", "", "Alice"]).size).toBe(1);
  });
});
