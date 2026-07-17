"use client";

/**
 * `authedFetch` shim — backed by `@perkos/shared-client`'s `createApiClient`.
 *
 * Browser requests always use the App's same-origin `/api/platform/*` proxy.
 * Call sites keep their legacy `/api/*` paths (e.g. `/api/agents/launch`),
 * which are rewritten to `/api/platform/agents/launch`. The Next.js proxy
 * forwards them server-side to the configured platform API, avoiding CORS and
 * keeping the upstream host out of browser networking.
 *
 * Throws if the user isn't signed into Firebase — callers are expected to
 * have triggered `signInWithWallet` first.
 */
import { createApiClient } from "@perkos/shared-client";

import { firebaseAuth } from "./firebase";

const apiBase = "/api/platform";

function rewritePath(path: string): string {
  return path.startsWith("/api/") ? path.slice(4) : path;
}

const client = createApiClient({
  baseUrl: apiBase,
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
