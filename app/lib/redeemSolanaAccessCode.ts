"use client";

import { isSolanaWalletAddress } from "@perkos/shared-types";
import { solanaLoginEnabled } from "./solanaLogin";
import { abortableWalletPrompt } from "./walletSignInCoordinator";

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : data.error?.message ?? "Could not redeem the access code.");
  }
  return data;
}

export async function redeemSolanaAccessCode(input: {
  address: string;
  code: string;
  email: string;
  username: string;
  company?: string;
  website?: string;
}, signMessage: (message: string) => Promise<string>, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!solanaLoginEnabled() || !isSolanaWalletAddress(input.address)) throw new Error("Solana login is not available yet.");
  const challenge = await readResponse(await fetch("/api/platform/auth/access-code/nonce", {
    method: "POST", headers: { "content-type": "application/json" }, signal,
    body: JSON.stringify({ address: input.address }),
  }));
  if (typeof challenge.message !== "string" || typeof challenge.nonce !== "string") throw new Error("Invalid access code challenge.");
  signal.throwIfAborted();
  const signature = await abortableWalletPrompt(signMessage(challenge.message), signal);
  signal.throwIfAborted();
  const result = await readResponse(await fetch("/api/platform/auth/access-code/redeem", {
    method: "POST", headers: { "content-type": "application/json" }, signal,
    body: JSON.stringify({ ...input, nonce: challenge.nonce, signature }),
  }));
  signal.throwIfAborted();
  if (result.granted !== true) throw new Error("Access was not granted.");
}
