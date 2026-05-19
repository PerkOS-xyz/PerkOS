/**
 * POST /api/agents/launch
 *
 * Replaces the legacy `/agent-launches` REST endpoint. Writes the agent doc
 * to /wallets/{addr}/agents/{id} via Admin SDK so we can:
 *   - skip client-side Firestore rules (admin bypasses them)
 *   - hold the BYOK modelKey in a separate /agent_secrets/{addr}/{id} doc
 *     that the client never sees
 *
 * Real infra provisioning (Hermes / OpenClaw runtimes on ECS or similar)
 * lives behind this endpoint when wired up. For now we mark new agents as
 * `ready` immediately so the UI flow completes end-to-end.
 *
 * Request shape:
 *   {
 *     walletAddress: string,
 *     runtime: "Hermes" | "OpenClaw",
 *     name: string,
 *     plugins?: string[],
 *     modelKey?: string   // BYOK; stored in /agent_secrets, never returned
 *   }
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";

type LaunchBody = {
  walletAddress?: string;
  runtime?: "Hermes" | "OpenClaw";
  name?: string;
  plugins?: string[];
  modelKey?: string;
};

async function requireAuth(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Missing Authorization bearer token.");
  const decoded = await adminAuth().verifyIdToken(token);
  return decoded.uid.toLowerCase();
}

export async function POST(request: Request) {
  let callerUid: string;
  try {
    callerUid = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: LaunchBody;
  try {
    body = (await request.json()) as LaunchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const walletAddress = body.walletAddress?.trim().toLowerCase();
  const runtime = body.runtime;
  const name = body.name?.trim();

  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json(
      { error: "Valid walletAddress is required." },
      { status: 400 }
    );
  }
  if (walletAddress !== callerUid) {
    return NextResponse.json(
      { error: "Token does not match walletAddress." },
      { status: 403 }
    );
  }
  if (runtime !== "Hermes" && runtime !== "OpenClaw") {
    return NextResponse.json(
      { error: "runtime must be 'Hermes' or 'OpenClaw'." },
      { status: 400 }
    );
  }
  if (!name || name.length < 2) {
    return NextResponse.json(
      { error: "name is required (min 2 chars)." },
      { status: 400 }
    );
  }

  const plugins = Array.isArray(body.plugins) ? body.plugins : [];
  const modelKey = body.modelKey?.trim() || null;

  const db = adminDb();

  // 1. Reserve the agent doc id
  const agentRef = db
    .collection("wallets")
    .doc(walletAddress)
    .collection("agents")
    .doc();

  await agentRef.set({
    name,
    runtime,
    status: "ready",
    walletAddress,
    plugins,
    modelKeyProvided: Boolean(modelKey),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 2. Stash the BYOK key in a separate collection the client can never read.
  //    /agent_secrets is locked down by rules; only admin SDK touches it.
  if (modelKey) {
    await db
      .collection("agent_secrets")
      .doc(walletAddress)
      .collection("agents")
      .doc(agentRef.id)
      .set({
        modelKey,
        createdAt: FieldValue.serverTimestamp(),
      });
  }

  return NextResponse.json({
    ok: true,
    launchId: agentRef.id,
    result: {
      mode: modelKey ? "byok" : "perkos",
      status: "ready",
      agent: {
        id: agentRef.id,
        name,
        runtime,
        status: "ready",
        walletAddress,
        plugins,
        modelKeyProvided: Boolean(modelKey),
      },
    },
  });
}
