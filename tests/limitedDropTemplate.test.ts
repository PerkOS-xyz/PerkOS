import { describe, expect, it } from "vitest";

import { renderSoulMd } from "../app/lib/agentPresets";
import { getCompanyTemplate } from "../app/lib/companyTemplates";

describe("Limited Drop team template", () => {
  const template = getCompanyTemplate("limited-drop");

  it("has six authored teammates with one lead", () => {
    expect(template?.roles.map((r) => r.role)).toEqual([
      "Launch Manager",
      "Market Researcher",
      "Brand Strategist",
      "Product Merchandiser",
      "Campaign Producer",
      "Operations & Support",
    ]);
    const leads = template!.roles.filter((r) => r.isPM);
    expect(leads.map((r) => r.role)).toEqual(["Launch Manager"]);
    template!.roles.forEach((r) => {
      expect(r.presetId).toBeUndefined();
      expect(r.soul?.identity).toBeTruthy();
    });
  });

  it("asks the lead to write the brief itself", () => {
    const lead = template!.roles.find((r) => r.isPM)!;
    expect(renderSoulMd("Northline-Launch-Manager", lead.soul!)).toContain("you write the full document yourself");
  });

  it("keeps the copy plain", () => {
    const copy = [template!.blurb, ...template!.roles.map((r) => renderSoulMd(r.role, r.soul!))].join("\n");
    expect(copy).not.toMatch(/—/);
    expect(copy).not.toMatch(/marketing/i);
  });
});
