/**
 * Admin authorization helpers.
 *
 * Two sources of super-admin truth, merged:
 *
 *   1. Env var `PERKOS_SUPER_ADMINS=0xa,0xb` — bootstrap. Lets the first
 *      admin sign in before any Firestore docs exist. Server-side only;
 *      never leaks into the client bundle.
 *
 *   2. Firestore `/super_admins/{address}` — runtime. The admin UI manages
 *      this collection so new admins can be added/removed without a
 *      redeploy.
 *
 * The check returns true if EITHER source contains the address. Removing
 * an env-var admin requires editing the env + restart; removing a
 * Firestore admin is one click in the admin UI.
 */

import "server-only";

import { adminAuth } from "./firebaseAdmin";
import { adminDb } from "./firebaseAdmin";

export function getEnvSuperAdmins(): string[] {
  const raw = process.env.PERKOS_SUPER_ADMINS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^0x[a-f0-9]{40}$/.test(s));
}

async function isFirestoreSuperAdmin(address: string): Promise<boolean> {
  try {
    const snap = await adminDb().collection("super_admins").doc(address).get();
    return snap.exists;
  } catch {
    return false;
  }
}

export async function isSuperAdmin(
  address: string | null | undefined
): Promise<boolean> {
  if (!address) return false;
  const normalized = address.toLowerCase();
  if (getEnvSuperAdmins().includes(normalized)) return true;
  return isFirestoreSuperAdmin(normalized);
}

/**
 * Resolve the caller wallet from the Firebase ID token + assert super-admin.
 * Throws on missing/invalid token or non-admin caller. Use at the top of
 * every admin route handler.
 */
export async function requireSuperAdmin(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    throw Object.assign(new Error("Missing bearer token"), { status: 401 });
  }
  const decoded = await adminAuth().verifyIdToken(token);
  const uid = decoded.uid.toLowerCase();
  if (!(await isSuperAdmin(uid))) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return uid;
}
