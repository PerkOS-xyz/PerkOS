import { describe, expect, it } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";

import {
  PERKOS_RECEIPT_ANCHOR_ABI,
  encodeAnchorCalldata,
  encodeVerifyCalldata,
  findAnchoredEvent,
  receiptIdFromManifest,
  reconcileAnchorEvent,
  toBytes32Hex,
} from "../app/lib/receiptAnchor";
import type { Receipt, ReceiptManifest } from "../app/lib/receiptsApi";

const HASH_HEX = "f".repeat(64);
const HASH_HEX_0X: Hex = `0x${HASH_HEX}`;
const WALLET: Address = "0xabcabcabcabcabcabcabcabcabcabcabcabcabca";
const CONTRACT: Address = "0x1111111111111111111111111111111111111111";

const MANIFEST: ReceiptManifest = {
  version: "1",
  convId: "conv-abc",
  walletAddress: WALLET,
  participants: [`user:${WALLET.toLowerCase()}` as `user:${string}`],
  historyHost: "agent:apollo",
  hostAgent: "agent:apollo",
  transcriptHash: HASH_HEX,
  hashAlgo: "sha256",
  messageCount: 4,
  firstMessageAt: "2026-05-20T10:00:00.000Z",
  lastMessageAt: "2026-05-20T10:05:00.000Z",
  generatedAt: "2026-05-20T10:06:00.000Z",
};

function buildReceipt(): Receipt {
  return {
    id: "r1",
    manifest: MANIFEST,
    signature: {
      signedMessage: "0xdead",
      signer: WALLET,
      signedAt: "2026-05-20T10:06:30.000Z",
    },
  };
}

describe("toBytes32Hex", () => {
  it("accepts a 64-char hex without prefix", () => {
    expect(toBytes32Hex(HASH_HEX)).toBe(HASH_HEX_0X);
  });
  it("accepts an already-prefixed hex", () => {
    expect(toBytes32Hex(HASH_HEX_0X)).toBe(HASH_HEX_0X);
  });
  it("lowercases the output", () => {
    expect(toBytes32Hex("F".repeat(64))).toBe(HASH_HEX_0X);
  });
  it("rejects wrong length", () => {
    expect(() => toBytes32Hex("abc")).toThrow(/32-byte/);
  });
  it("rejects non-hex characters", () => {
    expect(() => toBytes32Hex(`0x${"z".repeat(64)}`)).toThrow(/32-byte/);
  });
});

describe("receiptIdFromManifest", () => {
  it("is deterministic for the same manifest", () => {
    const a = receiptIdFromManifest(MANIFEST);
    const b = receiptIdFromManifest({ ...MANIFEST });
    expect(a).toBe(b);
  });

  it("matches keccak256(wallet|convId|generatedAt) lowercase-wallet", () => {
    const payload = [
      MANIFEST.walletAddress.toLowerCase(),
      MANIFEST.convId,
      MANIFEST.generatedAt,
    ].join("|");
    const expected = keccak256(toBytes(payload));
    expect(receiptIdFromManifest(MANIFEST)).toBe(expected);
  });

  it("changes when generatedAt changes (re-issued receipt → new id)", () => {
    const a = receiptIdFromManifest(MANIFEST);
    const b = receiptIdFromManifest({ ...MANIFEST, generatedAt: "2026-05-20T11:00:00.000Z" });
    expect(a).not.toBe(b);
  });

  it("changes when convId changes (distinct conversations → distinct ids)", () => {
    const a = receiptIdFromManifest(MANIFEST);
    const b = receiptIdFromManifest({ ...MANIFEST, convId: "conv-xyz" });
    expect(a).not.toBe(b);
  });
});

