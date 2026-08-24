/**
 * GET /.well-known/mcp/server-card.json — MCP Server Card (SEP-1649).
 *
 * The server itself lives at mcp.perkos.xyz and serves this same card. It is
 * mirrored here because discovery starts at the apex: an agent that finds
 * perkos.xyz has no reason to guess that a separate hostname exists, and the
 * whole point of this contract is that a caller only ever needs one origin.
 *
 * The `transport.endpoint` is the real host, so following the card lands the
 * caller on the server rather than back here.
 */
export const dynamic = "force-static";

const MCP_URL = process.env.NEXT_PUBLIC_PERKOS_MCP_URL ?? "https://mcp.perkos.xyz";
const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

export function GET(): Response {
  const card = {
    serverInfo: { name: "perkos", version: "0.1.0" },
    description:
      "PerkOS job board over MCP: create and move tasks, read and write " +
      "project docs, post to project chat.",
    transport: { type: "streamable-http", endpoint: `${MCP_URL}/mcp` },
    capabilities: { tools: { listChanged: false } },
    // Bearer from the wallet-signature flow. No OAuth issuer exists on this
    // origin, so the card points at what does rather than naming a scheme a
    // caller cannot complete.
    authentication: {
      type: "http",
      scheme: "bearer",
      documentation: `${SITE}/auth.md`,
    },
  };

  return new Response(JSON.stringify(card, null, 2), {
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600",
    },
  });
}
