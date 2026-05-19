"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { wagmiConfig } from "./lib/wagmi";
import { OnboardingProvider } from "./lib/onboardingState";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnboardingProvider>{children}</OnboardingProvider>
        <Toaster richColors closeButton />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
