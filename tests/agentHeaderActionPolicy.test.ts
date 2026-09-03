import { describe, expect, it } from "vitest";

import { agentHeaderActionPolicy, voiceHeaderActionPolicy } from "../app/(app)/agents/[agentId]/page";

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

describe("agent header Voice action", () => {
  it("offers a call only for a verified ready capability", () => {
    expect(voiceHeaderActionPolicy({ projectReady: true, loading: false, available: true, status: "ready" })).toBe("call");
    expect(voiceHeaderActionPolicy({ projectReady: true, loading: false, available: false, status: "unavailable" })).toBe("setup");
  });

  it("uses a truthful checking/setup action while capability is unresolved", () => {
    expect(voiceHeaderActionPolicy({ projectReady: true, loading: true })).toBe("checking");
    expect(voiceHeaderActionPolicy({ projectReady: false, loading: false })).toBe("setup");
  });
});
