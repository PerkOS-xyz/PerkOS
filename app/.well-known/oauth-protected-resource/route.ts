/**
 * GET /.well-known/oauth-protected-resource — RFC 9728.
 *
 * Says which authorization server issues tokens for THIS origin. It has to
 * live here, on the resource, not only on the issuer: a caller holding a
 * PerkOS URL needs to learn where to get a token without already knowing the
 * issuer's hostname, which is the whole point of resource metadata.
 *
 * The authorization server serves its own copy at oauth.perkos.xyz. Both are
 * generated from the same two constants so they cannot disagree about who
 * issues for whom — a mismatch there sends a caller to get a token that this
 * resource will not accept.
 */
export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";
const ISSUER = process.env.NEXT_PUBLIC_PERKOS_OAUTH_URL ?? "https://oauth.perkos.xyz";

export function GET(): Response {
  const metadata = {
    resource: SITE,
    authorization_servers: [ISSUER],
    scopes_supported: ["board:read", "board:write", "agent:read"],
    bearer_methods_supported: ["header"],
    resource_documentation: `${SITE}/auth.md`,
  };

  return new Response(JSON.stringify(metadata, null, 2), {
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600",
    },
  });
}
