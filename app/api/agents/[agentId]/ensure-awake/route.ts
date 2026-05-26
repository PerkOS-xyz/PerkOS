/**
 * POST /api/agents/[agentId]/ensure-awake
 *
 * Idempotent auto-wake: checks the agent's hibernation status and
 * wakes it if needed, optionally waiting until at least one task is
 * running. Designed to be called by any client about to interact
 * with an agent (chat UI, task dispatch, future webhook from
 * chat.perkos.xyz, etc).
 *
 * Body (optional):
 *   {
 *     "waitForRunning": true | false,  // default true
 *     "waitTimeoutMs": number          // default 60_000
 *   }
 *
 * Response:
 *   200 { ok: true, initialState, finalState, triggeredWake,
 *         online, waitedMs, timedOut? }
 *
 * Auth: Firebase ID token; caller must own the agent. Wallet is
 * derived from the Firebase uid — never trusted from the body.
 */
import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../../lib/firebaseAdmin";
import { ensureAgentAwake } from "../../../../lib/ensureAwake";

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

  let body: { waitForRunning?: unknown; waitTimeoutMs?: unknown } = {};
  // Body is optional — empty body is the common case (use defaults).
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON", errorClass: "BAD_INPUT" },
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
  if (data?.walletAddress && data.walletAddress.toLowerCase() !== caller) {
    return NextResponse.json(
      { error: "You don't own this agent.", errorClass: "FORBIDDEN" },
      { status: 403 },
    );
  }

  // Sanitize wait knobs — cap to a sane ceiling so a hostile body
  // can't keep the request open forever.
  const waitForRunning =
    typeof body.waitForRunning === "boolean" ? body.waitForRunning : true;
  const waitTimeoutMs =
    typeof body.waitTimeoutMs === "number" && Number.isFinite(body.waitTimeoutMs)
      ? Math.min(Math.max(body.waitTimeoutMs, 1_000), 120_000)
      : 60_000;

  try {
    const outcome = await ensureAgentAwake({
      walletAddress: caller,
      agentId,
      agentName,
      waitForRunning,
      waitTimeoutMs,
    });
    return NextResponse.json({ ok: true, ...outcome });
  } catch (err) {
    return NextResponse.json(
      {
        error: `ensureAwake failed: ${err instanceof Error ? err.message : String(err)}`,
        errorClass: "INTERNAL",
      },
      { status: 500 },
    );
  }
}
