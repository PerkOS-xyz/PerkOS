"use client";

import Image from "next/image";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

/**
 * Browser-only "Continue with email or wallet" button that opens Dynamic's
 * auth flow. Once the user connects, DynamicWalletBridge publishes the wallet
 * to DynamicWalletContext → useWalletSession flips to connected and the normal
 * sign-in flow (sign nonce → Firebase) proceeds, signing via Dynamic natively.
 *
 * Render ONLY when `dynamicBrowserEnabled()` is true — `useDynamicContext`
 * throws if the DynamicContextProvider isn't mounted.
 */
export function DynamicSignInButton() {
  const { setShowAuthFlow } = useDynamicContext();
  return (
    <button
      type="button"
      onClick={() => setShowAuthFlow(true)}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ec1b69] px-6 py-4 font-medium text-[#ececff] transition-opacity hover:opacity-90"
    >
      <Image src="/brand/icon-mail.svg" alt="" width={16} height={16} />
      <span className="text-base leading-none">Continue with email or wallet</span>
    </button>
  );
}
