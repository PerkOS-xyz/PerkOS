/**
 * GET /.well-known/api-catalog — RFC 9727 linkset.
 *
 * A machine-readable index of the APIs this origin offers, so a caller does
 * not have to guess where the description lives.
 */
export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

export function GET(): Response {
  const body = {
    linkset: [
      {
        // The origin identifies the API. `/api/platform` is only a prefix:
        // its children answer, the path itself 404s, and a catalog whose
        // anchor 404s reads as broken to a scanner following it.
        anchor: SITE,
        "service-desc": [
          { href: `${SITE}/openapi.json`, type: "application/json" },
        ],
        "service-doc": [
          { href: `${SITE}/AGENTS.md`, type: "text/markdown" },
          { href: `${SITE}/llms.txt`, type: "text/plain" },
        ],
        status: [{ href: `${SITE}/api/platform/health` }],
      },
    ],
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/linkset+json",
      "cache-control": "public, max-age=3600",
    },
  });
}
