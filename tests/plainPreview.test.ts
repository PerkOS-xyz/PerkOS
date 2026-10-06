import { describe, expect, it } from "vitest";

import { plainPreview } from "../app/lib/plainPreview";

describe("plainPreview", () => {
  it("keeps hyphens inside words", () => {
    expect(plainPreview("Two-line summary: a 7-day launch plan")).toBe("Two-line summary: a 7-day launch plan");
  });

  it("drops Markdown structure and emphasis", () => {
    const md = "## Brief\n\n> **Headline:** cozy *autumn* tea\n\n- first point\n- second point\n\n| a | b |\n|---|---|\n| c | d |";
    expect(plainPreview(md)).toBe("Brief Headline: cozy autumn tea first point second point a b c d");
  });

  it("cuts to the requested length", () => {
    expect(plainPreview("x".repeat(200), 120)).toHaveLength(120);
  });
});
