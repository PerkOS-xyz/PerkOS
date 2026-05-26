/**
 * /api/agents/[agentId]/upgrade
 *
 *   GET   → { currentImageTag, currentImageUri, available: [{imageTag, publishedAt?, notes?}] }
 *           Returns the runtime's active tags newer than the current one,
 *           so the UI can populate an upgrade dropdown.
 *
 *   POST  body: { imageTag: string }
 *         Orchestrates hibernate → drain → re-provision with the new
 *         image. Synchronous (returns when the new task definition is
 *         registered and desiredCount is back to 1). Median ~60-90s
 *         under normal load; cap at the route's edge timeout.
 *
 * Auth: Firebase ID token. The caller must own the agent. BYOK keys
 * are re-fetched from /agent_secrets server-side — never trusted from
 * the request body.
 */
import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../../lib/firebaseAdmin";
import {
  listAvailableUpgrades,
  upgradeAgent,
  UpgradeError,
} from "../../../../lib/agentUpgrade";

async function requireAuth(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Missing Authorization bearer token.");
  const decoded = await adminAuth().verifyIdToken(token);
  return decoded.uid.toLowerCase();
}

type AgentDoc = {
  name?: string;
  walletAddress?: string;
  runtime?: "OpenClaw" | "Hermes";
  modelKeyProvided?: boolean;
  ecs?: { imageUri?: string };
};

async function loadOwnedAgent(
  caller: string,
  agentId: string,
): Promise<{
  doc: AgentDoc;
  errorResponse?: NextResponse;
}> {
  const agentRef = adminDb()
    .collection("wallets")
    .doc(caller)
    .collection("agents")
    .doc(agentId);
  const snap = await agentRef.get();
  if (!snap.exists) {
    return {
      doc: {},
      errorResponse: NextResponse.json(
        { error: "Agent not found", errorClass: "NOT_FOUND" },
        { status: 404 },
      ),
    };
  }
  const data = snap.data() as AgentDoc | undefined;
  if (!data?.name) {
    return {
      doc: {},
      errorResponse: NextResponse.json(
        { error: "Agent doc missing `name`.", errorClass: "BAD_INPUT" },
        { status: 500 },
      ),
    };
  }
  if (data.walletAddress && data.walletAddress.toLowerCase() !== caller) {
    return {
      doc: {},
      errorResponse: NextResponse.json(
        { error: "You don't own this agent.", errorClass: "FORBIDDEN" },
        { status: 403 },
      ),
    };
  }
  if (!data.runtime || (data.runtime !== "Hermes" && data.runtime !== "OpenClaw")) {
    return {
      doc: {},
      errorResponse: NextResponse.json(
        { error: "Agent runtime is not OpenClaw/Hermes.", errorClass: "BAD_INPUT" },
        { status: 400 },
      ),
    };
  }
  return { doc: data };
}

export async function GET(
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
  if (!agentId) {
    return NextResponse.json(
      { error: "agentId is required", errorClass: "BAD_INPUT" },
      { status: 400 },
    );
  }

  const { doc, errorResponse } = await loadOwnedAgent(caller, agentId);
  if (errorResponse) return errorResponse;

  try {
    const opts = await listAvailableUpgrades({
      runtime: doc.runtime as "OpenClaw" | "Hermes",
      currentImageUri: doc.ecs?.imageUri ?? null,
    });
    return NextResponse.json(opts);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to list upgrades: ${err instanceof Error ? err.message : String(err)}`,
        errorClass: "INTERNAL",
      },
      { status: 500 },
    );
  }
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
  if (!agentId) {
    return NextResponse.json(
      { error: "agentId is required", errorClass: "BAD_INPUT" },
      { status: 400 },
    );
  }

  let body: { imageTag?: unknown };
  try {
    body = (await request.json()) as { imageTag?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON", errorClass: "BAD_INPUT" },
      { status: 400 },
    );
  }
  if (typeof body.imageTag !== "string" || body.imageTag.length === 0) {
    return NextResponse.json(
      { error: "imageTag is required", errorClass: "BAD_INPUT" },
      { status: 400 },
    );
  }

  const { doc, errorResponse } = await loadOwnedAgent(caller, agentId);
  if (errorResponse) return errorResponse;

  // Re-fetch BYOK key from /agent_secrets — we NEVER accept it from the
  // request body. If the agent was launched with modelKeyProvided=true,
  // the key should still be present in /agent_secrets/{wallet}/agents/{id}.
  let byokApiKey: string | undefined;
  if (doc.modelKeyProvided) {
    const secretSnap = await adminDb()
      .collection("agent_secrets")
      .doc(caller)
      .collection("agents")
      .doc(agentId)
      .get();
    const secretData = secretSnap.data() as { modelKey?: string } | undefined;
    if (secretData?.modelKey) byokApiKey = secretData.modelKey;
  }

  const llmSource: "perkos" | "byok" | "skip" = byokApiKey
    ? "byok"
    : "perkos";

  try {
    const result = await upgradeAgent({
      walletAddress: caller,
      agentId,
      agentName: doc.name!,
      runtime: doc.runtime as "OpenClaw" | "Hermes",
      targetImageTag: body.imageTag,
      llmSource,
      byokApiKey,
      // We don't have the perkos-llm key on the agent doc; the
      // re-provision path will re-stash it in Secrets Manager if the
      // worker has the value cached. For pure-perkos agents the
      // existing secret is preserved by Secrets Manager versioning,
      // so this is OK — ensureAgentSecret refreshes it if we pass one,
      // otherwise leaves the existing version intact.
      perkosLlmApiKey: undefined,
      currentImageUri: doc.ecs?.imageUri ?? undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof UpgradeError) {
      const status =
        err.errorClass === "TAG_NOT_FOUND"
          ? 404
          : err.errorClass === "SERVICE_NOT_FOUND"
            ? 404
            : err.errorClass === "DRAIN_TIMEOUT"
              ? 504
              : 400;
      return NextResponse.json(
        { error: err.message, errorClass: err.errorClass },
        { status },
      );
    }
    return NextResponse.json(
      {
        error: `Upgrade failed: ${err instanceof Error ? err.message : String(err)}`,
        errorClass: "INTERNAL",
      },
      { status: 500 },
    );
  }
}
