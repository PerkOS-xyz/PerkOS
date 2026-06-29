"use client";

import { type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/sonner";
import { wagmiConfig } from "../lib/wagmi";
import { OnboardingProvider } from "../lib/onboardingState";
import { AutoConnect } from "./AutoConnect";
import { DynamicOuter } from "./DynamicProvider";
import { DynamicWalletBridge } from "./DynamicWalletBridge";

/**
 * Full provider stack WITH Dynamic, kept in its own module so providers.tsx can
 * pull it via `next/dynamic` — the @dynamic-labs SDK then code-splits into an
 * async chunk that only the browser host downloads (never Farcaster / Base App).
 *
 * Mirrors the plain stack in providers.tsx, wrapped by DynamicContextProvider
 * (outermost, canonical). We deliberately do NOT use @dynamic-labs/wagmi-connector
 * to bridge Dynamic into wagmi — that bridge drops the connection on wagmi v3
 * (ConnectorNotConnectedError on sign-in). Instead DynamicWalletBridge exposes
 * Dynamic's wallet straight to useWalletSession (same approach as PerkOS-Stack).
 * The QueryClient is created once in providers.tsx and passed down so it's the
 * same instance across the plain ↔ Dynamic switch.
 */
export default function DynamicProviders({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return (
    <DynamicOuter>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <AutoConnect />
          {/* Bridgeless: Dynamic owns the wallet directly (no
              DynamicWagmiConnector — it drops the connection on wagmi v3).
              DynamicWalletBridge publishes Dynamic's wallet to useWalletSession. */}
          <DynamicWalletBridge>
            <OnboardingProvider>{children}</OnboardingProvider>
          </DynamicWalletBridge>
          <Toaster richColors closeButton />
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicOuter>
  );
}
