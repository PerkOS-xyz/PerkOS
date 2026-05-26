/**
 * POST /api/agents/[agentId]/hibernate
 *
 * Scales the agent's ECS service to desiredCount=0. The runtime container
 * receives SIGTERM and has up to 300s (task stopTimeout) to upload its
 * /opt/data snapshot to s3://perkos-agent-snapshots-${env}/<wallet>/<name>/.
 *
 * Auth: Firebase ID token; the caller must own the agent.
 *
 * Response: HibernationActionResult on 200.
 *           4xx { error, errorClass? } on validation / ownership failures.
 *
 * Idempotency: hibernating a service that's already at 0 is a no-op
 *              that still updates Firestore state and returns 200.
 */
import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../../lib/firebaseAdmin";
import {
  hibernateAgent,
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
    const result = await hibernateAgent({
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
        error: `Hibernate failed: ${err instanceof Error ? err.message : String(err)}`,
        errorClass: "INTERNAL",
      },
      { status: 500 },
    );
  }
}
