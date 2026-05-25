/**
 * DELETE /api/agents/[agentId]
 *
 * Tears down everything provisioning created:
 *   - ECS service + Secrets Manager secrets (if the agent was ECS-deployed)
 *   - LLM gateway key (best-effort revoke against api.llm.perkos.xyz)
 *   - Firestore docs:
 *       /agent_secrets/{wallet}/agents/{agentId}  (BYOK key, if any)
 *       /wallets/{wallet}/agents/{agentId}        (per-wallet view)
 *       /agents/{name}                            (global registry)
 *
 * Auth: Firebase ID token. The caller's wallet (uid) MUST own the agent
 * being deleted — we never trust a `walletAddress` parameter and never
 * let one wallet delete another's agent.
 *
 * Idempotent + best-effort: missing AWS resources or a missing LLM-gateway
 * key don't fail the call; we collect them as `warnings` in the response.
 * The Firestore deletes happen LAST so the agent remains visible in the
 * UI if ECS cleanup explodes — that way the user can retry rather than
 * being left with orphaned billable resources they can no longer see.
 */

import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";
import { deprovisionEcsAgent } from "../../../lib/ecsDeprovision";
import { revokeLlmAgent } from "../../../lib/llmAgentRegistry";

async function requireAuth(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Missing Authorization bearer token.");
  const decoded = await adminAuth().verifyIdToken(token);
  return decoded.uid.toLowerCase();
}

export async function DELETE(
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

  const snap = await agentRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const data = snap.data() as
    | { name?: string; walletAddress?: string }
    | undefined;
  const agentName = data?.name;
  if (!agentName) {
    // Defensive — the launch route always writes `name`, but a corrupted
    // doc shouldn't crash the cleanup path.
    return NextResponse.json(
      { error: "Agent doc missing `name`; cannot clean up infra safely." },
      { status: 500 },
    );
  }
  // Belt-and-braces: the doc lives under the caller's wallet path, but
  // verify the field too in case a legacy doc slipped past the launch
  // route's ownership invariant.
  if (
    data?.walletAddress &&
    data.walletAddress.toLowerCase() !== caller
  ) {
    return NextResponse.json(
      { error: "You don't own this agent." },
      { status: 403 },
    );
  }

  const warnings: string[] = [];

  // 1. ECS + Secrets — billable, must come first so we never strand a
  //    Fargate task with no UI to find it.
  try {
    const result = await deprovisionEcsAgent({
      walletAddress: caller,
      agentName,
    });
    if (result.warnings.length > 0) warnings.push(...result.warnings);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to tear down ECS resources: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 },
    );
  }

  // 2. LLM gateway key revoke — best-effort. A 404 from the gateway is
  //    already swallowed inside revokeLlmAgent; surface any other error
  //    as a warning so the user knows but the delete still completes.
  try {
    await revokeLlmAgent(agentName);
  } catch (err) {
    warnings.push(
      `LLM key revoke failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // 3. Firestore — three docs. Run as parallel deletes; missing docs are
  //    no-ops in Firestore so this is safe even if any subset is absent.
  const globalRef = db.collection("agents").doc(agentName);
  const secretsRef = db
    .collection("agent_secrets")
    .doc(caller)
    .collection("agents")
    .doc(agentId);

  await Promise.all([
    agentRef.delete(),
    globalRef.delete(),
    secretsRef.delete(),
  ]);

  return NextResponse.json({ ok: true, warnings });
}
