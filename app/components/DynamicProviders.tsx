"use client";

import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/sonner";
import { wagmiConfig } from "../lib/wagmi";
import { OnboardingProvider } from "../lib/onboardingState";
import { DynamicOuter } from "./DynamicProvider";
import { DynamicWalletBridge } from "./DynamicWalletBridge";

export default function DynamicProviders({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return (
    <DynamicOuter>
      <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
        <QueryClientProvider client={queryClient}>
          <DynamicWalletBridge>
            <OnboardingProvider>{children}</OnboardingProvider>
          </DynamicWalletBridge>
          <Toaster richColors closeButton />
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicOuter>
  );
}
