import { NextResponse } from "next/server";

/**
 * GET /.well-known/oauth-authorization-server — a signpost, not a copy.
 *
 * A client that only knows a PerkOS URL looks for authorization server
 * metadata here. The server is at oauth.perkos.xyz, so this redirects there
 * rather than serving the document itself.
 *
 * The distinction matters and is not stylistic. RFC 8414 requires the
 * `issuer` in the metadata to match the origin it was retrieved from, and
 * clients check exactly that to defend against mix-up attacks. A copy served
 * from this origin would either carry a foreign issuer — which a correct
 * client MUST reject — or claim perkos.xyz as the issuer, which is false:
 * there is no token endpoint here. A redirect asserts nothing about who the
 * issuer is; it just says where to look, and the document arrives from the
 * origin that legitimately owns it.
 *
 * The authoritative pointer is still /.well-known/oauth-protected-resource,
 * which names the authorization server for this resource. This path exists
 * for clients that reach for the server metadata first.
 */
const ISSUER = process.env.NEXT_PUBLIC_PERKOS_OAUTH_URL ?? "https://oauth.perkos.xyz";

export const dynamic = "force-static";

export function GET(): NextResponse {
  return NextResponse.redirect(
    `${ISSUER}/.well-known/oauth-authorization-server`,
    // 308: permanent, and preserves the method. This mapping is part of the
    // deployment shape, not a temporary detour.
    { status: 308, headers: { "cache-control": "public, max-age=3600" } },
  );
}
