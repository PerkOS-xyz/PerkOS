/**
 * Resolve the caller's ENS / Basename avatar SERVER-SIDE and cache it on their
 * profile. Used by the Settings "Refresh" button + first-visit auto-resolve, so
 * already-signed-in users get their avatar without re-logging-in.
 *
 * Must be server-side: NFT avatars (ERC-721/1155) need a token-metadata fetch
 * (e.g. api.opensea.io) that is CORS-blocked in the browser.
 *
 * POST /api/avatar/resolve   (Authorization: Bearer <firebase id token>)
 *   → { ok, ensAvatarUrl, basenameAvatarUrl } | { error }
 */
import { NextResponse } from "next/server";

import { adminAuth } from "../../../lib/firebaseAdmin";
import { resolveAndPersistAvatar } from "../../../lib/resolveAvatar";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (!idToken) {
    return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
  }

  let wallet: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    wallet = decoded.uid; // uid === lowercased wallet address
  } catch {
    return NextResponse.json({ error: "Invalid auth token." }, { status: 401 });
  }

  // Force (ignore TTL): the caller explicitly asked, or it's a first visit.
  const r = await resolveAndPersistAvatar(wallet, { force: true });

  return NextResponse.json({
    ok: true,
    ensAvatarUrl: r?.ensAvatarUrl ?? null,
    basenameAvatarUrl: r?.basenameAvatarUrl ?? null,
  });
}
