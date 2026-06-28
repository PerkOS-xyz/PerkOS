"use client";

import { type ReactNode } from "react";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
// Future (roadmap item 7 — Solana wallets):
//   import { SolanaWalletConnectors } from "@dynamic-labs/solana";
// then add it to `walletConnectors` below — one modal, EVM + SVM.
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";

import { DYNAMIC_ENV_ID } from "../lib/dynamicBrowser";

/**
 * Outer half of the Dynamic provider tree — wraps the whole WagmiProvider
 * (Dynamic's canonical ordering: DynamicContextProvider outermost). Mount
 * ONLY when `dynamicBrowserEnabled()` is true (browser + env id set).
 */
export function DynamicOuter({ children }: { children: ReactNode }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: DYNAMIC_ENV_ID,
        // EVM (Base / Celo) today. Append SolanaWalletConnectors here when the
        // Solana path lands — Dynamic surfaces both in a single connect modal.
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}

/**
 * Inner half — bridges Dynamic's connected wallet into the existing wagmi
 * config so the rest of the app (useAccount / useConnection / signInWithWallet)
 * keeps working unchanged. Must render inside WagmiProvider + QueryClientProvider.
 */
export { DynamicWagmiConnector };
