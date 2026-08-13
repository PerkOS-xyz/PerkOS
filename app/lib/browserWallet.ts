"use client";

import { createContext } from "react";

/**
 * Provider-neutral wallet state used by the regular browser auth path.
 * Mini App hosts do not mount this context and continue to use wagmi directly.
 */
export type BrowserWalletState = {
  loading: boolean;
  address: string | undefined;
  /** Human-friendly Privy identity; never required for wallet operations. */
  identityLabel?: string;
  isConnected: boolean;
  signMessage: (message: string) => Promise<string>;
  logout: () => Promise<void>;
};

export const BrowserWalletContext = createContext<BrowserWalletState | null>(
  null,
);
