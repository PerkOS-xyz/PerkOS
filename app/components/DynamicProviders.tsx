"use client";

import { type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/sonner";
import { wagmiConfig } from "../lib/wagmi";
import { OnboardingProvider } from "../lib/onboardingState";
import { AutoConnect } from "./AutoConnect";
import { DynamicOuter, DynamicWagmiConnector } from "./DynamicProvider";

/**
 * Full provider stack WITH Dynamic, kept in its own module so providers.tsx can
 * pull it via `next/dynamic` — the @dynamic-labs SDK then code-splits into an
 * async chunk that only the browser host downloads (never Farcaster / Base App).
 *
 * Mirrors the plain stack in providers.tsx, wrapped by DynamicContextProvider
 * (outermost, canonical) + DynamicWagmiConnector (inside Wagmi + QueryClient).
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
          <DynamicWagmiConnector>
            <OnboardingProvider>{children}</OnboardingProvider>
          </DynamicWagmiConnector>
          <Toaster richColors closeButton />
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicOuter>
  );
}
