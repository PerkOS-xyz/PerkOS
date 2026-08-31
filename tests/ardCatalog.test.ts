import { describe, expect, it } from "vitest";

import { GET } from "../app/.well-known/ai-catalog.json/route";

/**
 * The manifest shipped with `id` on each entry and was rejected: ARD reads
 * `identifier`, and an entry without one is dropped, which left the catalog
 * technically valid JSON with zero usable entries.
 */
describe("ARD catalog", () => {
  it("gives every entry an identifier ARD will read", async () => {
    const catalog = await GET().json();
    expect(catalog.entries.length).toBeGreaterThan(0);
    for (const entry of catalog.entries) {
      expect(entry.identifier).toMatch(/^urn:air:/);
      expect(entry.id).toBeUndefined();
    }
  });

  it("gives every entry exactly one of url or data, plus a type", async () => {
    const catalog = await GET().json();
    for (const entry of catalog.entries) {
      expect(Boolean(entry.url) !== Boolean(entry.data)).toBe(true);
      expect(entry.type).toBeTruthy();
      // Without these a registry cannot build an embedding for the entry.
      expect(entry.representativeQueries.length).toBeGreaterThanOrEqual(2);
    }
  });
});
