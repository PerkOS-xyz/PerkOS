"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useConnect, useConnection, useDisconnect } from "wagmi";
import { formatAddress } from "../../lib/format";
import { useWalletSession } from "../../lib/useWalletSession";
import { useIsInMiniApp } from "../../lib/useIsInMiniApp";
import { dynamicBrowserEnabled } from "../../lib/dynamicBrowser";
import { AccessGate } from "../../components/AccessGate";

// Code-split: @dynamic-labs loads only when the Dynamic browser button is
// actually rendered (browser + env id set).
const DynamicSignInButton = dynamic(
  () =>
    import("../../components/DynamicSignInButton").then(
      (m) => m.DynamicSignInButton,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[56px] w-full animate-pulse rounded-lg bg-[#ec1b69]/30" />
    ),
  },
);

export default function SignInPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { connectors, connect, isPending, error, reset } = useConnect();
  const { status, address } = useConnection();
  const { disconnect } = useDisconnect();
  const session = useWalletSession();
  const isInMiniApp = useIsInMiniApp();
  // In a browser (with Dynamic configured) offer Dynamic's connect modal
  // instead of the baseAccount / injected buttons. Off everywhere else.
  const dynamicEnabled = dynamicBrowserEnabled(isInMiniApp);

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

  // Hand off to /continue (the dispatcher → /dashboard or AccessGate) when
  // there's no point showing the connect buttons — inside a Mini App host
  // (wallet auto-connects) OR when wagmi already holds a connected wallet
  // (in-app browser / persisted session).
  //
  // BUT never hand off a `signed-out` session: /continue bounces any
  // signed-out session straight back to /sign-in, so redirecting there
  // creates an infinite /sign-in ↔ /continue loop (seen as a "reload"
  // flicker, no console error since both are client-side router.replace).
  // This bites the browser/Dynamic path, where useWalletSession reads
  // Dynamic (signed-out) while wagmi may still report a stale persisted
  // connection, and any case where isInMiniApp is a false positive.
  useEffect(() => {
    // TODO(i18n-cleanup): the [perkos:auth] console logs are temporary
    // diagnostics for the /sign-in ↔ /continue reload loop; remove once
    // confirmed fixed in prod.
    if (session.status === "signed-out") {
      if (isInMiniApp === true || (isConnected && address)) {
        console.log(
          "[perkos:auth] sign-in: holding (session signed-out, not handing off to /continue)",
          { isInMiniApp, wagmiConnected: isConnected, address },
        );
      }
      return;
    }
    if (isInMiniApp === true || (isConnected && address)) {
      console.log("[perkos:auth] sign-in → /continue", {
        isInMiniApp,
        wagmiConnected: isConnected,
        address,
        sessionStatus: session.status,
      });
      router.replace("/continue");
    }
  }, [isInMiniApp, isConnected, address, session.status, router]);

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
                  ? t("signIn.signingIn")
                  : t("signIn.continueAs", { address: formatAddress(address) })}
              </span>
            </button>
            {session.status === "error" ? (
              <button
                type="button"
                onClick={session.retry}
                className="text-center text-xs text-[#ec1b69] hover:underline"
              >
                {t("signIn.retry")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => disconnect()}
              className="text-center text-xs text-[#7975a8] hover:text-[#ececff]"
            >
              {t("signIn.useDifferentAccount")}
            </button>
          </div>
        ) : isInMiniApp === null ? (
          // Still resolving whether we're inside a Mini App host. Render
          // a neutral placeholder so we never flash the browser-mode
          // connect buttons inside Farcaster / Base App.
          <p className="text-center text-xs text-[#7975a8]">
            {t("common.loading")}
          </p>
        ) : isInMiniApp ? (
          // Inside Farcaster / Base App — AutoConnect is running. The
          // moment the wallet is injected, this view rerenders with
          // `isConnected = true` and the "Continue as 0x…" button shows.
          <p className="text-center text-xs text-[#7975a8]">
            {t("signIn.connectingWallet")}
          </p>
        ) : isReconnecting || isStuckOnStaleConnector ? (
          // wagmi is rehydrating its store (or we just kicked it via
          // disconnect()+reset() to break out of the half-hydrated
          // trap). Don't render the buttons yet — the moment hydration
          // finishes we'll either flip to "Continue as 0x…" or, if
          // there is no persisted session, to the buttons below.
          <p className="text-center text-xs text-[#7975a8]">
            {t("signIn.restoringSession")}
          </p>
        ) : dynamicEnabled ? (
          // Browser + Dynamic configured → Dynamic's connect modal (email /
          // social / external + embedded wallet). On connect, the wallet syncs
          // into wagmi and this view flips to the "Continue as 0x…" branch.
          <div className="flex w-full flex-col gap-4">
            <DynamicSignInButton />
          </div>
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
              <span className="text-base leading-none">{t("signIn.withEmail")}</span>
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
              <span className="text-base leading-none">{t("signIn.withWallet")}</span>
            </button>

            {isReconnecting ? (
              <p className="text-center text-xs text-[#7975a8]">
                {t("signIn.restoringPreviousSession")}
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
      </div>
    </div>
  );
}
