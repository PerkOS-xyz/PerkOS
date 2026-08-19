import { describe, expect, it } from "vitest";

import { orgDisplayName } from "../app/lib/orgDisplayName";

describe("orgDisplayName", () => {
  it("prefers the active org over the local workspace name", () => {
    expect(
      orgDisplayName({
        orgName: "PerkOS",
        workspaceName: "Personal Workspace",
        fallback: "Workspace",
      }),
    ).toBe("PerkOS");
  });

  it("falls back to workspace, then the generic label — never a wallet", () => {
    expect(
      orgDisplayName({
        orgName: "  ",
        workspaceName: "Studio",
        fallback: "Workspace",
      }),
    ).toBe("Studio");
    expect(
      orgDisplayName({
        orgName: null,
        workspaceName: "",
        fallback: "Personal Workspace",
      }),
    ).toBe("Personal Workspace");
  });
});
