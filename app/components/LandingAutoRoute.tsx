"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { useIsInMiniApp } from "../lib/useIsInMiniApp";
import { useWalletSession } from "../lib/useWalletSession";

/**
 * Sends the visitor straight into the app whenever the marketing landing
 * isn't the right destination:
 *
 *   - Inside Farcaster / Base App / any Mini App host → /sign-in. The
 *     wallet auto-connects there and the sign-in page forwards onward
 *     once the Firebase session is ready. Showing the long marketing
 *     pitch on every relaunch was the bug we're fixing — Base App users
 *     reopening the app could not get past the landing.
 *
 *   - Already-signed-in browser users → /dashboard. Returning users with
 *     a live wagmi + Firebase session don't need to re-read the pitch.
 *
 * Bots and first-time browser visitors see the SSR'd marketing landing
 * unchanged — this component renders nothing in that case so it never
 * blocks SEO crawlers from indexing the page.
 *
 * The full-screen overlay is mounted only when we know we're inside a
 * Mini App host or while a redirect is in flight; otherwise we don't
 * cover the landing, to avoid flashing a splash to first-time visitors.
 */
export function LandingAutoRoute() {
  const router = useRouter();
  const isInMiniApp = useIsInMiniApp();
  const session = useWalletSession();
  const redirected = useRef(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (redirected.current) return;
    if (isInMiniApp === null) return; // SDK still resolving — wait.

    if (isInMiniApp) {
      redirected.current = true;
      setRedirecting(true);
      router.replace("/sign-in");
      return;
    }

    if (session.status === "signed-in") {
      redirected.current = true;
      setRedirecting(true);
      router.replace("/dashboard");
    }
  }, [isInMiniApp, session.status, router]);

  const showOverlay = isInMiniApp === true || redirecting;
  if (!showOverlay) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "#0e0716",
        backgroundImage:
          "radial-gradient(ellipse 60% 35% at 50% 110%, rgba(236,27,105,0.55) 0%, rgba(236,27,105,0.18) 45%, transparent 75%)",
      }}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Image
          src="/perkos-header.png"
          alt="PerkOS"
          width={140}
          height={32}
          priority
        />
        <p className="text-sm text-muted-foreground">Opening PerkOS…</p>
      </div>
    </div>
  );
}
