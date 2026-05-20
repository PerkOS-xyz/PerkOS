import { describe, expect, it } from "vitest";

import {
  formatAddress,
  formatRelativeShort,
} from "../app/lib/format";

describe("formatAddress", () => {
  it("returns empty string for null / undefined / empty", () => {
    expect(formatAddress(null)).toBe("");
    expect(formatAddress(undefined)).toBe("");
    expect(formatAddress("")).toBe("");
  });

  it("returns the address verbatim when ≤7 chars", () => {
    expect(formatAddress("0xabc")).toBe("0xabc");
    expect(formatAddress("0x12345")).toBe("0x12345");
  });

  it("compresses long addresses to first-3 + last-4 with ellipsis", () => {
    // first 3 chars = "0x9", last 4 chars = "3e2a"
    expect(formatAddress("0x9F02b48c12d4d6e2a3e2a"))
      .toBe("0x9…3e2a");
    // Confirm the shape on a synthetic input
    const out = formatAddress("0xABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(out.startsWith("0xA")).toBe(true);
    expect(out.endsWith("WXYZ")).toBe(true);
    expect(out.includes("…")).toBe(true);
  });
});

describe("formatRelativeShort", () => {
  const now = new Date("2026-05-20T12:00:00.000Z");

  it("returns empty string for missing or future input", () => {
    expect(formatRelativeShort(null, now)).toBe("");
    expect(formatRelativeShort(undefined, now)).toBe("");
    expect(formatRelativeShort("invalid-date", now)).toBe("");
    // future
    expect(formatRelativeShort("2026-05-20T13:00:00.000Z", now)).toBe("");
  });

  it("returns 'now' for sub-45-second deltas", () => {
    expect(formatRelativeShort("2026-05-20T11:59:30.000Z", now)).toBe("now");
    expect(formatRelativeShort("2026-05-20T11:59:16.000Z", now)).toBe("now");
  });

  it("returns minutes between 45s and 1h", () => {
    expect(formatRelativeShort("2026-05-20T11:59:00.000Z", now)).toBe("1m");
    expect(formatRelativeShort("2026-05-20T11:30:00.000Z", now)).toBe("30m");
    expect(formatRelativeShort("2026-05-20T11:01:00.000Z", now)).toBe("59m");
  });

  it("returns hours between 1h and 24h", () => {
    expect(formatRelativeShort("2026-05-20T10:00:00.000Z", now)).toBe("2h");
    expect(formatRelativeShort("2026-05-19T13:00:00.000Z", now)).toBe("23h");
  });

  it("returns days between 1d and 7d", () => {
    expect(formatRelativeShort("2026-05-19T12:00:00.000Z", now)).toBe("1d");
    expect(formatRelativeShort("2026-05-14T12:00:00.000Z", now)).toBe("6d");
  });

  it("returns a locale date past 7 days", () => {
    const out = formatRelativeShort("2026-04-15T12:00:00.000Z", now);
    expect(out).toMatch(/Apr 15|15 abr|abr 15/i);
  });

  it("accepts a Date instance as input", () => {
    expect(formatRelativeShort(new Date("2026-05-20T11:30:00.000Z"), now)).toBe("30m");
  });
});
