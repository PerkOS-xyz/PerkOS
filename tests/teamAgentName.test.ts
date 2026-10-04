import { describe, expect, it } from "vitest";

import { AGENT_NAME_MAX, teamAgentName } from "../app/lib/teamAgentName";

const valid = /^[a-zA-Z0-9_-]{2,32}$/;

describe("teamAgentName", () => {
  it("keeps short project and role names intact", () => {
    expect(teamAgentName("Seoul-Beans", "Social-Media-Manager")).toBe("Seoul-Beans-Social-Media-Manager");
  });

  it("shortens the project part so long names still launch", () => {
    const name = teamAgentName("Seoul-Bean-Roasters", "Social-Media-Manager");
    expect(name).toBe("Seoul-Bean-Social-Media-Manager");
    expect(name.length).toBeLessThanOrEqual(AGENT_NAME_MAX);
    expect(name).toMatch(valid);
  });

  it("never leaves a dangling dash where the project is cut", () => {
    expect(teamAgentName("Two-Table-Cafe-New-York", "Distribution-Expert")).toMatch(/^[^-].*[^-]$/);
    expect(teamAgentName("Two-Table-Cafe-New-York", "Distribution-Expert")).not.toContain("--");
  });

  it("falls back to the role alone when the role fills the name", () => {
    const role = "A".repeat(40);
    const name = teamAgentName("Seoul-Beans", role);
    expect(name.length).toBeLessThanOrEqual(AGENT_NAME_MAX);
    expect(name).toMatch(valid);
  });

  it("always produces a name the API accepts", () => {
    for (const project of ["Seoul-Bean-Roasters", "Two-Table-Cafe-NY", "agent", "A".repeat(24)]) {
      for (const role of ["Account-Manager", "Content-Writer", "SEO-Specialist", "Social-Media-Manager", "B".repeat(24)]) {
        expect(teamAgentName(project, role)).toMatch(valid);
      }
    }
  });
});
