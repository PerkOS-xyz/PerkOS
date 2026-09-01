import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("BillingCard responsive layout", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../app/components/BillingCard.tsx"),
    "utf8",
  );

  it("keeps sidebar metrics in a readable two-column grid", () => {
    expect(source).toContain('className="grid grid-cols-2 gap-2"');
    expect(source).not.toContain("sm:grid-cols-4");
  });

  it("contains long localized labels and values inside each tile", () => {
    expect(source).toContain("flex min-w-0 flex-col");
    expect(source.match(/break-words/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
