"use client";

import { signInWithCustomToken } from "firebase/auth";

import { firebaseAuth } from "./firebase";
import { recordActivity } from "./activityTelemetry";

/**
 * Full wallet → Firebase sign-in dance.
 *
 *   1. Ask /api/auth/nonce for a fresh nonce + canonical message.
 *   2. Have the wallet sign that message (caller provides `signMessage`).
 *   3. POST the signature to /api/auth/wallet-signin.
 *   4. signInWithCustomToken with the token the server returned.
 *
 * Returns the Firebase User on success. Throws on any step that fails so the
 * caller can surface a toast / inline error.
 */
export async function signInWithWallet(input: {
  address: string;
  signMessage: (message: string) => Promise<string>;
}) {
  const address = input.address.toLowerCase();

  // 1. Nonce -----------------------------------------------------------
  const nonceRes = await fetch(
    `/api/auth/nonce?address=${encodeURIComponent(address)}`
  );
  if (!nonceRes.ok) {
    const { error } = (await nonceRes.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(error ?? "Couldn't request a sign-in nonce.");
  }
  const { nonce, message } = (await nonceRes.json()) as {
    nonce: string;
    message: string;
  };

  // 2. Wallet signs ----------------------------------------------------
  const signature = await input.signMessage(message);

  // 3. Exchange for Firebase custom token ------------------------------
  const exchangeRes = await fetch("/api/auth/wallet-signin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, nonce, signature }),
  });
  if (!exchangeRes.ok) {
    const { error } = (await exchangeRes.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(error ?? "Sign-in rejected by server.");
  }
  const { token } = (await exchangeRes.json()) as { token: string };

  // 4. Sign into Firebase ---------------------------------------------
  const credential = await signInWithCustomToken(firebaseAuth(), token);
  void recordActivity(credential.user, "login", "app", address);
  return credential.user;
}
