import { describe, expect, it } from "vitest";

import { teamShortLabels } from "../app/lib/teamLabels";

describe("teamShortLabels", () => {
  it("drops the project words every teammate shares", () => {
    const labels = teamShortLabels(["Northline-Launch-Manager", "Northline-Market-Researcher", "Northline-Operations-Support"]);
    expect(labels.get("Northline-Launch-Manager")).toBe("Launch Manager");
    expect(labels.get("Northline-Market-Researcher")).toBe("Market Researcher");
    expect(labels.get("Northline-Operations-Support")).toBe("Operations Support");
  });

  it("handles multi-word project prefixes", () => {
    const labels = teamShortLabels(["Seoul-Beans-Social-Media-Manager", "Seoul-Beans-Barista-Trainer"]);
    expect(labels.get("Seoul-Beans-Social-Media-Manager")).toBe("Social Media Manager");
    expect(labels.get("Seoul-Beans-Barista-Trainer")).toBe("Barista Trainer");
  });

  it("keeps names when teammates share no prefix or the team has one agent", () => {
    expect(teamShortLabels(["Alice", "Bragi"]).get("Alice")).toBe("Alice");
    expect(teamShortLabels(["Northline-Launch-Manager"]).get("Northline-Launch-Manager")).toBe("Northline-Launch-Manager");
  });

  it("never shortens a name to nothing or to a duplicate", () => {
    const labels = teamShortLabels(["Acme-Writer", "Acme-Writer-2", "Acme"]);
    expect(labels.get("Acme")).toBe("Acme");
    const twins = teamShortLabels(["Acme-Writer", "acme_writer"]);
    expect(twins.get("Acme-Writer")).toBe("Acme-Writer");
  });
});
