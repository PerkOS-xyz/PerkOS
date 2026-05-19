"use client";

import { firebaseAuth } from "./firebase";

/**
 * `fetch` wrapper that injects the current Firebase user's idToken as a
 * `Authorization: Bearer …` header. Use this for any call to our own Next.js
 * API routes that need to know who's calling.
 *
 * Throws if the user isn't signed into Firebase — the caller should normally
 * have triggered `signInWithWallet` before getting here.
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const user = firebaseAuth().currentUser;
  if (!user) {
    throw new Error("Not signed in. Connect your wallet first.");
  }
  const token = await user.getIdToken();

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(input, { ...init, headers });
}
