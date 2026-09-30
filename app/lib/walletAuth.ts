"use client";

import { signInWithCustomToken, signOut } from "firebase/auth";

import { firebaseAuth } from "./firebase";
import { recordActivity } from "./activityTelemetry";
import { normalizeWalletAddress, walletChain } from "@perkos/shared-types";
import { solanaLoginEnabled } from "./solanaLogin";
import { abortableWalletPrompt } from "./walletSignInCoordinator";

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
  signal?: AbortSignal;
}) {
  const assertCurrent = () => input.signal?.throwIfAborted();
  assertCurrent();
  const chain = walletChain(input.address);
  if (!chain) throw new Error("Invalid wallet address.");
  if (chain === "solana" && !solanaLoginEnabled()) throw new Error("Solana login is not available yet.");
  const address = normalizeWalletAddress(input.address);
  // Solana proofs are verified centrally; retain the existing EVM flow unchanged.
  const authBase = chain === "solana" ? "/api/platform/auth" : "/api/auth";

  // 1. Nonce -----------------------------------------------------------
  const nonceRes = await fetch(
    `${authBase}/nonce?address=${encodeURIComponent(address)}`,
    { signal: input.signal },
  );
  if (!nonceRes.ok) {
    const { error } = (await nonceRes.json().catch(() => ({}))) as {
      error?: string | { message?: string };
    };
    throw new Error(typeof error === "string" ? error : error?.message ?? "Couldn't request a sign-in nonce.");
  }
  const { nonce, message } = (await nonceRes.json()) as {
    nonce: string;
    message: string;
  };

  // 2. Wallet signs ----------------------------------------------------
  assertCurrent();
  const signature = await abortableWalletPrompt(input.signMessage(message), input.signal);
  assertCurrent();

  // 3. Exchange for Firebase custom token ------------------------------
  const exchangeRes = await fetch(`${authBase}/wallet-signin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: input.signal,
    body: JSON.stringify({ address, nonce, signature, ...(chain === "solana" ? { chain } : {}) }),
  });
  if (!exchangeRes.ok) {
    const { error } = (await exchangeRes.json().catch(() => ({}))) as {
      error?: string | { message?: string };
    };
    throw new Error(typeof error === "string" ? error : error?.message ?? "Sign-in rejected by server.");
  }
  const { token } = (await exchangeRes.json()) as { token: string };

  // 4. Sign into Firebase ---------------------------------------------
  assertCurrent();
  const auth = firebaseAuth();
  if (auth.currentUser && auth.currentUser.uid !== address) {
    await signOut(auth);
    assertCurrent();
  }
  const credential = await signInWithCustomToken(auth, token);
  // The coordinator serializes commits, so cleanup cannot sign out a newer
  // account. Never record activity for a cancelled or mismatched identity.
  if (input.signal?.aborted || credential.user.uid !== address) {
    await signOut(auth);
    assertCurrent();
    throw new Error("The sign-in identity did not match the connected wallet.");
  }
  void recordActivity(credential.user, "login", "app", address);
  return credential.user;
}
