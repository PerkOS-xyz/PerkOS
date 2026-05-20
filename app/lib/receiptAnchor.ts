/**
 * On-chain receipt anchoring (Base).
 *
 * The flow is intentionally minimal:
 *
 *   1. Build a `receiptId` (bytes32) and a `transcriptHash` (bytes32)
 *      from the off-chain signed receipt + manifest.
 *   2. Call `PerkosReceiptAnchor.anchor(receiptId, transcriptHash)` on
 *      Base. The contract records (msg.sender, transcriptHash, ts).
 *   3. Once the tx is mined, persist the resulting txHash + blockNumber
 *      onto the off-chain Receipt's `anchor` field (see `receiptsApi.ts`).
 *   4. Anyone can verify with `PerkosReceiptAnchor.verify(receiptId, ...)`
 *      or by replaying the `ReceiptAnchored` log.
 *
 * Privacy: the contract sees only opaque 32-byte hashes. Nothing about
 * the conversation content, participants, or message count is exposed
 * on-chain unless the caller chooses to derive `receiptId` from
 * identifiable inputs.
 */

import {
  decodeEventLog,
  encodeFunctionData,
  keccak256,
  toBytes,
  type Address,
  type Hex,
  type Log,
} from "viem";

import type { Receipt, ReceiptManifest } from "./receiptsApi";

export const PERKOS_RECEIPT_ANCHOR_ABI = [
  {
    type: "function",
    name: "anchor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiptId", type: "bytes32" },
      { name: "transcriptHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "verify",
    stateMutability: "view",
    inputs: [
      { name: "receiptId", type: "bytes32" },
      { name: "transcriptHash", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getAnchor",
    stateMutability: "view",
    inputs: [{ name: "receiptId", type: "bytes32" }],
    outputs: [
      { name: "wallet", type: "address" },
      { name: "transcriptHash", type: "bytes32" },
      { name: "anchoredAt", type: "uint64" },
    ],
  },
  {
    type: "event",
    name: "ReceiptAnchored",
    inputs: [
      { name: "receiptId", type: "bytes32", indexed: true },
      { name: "wallet", type: "address", indexed: true },
      { name: "transcriptHash", type: "bytes32", indexed: true },
      { name: "anchoredAt", type: "uint64", indexed: false },
    ],
  },
] as const;

/**
 * Chains we currently support for anchoring. Base mainnet for production,
 * Base Sepolia for staging tests. Caller picks via the contract address
 * + chainId passed in.
 */
export const SUPPORTED_ANCHOR_CHAINS = {
  base: 8453,
  baseSepolia: 84532,
} as const;

export type AnchorChainId =
  (typeof SUPPORTED_ANCHOR_CHAINS)[keyof typeof SUPPORTED_ANCHOR_CHAINS];

const HEX64 = /^0x[0-9a-fA-F]{64}$/;

/**
 * Convert a 32-byte hex string (sha256 hex, with or without "0x") into a
 * 0x-prefixed bytes32 suitable for ABI encoding. Throws on bad input.
 */
export function toBytes32Hex(hashHex: string): Hex {
  const normalized = hashHex.startsWith("0x") ? hashHex : `0x${hashHex}`;
  if (!HEX64.test(normalized)) {
    throw new Error(
      `transcriptHash must be a 32-byte hex string, got "${hashHex}"`,
    );
  }
  return normalized.toLowerCase() as Hex;
}

/**
 * Derive a deterministic bytes32 receiptId from the off-chain manifest.
 *
 * The id is keccak256(walletAddress | convId | generatedAt). Deterministic
 * for the same manifest, distinct across conversations and across re-issued
 * receipts for the same conversation (because generatedAt changes).
 *
 * Callers are free to pass any 32-byte id to `anchor()`; this helper is the
 * recommended default.
 */
export function receiptIdFromManifest(manifest: ReceiptManifest): Hex {
  const payload = [
    manifest.walletAddress.toLowerCase(),
    manifest.convId,
    manifest.generatedAt,
  ].join("|");
  return keccak256(toBytes(payload));
}

/** Calldata for `anchor(receiptId, transcriptHash)`. */
export function encodeAnchorCalldata(input: {
  manifest: ReceiptManifest;
  receiptId?: Hex;
}): Hex {
  const receiptId = input.receiptId ?? receiptIdFromManifest(input.manifest);
  const transcriptHash = toBytes32Hex(input.manifest.transcriptHash);
  return encodeFunctionData({
    abi: PERKOS_RECEIPT_ANCHOR_ABI,
    functionName: "anchor",
    args: [receiptId, transcriptHash],
  });
}

/** Calldata for `verify(receiptId, transcriptHash)`. */
export function encodeVerifyCalldata(input: {
  manifest: ReceiptManifest;
  receiptId?: Hex;
}): Hex {
  const receiptId = input.receiptId ?? receiptIdFromManifest(input.manifest);
  const transcriptHash = toBytes32Hex(input.manifest.transcriptHash);
  return encodeFunctionData({
    abi: PERKOS_RECEIPT_ANCHOR_ABI,
    functionName: "verify",
    args: [receiptId, transcriptHash],
  });
}

export type DecodedAnchorEvent = {
  receiptId: Hex;
  wallet: Address;
  transcriptHash: Hex;
  anchoredAt: bigint;
};

/**
 * Find the ReceiptAnchored event in a transaction's logs. Returns null when
 * the receipt didn't include it (e.g. the call reverted or was made against
 * a different contract).
 */
export function findAnchoredEvent(
  logs: Pick<Log, "topics" | "data" | "address">[],
  contractAddress: Address,
): DecodedAnchorEvent | null {
  const want = contractAddress.toLowerCase();
  for (const log of logs) {
    if (log.address?.toLowerCase() !== want) continue;
    try {
      const decoded = decodeEventLog({
        abi: PERKOS_RECEIPT_ANCHOR_ABI,
        topics: log.topics,
        data: log.data,
      });
      if (decoded.eventName !== "ReceiptAnchored") continue;
      const args = decoded.args as {
        receiptId: Hex;
        wallet: Address;
        transcriptHash: Hex;
        anchoredAt: bigint;
      };
      return {
        receiptId: args.receiptId,
        wallet: args.wallet,
        transcriptHash: args.transcriptHash,
        anchoredAt: args.anchoredAt,
      };
    } catch {
      // not our event — keep scanning
    }
  }
  return null;
}

/**
 * Reconcile a decoded ReceiptAnchored event against an off-chain receipt.
 *
 * Returns `{ ok: true }` only when the event commits to the same wallet
 * and the same transcript hash that the off-chain manifest claims. Any
 * mismatch returns `{ ok: false, reason }` so callers can surface a clear
 * "anchored but contradicts" UX rather than silently accepting it.
 */
export function reconcileAnchorEvent(
  receipt: Receipt,
  event: DecodedAnchorEvent,
):
  | { ok: true }
  | { ok: false; reason: "wallet_mismatch" | "hash_mismatch" } {
  const declaredWallet = receipt.manifest.walletAddress.toLowerCase();
  if (event.wallet.toLowerCase() !== declaredWallet) {
    return { ok: false, reason: "wallet_mismatch" };
  }
  const declaredHash = toBytes32Hex(receipt.manifest.transcriptHash);
  if (event.transcriptHash.toLowerCase() !== declaredHash) {
    return { ok: false, reason: "hash_mismatch" };
  }
  return { ok: true };
}
