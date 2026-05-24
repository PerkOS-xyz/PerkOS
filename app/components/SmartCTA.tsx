"use client";

/**
 * Landing-page CTA wrapper. Routes the user past /sign-up | /sign-in
 * (the connect-wallet forms) when there's no point showing them — i.e.
 * when the wallet is already connected, or when we're inside a Mini App
 * host where AutoConnect is about to connect it. Routes browser users
 * with no wallet to the original /sign-up | /sign-in destination.
 *
 * Why both signals (not just isInMiniApp):
 *
 *   - Mini App detection only fires when the page is loaded as a
 *     miniapp embed. A user opening app.perkos.xyz from Base App's
 *     in-app browser (URL bar) is technically NOT in a miniapp host —
 *     sdk.isInMiniApp() returns false — but their Base smart wallet
 *     can still be connected from a prior session.
 *
 *   - wagmi's isConnected lights up as soon as the store rehydrates
 *     the persisted session, covering the in-app browser case and any
 *     other "wallet already there" scenario.
 *
 * /continue reads useWalletSession and dispatches to /dashboard or to
 * the AccessGate request-access form. It is the right destination any
 * time we already have a wallet (or are about to).
 *
 * SSR safety: both hooks start at their disconnected/null default on
 * server and first client render, so effectiveHref matches across the
 * hydration boundary. It only swaps to /continue after wagmi rehydrates
 * or the SDK resolves, both of which happen after hydration.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { useAccount } from "wagmi";

import { useIsInMiniApp } from "../lib/useIsInMiniApp";

type Props = {
  /** Destination for non-MiniApp visitors with no wallet. Usually /sign-up or /sign-in. */
  href: string;
  className?: string;
  children: ReactNode;
};

export function SmartCTA({ href, className, children }: Props) {
  const isInMiniApp = useIsInMiniApp();
  const { isConnected } = useAccount();

  const skipConnectForm = isInMiniApp === true || isConnected;
  const effectiveHref = skipConnectForm ? "/continue" : href;

  return (
    <Link href={effectiveHref} className={className}>
      {children}
    </Link>
  );
}
