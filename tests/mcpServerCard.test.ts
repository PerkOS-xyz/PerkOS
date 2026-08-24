import { describe, expect, it } from "vitest";

import { GET } from "../app/.well-known/mcp/server-card.json/route";

/**
 * The card is mirrored at the apex because discovery starts there: an agent
 * that finds perkos.xyz has no reason to guess a separate hostname exists.
 * The endpoint inside it must still be the real server, or following the card
 * lands the caller back here with nothing to talk to.
 */
describe("MCP server card at the apex", () => {
  it("points the transport at the MCP host, not at this origin", async () => {
    const card = await GET().json();
    expect(card.transport.type).toBe("streamable-http");
    expect(card.transport.endpoint).toMatch(/^https:\/\/mcp\./);
    expect(card.transport.endpoint).toMatch(/\/mcp$/);
  });

  it("points auth at the flow that exists", async () => {
    const card = await GET().json();
    expect(card.authentication.scheme).toBe("bearer");
    expect(card.authentication.documentation).toContain("auth.md");
    // Naming an OAuth issuer would send the caller to a document that 404s.
    expect(JSON.stringify(card).toLowerCase()).not.toContain("oauth");
  });

  it("names the server the same as the server names itself", async () => {
    const card = await GET().json();
    expect(card.serverInfo.name).toBe("perkos");
  });
});
