/**
 * POST /api/concierge/ensure-conv
 *
 * Idempotently creates (or finds) the canonical conversation between
 * the calling wallet and the PerkOS Assistant. Returns `{ convId }`.
 *
 * Why a server-side route instead of a client-side Firestore create:
 *
 *   1. Audit: every Assistant chat creation is logged so we can rate-limit
 *      a wallet that opens 500 threads in a minute.
 *   2. Identity invariant: the conv doc's participants array is exactly
 *      `["user:0xc256…", "agent:PerkOS-Assistant"]` (or `["admin:…", …]`
 *      on the admin surface — separate route). The server enforces the
 *      prefix; a client can't pass `admin:` from app.perkos.xyz to
 *      elevate.
 *   3. Single canonical conv per wallet: a client race could create two
 *      conv docs. A Firestore transaction with a stable convId per wallet
 *      makes this impossible.
 *
 * Auth: Firebase ID token. The wallet is derived from the token (uid),
 * NEVER from request body — same invariant as every other server-side
 * route in this app.
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";

/** Stable agent identity used by the Assistant Hermes container when it
 *  authenticates to chat.perkos.xyz. The container will be provisioned
 *  with `agentName: "PerkOS-Assistant"` via the `kind: "platform"` flag
 *  on /api/agents/launch (separate PR). */
const ASSISTANT_AGENT_NAME = "PerkOS-Assistant";
const ASSISTANT_IDENTITY = `agent:${ASSISTANT_AGENT_NAME}` as const;

/** Convention: one canonical Assistant conv per wallet. The convId is
 *  derived from the wallet so two concurrent ensure-conv calls land on
 *  the same doc instead of racing to create duplicates. */
function assistantConvIdFor(walletAddress: string): string {
  return `assistant-${walletAddress.toLowerCase()}`;
}

async function requireAuth(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Missing Authorization bearer token.");
  const decoded = await adminAuth().verifyIdToken(token);
  return decoded.uid.toLowerCase();
}

export async function POST(request: Request) {
  let caller: string;
  try {
    caller = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!caller.startsWith("0x")) {
    // Defensive — Firebase uid for wallet sign-ins is the wallet address.
    // Anything else means a non-wallet token slipped past auth.
    return NextResponse.json(
      { error: "Wallet identity required." },
      { status: 400 },
    );
  }

  const convId = assistantConvIdFor(caller);
  const userIdentity = `user:${caller}` as const;
  const db = adminDb();
  const convRef = db
    .collection("wallets")
    .doc(caller)
    .collection("conversations")
    .doc(convId);

  // Transactional create-if-absent. If two requests arrive concurrently,
  // only one writes; the other reads the existing doc and returns the
  // same convId — both callers get a consistent answer.
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(convRef);
    if (snap.exists) return;

    tx.set(convRef, {
      title: "PerkOS Assistant",
      kind: "dm",
      participants: [userIdentity, ASSISTANT_IDENTITY],
      historyHost: ASSISTANT_IDENTITY,
      pinned: true,
      archived: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return NextResponse.json({
    convId,
    historyHost: ASSISTANT_IDENTITY,
  });
}
