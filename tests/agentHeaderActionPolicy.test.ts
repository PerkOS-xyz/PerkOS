import { describe, expect, it } from "vitest";

import { agentHeaderActionPolicy } from "../app/(app)/agents/[agentId]/page";

describe("agent header operating model actions", () => {
  it("keeps external refresh read-only and hides managed configuration", () => {
    expect(agentHeaderActionPolicy({ external: true, authorized: true })).toEqual({
      refreshLabel: "Refresh status",
      showManage: false,
      manageLabel: "Manage agent",
    });
  });

  it("shows managed configuration only to an authorized owner", () => {
    expect(agentHeaderActionPolicy({ external: false, authorized: true }).showManage).toBe(true);
    expect(agentHeaderActionPolicy({ external: false, authorized: false }).showManage).toBe(false);
  });
});
