import { describe, expect, it } from "vitest";

import { agentMatchesOrgFilter } from "../app/lib/agentOrgFilter";

describe("agentMatchesOrgFilter", () => {
  const owned = { shared: false, sharedVia: null };
  const perkos = { shared: true, sharedVia: "PerkOS" };
  const other = { shared: true, sharedVia: "Cafe" };

  it("all keeps every agent", () => {
    expect(agentMatchesOrgFilter(owned, "PerkOS", "all")).toBe(true);
    expect(agentMatchesOrgFilter(other, "PerkOS", "all")).toBe(true);
  });

  it("org keeps owned agents and those shared via the active org", () => {
    expect(agentMatchesOrgFilter(owned, "PerkOS", "org")).toBe(true);
    expect(agentMatchesOrgFilter(perkos, "PerkOS", "org")).toBe(true);
    expect(agentMatchesOrgFilter(other, "PerkOS", "org")).toBe(false);
  });

  it("shared keeps only shared agents", () => {
    expect(agentMatchesOrgFilter(owned, "PerkOS", "shared")).toBe(false);
    expect(agentMatchesOrgFilter(perkos, "PerkOS", "shared")).toBe(true);
  });
});
