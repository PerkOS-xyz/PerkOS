"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { wagmiConfig } from "./lib/wagmi";
import { OnboardingProvider } from "./lib/onboardingState";
import { AutoConnect } from "./components/AutoConnect";
import { useIsInMiniApp } from "./lib/useIsInMiniApp";
import { dynamicBrowserEnabled } from "./lib/dynamicBrowser";
import { prepareFirestore } from "./lib/firebase";
import { isPublicPagePath } from "./lib/publicRoutes";

// Code-split: the Dynamic SDK ships only to the browser host, never to Farcaster
// or Base App. ssr:false keeps the browser-only SDK out of the plain tree
// is always what's server-rendered (isInMiniApp is null during SSR). The
// loading fallback matches the app background (#0e0716) to avoid a white flash
// while the chunk downloads.
const DynamicProviders = dynamic(() => import("./components/DynamicProviders"), {
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

  // Only wrap with Dynamic in a real browser tab (and only when an app id is
  // set). Farcaster / Base App keep their host connectors untouched and never
  // download Dynamic; while the host is still resolving (null) we render the
  // plain tree, so the Mini App path is stable.
  const isInMiniApp = useIsInMiniApp();

  // Public pages skip Dynamic. Swapping to the Dynamic tree remounts the whole
  // page behind a blank placeholder until the SDK downloads, which on a phone
  // hid the landing for seconds. Nothing on these pages reads the wallet.
  const publicPage = isPublicPagePath(usePathname());
  const walletHost = dynamicBrowserEnabled(isInMiniApp);

  // On a public page, start downloading the wallet SDK as soon as the visitor
  // points at, touches or focuses a link into the app, so sign-in does not
  // wait for it after the click.
  const preloadWallet = publicPage && walletHost;
  useEffect(() => {
    if (!preloadWallet) return;
    const onIntent = (event: Event) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      const href = link?.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      if (isPublicPagePath(href.split(/[?#]/)[0])) return;
      void import("./components/DynamicProviders");
    };
    const events = ["pointerover", "touchstart", "focusin"] as const;
    for (const type of events) document.addEventListener(type, onIntent, { passive: true });
    return () => {
      for (const type of events) document.removeEventListener(type, onIntent);
    };
  }, [preloadWallet]);

  if (!publicPage && walletHost) {
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
