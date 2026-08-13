"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { base, baseSepolia, celo } from "viem/chains";

import { robinhoodChain } from "../lib/chains";
import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from "../lib/privyBrowser";

export function PrivyOuter({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID || undefined}
      config={{
        loginMethodsAndOrder: {
          primary: ["google", "email"],
          overflow: [
            "base_account",
            "coinbase_wallet",
            "metamask",
            "detected_ethereum_wallets",
            "wallet_connect_qr",
          ],
        },
        supportedChains: [base, celo, robinhoodChain, baseSepolia],
        defaultChain: base,
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        appearance: {
          theme: "dark",
          accentColor: "#ec1b69",
          logo: "/perkos-landing-logo.png",
          showWalletLoginFirst: false,
          walletList: [
            "base_account",
            "coinbase_wallet",
            "metamask",
            "detected_ethereum_wallets",
            "wallet_connect_qr",
          ],
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
