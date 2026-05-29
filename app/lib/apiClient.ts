"use client";

/**
 * `authedFetch` shim — backed by `@perkos/shared-client`'s `createApiClient`.
 *
 * Phase 1.2 points App at the platform API at `https://api.perkos.xyz` by
 * default. Call sites use legacy `/api/*` paths (e.g. `/api/agents/launch`)
 * — those get rewritten to the platform route (`/agents/launch`) when
 * `apiBase` is non-empty. Set `NEXT_PUBLIC_PERKOS_API_URL=""` at build time
 * to roll back to App's own same-origin `/api/*` routes for a release.
 *
 * Throws if the user isn't signed into Firebase — callers are expected to
 * have triggered `signInWithWallet` first.
 */
import { createApiClient } from "@perkos/shared-client";

import { firebaseAuth } from "./firebase";

const apiBase =
  process.env.NEXT_PUBLIC_PERKOS_API_URL ?? "https://api.perkos.xyz";

// When apiBase is empty (or "/"), we hit App's own Next routes — keep paths
// as-is. When apiBase is a real host (the platform API), strip the leading
// `/api` so legacy call sites like `/api/agents/launch` resolve to
// `api.perkos.xyz/agents/launch`.
const stripApiPrefix = apiBase !== "" && apiBase !== "/";

function rewritePath(path: string): string {
  if (!stripApiPrefix) return path;
  return path.startsWith("/api/") ? path.slice(4) : path;
}

const client = createApiClient({
  baseUrl: apiBase || "/",
  getIdToken: async () => {
    const user = firebaseAuth().currentUser;
    if (!user) throw new Error("Not signed in. Connect your wallet first.");
    return user.getIdToken();
  },
});

export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const path =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  return client.fetch(rewritePath(path), init);
}
