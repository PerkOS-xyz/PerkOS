import { describe, expect, it } from "vitest";
import { DECK_ROADMAP, DECK_SLIDE_TITLES } from "@/app/deck/content";
import { DECK_COPY } from "@/app/deck/copy";

describe("investor deck content contract", () => {
  it("has a concise twelve-slide narrative", () => {
    expect(DECK_SLIDE_TITLES).toHaveLength(12);
    expect(new Set(DECK_SLIDE_TITLES).size).toBe(DECK_SLIDE_TITLES.length);
  });

  it("contains the requested one, three, six, and twelve month roadmap", () => {
    expect(DECK_ROADMAP.map((item) => item.horizon)).toEqual([
      "1 month",
      "3 months",
      "6 months",
      "12 months",
    ]);
  });

  it("does not include financial amounts in the investor narrative contract", () => {
    const copy = JSON.stringify({ DECK_SLIDE_TITLES, DECK_ROADMAP });
    expect(copy).not.toMatch(/[$€£]|\b(?:usd|usdc|valuation|raise)\b/i);
  });

  it("ships complete copy for every public PerkOS language", () => {
    expect(Object.keys(DECK_COPY)).toEqual(["en", "es", "fr", "pt", "ja", "ko"]);
    for (const locale of Object.values(DECK_COPY)) {
      expect(locale.problem.items).toHaveLength(4);
      expect(locale.loop.steps).toHaveLength(5);
      expect(locale.live.items).toHaveLength(6);
      expect(locale.roadmap.focuses).toHaveLength(4);
      expect(locale.roadmap.details.every((items) => items.length === 3)).toBe(true);
    }
  });
});
