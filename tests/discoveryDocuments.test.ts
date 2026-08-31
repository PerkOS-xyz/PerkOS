import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const middlewareSource = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");

/**
 * Discovery documents must advertise the PUBLIC origin.
 *
 * Behind Caddy the Next server binds 0.0.0.0:3000, so deriving the origin from
 * the request emitted `<https://0.0.0.0:3000/llms.txt>` — a Link header
 * pointing at an address no caller can reach. It shipped that way and was
 * caught only by curling production, because a build and a passing suite both
 * confirm the code runs, not that the value is reachable.
 */
describe("discovery documents", () => {
  it("builds the Link header from the canonical origin, not the request", () => {
    expect(middlewareSource).toContain("NEXT_PUBLIC_CANONICAL_URL");
    // The bug: the bind address leaks into a header agents are meant to follow.
    expect(middlewareSource).not.toContain("request.nextUrl.origin");
  });

  it("never changes routing, with .well-known excluded", () => {
    // Farcaster and Base App fetch /.well-known/farcaster.json to verify the
    // Mini App; altering its routing would break embedding. Markdown
    // negotiation answers inline for exactly this reason rather than
    // rewriting to a mirror path.
    expect(middlewareSource).toContain(".well-known");
    expect(middlewareSource).not.toContain("NextResponse.redirect");
    expect(middlewareSource).not.toContain("NextResponse.rewrite");
  });

  it("serves markdown only when it is actually asked for", () => {
    // A browser and a Farcaster client never send this Accept, so neither can
    // be handed markdown by accident.
    expect(middlewareSource).toContain("text/markdown");
    expect(middlewareSource).toContain("accept");
    // `Vary` so a cache cannot serve the markdown to an HTML request.
    expect(middlewareSource).toContain("vary");
  });
});
