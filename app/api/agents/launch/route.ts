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
import { provisionEcsAgent } from "../../../lib/ecsProvision";
import { registerLlmAgent } from "../../../lib/llmAgentRegistry";

type LaunchBody = {
  walletAddress?: string;
  runtime?: "Hermes" | "OpenClaw";
  name?: string;
  plugins?: string[];
  modelKey?: string;
  /** ECR image tag pinned by the admin. Required for ECS provisioning;
   *  null/undefined means VPS or Local deploy → skip the AWS path. */
  imageTag?: string | null;
};

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
  const agentRef = db
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

      // Per-wallet record (the existing schema; unchanged shape for the UI).
      tx.set(agentRef, {
        name,
        runtime,
        status: "ready",
        walletAddress,
        plugins,
        modelKeyProvided: Boolean(modelKey),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Global registry doc consumed by PerkOS-Chat (and Transport in the
      // future) to verify WS auth on agent connections.
      tx.set(globalRef, {
        name,
        relayApiKey,
        walletAddress,
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
  // Provisioning failures are recorded on the agent doc but don't fail the
  // launch response. The user keeps their agent registration + relayApiKey;
  // they can retry the provisioning step from the agents page (TODO: wire
  // a "Retry provisioning" affordance once it ships).
  let ecsResult: Awaited<ReturnType<typeof provisionEcsAgent>> | null = null;
  let ecsError: string | null = null;
  if (body.imageTag && typeof body.imageTag === "string") {
    // PerkOS-mode (no BYOK): mint a per-agent Bearer key against the
    // shared LLM gateway. We do this BEFORE provisioning so the ECS
    // task starts with the secret already populated in Secrets Manager.
    // Registration failures don't abort the launch — the agent still
    // boots (the wizard already promised it would), but its LLM calls
    // will 401 until we re-provision. The failure is recorded on the
    // agent doc so the admin UI can surface it.
    let perkosLlmApiKey: string | undefined;
    if (!modelKey) {
      try {
        const registered = await registerLlmAgent(name);
        perkosLlmApiKey = registered.key;
        await agentRef.set(
          {
            llmRegistration: {
              status: "ok",
              last4: registered.last4,
              registeredAt: FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[launch] LLM gateway registration failed for ${name}: ${message}`,
        );
        await agentRef.set(
          {
            llmRegistration: {
              status: "failed",
              error: message.slice(0, 500),
              attemptedAt: FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        );
      }
    }

    try {
      ecsResult = await provisionEcsAgent({
        walletAddress,
        agentName: name,
        runtime,
        imageTag: body.imageTag,
        llmSource: modelKey ? "byok" : "perkos",
        byokApiKey: modelKey ?? undefined,
        perkosLlmApiKey,
        agentId: agentRef.id,
      });
      await agentRef.set(
        {
          ecs: {
            serviceArn: ecsResult.serviceArn,
            taskDefinitionArn: ecsResult.taskDefinitionArn,
            imageUri: ecsResult.imageUri,
            provisionedAt: FieldValue.serverTimestamp(),
          },
          status: "provisioning",
        },
        { merge: true }
      );
    } catch (err) {
      ecsError = err instanceof Error ? err.message : String(err);
      await agentRef.set(
        {
          ecs: { lastError: ecsError, lastErrorAt: FieldValue.serverTimestamp() },
          status: "provision-failed",
        },
        { merge: true }
      );
    }
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
      status: ecsError
        ? "provision-failed"
        : ecsResult
          ? "provisioning"
          : "ready",
      agent: {
        id: agentRef.id,
        name,
        runtime,
        status: ecsError
          ? "provision-failed"
          : ecsResult
            ? "provisioning"
            : "ready",
        walletAddress,
        plugins,
        modelKeyProvided: Boolean(modelKey),
      },
      ecs: ecsResult
        ? {
            serviceArn: ecsResult.serviceArn,
            taskDefinitionArn: ecsResult.taskDefinitionArn,
            imageUri: ecsResult.imageUri,
          }
        : ecsError
          ? { error: ecsError }
          : null,
    },
  });
}
