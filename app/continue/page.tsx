"use client";

/**
 * /continue — dispatcher landing for users coming from the landing-page
 * CTAs inside a Mini App host (Base App / Farcaster).
 *
 * Inside a Mini App the wallet is already connected by AutoConnect, so
 * there is no point routing the user through /sign-up or /sign-in
 * (those are the host-less "choose a connect method" forms). This page
 * reads the resolved wallet session and dispatches to the right
 * destination:
 *
 *   - signed-in       → /dashboard
 *   - not-allowlisted → <AccessGate /> (request-access form)
 *   - loading|syncing → "Checking access…" splash
 *   - signed-out      → fall back to /sign-in so the user can still
 *                       connect manually if AutoConnect didn't fire
 *
 * Browser users are also welcome here — the same dispatch works for
 * anyone who already has a wallet connected.
 */

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AccessGate } from "../components/AccessGate";
import { useWalletSession } from "../lib/useWalletSession";

const LOADING_TIMEOUT_MS = 10_000;

export default function ContinuePage() {
  const router = useRouter();
  const session = useWalletSession();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (session.status === "signed-in") {
      router.replace("/dashboard");
      return;
    }
    if (session.status === "signed-out") {
      // No wallet at all — fall back to the manual sign-in screen. This
      // matters in a browser tab that opened /continue directly (e.g.
      // from a shared link) rather than via a landing-page CTA.
      router.replace("/sign-in");
    }
  }, [session.status, router]);

  // Escape hatch: if the session never resolves (Coinbase Wallet RN
  // can leave wagmi pinned in "reconnecting" indefinitely when the
  // host doesn't surface the wallet prompt), bounce to /sign-in
  // after 10s so the user isn't stranded on the splash forever.
  useEffect(() => {
    if (session.status !== "loading") return;
    const t = window.setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [session.status]);

  useEffect(() => {
    if (timedOut && session.status === "loading") {
      router.replace("/sign-in");
    }
  }, [timedOut, session.status, router]);

  if (session.status === "not-allowlisted" && session.address) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex-1">
          <AccessGate address={session.address} />
        </div>
        <div className="flex justify-center py-4">
          <Link
            href="/"
            className="text-xs text-[#7975a8] hover:text-[#ececff]"
          >
            ← Back to landing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-5"
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
        <p className="text-sm text-[#7975a8]">
          {session.status === "error"
            ? "Sign-in failed. Retrying…"
            : "Checking access…"}
        </p>
        {session.error ? (
          <p className="max-w-sm text-xs text-destructive">{session.error}</p>
        ) : null}
        <Link
          href="/"
          className="mt-2 text-xs text-[#7975a8] hover:text-[#ececff]"
        >
          ← Back to landing
        </Link>
      </div>
    </div>
  );
}
