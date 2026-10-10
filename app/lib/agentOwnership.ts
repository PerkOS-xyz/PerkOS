import "server-only";
import { normalizeWalletAddress } from "@perkos/shared-types";
import { adminDb } from "./firebaseAdmin";

export class LegacyAgentAuthorizationError extends Error {
  constructor() { super("Agent authorization unavailable. Use the API worker for unsupported or unbound records."); }
}

function reject(): never { throw new LegacyAgentAuthorizationError(); }
function safeId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1500
    && !value.includes("/") && value !== "." && value !== "..";
}

/** Retired App primitives use EVM-only resource naming. Never lowercase Solana. */
export async function loadLegacyAgentOperation(input: {
  walletAddress: string; agentId: string; agentName: string;
}) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.walletAddress)
    || !safeId(input.agentId) || !safeId(input.agentName)) reject();
  const wallet = normalizeWalletAddress(input.walletAddress);
  const db = adminDb();
  const global = await db.collection("agents").doc(input.agentName).get();
  const registry = global.data() as Record<string, unknown> | undefined;
  if (!global.exists || !registry || typeof registry.walletAddress !== "string"
    || normalizeWalletAddress(registry.walletAddress) !== wallet
    || !safeId(registry.agentId)
    || (registry.name !== undefined && registry.name !== input.agentName)) reject();
  const id = input.agentId === input.agentName ? registry.agentId : input.agentId;
  if (id !== registry.agentId) reject();
  const ref = db.collection("wallets").doc(wallet).collection("agents").doc(id);
  const snap = await ref.get();
  const data = snap.data() as Record<string, unknown> | undefined;
  if (!snap.exists || !data || (data.name ?? id) !== input.agentName
    || (data.walletAddress !== undefined && (typeof data.walletAddress !== "string"
      || normalizeWalletAddress(data.walletAddress) !== wallet))) reject();
  return { wallet, id, name: input.agentName, ref, data, registry };
}
