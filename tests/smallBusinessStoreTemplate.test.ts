import { describe, expect, it } from "vitest";

import { renderSoulMd } from "../app/lib/agentPresets";
import { getCompanyTemplate } from "../app/lib/companyTemplates";

describe("Small Business Store team template", () => {
  const template = getCompanyTemplate("small-business-store");

  it("has a store manager leading a builder and a copywriter", () => {
    expect(template?.roles.map((r) => r.role)).toEqual(["Store Manager", "Store Builder", "Product Copywriter"]);
    expect(template!.roles.filter((r) => r.isPM).map((r) => r.role)).toEqual(["Store Manager"]);
  });

  it("tells the builder to publish with createStorefront and answer Ready with the link", () => {
    const builder = template!.roles.find((r) => r.role === "Store Builder")!;
    const soul = renderSoulMd("Store-Builder", builder.soul!);
    expect(soul).toContain("createStorefront");
    expect(soul).toContain("Ready");
    expect(soul).toContain("USDC on Solana");
  });

  it("asks the bridge for the conversation it is answering", () => {
    const builder = template!.roles.find((r) => r.role === "Store Builder")!;
    expect(renderSoulMd("Store-Builder", builder.soul!)).toContain("--conv-id current");
  });

  it("asks the builder to avoid long dashes in its replies", () => {
    const builder = template!.roles.find((r) => r.role === "Store Builder")!;
    expect(renderSoulMd("Store-Builder", builder.soul!)).toContain("never long dashes");
  });

  it("requires a professional end-to-end shopping journey", () => {
    const builder = template!.roles.find((r) => r.role === "Store Builder")!;
    const soul = renderSoulMd("Store-Builder", builder.soul!);
    expect(template!.blurb).not.toContain("Solana");
    expect(soul).toContain("product detail pages");
    expect(soul).toContain("selected product, price, and total before payment");
    expect(soul).toContain("Never ship generic placeholder copy");
  });

  it("keeps the copy plain", () => {
    const authored = template!.roles.filter((r) => r.soul);
    const copy = [template!.blurb, ...authored.map((r) => renderSoulMd(r.role, r.soul!))].join("\n");
    expect(copy).not.toMatch(/—/);
    expect(copy).not.toMatch(/marketing/i);
  });
});
