/**
 * Access control checks used by /api/auth/wallet-signin and the admin UI.
 *
 * A wallet can enter PerkOS in three modes:
 *
 *   1. Public mode is on
 *      → Anyone in. Toggled via Firestore doc `config/access.publicMode`.
 *
 *   2. Wallet is in the env-var seed allowlist
 *      → `PERKOS_WHITELIST=0xa,0xb` lets us bootstrap before Firestore is
 *      writable, and lets us pin a small permanent allowlist (e.g. the
 *      founders) outside the admin UI.
 *
 *   3. Wallet is in the Firestore allowlist (`/allowlist/{address}`)
 *      → Managed via the /admin/access page.
 *
 * The check returns the first rule that grants access, plus a reason
 * string so the admin UI can show *why* a wallet was admitted.
 */

import "server-only";

import { adminDb } from "./firebaseAdmin";

export type AccessDecision =
  | { allowed: true; reason: "public-mode" | "env-allowlist" | "firestore-allowlist" }
  | { allowed: false; reason: "not-allowlisted" };

export function getEnvAllowlist(): string[] {
  const raw = process.env.PERKOS_WHITELIST ?? process.env.NEXT_PUBLIC_PERKOS_WHITELIST ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^0x[a-f0-9]{40}$/.test(s));
}

export async function getPublicMode(): Promise<boolean> {
  try {
    const snap = await adminDb().collection("config").doc("access").get();
    const data = snap.data();
    return data?.publicMode === true;
  } catch {
    return false;
  }
}

export async function checkWalletAccess(address: string): Promise<AccessDecision> {
  const normalized = address.toLowerCase();

  if (await getPublicMode()) {
    return { allowed: true, reason: "public-mode" };
  }

  if (getEnvAllowlist().includes(normalized)) {
    return { allowed: true, reason: "env-allowlist" };
  }

  const snap = await adminDb().collection("allowlist").doc(normalized).get();
  if (snap.exists) {
    return { allowed: true, reason: "firestore-allowlist" };
  }

  return { allowed: false, reason: "not-allowlisted" };
}
