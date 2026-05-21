/**
 * GET /api/runtimes
 *
 * Returns the runtime images the admin (PerkOS-Admin /runtimes) has
 * activated for user-facing provisioning. The wizard reads this to
 * populate step 2 — runtimes with zero active images stay hidden.
 *
 * Why through an API route instead of a direct Firestore client read:
 *   - firestore.rules default-denies the runtime_images collection
 *   - keeping it that way means the inactive/admin-only fields never
 *     leak to the browser bundle
 *   - the Admin SDK on the server applies the active-only filter, so the
 *     client just gets a clean list it can render
 *
 * Auth: any signed-in caller. The data is non-sensitive (it's literally
 * the list of options PerkOS offers), but we still require a Firebase
 * ID token to avoid trivial scraping.
 */

import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../lib/firebaseAdmin";

type Runtime = "OpenClaw" | "Hermes";

const RUNTIME_MAP: Record<string, Runtime | undefined> = {
  openclaw: "OpenClaw",
  hermes: "Hermes",
};

async function requireSignedIn(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Missing Authorization bearer token.");
  const decoded = await adminAuth().verifyIdToken(token);
  return decoded.uid;
}

export async function GET(request: Request) {
  try {
    await requireSignedIn(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snap = await adminDb()
    .collection("runtime_images")
    .where("active", "==", true)
    .get();

  const runtimes: {
    runtime: Runtime;
    primaryTag: string;
    displayName: string | null;
    notes: string | null;
  }[] = [];

  for (const doc of snap.docs) {
    const data = doc.data() as {
      runtime?: string;
      primaryTag?: string;
      displayName?: string | null;
      notes?: string | null;
    };
    const kind = RUNTIME_MAP[(data.runtime ?? "").toLowerCase()];
    if (!kind || !data.primaryTag) continue;
    runtimes.push({
      runtime: kind,
      primaryTag: data.primaryTag,
      displayName: data.displayName ?? null,
      notes: data.notes ?? null,
    });
  }

  return NextResponse.json({ runtimes });
}
