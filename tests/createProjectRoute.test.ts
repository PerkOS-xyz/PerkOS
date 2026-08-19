import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("create-project route", () => {
  it("points both /projects CTAs at /projects/new, not /companies/new", () => {
    const page = readFileSync("app/(app)/projects/page.tsx", "utf8");
    expect(page).not.toContain("/companies/new");
    expect(page.match(/["']\/projects\/new["']/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("redirects the legacy /companies/new alias to /projects/new", () => {
    const cfg = readFileSync("next.config.ts", "utf8");
    expect(cfg).toContain('source: "/companies/new"');
    expect(cfg).toContain('destination: "/projects/new"');
    const alias = readFileSync("app/(app)/companies/new/page.tsx", "utf8");
    expect(alias).toContain('redirect("/projects/new")');
  });
});
