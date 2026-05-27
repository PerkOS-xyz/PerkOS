/**
 * POST /api/agents/[agentId]/ensure-conv
 *
 * Idempotently creates (or finds) the canonical conversation between
 * the calling wallet and ONE OF THE WALLET'S OWN agents. Returns
 * `{ convId, historyHost, agentName }`.
 *
 * Sister route to /api/concierge/ensure-conv, which handles the
 * platform-wide PerkOS Assistant conv. The two routes share the same
 * Firestore conv-doc shape (so the chat.perkos.xyz router and the
 * `useChatPerkosClient` hook need no changes), but this one:
 *
 *   1. Resolves a user-launched agent by agentId (Firestore doc id)
 *      under the caller's wallet.
 *   2. Enforces that the caller OWNS the agent — same uid-derived
 *      wallet invariant the rest of /api/agents/[agentId]/* uses.
 *   3. Picks a convId of shape `agent-${wallet}-${agentName}` so two
 *      agents owned by the same wallet get distinct convs and racing
 *      ensure-conv calls deterministically land on the same doc.
 *
 * Identity model in the conv-doc participants array:
 *   user identity:  `user:${wallet}`              — the chat.perkos.xyz
 *                                                   router validates
 *                                                   this against the
 *                                                   Firebase token.
 *   agent identity: `agent:${agentName}`          — the running agent's
 *                                                   bridge authenticates
 *                                                   with this name +
 *                                                   its relayApiKey.
 */
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "../../../../lib/firebaseAdmin";

function agentConvIdFor(wallet: string, agentName: string): string {
  return `agent-${wallet.toLowerCase()}-${agentName.toLowerCase()}`;
}

async function requireAuth(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Missing Authorization bearer token.");
  const decoded = await adminAuth().verifyIdToken(token);
  return decoded.uid.toLowerCase();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  let caller: string;
  try {
    caller = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!caller.startsWith("0x")) {
    return NextResponse.json(
      { error: "Wallet identity required." },
      { status: 400 },
    );
  }

  const { agentId } = await params;
  if (!agentId || typeof agentId !== "string") {
    return NextResponse.json(
      { error: "agentId is required" },
      { status: 400 },
    );
  }

  const db = adminDb();
  const agentRef = db
    .collection("wallets")
    .doc(caller)
    .collection("agents")
    .doc(agentId);
  const agentSnap = await agentRef.get();
  if (!agentSnap.exists) {
    return NextResponse.json(
      { error: "Agent not found." },
      { status: 404 },
    );
  }
  const data = agentSnap.data() as
    | { name?: string; walletAddress?: string }
    | undefined;
  const agentName = data?.name;
  if (!agentName) {
    return NextResponse.json(
      { error: "Agent doc missing `name`." },
      { status: 500 },
    );
  }
  // Belt-and-braces — the doc lives under the caller's wallet path,
  // but verify the field too in case a legacy doc slipped past the
  // launch route's ownership invariant.
  if (data?.walletAddress && data.walletAddress.toLowerCase() !== caller) {
    return NextResponse.json(
      { error: "You don't own this agent." },
      { status: 403 },
    );
  }

  const convId = agentConvIdFor(caller, agentName);
  const userIdentity = `user:${caller}` as const;
  const agentIdentity = `agent:${agentName}` as const;
  const convRef = db
    .collection("wallets")
    .doc(caller)
    .collection("conversations")
    .doc(convId);

  // Transactional create-if-absent (same pattern as concierge ensure-conv).
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(convRef);
    if (snap.exists) return;

    tx.set(convRef, {
      title: agentName,
      kind: "dm",
      participants: [userIdentity, agentIdentity],
      historyHost: agentIdentity,
      pinned: false,
      archived: false,
      // Free-form ref back to the per-wallet agent doc so admin
      // surfaces can join the two without re-parsing convId shape.
      agentRef: {
        agentId,
        agentName,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return NextResponse.json({
    convId,
    historyHost: agentIdentity,
    agentName,
  });
}
