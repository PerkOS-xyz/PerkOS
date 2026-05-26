/**
 * POST /api/agents/launch
 *
 * Provisions a new agent record:
 *   - /wallets/{addr}/agents/{id}     ← user-scoped view (existing)
 *   - /agents/{name}                  ← global registry consumed by
 *                                       PerkOS-Chat for WS auth
 *   - /agent_secrets/{addr}/agents/{id}  ← BYOK model key (server-only)
 *
 * The generated `relayApiKey` is returned in the response **only once**.
 * The client should surface it in a one-shot reveal modal — after that
 * the key is server-side only and can't be re-fetched.
 *
 * Real infra provisioning (Hermes / OpenClaw runtimes on ECS or similar)
 * lives behind this endpoint when wired up. For now we mark new agents as
 * `ready` immediately so the UI flow completes end-to-end.
 */

import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";
import { isSuperAdmin } from "../../../lib/adminAuth";
import { createJob } from "../../../lib/provisionJobs";

type LaunchBody = {
  walletAddress?: string;
  runtime?: "Hermes" | "OpenClaw";
  name?: string;
  plugins?: string[];
  modelKey?: string;
  /** ECR image tag pinned by the admin. Required for ECS provisioning;
   *  null/undefined means VPS or Local deploy → skip the AWS path. */
  imageTag?: string | null;
  /** Optional. Defaults to "user" (the existing wallet-owned agent path).
   *  When set to "platform", the caller must be a super-admin and the
   *  agent is registered as a platform identity (no wallet owner). Used
   *  to bootstrap things like the PerkOS Assistant. */
  kind?: "user" | "platform";
};

/** Sentinel "wallet" the global registry stores for platform agents so
 *  downstream consumers (chat.perkos.xyz, Transport) that expect a
 *  walletAddress field don't blow up on null. The Assistant container
 *  ignores this and uses the per-conv walletFromConv() mapping instead. */
const PLATFORM_WALLET_SENTINEL = "platform";

const AGENT_NAME_PATTERN = /^[a-zA-Z0-9_-]{2,32}$/;

async function requireAuth(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Missing Authorization bearer token.");
  const decoded = await adminAuth().verifyIdToken(token);
  return decoded.uid.toLowerCase();
}

/** Convert the user-facing runtime label to the wire-protocol value. */
function runtimeKind(label: "Hermes" | "OpenClaw"): "hermes-api" | "openclaw" {
  return label === "Hermes" ? "hermes-api" : "openclaw";
}

