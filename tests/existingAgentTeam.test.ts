import { describe, expect, it } from "vitest";

import { buildExistingTeamRoster } from "../app/lib/existingAgentTeam";

describe("existing agent team roster", () => {
  it("preserves registered names and marks the selected coordinator", () => {
    const roster = buildExistingTeamRoster(
      ["mimir", "tyr", "bragi", "idunn", "perkos"],
      "perkos",
    );

    expect(roster).toEqual([
      { name: "mimir", isPM: false },
      { name: "tyr", isPM: false },
      { name: "bragi", isPM: false },
      { name: "idunn", isPM: false },
      { name: "perkos", isPM: true },
    ]);
  });

  it("does not duplicate an existing identity", () => {
    expect(buildExistingTeamRoster(["perkos", "Perkos"], "perkos")).toEqual([
      { name: "perkos", isPM: true },
    ]);
  });
});
