/**
 * POST /api/agents/[agentId]/gateways/[type]/status
 *
 * Runtime-callable status update for a single gateway. The bridge
 * sidecar (perkos-a2a-bridge) polls the runtime's gateway health and
 * forwards the verdict here so the admin panel + future Prometheus
 * exporters see a real status instead of "pending forever".
 *
 * Body:
 *   { "status": "active" | "error", "message"?: string }
 *
 * Auth:
 *   Authorization: Bearer <relayApiKey>
 *   x-agent-name: <global agent name>
 *
 * Why bearer-relayApiKey + agent-name header (not Firebase token):
 *   The caller is the agent's container, not a logged-in wallet. The
 *   relayApiKey is already provisioned into the bridge sidecar (PR
 *   #80) for chat.perkos.xyz / transport.perkos.xyz auth — same
 *   secret, no new key to manage. The agent-name header lets us
 *   resolve the global `/agents/<name>` doc to verify the bearer
 *   matches without an expensive collection-wide query.
 *
 * Why the path carries both agentId AND gatewayType:
 *   - agentId resolves the per-wallet doc to update (status writes
 *     happen on `/wallets/<wallet>/agents/<agentId>.gateways.<type>`).
 *   - gatewayType narrows the write so a bridge bug can't accidentally
 *     overwrite the whole gateways map.
 *
 * The endpoint is intentionally narrow: it can only flip status +
 * statusMessage. It cannot disable a gateway, change config, or
 * touch secrets. Those operations remain owner-only via
 * /api/agents/[agentId]/gateways.
 */
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { GATEWAY_CATALOG, type GatewayType } from "../../../../../../lib/agentGateways";
import { adminDb } from "../../../../../../lib/firebaseAdmin";

type ValidStatus = "active" | "error";

function isValidStatus(value: unknown): value is ValidStatus {
  return value === "active" || value === "error";
}

function isKnownGatewayType(value: string): value is GatewayType {
  return value in GATEWAY_CATALOG;
}

/**
 * Look up the agent's global doc to verify the supplied bearer
 * matches and the agentId matches the doc's per-wallet record.
 * Returns the wallet on success so the caller can update the right
 * per-wallet sub-collection.
 *
 * We deliberately do NOT echo the relayApiKey or any other field
 * back to the runtime — only ok/wallet. Defense-in-depth: a
 * compromised log won't leak the secret.
 */
async function authenticateRuntime(
  agentId: string,
  agentName: string,
  bearer: string,
): Promise<{ ok: true; wallet: string } | { ok: false; status: number; error: string }> {
  if (!bearer) return { ok: false, status: 401, error: "Missing bearer token." };
  if (!agentName) return { ok: false, status: 400, error: "x-agent-name header required." };

  const snap = await adminDb().collection("agents").doc(agentName).get();
  if (!snap.exists) return { ok: false, status: 404, error: "Agent not found." };
  const data = snap.data() as
    | { relayApiKey?: string; walletAddress?: string; agentId?: string }
    | undefined;
  if (!data?.relayApiKey) {
    return { ok: false, status: 404, error: "Agent missing relayApiKey." };
  }
  if (data.relayApiKey !== bearer) {
    // Constant-time would be nicer here, but Firestore lookups already
    // dominate the timing channel and the relayApiKey is high-entropy
    // (UUID-class). String compare is fine for this threat model.
    return { ok: false, status: 401, error: "Invalid bearer." };
  }
  if (data.agentId !== agentId) {
    return { ok: false, status: 403, error: "agentId does not match the named agent." };
  }
  if (!data.walletAddress) {
    return { ok: false, status: 500, error: "Agent global doc missing walletAddress." };
  }
  return { ok: true, wallet: data.walletAddress.toLowerCase() };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string; type: string }> },
) {
  const { agentId, type } = await params;
  if (!isKnownGatewayType(type)) {
    return NextResponse.json(
      { error: `Unknown gateway type: ${type}`, errorClass: "BAD_INPUT" },
      { status: 400 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const agentName = request.headers.get("x-agent-name") ?? "";

  const auth = await authenticateRuntime(agentId, agentName, bearer);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, errorClass: auth.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" },
      { status: auth.status },
    );
  }

  let body: { status?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON", errorClass: "BAD_INPUT" },
      { status: 400 },
    );
  }

  if (!isValidStatus(body.status)) {
    return NextResponse.json(
      { error: 'status must be "active" or "error"', errorClass: "BAD_INPUT" },
      { status: 400 },
    );
  }

  // Bound the operator-facing message — a runaway runtime could
  // otherwise post a multi-MB stack trace into Firestore.
  const rawMessage = typeof body.message === "string" ? body.message : "";
  const message = rawMessage.length > 500 ? rawMessage.slice(0, 497) + "..." : rawMessage;

  const ref = adminDb()
    .collection("wallets")
    .doc(auth.wallet)
    .collection("agents")
    .doc(agentId);

  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json(
      { error: "Per-wallet agent doc not found", errorClass: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // Only update the targeted gateway's status+message+updatedAt so a
  // status report can't accidentally clobber the enabled flag, the
  // non-secret config, or the secret presence list.
  const now = new Date().toISOString();
  await ref.set(
    {
      gateways: {
        [type]: {
          status: body.status,
          statusMessage: message || undefined,
          updatedAt: now,
        },
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true, type, status: body.status, updatedAt: now });
}
