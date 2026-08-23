import { NextResponse } from "next/server";

/**
 * POST /api/a2a — A2A JSON-RPC endpoint for the PerkOS assistant.
 *
 * The endpoint advertised by /.well-known/agent-card.json. It speaks A2A so
 * another agent can talk to PerkOS without a browser, and forwards to the
 * assistant that already answers these questions
 * (PerkOS-API `POST /assistant/chat`).
 *
 * Deliberately a thin translation layer, not a second assistant: the scope
 * guard, the model choice and the answers all stay on the API side, so the
 * A2A caller and the in-app chat cannot drift into answering differently.
 *
 * Supports `message/send`. Streaming is advertised as false on the card
 * rather than half-implemented here.
 */
export const dynamic = "force-dynamic";

/**
 * The public origin. Behind Caddy the server binds 0.0.0.0:3000 and that is
 * what the request URL reports, so pointing a caller at a URL derived from the
 * request sends it to an address it cannot reach. The same mistake shipped
 * once already in the Link headers.
 */
const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

const PLATFORM_API =
  process.env.PERKOS_API_URL ??
  process.env.NEXT_PUBLIC_PERKOS_API_URL ??
  "https://api.perkos.xyz";

type JsonRpcId = string | number | null;

function rpcError(id: JsonRpcId, code: number, message: string, status = 200) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status, headers: { "access-control-allow-origin": "*" } },
  );
}

/** Pull the text out of an A2A message's parts. */
function textFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) =>
      p && typeof p === "object" && (p as { kind?: string }).kind === "text"
        ? String((p as { text?: unknown }).text ?? "")
        : "",
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    jsonrpc?: string;
    id?: JsonRpcId;
    method?: string;
    params?: Record<string, unknown>;
  } | null;

  const id = body?.id ?? null;
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return rpcError(id, -32600, "Invalid Request: expected JSON-RPC 2.0");
  }
  if (body.method !== "message/send") {
    return rpcError(id, -32601, `Method not found: ${body.method}`);
  }

  const message = (body.params?.message ?? null) as {
    parts?: unknown;
    messageId?: unknown;
  } | null;
  const text = textFromParts(message?.parts);
  if (!text) {
    return rpcError(id, -32602, "Invalid params: message.parts must carry text");
  }

  // The caller's own credential is forwarded; this endpoint holds none of its
  // own. An unauthenticated caller gets the API's 401, not a silent downgrade.
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return rpcError(
      id,
      -32001,
      `Unauthorized: send a bearer token. See ${SITE}/auth.md`,
      401,
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${PLATFORM_API}/assistant/chat`, {
      method: "POST",
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
  } catch {
    return rpcError(id, -32603, "Internal error: assistant unreachable");
  }

  const payload = (await upstream.json().catch(() => null)) as {
    data?: { reply?: string };
    error?: { message?: string };
  } | null;

  if (!upstream.ok) {
    return rpcError(
      id,
      upstream.status === 401 || upstream.status === 403 ? -32001 : -32603,
      payload?.error?.message ?? `Assistant returned ${upstream.status}`,
      upstream.status,
    );
  }

  const reply = payload?.data?.reply ?? "";

  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      result: {
        kind: "message",
        role: "agent",
        messageId: crypto.randomUUID(),
        parts: [{ kind: "text", text: reply }],
      },
    },
    { headers: { "access-control-allow-origin": "*" } },
  );
}
