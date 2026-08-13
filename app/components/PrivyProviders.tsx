"use client";

import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/sonner";
import { wagmiConfig } from "../lib/wagmi";
import { OnboardingProvider } from "../lib/onboardingState";
import { PrivyOuter } from "./PrivyProvider";
import { PrivyWalletBridge } from "./PrivyWalletBridge";

export default function PrivyProviders({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return (
    <PrivyOuter>
      <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
        <QueryClientProvider client={queryClient}>
          <PrivyWalletBridge>
            <OnboardingProvider>{children}</OnboardingProvider>
          </PrivyWalletBridge>
          <Toaster richColors closeButton />
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyOuter>
  );
}
