import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const panel = readFileSync(resolve(root, "app/(app)/agents/[agentId]/UpgradePanel.tsx"), "utf8");

describe("runtime update i18n and UX", () => {
  it("uses the selected locale and translated UI copy", () => {
    expect(panel).toContain("useTranslation");
    expect(panel).toContain("toLocaleString(locale");
    expect(panel).toContain('t("agentDetail.upgrade.title")');
    expect(panel).not.toContain("You're on the latest available image.");
    expect(panel).not.toContain("Runtime upgrade\n");
  });

  it("keeps update discovery and retry available", () => {
    expect(panel).toContain('t("agentDetail.upgrade.refresh")');
    expect(panel).toContain('t("agentDetail.upgrade.retry")');
    expect(panel.indexOf('t("agentDetail.upgrade.refresh")')).toBeGreaterThan(
      panel.indexOf("{noUpdates ?"),
    );
  });

  it("keeps English and Spanish upgrade catalogs in parity", () => {
    const en = JSON.parse(readFileSync(resolve(root, "app/i18n/locales/en.json"), "utf8"));
    const es = JSON.parse(readFileSync(resolve(root, "app/i18n/locales/es.json"), "utf8"));
    expect(Object.keys(es.agentDetail.upgrade).sort()).toEqual(
      Object.keys(en.agentDetail.upgrade).sort(),
    );
  });
});
