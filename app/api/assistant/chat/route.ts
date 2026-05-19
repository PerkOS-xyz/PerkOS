/**
 * POST /api/assistant/chat
 *
 * Two modes:
 *  - regular JSON request → returns `{ reply, agent? }` once the LLM call
 *    completes.
 *  - `Accept: text/event-stream` (or `stream: true` in body) → SSE frames:
 *        data: {"chunk":"…"}
 *        data: {"chunk":"…"}
 *        data: {"reply":"…full text…","agent":{…}}
 *        data: [DONE]
 *
 * Request shape:
 *   { walletAddress, message, history?: {role, content}[], agentId? }
 */

import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";
import { complete, stream, type LlmMessage } from "../../../lib/llmProvider";

type Body = {
  walletAddress?: string;
  message?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  agentId?: string;
  stream?: boolean;
};

async function requireAuth(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Missing Authorization bearer token.");
  const decoded = await adminAuth().verifyIdToken(token);
  return decoded.uid.toLowerCase();
}

async function loadAgentContext(
  walletAddress: string,
  agentId: string | undefined
): Promise<{
  systemPrompt: string | undefined;
  byokKey: string | null;
  agentMeta?: { id?: string; name?: string; runtime?: string };
}> {
  if (!agentId) {
    return {
      systemPrompt:
        "You are the PerkOS Agent — a helpful guide for the PerkOS platform. Keep replies concise and actionable. Markdown supported.",
      byokKey: null,
    };
  }

  const db = adminDb();
  const agentRef = db
    .collection("wallets")
    .doc(walletAddress)
    .collection("agents")
    .doc(agentId);
  const agentSnap = await agentRef.get();
  if (!agentSnap.exists) {
    return { systemPrompt: undefined, byokKey: null };
  }
  const agent = agentSnap.data() as {
    name?: string;
    runtime?: string;
    plugins?: string[];
    modelKeyProvided?: boolean;
  };

  let byokKey: string | null = null;
  if (agent.modelKeyProvided) {
    const secretSnap = await db
      .collection("agent_secrets")
      .doc(walletAddress)
      .collection("agents")
      .doc(agentId)
      .get();
    byokKey = (secretSnap.data()?.modelKey as string | undefined) ?? null;
  }

  const systemPrompt = [
    `You are "${agent.name ?? "an agent"}", a ${agent.runtime ?? ""} agent running inside PerkOS.`,
    agent.plugins && agent.plugins.length > 0
      ? `Available capabilities: ${agent.plugins.join(", ")}.`
      : "",
    "Keep replies focused and use Markdown where helpful.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    systemPrompt,
    byokKey,
    agentMeta: { id: agentId, name: agent.name, runtime: agent.runtime },
  };
}

export async function POST(request: Request) {
  let callerUid: string;
  try {
    callerUid = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const walletAddress = body.walletAddress?.trim().toLowerCase();
  const userMessage = body.message?.trim();
  if (!walletAddress || walletAddress !== callerUid) {
    return NextResponse.json(
      { error: "walletAddress missing or doesn't match token." },
      { status: 403 }
    );
  }
  if (!userMessage) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }

  const ctx = await loadAgentContext(walletAddress, body.agentId);

  const llmMessages: LlmMessage[] = [
    ...(body.history ?? []).map<LlmMessage>((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const wantsStream =
    body.stream === true ||
    (request.headers.get("accept") ?? "").includes("text/event-stream");

  // ---- Streaming SSE response ---------------------------------------
  if (wantsStream) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let final = "";
          for await (const event of stream({
            byokKey: ctx.byokKey,
            systemPrompt: ctx.systemPrompt,
            messages: llmMessages,
          })) {
            const frame = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(frame));
            if (event.reply) final = event.reply;
          }
          // Final frame with the assembled reply + agent meta.
          const closing = `data: ${JSON.stringify({
            reply: final,
            agent: ctx.agentMeta,
          })}\n\n`;
          controller.enqueue(encoder.encode(closing));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "LLM error";
          const errFrame = `data: ${JSON.stringify({ error: message })}\n\n`;
          controller.enqueue(encoder.encode(errFrame));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  }

  // ---- Buffered JSON response ---------------------------------------
  try {
    const reply = await complete({
      byokKey: ctx.byokKey,
      systemPrompt: ctx.systemPrompt,
      messages: llmMessages,
    });
    return NextResponse.json({ data: { reply, agent: ctx.agentMeta } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "LLM error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
