"use client";

/**
 * Landing-page CTA wrapper that routes Mini App users to /continue —
 * the dispatcher that reads the connected wallet's session and sends
 * them to /dashboard or the request-access form — while keeping the
 * regular sign-in / sign-up routes for browser users.
 *
 * Why this exists: inside Base App / Farcaster the wallet is already
 * connected, so the "choose your sign-up method" buttons on /sign-up
 * (and equivalent on /sign-in) are noise. Anyone who clicks "Get
 * started" or "Sign in" from the landing should skip straight to the
 * post-auth dispatcher.
 *
 * SSR safety: the hook starts at `null` on both server and first
 * client render, so `effectiveHref` matches across the hydration
 * boundary. It only swaps to /continue after the SDK resolves, which
 * happens after hydration.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { useIsInMiniApp } from "../lib/useIsInMiniApp";

type Props = {
  /** Destination for non-MiniApp visitors. Usually /sign-up or /sign-in. */
  href: string;
  className?: string;
  children: ReactNode;
};

export function SmartCTA({ href, className, children }: Props) {
  const isInMiniApp = useIsInMiniApp();
  const effectiveHref = isInMiniApp === true ? "/continue" : href;

  return (
    <Link href={effectiveHref} className={className}>
      {children}
    </Link>
  );
}
