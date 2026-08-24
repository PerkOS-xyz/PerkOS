import { NextResponse, type NextRequest } from "next/server";

import { LANDING_MARKDOWN } from "./app/lib/agentMarkdown";

/**
 * Advertise the agent contract on every HTML response.
 *
 * An agent that lands on a page should not have to guess that `/llms.txt` or
 * an OpenAPI document exist. RFC 8288 `Link` headers say so in the response
 * itself, which is what discovery scanners read and what saves a caller a
 * round of 404s.
 *
 * Deliberately headers ONLY — no rewrites, no redirects.
 * `/.well-known/farcaster.json` is a route handler that Farcaster and Base App
 * clients fetch to verify and embed the Mini App; anything that altered its
 * routing would break that verification, so the matcher keeps this away from
 * `/.well-known` entirely.
 *
 * This does not touch how the three host contexts (Base Mini App, Farcaster
 * Mini App, browser) are told apart: that happens client-side in
 * `useIsInMiniApp`, after the page loads.
 */
/**
 * The public origin, taken from config rather than from the incoming request.
 *
 * Behind Caddy the Next server binds 0.0.0.0:3000 and that is what the request
 * URL reports, so deriving the origin from it emitted
 * `<https://0.0.0.0:3000/llms.txt>` — a header pointing at an address no
 * caller can reach. The other discovery documents already read this env var,
 * so they were correct while the header was not.
 */
const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

export function middleware(request: NextRequest) {
  // Content negotiation: an agent that asks for markdown gets markdown from
  // the SAME url, rather than having to know a separate path exists. Answered
  // inline instead of rewriting, so this stays out of routing entirely — a
  // browser or a Farcaster client never sends this Accept, so they never
  // reach here.
  if (
    request.nextUrl.pathname === "/" &&
    (request.headers.get("accept") ?? "").includes("text/markdown")
  ) {
    return new NextResponse(LANDING_MARKDOWN, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        vary: "accept",
      },
    });
  }

  const response = NextResponse.next();
  const origin = SITE;

  response.headers.set(
    "link",
    [
      `<${origin}/llms.txt>; rel="llms-txt"; type="text/plain"`,
      `<${origin}/AGENTS.md>; rel="author"; type="text/markdown"`,
      `<${origin}/openapi.json>; rel="service-desc"; type="application/json"`,
      `<${origin}/.well-known/api-catalog>; rel="api-catalog"`,
      `<${origin}/.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/json"`,
      `<${origin}/.well-known/agent-card.json>; rel="agent-card"; type="application/json"`,
      `<${origin}/.well-known/mcp/server-card.json>; rel="mcp-server-card"; type="application/json"`,
    ].join(", "),
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *  - /.well-known/*  (farcaster.json verification, and the catalog itself)
     *  - /api/*          (JSON contract; callers there already know the paths)
     *  - Next internals and static assets
     */
    "/((?!\\.well-known|api|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|json|md|js|css|woff2?)$).*)",
  ],
};
