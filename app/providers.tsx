"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { wagmiConfig } from "./lib/wagmi";
import { OnboardingProvider } from "./lib/onboardingState";
import { AutoConnect } from "./components/AutoConnect";
import { useIsInMiniApp } from "./lib/useIsInMiniApp";
import { dynamicBrowserEnabled } from "./lib/dynamicBrowser";
import { DynamicOuter, DynamicWagmiConnector } from "./components/DynamicProvider";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Only mount Dynamic in a real browser tab (and only when an env id is
  // configured). Farcaster / Base App keep their host connectors untouched;
  // while the host is still resolving (null) we render the plain tree, so the
  // Mini App path is stable and never remounts.
  const isInMiniApp = useIsInMiniApp();
  const useDynamic = dynamicBrowserEnabled(isInMiniApp);

  const app = <OnboardingProvider>{children}</OnboardingProvider>;

  const tree = (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AutoConnect />
        {useDynamic ? (
          <DynamicWagmiConnector>{app}</DynamicWagmiConnector>
        ) : (
          app
        )}
        <Toaster richColors closeButton />
      </QueryClientProvider>
    </WagmiProvider>
  );

  return useDynamic ? <DynamicOuter>{tree}</DynamicOuter> : tree;
}
