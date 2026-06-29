"use client";

import { createContext } from "react";

/**
 * Bridgeless Dynamic wallet state — modeled on PerkOS-Stack's WalletContext,
 * which runs the SAME wagmi v3 + Dynamic and works because it does NOT use
 * `@dynamic-labs/wagmi-connector`. That bridge drops the wagmi connection
 * mid-sign-in on v3 (ConnectorNotConnectedError). So in the browser path we
 * read the wallet straight from Dynamic (`useDynamicContext().primaryWallet`)
 * and sign with Dynamic's own signer, never touching the wagmi connector.
 *
 * Provided by <DynamicWalletBridge/> (browser/Dynamic path only). It's `null`
 * in the Farcaster / Base App Mini App hosts — there Dynamic isn't mounted and
 * useWalletSession keeps using wagmi exactly as before.
 */
export type DynamicWalletState = {
  address: string | undefined;
  isConnected: boolean;
  signMessage: (message: string) => Promise<string>;
};

export const DynamicWalletContext = createContext<DynamicWalletState | null>(
  null,
);
