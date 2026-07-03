"use client";

import Image from "next/image";
import Link from "next/link";
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

  // Hand off to /continue's dispatcher (→ /dashboard or AccessGate) for an
  // already-connected wallet, so a returning user doesn't sit on the connect
  // buttons — inside a Mini App host (wallet auto-connects) OR when wagmi
  // already holds a connected wallet (in-app browser / persisted session).
  //
  // ONLY once the session has SETTLED (signed-in or not-allowlisted). During
  // the transient states we must stay put:
  //  - signed-out: /continue bounces it straight back → /sign-in ↔ /continue
  //    infinite loop (a "reload" flicker, no console error since both are
  //    client-side router.replace);
  //  - loading / syncing: a sign-in is IN PROGRESS on this page (e.g. the
  //    wallet-signature popup is open). Handing off mid-sync navigates away
  //    from the page driving the signature and thrashes /sign-in ↔ /continue.
  // This matters on the browser/Dynamic path, where AutoConnect can connect
  // wagmi to a Coinbase EIP-6963 provider while the real sign-in runs through
  // Dynamic — so `isConnected` (wagmi) is true throughout the Dynamic sync.
  const sessionSettled =
    session.status === "signed-in" || session.status === "not-allowlisted";
  useEffect(() => {
    if (!sessionSettled) return;
    if (isInMiniApp === true || (isConnected && address)) {
      router.replace("/continue");
    }
  }, [isInMiniApp, isConnected, address, sessionSettled, router]);

  // Once the user has both wagmi + Firebase, send them on through /continue,
  // the single post-auth dispatcher (→ /dashboard). Do NOT route straight to
  // /onboarding/welcome: that forced the setup wizard on EVERY sign-in,
  // including returning users with existing data (there's no reliable
  // new-vs-returning signal here — the onboarding flag is local-only). New
  // users land on the dashboard's empty state, which has a create-first-project
  // CTA; the guided wizard stays available but isn't forced.
  useEffect(() => {
    if (session.status === "signed-in") {
      router.replace("/continue");
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

  // Which wallet drives the UI. In the browser/Dynamic path the wallet is
  // Dynamic (read from the session); wagmi may hold a STALE persisted
  // connection there (a prior injected/EIP-6963 login, wallet now locked so
  // eth_accounts is empty), and we must NOT let that show a disabled
  // "Continue as 0x…" and hide the Dynamic connect button — that strands the
  // user with no way to connect and no popup. In Mini App hosts wagmi IS the
  // wallet source.
  const connectedAddress = dynamicEnabled
    ? session.address
    : isConnected
      ? address
      : undefined;

  const handleUseDifferentAccount = () => {
    // Dynamic owns the wallet in the browser path, so fully log out (Dynamic +
    // Firebase) — a bare wagmi disconnect() wouldn't clear it. wagmi elsewhere.
    if (dynamicEnabled) {
      void session.logout();
    } else {
      disconnect();
    }
  };

  // Wallet connected but Firebase rejected the allowlist → request access UI.
  if (session.status === "not-allowlisted" && session.address) {
    return <AccessGate address={session.address} />;
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
        {connectedAddress ? (
          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              disabled={session.status !== "signed-in"}
              onClick={() => router.replace("/continue")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ec1b69] px-6 py-4 font-medium text-[#ececff] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <span className="text-base leading-none">
                {session.status === "syncing"
                  ? t("signIn.signingIn")
                  : t("signIn.continueAs", {
                      address: formatAddress(connectedAddress),
                    })}
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
              onClick={handleUseDifferentAccount}
              className="text-center text-xs text-[#7975a8] hover:text-[#ececff]"
            >
              {t("signIn.useDifferentAccount")}
            </button>
          </div>
        ) : dynamicEnabled ? (
          // Browser + Dynamic configured → Dynamic's connect modal (email /
          // social / external + embedded wallet). Keyed off the SESSION above
          // (Dynamic), NOT wagmi — a stale persisted wagmi connection must not
          // hide this button. Checked before the wagmi-state branches below so
          // the browser path never falls into them.
          <div className="flex w-full flex-col gap-4">
            <DynamicSignInButton />
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

        <Link
          href="/"
          className="mt-2 text-center text-xs text-[#7975a8] transition-colors hover:text-[#ececff]"
        >
          ← {t("signIn.backToLanding")}
        </Link>
      </div>
    </div>
  );
}
