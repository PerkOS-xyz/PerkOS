import { describe, expect, it } from "vitest";

import {
  isValidAgentName,
  normalizeAgentName,
  resolveAgentName,
} from "../app/(app)/agents/new/wizard/types";

describe("agent wizard name validation", () => {
  it("matches the API's 2-32 character handle contract", () => {
    expect(isValidAgentName("PerkOS-QA_Test-20260717")).toBe(true);
    expect(isValidAgentName("QA Test")).toBe(false);
    expect(isValidAgentName("x")).toBe(false);
    expect(isValidAgentName("a".repeat(33))).toBe(false);
  });

  it("normalizes display labels into API-compatible defaults", () => {
    expect(normalizeAgentName("Customer Support")).toBe("Customer-Support");
    expect(normalizeAgentName("  QA / Audit  ")).toBe("QA-Audit");
    expect(normalizeAgentName("A".repeat(40))).toHaveLength(32);
  });

  it("keeps an explicit value and normalizes only the fallback", () => {
    expect(resolveAgentName("my_agent", "Customer Support")).toBe("my_agent");
    expect(resolveAgentName("", "Customer Support")).toBe("Customer-Support");
  });
});
