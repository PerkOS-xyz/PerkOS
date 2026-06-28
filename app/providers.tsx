"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { wagmiConfig } from "./lib/wagmi";
import { OnboardingProvider } from "./lib/onboardingState";
import { AutoConnect } from "./components/AutoConnect";
import { useIsInMiniApp } from "./lib/useIsInMiniApp";
import { dynamicBrowserEnabled } from "./lib/dynamicBrowser";

// Code-split: the @dynamic-labs SDK ships only to the browser host, never to
// Farcaster / Base App. ssr:false — Dynamic is browser-only and the plain tree
// is always what's server-rendered (isInMiniApp is null during SSR). The
// loading fallback matches the app background (#0e0716) to avoid a white flash
// while the chunk downloads.
const DynamicProviders = dynamic(() => import("./components/DynamicProviders"), {
  ssr: false,
  loading: () => <div style={{ minHeight: "100vh", background: "#0e0716" }} />,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Only wrap with Dynamic in a real browser tab (and only when an env id is
  // set). Farcaster / Base App keep their host connectors untouched and never
  // download Dynamic; while the host is still resolving (null) we render the
  // plain tree, so the Mini App path is stable.
  const isInMiniApp = useIsInMiniApp();

  if (dynamicBrowserEnabled(isInMiniApp)) {
    return (
      <DynamicProviders queryClient={queryClient}>{children}</DynamicProviders>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AutoConnect />
        <OnboardingProvider>{children}</OnboardingProvider>
        <Toaster richColors closeButton />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
