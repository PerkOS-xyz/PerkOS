"use client";

import type { ReactNode } from "react";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { base, baseSepolia, celo } from "viem/chains";
import { robinhoodChain } from "../lib/chains";
import { DYNAMIC_ENVIRONMENT_ID } from "../lib/dynamicBrowser";
import { PERKOS_WALLET_LOGO, PERKOS_WALLET_STYLES, PERKOS_WALLET_LOCALE } from "../lib/dynamicBranding";

const networks = [base, celo, robinhoodChain, baseSepolia].map((chain) => ({
  chainId: chain.id,
  networkId: chain.id,
  chainName: chain.name,
  name: chain.name,
  nativeCurrency: chain.nativeCurrency,
  iconUrls: [],
  rpcUrls: [...chain.rpcUrls.default.http],
  blockExplorerUrls: [chain.blockExplorers.default.url],
}));

export function DynamicOuter({ children }: { children: ReactNode }) {
  return (
    <DynamicContextProvider
      theme="dark"
      locale={PERKOS_WALLET_LOCALE}
      settings={{
        environmentId: DYNAMIC_ENVIRONMENT_ID,
        walletConnectors: [EthereumWalletConnectors],
        // PerkOS verifies its own wallet nonce before issuing a Firebase session.
        initialAuthenticationMode: "connect-only",
        overrides: { evmNetworks: networks },
        appName: "PerkOS",
        // Absolute HTTPS URLs also work in wallet connector metadata and mobile handoffs.
        appLogoUrl: PERKOS_WALLET_LOGO,
        cssOverrides: PERKOS_WALLET_STYLES,
        privacyPolicyUrl: "https://perkos.xyz/privacy",
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}
