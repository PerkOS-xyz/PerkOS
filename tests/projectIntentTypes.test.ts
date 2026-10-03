import { describe, expect, expectTypeOf, it } from "vitest";
import type { IntentFact, ProjectIntent } from "../app/lib/projectIntentTypes";

describe("project intent types", () => {
  it("keeps confirmed facts and Sparky assumptions structurally separate", () => {
    const confirmed: IntentFact = {
      id: "fact-1",
      text: "The launch is in November",
      provenance: "user",
      confirmation: "confirmed",
    };
    const intent: ProjectIntent = {
      id: "intent-1",
      owner: "wallet-1",
      orgId: null,
      status: "draft",
      revision: 1,
      goal: "Prepare a product launch",
      successCriteria: ["Launch plan approved"],
      businessContext: "Small online store",
      constraints: ["No external publishing"],
      deadline: null,
      budget: null,
      proposedKnowledgeSources: [],
      confirmedFacts: [confirmed],
      assumptions: [
        {
          id: "assumption-1",
          text: "Email may be the primary channel",
          provenance: "sparky",
          confirmation: "proposed",
        },
      ],
      recommendedTemplateId: null,
      recommendationReason: "",
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-03T00:00:00.000Z",
    };
    expect(intent.confirmedFacts[0]).toEqual(confirmed);
    expect(intent.assumptions[0]?.confirmation).toBe("proposed");
    expectTypeOf(intent.status).toMatchTypeOf<"draft" | "confirmed" | "consumed">();
  });
});
