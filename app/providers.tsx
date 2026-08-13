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
import { privyBrowserEnabled } from "./lib/privyBrowser";
import { prepareFirestore } from "./lib/firebase";

// Code-split: the Privy SDK ships only to the browser host, never to Farcaster
// or Base App. ssr:false keeps the browser-only SDK out of the plain tree
// is always what's server-rendered (isInMiniApp is null during SSR). The
// loading fallback matches the app background (#0e0716) to avoid a white flash
// while the chunk downloads.
const PrivyProviders = dynamic(() => import("./components/PrivyProviders"), {
  ssr: false,
  loading: () => <div style={{ minHeight: "100vh", background: "#0e0716" }} />,
});

export function Providers({ children }: { children: ReactNode }) {
  // Configure Firestore (auto-detect long-polling) before any descendant's
  // useFirebaseUser calls getFirestore — a lazy-init runs once, during this
  // root render, ahead of child renders. Kills the benign /Listen/channel 400s.
  useState(() => {
    prepareFirestore();
    return null;
  });

  const [queryClient] = useState(() => new QueryClient());

  // Only wrap with Privy in a real browser tab (and only when an app id is
  // set). Farcaster / Base App keep their host connectors untouched and never
  // download Privy; while the host is still resolving (null) we render the
  // plain tree, so the Mini App path is stable.
  const isInMiniApp = useIsInMiniApp();

  if (privyBrowserEnabled(isInMiniApp)) {
    return (
      <PrivyProviders queryClient={queryClient}>{children}</PrivyProviders>
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
