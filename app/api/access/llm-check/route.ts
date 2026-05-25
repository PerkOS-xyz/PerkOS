/**
 * GET /api/access/llm-check
 *
 * Tells the agent wizard whether the caller is allowed to pick the
 * "PerkOS LLM service" option in Step 4.
 *
 * Sources of truth, in order:
 *   1. Super-admins (env `PERKOS_SUPER_ADMINS` + Firestore /super_admins)
 *      — always allowed.
 *   2. Firestore /llm_allowlist/{address} — managed via PerkOS-Admin
 *      /llm-access. Manual allow list until billing (x402 monthly) lands.
 *
 * Response: { allowed: boolean, reason: "super-admin" | "allowlist" | "denied" }
 *
 * Auth: any signed-in caller (Firebase ID token). We resolve the address
 * from the token rather than trusting a query param so a user can't probe
 * other wallets.
 */

import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";
import { isSuperAdmin } from "../../../lib/adminAuth";

async function resolveCaller(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Missing Authorization bearer token.");
  const decoded = await adminAuth().verifyIdToken(token);
  return decoded.uid.toLowerCase();
}

export async function GET(request: Request) {
  let caller: string;
  try {
    caller = await resolveCaller(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isSuperAdmin(caller)) {
    return NextResponse.json({ allowed: true, reason: "super-admin" });
  }

  try {
    const snap = await adminDb().collection("llm_allowlist").doc(caller).get();
    if (snap.exists) {
      return NextResponse.json({ allowed: true, reason: "allowlist" });
    }
  } catch {
    // Treat Firestore errors as a deny — fail closed.
  }

  return NextResponse.json({ allowed: false, reason: "denied" });
}
