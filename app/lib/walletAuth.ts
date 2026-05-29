"use client";

/**
 * Wallet -> Firebase sign-in shim.
 *
 * Delegates the nonce + signature + custom-token exchange to
 * `@perkos/shared-client`'s `signInWithWallet`, then finishes with the
 * Firebase `signInWithCustomToken` call (the shared helper deliberately
 * stops short of that so it stays framework-agnostic).
 *
 * `apiBase: ""` means we hit App's own `/api/auth/nonce` and
 * `/api/auth/wallet-signin` routes — Phase 1.2 will flip this to
 * `https://api.perkos.xyz` once the backbone migration completes.
 */
import { signInWithCustomToken } from "firebase/auth";
import { signInWithWallet as sharedSignIn } from "@perkos/shared-client";

import { firebaseAuth } from "./firebase";

export async function signInWithWallet(input: {
  address: string;
  signMessage: (message: string) => Promise<string>;
}) {
  const session = await sharedSignIn({
    address: input.address.toLowerCase() as `0x${string}`,
    signMessage: (message) =>
      input.signMessage(message) as Promise<`0x${string}`>,
    apiBase: "",
  });
  const credential = await signInWithCustomToken(firebaseAuth(), session.token);
  return credential.user;
}
