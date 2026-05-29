"use client";

/**
 * `authedFetch` shim — backed by `@perkos/shared-client`'s `createApiClient`.
 *
 * Phase 1.1 keeps App talking to its own Next.js `/api/*` routes (empty
 * baseUrl = same-origin), but the underlying wrapper that attaches the
 * Firebase ID token is the shared one. Phase 1.2 will swap the empty
 * baseUrl for `https://api.perkos.xyz`.
 *
 * Throws if the user isn't signed into Firebase — callers are expected to
 * have triggered `signInWithWallet` first.
 */
import { createApiClient } from "@perkos/shared-client";

import { firebaseAuth } from "./firebase";

const client = createApiClient({
  // Empty baseUrl => path is used verbatim; preserves App's same-origin call
  // sites like `/api/agents/launch`. Reset to api.perkos.xyz in Phase 1.2.
  baseUrl: "/",
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
  // `createApiClient.fetch` accepts a string path. For URL/Request inputs we
  // fall back to letting the underlying fetch handle them, but App's call
  // sites always pass plain strings.
  const path =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  return client.fetch(path, init);
}
