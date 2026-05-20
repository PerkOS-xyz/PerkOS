/**
 * Signed receipts data layer.
 *
 *   /wallets/{walletAddress}/receipts/{receiptId}
 *
 * A receipt is a tamper-evident attestation of a conversation. The host
 * agent computes the sha256 of `messages.jsonl + metadata.json`. The
 * browser builds a canonical JSON manifest from that hash + metadata,
 * asks the wallet to sign(SHA256(manifest)), and writes the signed
 * receipt to Firestore.
 *
 * Verifying off-chain:
 *   1. Take the manifest fields (no `signature` block)
 *   2. canonicalize: stable-key JSON stringify
 *   3. recover the signer with ecrecover(message, signature)
 *   4. ensure recovered address === manifest.walletAddress
 *
 * Verifying transcript integrity:
 *   The host agent (or anyone with the jsonl) recomputes the sha256
 *   and confirms it matches manifest.transcriptHash.
 *
 * The signature can be anchored on Base in a follow-up — for now the
 * receipt is signed locally and stored in Firestore.
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  updateDoc,
  query,
  serverTimestamp,
  setDoc,
  type FirestoreDataConverter,
  type Timestamp,
} from "firebase/firestore";

import { firebaseDb } from "./firebase";
import type { ConvIdentity } from "./conversationsApi";

export const RECEIPT_VERSION = "1" as const;

export type ReceiptManifest = {
  version: typeof RECEIPT_VERSION;
  convId: string;
  /** Lowercase 0x... — the wallet that owns the conversation and signs. */
  walletAddress: string;
  participants: ConvIdentity[];
  historyHost: ConvIdentity;
  hostAgent: ConvIdentity;
  /** sha256 hex of messages.jsonl + 0x1E + metadata.json on the host agent. */
  transcriptHash: string;
  hashAlgo: "sha256";
  messageCount: number;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  /** When the agent produced the hash. */
  generatedAt: string;
};

export type ReceiptSignature = {
  /** EIP-191 personal_sign signature of stableStringify(manifest). */
  signedMessage: `0x${string}`;
  /** Address recovered from the signature — should equal manifest.walletAddress. */
  signer: string;
  /** ISO timestamp when the wallet signed. */
  signedAt: string;
};

export type Receipt = {
  id: string;
  manifest: ReceiptManifest;
  signature: ReceiptSignature;
  /** Set by serverTimestamp on write. */
  createdAt?: string;
  /**
   * On-chain anchor record (Base / Base Sepolia). Persisted when the
   * caller broadcasts `PerkosReceiptAnchor.anchor()` and the tx mines.
   * Off-chain verifiers should cross-check `receiptId` + `transcriptHash`
   * against the on-chain `ReceiptAnchored` event before trusting the
   * anchor. See `receiptAnchor.ts` for the helpers.
   */
  anchor?: {
    chainId: number;
    contractAddress: string;
    /** 32-byte hex id passed to anchor(); recoverable via receiptIdFromManifest. */
    receiptId: string;
    txHash: string;
    blockNumber?: number;
    /** block.timestamp at the time of anchoring, ISO. */
    anchoredAt?: string;
  };
};

function tsToIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }
  return undefined;
}

const converter: FirestoreDataConverter<Receipt> = {
  toFirestore: (r) => ({
    manifest: r.manifest,
    signature: r.signature,
    ...(r.anchor ? { anchor: r.anchor } : {}),
  }),
  fromFirestore(snap) {
    const data = snap.data();
    return {
      id: snap.id,
      manifest: data.manifest as ReceiptManifest,
      signature: data.signature as ReceiptSignature,
      anchor: data.anchor as Receipt["anchor"],
      createdAt: tsToIso(data.createdAt),
    };
  },
};

function receiptsCol(walletAddress: string) {
  return collection(
    firebaseDb(),
    "wallets",
    walletAddress.toLowerCase(),
    "receipts",
  ).withConverter(converter);
}

function receiptDoc(walletAddress: string, receiptId: string) {
  return doc(
    firebaseDb(),
    "wallets",
    walletAddress.toLowerCase(),
    "receipts",
    receiptId,
  ).withConverter(converter);
}

/**
 * Stable-key JSON serializer. Used so the signed bytes are deterministic
 * regardless of object key insertion order. NOT a full canonicalization
 * spec (no UTF-8 normalization, no number canonicalization) — sufficient
 * because the manifest only contains hex strings, ISO timestamps, integers,
 * and identifiers from our own schema.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map((k) => {
    const v = (value as Record<string, unknown>)[k];
    if (v === undefined) return null;
    return `${JSON.stringify(k)}:${stableStringify(v)}`;
  }).filter(Boolean);
  return `{${parts.join(",")}}`;
}

export async function createReceipt(
  walletAddress: string,
  receiptId: string,
  manifest: ReceiptManifest,
  signature: ReceiptSignature,
): Promise<void> {
  await setDoc(receiptDoc(walletAddress, receiptId), {
    manifest,
    signature,
    createdAt: serverTimestamp(),
  } as unknown as Receipt);
}

export async function getReceipt(
  walletAddress: string,
  receiptId: string,
): Promise<Receipt | null> {
  const snap = await getDoc(receiptDoc(walletAddress, receiptId));
  return snap.exists() ? snap.data() : null;
}

/**
 * Attach an on-chain anchor record to an existing receipt.
 *
 * Firestore rules permit this exactly once per receipt — the
 * `anchor` field cannot already be set, and the only field that may
 * change on this update is `anchor` itself. The signed manifest and
 * signature stay immutable. Calling this on a receipt that's already
 * anchored will be rejected by the rules.
 */
export async function setReceiptAnchor(
  walletAddress: string,
  receiptId: string,
  anchor: NonNullable<Receipt["anchor"]>,
): Promise<void> {
  // Plain `updateDoc` so the converter's `toFirestore` is not invoked
  // (which would re-write the whole document and trip the
  // affectedKeys()=['anchor'] rule check).
  await updateDoc(receiptDoc(walletAddress, receiptId), { anchor });
}

/** Realtime subscription to all receipts for the wallet (newest first). */
export function subscribeReceipts(
  walletAddress: string,
  onChange: (receipts: Receipt[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(receiptsCol(walletAddress), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data())),
    onError,
  );
}

/** Receipts scoped to a single conversation. */
export function subscribeReceiptsForConv(
  walletAddress: string,
  convId: string,
  onChange: (receipts: Receipt[]) => void,
): () => void {
  return subscribeReceipts(walletAddress, (all) => {
    onChange(all.filter((r) => r.manifest.convId === convId));
  });
}
