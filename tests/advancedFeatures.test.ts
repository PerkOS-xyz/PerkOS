import { describe, expect, it } from "vitest";

import {
  advancedFeaturesStorageKey,
  readAdvancedFeatures,
} from "../app/lib/advancedFeatures";

describe("advanced feature preference", () => {
  it("is off by default and scoped to a normalized account", () => {
    const storage = { getItem: () => null };
    expect(readAdvancedFeatures(undefined, storage)).toBe(false);
    expect(readAdvancedFeatures("0xAbC", storage)).toBe(false);
    expect(advancedFeaturesStorageKey(" 0xAbC ")).toBe(
      "perkos.ui.advanced.v1:0xabc",
    );
  });

  it("only enables the mode for the exact account with an explicit flag", () => {
    const entries = new Map([
      ["perkos.ui.advanced.v1:0xalice", "on"],
      ["perkos.ui.advanced.v1:0xbob", "off"],
    ]);
    const storage = { getItem: (key: string) => entries.get(key) ?? null };

    expect(readAdvancedFeatures("0xAlice", storage)).toBe(true);
    expect(readAdvancedFeatures("0xBob", storage)).toBe(false);
    expect(readAdvancedFeatures("0xCarol", storage)).toBe(false);
  });
});
