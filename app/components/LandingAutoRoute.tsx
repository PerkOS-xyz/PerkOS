"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";

import { useWalletSession } from "../lib/useWalletSession";

/**
 * Sends already-signed-in browser users straight to /dashboard so
 * returning users don't have to re-read the marketing pitch.
 *
 * Mini App visitors are intentionally NOT redirected from here — they
 * see the landing and use the CTAs (which `<SmartCTA />` rewrites to
 * /continue) to enter the app. Routing them away from the landing
 * automatically would skip the pitch on every relaunch, and would also
 * collide with the dispatch logic in /continue.
 *
 * Bots and first-time browser visitors see the SSR'd marketing landing
 * unchanged — this component renders nothing in that case so it never
 * blocks SEO crawlers from indexing the page.
 */
export function LandingAutoRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useWalletSession();
  const redirected = useRef(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (redirected.current) return;
    // This component belongs to the marketing landing, but a cached or
    // concurrently-hydrating landing tree can briefly survive while Next is
    // entering a deep route. Never let that stale effect override the URL the
    // user explicitly opened.
    if (pathname !== "/" || window.location.pathname !== "/") return;
    if (session.status !== "signed-in") return;

    // Explicit landing view (e.g. the in-app logo links to /?home): the user
    // asked to see the marketing page, so don't bounce them back to the app.
    try {
      if (new URLSearchParams(window.location.search).has("home")) return;
    } catch {
      // window unavailable — fall through to the normal redirect
    }

    redirected.current = true;
    // Defer the visual transition to the next frame. The effect's primary job
    // remains synchronizing the router, and we avoid a synchronous cascading
    // render while React is flushing effects.
    const frame = window.requestAnimationFrame(() => setRedirecting(true));
    router.replace("/dashboard");
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, session.status, router]);

  if (!redirecting) return null;

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