describe("encodeAnchorCalldata + encodeVerifyCalldata", () => {
  it("encodes anchor() with the manifest-derived id by default", () => {
    const data = encodeAnchorCalldata({ manifest: MANIFEST });
    // 4-byte selector + two 32-byte words
    expect(data.length).toBe(2 + (4 + 32 + 32) * 2);
    // contains the transcript hash word (lowercase)
    expect(data.toLowerCase()).toContain(HASH_HEX);
  });

  it("respects an explicit receiptId override", () => {
    const id: Hex = `0x${"1".repeat(64)}`;
    const data = encodeAnchorCalldata({ manifest: MANIFEST, receiptId: id });
    expect(data.toLowerCase()).toContain("1".repeat(64));
  });

  it("produces a distinct selector for verify()", () => {
    const anchorData = encodeAnchorCalldata({ manifest: MANIFEST });
    const verifyData = encodeVerifyCalldata({ manifest: MANIFEST });
    expect(anchorData.slice(0, 10)).not.toBe(verifyData.slice(0, 10));
  });
});

describe("findAnchoredEvent", () => {
  function buildAnchoredLog(
    contract: Address,
    args: { receiptId: Hex; wallet: Address; transcriptHash: Hex; anchoredAt: bigint },
  ) {
    const topics = encodeEventTopics({
      abi: PERKOS_RECEIPT_ANCHOR_ABI,
      eventName: "ReceiptAnchored",
      args: {
        receiptId: args.receiptId,
        wallet: args.wallet,
        transcriptHash: args.transcriptHash,
      },
    });
    const data = encodeAbiParameters(
      [{ name: "anchoredAt", type: "uint64" }],
      [args.anchoredAt],
    );
    // viem types encodeEventTopics as a wide union; in our synthetic log
    // it's always [eventSig, indexed1, indexed2, indexed3].
    return { address: contract, topics: topics as [Hex, Hex, Hex, Hex], data };
  }

  it("decodes a matching ReceiptAnchored log", () => {
    const receiptId = receiptIdFromManifest(MANIFEST);
    const log = buildAnchoredLog(CONTRACT, {
      receiptId,
      wallet: WALLET,
      transcriptHash: HASH_HEX_0X,
      anchoredAt: BigInt(1_700_000_000),
    });
    const decoded = findAnchoredEvent([log], CONTRACT);
    expect(decoded).not.toBeNull();
    expect(decoded?.receiptId.toLowerCase()).toBe(receiptId.toLowerCase());
    expect(decoded?.wallet.toLowerCase()).toBe(WALLET.toLowerCase());
    expect(decoded?.transcriptHash.toLowerCase()).toBe(HASH_HEX_0X);
    expect(decoded?.anchoredAt).toBe(BigInt(1_700_000_000));
  });

  it("ignores logs from other contract addresses", () => {
    const receiptId = receiptIdFromManifest(MANIFEST);
    const log = buildAnchoredLog(CONTRACT, {
      receiptId,
      wallet: WALLET,
      transcriptHash: HASH_HEX_0X,
      anchoredAt: BigInt(1),
    });
    expect(
      findAnchoredEvent([log], "0x2222222222222222222222222222222222222222"),
    ).toBeNull();
  });

  it("returns null when no logs match", () => {
    expect(findAnchoredEvent([], CONTRACT)).toBeNull();
  });
});

describe("reconcileAnchorEvent", () => {
  it("accepts a matching wallet + hash", () => {
    expect(
      reconcileAnchorEvent(buildReceipt(), {
        receiptId: receiptIdFromManifest(MANIFEST),
        wallet: WALLET,
        transcriptHash: HASH_HEX_0X,
        anchoredAt: BigInt(1),
      }),
    ).toEqual({ ok: true });
  });

  it("rejects wallet_mismatch", () => {
    const r = reconcileAnchorEvent(buildReceipt(), {
      receiptId: receiptIdFromManifest(MANIFEST),
      wallet: "0xdeadbeef00000000000000000000000000000000",
      transcriptHash: HASH_HEX_0X,
      anchoredAt: BigInt(1),
    });
    expect(r).toEqual({ ok: false, reason: "wallet_mismatch" });
  });

  it("rejects hash_mismatch", () => {
    const r = reconcileAnchorEvent(buildReceipt(), {
      receiptId: receiptIdFromManifest(MANIFEST),
      wallet: WALLET,
      transcriptHash: `0x${"a".repeat(64)}`,
      anchoredAt: BigInt(1),
    });
    expect(r).toEqual({ ok: false, reason: "hash_mismatch" });
  });
});
