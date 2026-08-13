"use client";

import { useContext } from "react";
import { useConnection } from "wagmi";

import { BrowserWalletContext } from "./browserWallet";

export function resolveAppAccount({
  browserAddress,
  browserConnected,
  hasBrowserWallet,
  wagmiAddress,
  wagmiConnected,
}: {
  browserAddress?: string;
  browserConnected: boolean;
  hasBrowserWallet: boolean;
  wagmiAddress?: string;
  wagmiConnected: boolean;
}) {
  const address = hasBrowserWallet ? browserAddress : wagmiAddress;
  return {
    address,
    isConnected:
      Boolean(address) &&
      (hasBrowserWallet ? browserConnected : wagmiConnected),
  };
}

/**
 * Unified account view for product screens.
 *
 * Browser users authenticate through Privy (including Google/email embedded
 * wallets), while Mini App hosts still connect through wagmi. Product screens
 * must never read wagmi alone or a Google user will appear signed in but have
 * no account-scoped data.
 */
export function useAppAccount() {
  const connection = useConnection();
  const browserWallet = useContext(BrowserWalletContext);
  const resolved = resolveAppAccount({
    browserAddress: browserWallet?.address,
    browserConnected: browserWallet?.isConnected ?? false,
    hasBrowserWallet: browserWallet !== null,
    wagmiAddress: connection.address,
    wagmiConnected: connection.isConnected,
  });

  return {
    ...connection,
    ...resolved,
    identityLabel: browserWallet?.identityLabel,
  };
}
