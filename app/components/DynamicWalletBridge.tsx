"use client";

import { type ReactNode, useMemo } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isEthereumWallet } from "@dynamic-labs/ethereum";
import { BrowserWalletContext, type BrowserWalletState } from "../lib/browserWallet";

export function DynamicWalletBridge({ children }: { children: ReactNode }) {
  const { sdkHasLoaded, primaryWallet, user, handleLogOut } = useDynamicContext();
  const identityLabel = user?.email;
  const value = useMemo<BrowserWalletState>(() => {
    const wallet = primaryWallet;
    const usable = sdkHasLoaded && wallet && isEthereumWallet(wallet)
      && /^0x[0-9a-f]{40}$/i.test(wallet.address);
    return {
      loading: !sdkHasLoaded,
      address: usable ? wallet.address : undefined,
      identityLabel,
      isConnected: Boolean(usable),
      signMessage: async (message: string) => {
        if (!usable) throw new Error("No EVM wallet is connected.");
        const signature = await wallet.signMessage(message);
        if (!signature) throw new Error("The wallet did not return a signature.");
        return signature;
      },
      logout: async () => { await handleLogOut(); },
    };
  }, [sdkHasLoaded, primaryWallet, identityLabel, handleLogOut]);
  return <BrowserWalletContext.Provider value={value}>{children}</BrowserWalletContext.Provider>;
}