function newRelayApiKey(): string {
  return `rk_${randomBytes(32).toString("hex")}`;
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

  const kind = body.kind ?? "user";
  const runtime = body.runtime;
  const name = body.name?.trim();

  // Platform agents (PerkOS Assistant + future platform identities) skip
  // the wallet-ownership check but require super-admin auth instead.
  // They live under /platform_agents/{name} rather than /wallets/.../
  // agents/{id} since they have no end-user owner.
  let walletAddress: string;

  if (kind === "platform") {
    if (!(await isSuperAdmin(callerUid))) {
      return NextResponse.json(
        { error: "Platform agents can only be launched by a super-admin." },
        { status: 403 },
      );
    }
    if (body.walletAddress) {
      return NextResponse.json(
        { error: "Platform agents do not have a walletAddress." },
        { status: 400 },
      );
    }
    if (body.modelKey) {
      return NextResponse.json(
        {
          error:
            "Platform agents don't take a BYOK modelKey — set env vars on the container instead.",
        },
        { status: 400 },
      );
    }
    if (body.imageTag) {
      return NextResponse.json(
        {
          error:
            "Platform agents are deployed out-of-band (LLM VPS), not via the ECS provisioner. Omit imageTag.",
        },
        { status: 400 },
      );
    }
    walletAddress = PLATFORM_WALLET_SENTINEL;
  } else {
    const w = body.walletAddress?.trim().toLowerCase();
    if (!w || !/^0x[a-fA-F0-9]{40}$/.test(w)) {
      return NextResponse.json(
        { error: "Valid walletAddress is required." },
        { status: 400 },
      );
    }
    if (w !== callerUid) {
      return NextResponse.json(
        { error: "Token does not match walletAddress." },
        { status: 403 },
      );
    }
    walletAddress = w;
  }

  if (runtime !== "Hermes" && runtime !== "OpenClaw") {
    return NextResponse.json(
      { error: "runtime must be 'Hermes' or 'OpenClaw'." },
      { status: 400 }
    );
  }
  if (!name || !AGENT_NAME_PATTERN.test(name)) {
    return NextResponse.json(
      {
        error:
          "name must be 2-32 chars, only letters / digits / underscore / dash.",
      },
      { status: 400 }
    );
  }

  const plugins = Array.isArray(body.plugins) ? body.plugins : [];
  const modelKey = body.modelKey?.trim() || null;

  const db = adminDb();
  const relayApiKey = newRelayApiKey();

  // /agents/{name} is the global registry — names must be globally unique.
  // Use a Firestore transaction to atomically check-and-create so two
  // concurrent launches can't both win the same name.
  const globalRef = db.collection("agents").doc(name);
  // For user agents: auto-generated doc id under /wallets/{w}/agents/.
  // For platform agents: the agent name doubles as the doc id since
  // platform names are already globally unique by definition.
  const agentRef =
    kind === "platform"
      ? db.collection("platform_agents").doc(name)
      : db
          .collection("wallets")
          .doc(walletAddress)
          .collection("agents")
          .doc();

  try {
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(globalRef);
      if (existing.exists) {
        const err = new Error("AGENT_NAME_TAKEN");
        err.name = "AgentNameTakenError";
        throw err;
      }

      // Per-owner record. Shape parallels the user case for UI uniformity;
      // the `kind` field disambiguates downstream consumers.
      tx.set(agentRef, {
        name,
        runtime,
        status: "ready",
        kind,
        walletAddress,
        plugins,
        modelKeyProvided: Boolean(modelKey),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Global registry doc consumed by PerkOS-Chat (and Transport in the
      // future) to verify WS auth on agent connections. The `kind` field
      // lets chat.perkos.xyz scope behavior (e.g. platform agents can
      // serve many wallets in one identity; user agents own their thread).
      tx.set(globalRef, {
        name,
        relayApiKey,
        walletAddress,
        kind,
        agentId: agentRef.id,
        runtime: runtimeKind(runtime),
        status: "active",
        scopes: ["chat:send", "chat:history", "tasks:receive"],
        plugins,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AgentNameTakenError") {
      return NextResponse.json(
        {
          error: `Agent name "${name}" is already taken. Pick another.`,
          code: "AGENT_NAME_TAKEN",
        },
        { status: 409 }
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to provision agent: ${msg}` },
      { status: 500 }
    );
  }

  // BYOK key — separate collection the client never reads.
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

  // ECS provisioning happens only when the wizard sent an imageTag (i.e.
  // deployMode === "perkos-ecs"). For VPS / Local we stop after the
  // Firestore registration — the user installs the runtime themselves.
  //
  // Provisioning runs asynchronously on the worker (see
  // app/worker/provisioner.ts). We enqueue a job into /provision_jobs
  // and return immediately so the wizard can subscribe to the job
  // status + log stream via Firestore realtime listeners.
  //
  // BYOK keys live in the agent_secrets collection (written above);
  // the worker reads them from there when it picks the job up. We
  // don't ship the plaintext key through the job doc — the worker
  // re-fetches it from agent_secrets inside its own privileged
  // context.
  let jobId: string | null = null;
  if (body.imageTag && typeof body.imageTag === "string") {
    jobId = await createJob({
      walletAddress,
      agentId: agentRef.id,
      agentName: name,
      input: {
        runtime,
        imageTag: body.imageTag,
        llmSource: modelKey ? "byok" : "perkos",
      },
    });
    await agentRef.set(
      {
        status: "provisioning",
        provisionJobId: jobId,
      },
      { merge: true },
    );
  }

  return NextResponse.json({
    ok: true,
    launchId: agentRef.id,
    /**
     * The relayApiKey is returned exactly once — the client must show it to
     * the user immediately (one-shot reveal modal). After this response the
     * key is server-only.
     */
    credentials: {
      agentName: name,
      relayApiKey,
      chatUrl:
        process.env.NEXT_PUBLIC_PERKOS_CHAT_URL ?? "wss://chat.perkos.xyz/chat",
      transportUrl:
        process.env.NEXT_PUBLIC_PERKOS_TRANSPORT_URL ?? "wss://transport.perkos.xyz/a2a",
    },
    result: {
      mode: modelKey ? "byok" : "perkos",
      // When jobId is set the agent is asynchronously provisioning;
      // when null (VPS / Local), we're already done.
      status: jobId ? "provisioning" : "ready",
      jobId,
      agent: {
        id: agentRef.id,
        name,
        runtime,
        status: jobId ? "provisioning" : "ready",
        walletAddress,
        plugins,
        modelKeyProvided: Boolean(modelKey),
      },
    },
  });
}
