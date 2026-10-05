import { describe, expect, it } from "vitest";

import { AGENT_NAME_MAX, teamAgentName, teamAgentNames } from "../app/lib/teamAgentName";

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

describe("teamAgentNames", () => {
  const roles = ["Store-Manager", "Product-Copywriter", "Customer-Support", "Promotions-Outreach"];

  it("gives the whole team one project prefix cut at a word boundary", () => {
    const names = teamAgentNames("Harbor-Tea-Shop", roles);
    expect(names).toEqual([
      "Harbor-Tea-Store-Manager",
      "Harbor-Tea-Product-Copywriter",
      "Harbor-Tea-Customer-Support",
      "Harbor-Tea-Promotions-Outreach",
    ]);
    for (const name of names) {
      expect(name.length).toBeLessThanOrEqual(AGENT_NAME_MAX);
      expect(name).toMatch(valid);
    }
  });

  it("keeps a short project whole", () => {
    expect(teamAgentNames("Seoul-Beans", ["SEO-Specialist", "Content-Writer"])).toEqual([
      "Seoul-Beans-SEO-Specialist",
      "Seoul-Beans-Content-Writer",
    ]);
  });

  it("falls back to the project's initials when its first word does not fit", () => {
    const names = teamAgentNames("Bakeryandcoffeehouse-Downtown", ["Distribution-Expert-Long"]);
    expect(names).toEqual(["BD-Distribution-Expert-Long"]);
  });

  it("drops the prefix only when nothing fits", () => {
    const role = "A".repeat(30);
    expect(teamAgentNames("Seoul-Beans", [role])).toEqual([role]);
  });
});
