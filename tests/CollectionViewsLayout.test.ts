import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("collection cards/list layouts", () => {
  for (const route of ["projects", "organizations"]) {
    it(`${route} uses an independent persisted responsive cards view`, () => {
      const source = readFileSync(resolve(import.meta.dirname, `../app/(app)/${route}/page.tsx`), "utf8");
      expect(source).toContain(`perkos:${route}:view`);
      expect(source).toContain("grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3");
      expect(source).toContain("CollectionViewToggle");
    });
  }
});
