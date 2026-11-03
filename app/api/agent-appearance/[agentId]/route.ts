import { normalizeWalletAddress, walletChain } from "@perkos/shared-types";
import { isAgentAppearance, MAX_AGENT_AVATAR_LENGTH } from "@/app/lib/agentAvatarIdentity";
import { adminAuth, adminDb } from "@/app/lib/firebaseAdmin";

export async function PATCH(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const token = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  const uid = token ? await adminAuth().verifyIdToken(token).then((v) => v.uid).catch(() => null) : null;
  if (!uid || !walletChain(uid)) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { agentId } = await params;
  if (!agentId || agentId.includes("/") || agentId === "." || agentId === "..") {
    return Response.json({ error: "Invalid agent." }, { status: 400 });
  }
  const raw = await request.text();
  if (raw.length > MAX_AGENT_AVATAR_LENGTH + 64) return Response.json({ error: "Avatar is too large." }, { status: 413 });
  let appearance: unknown;
  try { appearance = JSON.parse(raw)?.appearance; } catch { /* handled by validation */ }
  if (!isAgentAppearance(appearance)) return Response.json({ error: "Invalid avatar." }, { status: 400 });

  // Never accept an owner or a runtime/configuration field from the request.
  const ref = adminDb().collection("wallets").doc(normalizeWalletAddress(uid)).collection("agents").doc(agentId);
  const found = await adminDb().runTransaction(async (tx) => {
    if (!(await tx.get(ref)).exists) return false;
    tx.update(ref, { avatarAppearance: appearance });
    return true;
  });
  return found ? Response.json({ appearance }) : Response.json({ error: "Agent not found." }, { status: 404 });
}
