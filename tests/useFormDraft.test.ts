import { describe, expect, it } from "vitest";
import { mergeDraft } from "../app/lib/useFormDraft";

describe("mergeDraft", () => {
  it("lets route-owned fields override a stored draft without losing its content", () => {
    expect(mergeDraft(
      { projectId: "route-project", name: "", description: "" },
      { projectId: "old-project", name: "Saved task", description: "Saved details" },
      ["projectId"],
    )).toEqual({ projectId: "route-project", name: "Saved task", description: "Saved details" });
  });
});
