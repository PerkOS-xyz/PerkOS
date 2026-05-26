/**
 * POST /api/agents/[agentId]/wake
 *
 * Scales the agent's ECS service back to desiredCount=1. The container
 * entrypoint detects the stashed snapshot in
 * s3://perkos-agent-snapshots-${env}/<wallet>/<name>/state.tar.gz and
 * restores it before Hermes starts.
 *
 * Auth: Firebase ID token; the caller must own the agent.
 *
 * Idempotent: if the service is already running, returns 200 with state
 * "active" and previousDesiredCount > 0.
 */
import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../../lib/firebaseAdmin";
import {
  wakeAgent,
  HibernationError,
} from "../../../../lib/hibernation";

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

  const { agentId } = await params;
  if (!agentId || typeof agentId !== "string") {
    return NextResponse.json(
      { error: "agentId is required", errorClass: "BAD_INPUT" },
      { status: 400 },
    );
  }

  const agentRef = adminDb()
    .collection("wallets")
    .doc(caller)
    .collection("agents")
    .doc(agentId);
  const snap = await agentRef.get();
  if (!snap.exists) {
    return NextResponse.json(
      { error: "Agent not found", errorClass: "NOT_FOUND" },
      { status: 404 },
    );
  }
  const data = snap.data() as
    | { name?: string; walletAddress?: string }
    | undefined;
  const agentName = data?.name;
  if (!agentName) {
    return NextResponse.json(
      { error: "Agent doc missing `name`.", errorClass: "BAD_INPUT" },
      { status: 500 },
    );
  }
  if (
    data?.walletAddress &&
    data.walletAddress.toLowerCase() !== caller
  ) {
    return NextResponse.json(
      { error: "You don't own this agent.", errorClass: "FORBIDDEN" },
      { status: 403 },
    );
  }

  try {
    const result = await wakeAgent({
      walletAddress: caller,
      agentId,
      agentName,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof HibernationError) {
      const status = err.errorClass === "SERVICE_NOT_FOUND" ? 404 : 400;
      return NextResponse.json(
        { error: err.message, errorClass: err.errorClass },
        { status },
      );
    }
    return NextResponse.json(
      {
        error: `Wake failed: ${err instanceof Error ? err.message : String(err)}`,
        errorClass: "INTERNAL",
      },
      { status: 500 },
    );
  }
}
