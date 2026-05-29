"use client";

/**
 * Wallet -> Firebase sign-in shim.
 *
 * Delegates the nonce + signature + custom-token exchange to
 * `@perkos/shared-client`'s `signInWithWallet`, then finishes with the
 * Firebase `signInWithCustomToken` call (the shared helper deliberately
 * stops short of that so it stays framework-agnostic).
 *
 * `apiBase` resolves from `NEXT_PUBLIC_PERKOS_API_URL` at build time so
 * App can target the platform API at `https://api.perkos.xyz` (default,
 * Phase 1.2) and roll back to its own `/api/auth/*` routes by setting
 * the env var to an empty string for a release.
 */
import { signInWithCustomToken } from "firebase/auth";
import { signInWithWallet as sharedSignIn } from "@perkos/shared-client";

import { firebaseAuth } from "./firebase";

const apiBase =
  process.env.NEXT_PUBLIC_PERKOS_API_URL ?? "https://api.perkos.xyz";

export async function signInWithWallet(input: {
  address: string;
  signMessage: (message: string) => Promise<string>;
}) {
  const session = await sharedSignIn({
    address: input.address.toLowerCase() as `0x${string}`,
    signMessage: (message) =>
      input.signMessage(message) as Promise<`0x${string}`>,
    apiBase,
  });
  const credential = await signInWithCustomToken(firebaseAuth(), session.token);
  return credential.user;
}
