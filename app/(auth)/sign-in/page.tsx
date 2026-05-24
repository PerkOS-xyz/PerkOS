"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useConnect, useConnection, useDisconnect } from "wagmi";
import { formatAddress } from "../../lib/format";
import { useWalletSession } from "../../lib/useWalletSession";
import { useIsInMiniApp } from "../../lib/useIsInMiniApp";
import { AccessGate } from "../../components/AccessGate";

export default function SignInPage() {
  const router = useRouter();
  const { connectors, connect, isPending, error, reset } = useConnect();
  const { status, address } = useConnection();
  const { disconnect } = useDisconnect();
  const session = useWalletSession();
  const isInMiniApp = useIsInMiniApp();

  const baseAccountConnector = connectors.find((c) => c.id === "baseAccount");
  const injectedConnector = connectors.find((c) => c.id === "injected");

  const isConnected = status === "connected";
  const isReconnecting = status === "reconnecting";

  // wagmi half-hydrated state — a `current` connector UID is set in the
  // store but `useConnection` doesn't have an address. Manifests as a
  // pinned "Connector already connected." error under the sign-in
  // buttons (most common when reopening inside Base App). Clearing the
  // wagmi state via `disconnect()` is the standard escape hatch.
  const isStuckOnStaleConnector =
    error?.name === "ConnectorAlreadyConnectedError" ||
    error?.message?.toLowerCase().includes("already connected") === true;

  // Once the user has both wagmi + Firebase, send them on.
  useEffect(() => {
    if (session.status === "signed-in") {
      router.replace("/onboarding/welcome");
    }
  }, [session.status, router]);

  // Auto-recover from the half-hydrated wagmi state. Disconnect clears
  // the stale `current` connector UID in the store and reset() clears
  // useConnect's lingering error. AutoConnect's effect re-runs after
  // this and re-attempts the host-aware connect cleanly.
  useEffect(() => {
    if (!isStuckOnStaleConnector) return;
    disconnect();
    reset();
  }, [isStuckOnStaleConnector, disconnect, reset]);

  // Wallet connected but Firebase rejected the allowlist → request access UI.
  if (session.status === "not-allowlisted" && address) {
    return <AccessGate address={address} />;
  }

  return (
    <div className="flex w-[329px] flex-col gap-8 rounded-lg border border-[#530922] bg-[#0e0716] p-10 shadow-[0_0_5px_rgba(236,27,105,0.3)] md:w-[616px] md:gap-14">
      <div className="flex w-full flex-col items-center gap-6 md:gap-5">
        <Image
          src="/perkos-landing-logo.png"
          alt="PerkOS"
          width={175}
          height={175}
          priority
        />
      </div>

      <div className="flex w-full flex-col gap-2">
        {isConnected && address ? (
          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              disabled={session.status !== "signed-in"}
              onClick={() => router.replace("/onboarding/welcome")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ec1b69] px-6 py-4 font-medium text-[#ececff] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <span className="text-base leading-none">
                {session.status === "syncing"
                  ? "Signing you in…"
                  : `Continue as ${formatAddress(address)}`}
              </span>
            </button>
            {session.status === "error" ? (
              <button
                type="button"
                onClick={session.retry}
                className="text-center text-xs text-[#ec1b69] hover:underline"
              >
                Retry sign-in
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => disconnect()}
              className="text-center text-xs text-[#7975a8] hover:text-[#ececff]"
            >
              Use a different account
            </button>
          </div>
        ) : isInMiniApp === null ? (
          // Still resolving whether we're inside a Mini App host. Render
          // a neutral placeholder so we never flash the browser-mode
          // connect buttons inside Farcaster / Base App.
          <p className="text-center text-xs text-[#7975a8]">
            Loading…
          </p>
        ) : isInMiniApp ? (
          // Inside Farcaster / Base App — AutoConnect is running. The
          // moment the wallet is injected, this view rerenders with
          // `isConnected = true` and the "Continue as 0x…" button shows.
          <p className="text-center text-xs text-[#7975a8]">
            Connecting your wallet…
          </p>
        ) : isReconnecting || isStuckOnStaleConnector ? (
          // wagmi is rehydrating its store (or we just kicked it via
          // disconnect()+reset() to break out of the half-hydrated
          // trap). Don't render the buttons yet — the moment hydration
          // finishes we'll either flip to "Continue as 0x…" or, if
          // there is no persisted session, to the buttons below.
          <p className="text-center text-xs text-[#7975a8]">
            Restoring your session…
          </p>
        ) : (
          <div className="flex w-full flex-col gap-4">
            <button
              type="button"
              disabled={!baseAccountConnector || isPending || isReconnecting}
              onClick={() =>
                baseAccountConnector &&
                connect({ connector: baseAccountConnector })
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ec1b69] px-6 py-4 font-medium text-[#ececff] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Image src="/brand/icon-mail.svg" alt="" width={16} height={16} />
              <span className="text-base leading-none">Sign in with email</span>
            </button>

            <button
              type="button"
              disabled={!injectedConnector || isPending || isReconnecting}
              onClick={() =>
                injectedConnector && connect({ connector: injectedConnector })
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#1b1833] bg-[#0e0716] px-6 py-4 font-medium text-[#ececff] transition-colors hover:border-[#530922] disabled:opacity-60"
            >
              <Image src="/brand/icon-wallet.svg" alt="" width={16} height={16} />
              <span className="text-base leading-none">Sign in with wallet</span>
            </button>

            {isReconnecting ? (
              <p className="text-center text-xs text-[#7975a8]">
                Restoring previous session…
              </p>
            ) : null}
          </div>
        )}

        {error && !isStuckOnStaleConnector ? (
          <p className="px-2 text-center text-xs text-[#ec1b69]">{error.message}</p>
        ) : null}
        {session.error ? (
          <p className="px-2 text-center text-xs text-[#ec1b69]">
            {session.error}
          </p>
        ) : null}

        <div className="flex h-11 w-full items-center justify-center gap-2 text-sm">
          <span className="text-[#7975a8] opacity-90">Don&apos;t have an account?</span>
          <Link href="/sign-up" className="text-[#ececff] opacity-90 hover:opacity-100">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
