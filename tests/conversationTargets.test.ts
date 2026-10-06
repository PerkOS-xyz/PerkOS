import { describe, expect, it } from "vitest";

import { conversationTargets } from "../app/lib/conversationTargets";

describe("conversationTargets", () => {
  it("keeps a message for Sparky away from the teammates", () => {
    expect(conversationTargets({ mentions: [], address: "0xAbC0000000000000000000000000000000000001", shared: false })).toEqual([
      "user:0xabc0000000000000000000000000000000000001",
    ]);
  });

  it("keeps a Solana owner's exact address", () => {
    expect(conversationTargets({ mentions: [], address: "EsXvSde4oFup8d2QdbEMrA2YWjCod52SbECQ9dgJ6SLA", shared: false })).toEqual([
      "user:EsXvSde4oFup8d2QdbEMrA2YWjCod52SbECQ9dgJ6SLA",
    ]);
  });

  it("sends an @-mention straight to that teammate", () => {
    expect(conversationTargets({ mentions: ["agent:Maya"], address: "0x1", shared: false })).toEqual(["agent:Maya"]);
  });

  it("lets a shared-project member reach the whole conversation", () => {
    expect(conversationTargets({ mentions: [], address: "0x1", shared: true })).toBeUndefined();
  });
});
