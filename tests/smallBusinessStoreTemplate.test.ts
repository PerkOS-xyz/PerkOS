import { describe, expect, it } from "vitest";

import { renderSoulMd } from "../app/lib/agentPresets";
import { getCompanyTemplate } from "../app/lib/companyTemplates";

describe("Small Business Store team template", () => {
  const template = getCompanyTemplate("small-business-store");

  it("has a store manager leading a visual designer, builder and copywriter", () => {
    expect(template?.roles.map((r) => r.role)).toEqual([
      "Store Manager",
      "Brand & Image Designer",
      "Store Builder",
      "Product Copywriter",
    ]);
    expect(template!.roles.filter((r) => r.isPM).map((r) => r.role)).toEqual(["Store Manager"]);
  });

  it("tells the builder to publish with createStorefront and answer Ready with the link", () => {
    const builder = template!.roles.find((r) => r.role === "Store Builder")!;
    const soul = renderSoulMd("Store-Builder", builder.soul!);
    expect(soul).toContain("createStorefront");
    expect(soul).toContain("Ready");
    expect(soul).toContain("USDC on Solana");
    expect(soul).toContain("checkoutMode test");
    expect(soul).toContain("projectId, taskId, and claimToken");
    expect(soul).toContain("taskContext");
    expect(soul).toContain("Never expose the claimToken");
    expect(soul).toContain("required only when the owner later activates live payments");
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

  it("assigns original storefront imagery to a specialist agent", () => {
    const designer = template!.roles.find((r) => r.role === "Brand & Image Designer")!;
    const soul = renderSoulMd("Brand-Image-Designer", designer.soul!);
    expect(soul).toContain("image_generate");
    expect(soul).toContain("hero plus distinct product or category assets");
    expect(soul).toContain("owner approves the direction");
  });

  it("keeps the copy plain", () => {
    const authored = template!.roles.filter((r) => r.soul);
    const copy = [template!.blurb, ...authored.map((r) => renderSoulMd(r.role, r.soul!))].join("\n");
    expect(copy).not.toMatch(/—/);
    expect(copy).not.toMatch(/marketing/i);
  });
});
