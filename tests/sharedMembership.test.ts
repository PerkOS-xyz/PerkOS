import { describe, expect, it } from "vitest";

import { isActiveMembershipStatus } from "../app/lib/perkosApi";

describe("isActiveMembershipStatus", () => {
  it("treats missing/empty status as active for legacy member docs", () => {
    expect(isActiveMembershipStatus(undefined)).toBe(true);
    expect(isActiveMembershipStatus(null)).toBe(true);
    expect(isActiveMembershipStatus("")).toBe(true);
  });

  it("accepts only active (case-insensitive)", () => {
    expect(isActiveMembershipStatus("active")).toBe(true);
    expect(isActiveMembershipStatus("Active")).toBe(true);
    expect(isActiveMembershipStatus("ACTIVE")).toBe(true);
  });

  it("rejects removed/revoked/other statuses", () => {
    expect(isActiveMembershipStatus("removed")).toBe(false);
    expect(isActiveMembershipStatus("revoked")).toBe(false);
    expect(isActiveMembershipStatus("inactive")).toBe(false);
    expect(isActiveMembershipStatus("pending")).toBe(false);
  });
});
