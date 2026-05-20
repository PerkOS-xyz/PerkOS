import { describe, expect, it } from "vitest";

import {
  RECEIPT_VERSION,
  stableStringify,
  type ReceiptManifest,
} from "../app/lib/receiptsApi";

describe("stableStringify", () => {
  it("serializes primitives as JSON.stringify", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify("hello")).toBe('"hello"');
    expect(stableStringify(true)).toBe("true");
    expect(stableStringify(false)).toBe("false");
  });

  it("emits arrays in source order", () => {
    expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
  });

  it("sorts object keys alphabetically", () => {
    expect(stableStringify({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}');
  });

  it("produces identical output regardless of key insertion order", () => {
    const a = stableStringify({ name: "x", id: "y", count: 1 });
    const b = stableStringify({ count: 1, id: "y", name: "x" });
    const c = stableStringify({ id: "y", count: 1, name: "x" });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("recursively stabilizes nested objects + arrays", () => {
    const out = stableStringify({
      z: { b: 2, a: 1 },
      arr: [{ y: 1, x: 2 }, { x: 4, y: 3 }],
    });
    expect(out).toBe('{"arr":[{"x":2,"y":1},{"x":4,"y":3}],"z":{"a":1,"b":2}}');
  });

  it("skips keys whose value is undefined (JSON-compatible behavior)", () => {
    expect(stableStringify({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}');
  });
});

describe("ReceiptManifest signing input", () => {
  const baseManifest: ReceiptManifest = {
    version: RECEIPT_VERSION,
    convId: "c-test",
    walletAddress: "0xabc",
    participants: ["user:0xabc", "agent:apollo"],
    historyHost: "agent:apollo",
    hostAgent: "agent:apollo",
    transcriptHash: "abc123",
    hashAlgo: "sha256",
    messageCount: 5,
    firstMessageAt: "2026-05-20T10:00:00.000Z",
    lastMessageAt: "2026-05-20T10:30:00.000Z",
    generatedAt: "2026-05-20T10:35:00.000Z",
  };

  it("the canonical string is deterministic for identical manifests", () => {
    const a = stableStringify(baseManifest);
    const b = stableStringify({ ...baseManifest });
    expect(a).toBe(b);
  });

  it("a single field change produces a different signing input", () => {
    const a = stableStringify(baseManifest);
    const b = stableStringify({ ...baseManifest, messageCount: 6 });
    expect(a).not.toBe(b);
  });

  it("a hash flip produces a different signing input", () => {
    const a = stableStringify(baseManifest);
    const b = stableStringify({ ...baseManifest, transcriptHash: "different" });
    expect(a).not.toBe(b);
  });

  it("participant reordering DOES change the manifest (order is meaningful)", () => {
    const a = stableStringify(baseManifest);
    const b = stableStringify({
      ...baseManifest,
      participants: ["agent:apollo", "user:0xabc"] as ReceiptManifest["participants"],
    });
    // Participants are an ordered array; their order matters in the hash.
    // This documents the invariant — the host agent decides participant
    // ordering when it issues channel_join. Changing order would invalidate
    // a re-issued receipt.
    expect(a).not.toBe(b);
  });
});
