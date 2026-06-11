import { describe, expect, it, vi } from "vitest";

import { entityKey, writeEdge } from "../app/lib/edges";

vi.mock("../app/lib/firebase", () => ({
  firebaseDb: () => {
    throw new Error("no firebase in tests");
  },
}));

describe("entityKey", () => {
  it("builds the shared key format for every entity type", () => {
    expect(entityKey.agent("Researcher")).toBe("agent:Researcher");
    expect(entityKey.user("0xAbC123")).toBe("user:0xabc123"); // lowercased
    expect(entityKey.task("p1", "t1")).toBe("task:p1/t1");
    expect(entityKey.doc("p1", "d1")).toBe("doc:p1/d1");
    expect(entityKey.project("p1")).toBe("project:p1");
  });
});

describe("writeEdge", () => {
  it("is a no-op without a wallet or incomplete keys", () => {
    expect(() =>
      writeEdge(null, { fromKey: "a", toKey: "b", rel: "mentions" }),
    ).not.toThrow();
    expect(() =>
      writeEdge("0xabc", { fromKey: "", toKey: "b", rel: "mentions" }),
    ).not.toThrow();
  });

  it("swallows backend errors instead of breaking the caller", () => {
    expect(() =>
      writeEdge("0xABC", {
        fromKey: entityKey.user("0xABC"),
        toKey: entityKey.agent("Maya"),
        rel: "mentions",
        projectId: "p1",
        sourceRef: "m1",
      }),
    ).not.toThrow();
  });
});
