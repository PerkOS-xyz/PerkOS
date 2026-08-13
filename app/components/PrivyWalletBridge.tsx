"use client";

import { type ReactNode, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

import {
  BrowserWalletContext,
  type BrowserWalletState,
} from "../lib/browserWallet";

export function PrivyWalletBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();

  const preferredAddress = user?.wallet?.address?.toLowerCase();
  const wallet =
    wallets.find((candidate) =>
      preferredAddress
        ? candidate.address.toLowerCase() === preferredAddress
        : candidate.walletClientType === "privy",
    ) ?? wallets[0];

  const value = useMemo<BrowserWalletState>(() => {
    const address = wallet?.address;
    const isEvm = /^0x[0-9a-f]{40}$/i.test(address ?? "");
    if (!ready || !walletsReady || !authenticated || !wallet || !isEvm) {
      return {
        loading: !ready || !walletsReady || (authenticated && !wallet),
        address: undefined,
        isConnected: false,
        signMessage: async () => {
          throw new Error("No Privy wallet is connected.");
        },
        logout,
      };
    }

    return {
      loading: false,
      address,
      isConnected: true,
      signMessage: (message: string) => wallet.sign(message),
      logout,
    };
  }, [ready, walletsReady, authenticated, wallet, logout]);

  return (
    <BrowserWalletContext.Provider value={value}>
      {children}
    </BrowserWalletContext.Provider>
  );
}
