"use client";

/**
 * Landing-page CTA wrapper that does the right thing for every host
 * we might be loaded inside:
 *
 *   1. wagmi already isConnected, or sdk.isInMiniApp() === true
 *      → route to /continue. The dispatcher there will read the
 *        session and forward to /dashboard or the AccessGate.
 *
 *   2. Coinbase Smart Wallet is announced via EIP-6963 but wagmi has
 *      not connected yet (typical for Base App's in-app browser —
 *      auto-connect from a useEffect gets silently denied because the
 *      wallet requires a user gesture for eth_requestAccounts). On
 *      click we call connectAsync({ connector: coinbase }) ourselves,
 *      which IS a user gesture, then route to /continue. Shows a
 *      "Connecting…" label on the button while the prompt is up.
 *
 *   3. No wallet signal at all (plain browser) → follow the original
 *      href to /sign-up or /sign-in so the user can pick a method.
 *
 * Why we keep AutoConnect for the EIP-6963 case too: when the wallet
 * has already authorised app.perkos.xyz in a previous session, wagmi
 * rehydrates silently without needing a user click, and isConnected
 * flips before the user even taps anything. The click-time connect is
 * the fallback for the first-time authorisation.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";
import {
  useAccount,
  useConnect,
  useConnectors,
  useDisconnect,
  type Connector,
} from "wagmi";
import { toast } from "sonner";

import { useIsInMiniApp } from "../lib/useIsInMiniApp";
import { trackEvent } from "../lib/analytics";

const COINBASE_WALLET_RDNS = "com.coinbase.wallet";

function rdnsOf(connector: Connector): string | undefined {
  const c = connector as Connector & {
    rdns?: string;
    info?: { rdns?: string };
  };
  return c.rdns ?? c.info?.rdns;
}

type Props = {
  /** Destination for visitors with no wallet signal at all. Usually /sign-up or /sign-in. */
  href: string;
  className?: string;
  children: ReactNode;
  /** Stable funnel label shown in GA4 reports. */
  analyticsId?: string;
};

export function SmartCTA({ href, className, children, analyticsId = "generic" }: Props) {
  const router = useRouter();
  const isInMiniApp = useIsInMiniApp();
  const { isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const connectors = useConnectors();
  const [busy, setBusy] = useState(false);

  const coinbaseConnector = connectors.find(
    (c) => c.id === COINBASE_WALLET_RDNS || rdnsOf(c) === COINBASE_WALLET_RDNS,
  );

  const skipConnectForm = isInMiniApp === true || isConnected;

  // SSR-safe href: we never advertise /continue at render time. The
  // click handler decides what to do based on live wallet state, and
  // the href is only used as a fallback when none of the special
  // cases apply (or when JS is disabled).
  const fallbackHref = href;

  async function onClick(e: MouseEvent<HTMLAnchorElement>) {
    trackEvent("begin_signup", {
      cta_id: analyticsId,
      destination: href,
      host_context: isInMiniApp ? "mini_app" : "web",
    });

    if (skipConnectForm) {
      e.preventDefault();
      router.push("/continue");
      return;
    }

    if (coinbaseConnector) {
      // User gesture path: this click IS the gesture wallets require
      // before they'll process eth_requestAccounts. Auto-connect from
      // AutoConnect's useEffect tends to be silently denied here.
      e.preventDefault();
      setBusy(true);
      try {
        await connectAsync({ connector: coinbaseConnector });
        router.push("/continue");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        const isAlreadyConnected =
          err instanceof Error &&
          (err.name === "ConnectorAlreadyConnectedError" ||
            message.toLowerCase().includes("already connected"));

        // Half-hydrated wagmi trap: the store has a `current`
        // connector UID set but useAccount hasn't hydrated. Reconnect
        // can resolve "successfully" without actually re-injecting
        // the account in some hosts (Coinbase Wallet RN webview),
        // leaving the rest of the app stuck on "loading". Force-clear
        // via disconnect and re-issue connect in one cycle so a
        // single tap takes the user all the way through.
        if (isAlreadyConnected) {
          try {
            await disconnectAsync();
            await connectAsync({ connector: coinbaseConnector });
            router.push("/continue");
            return;
          } catch (retryErr) {
            const retryMessage =
              retryErr instanceof Error ? retryErr.message : "Unknown error";
            toast("Couldn't connect wallet", { description: retryMessage });
            return;
          }
        }

        // Stay on landing — sign-up would be confusing (wallet IS
        // available, user just declined or the wallet errored). Split
        // friendly toast for user rejection vs surfacing the real
        // error for everything else.
        const isUserReject = /reject|denied|cancel|abort|dismiss/i.test(
          message,
        );
        toast(
          isUserReject
            ? "Wallet connection cancelled"
            : "Couldn't connect wallet",
          {
            description: isUserReject
              ? "Tap the button again when you're ready."
              : message,
          },
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    // No wallet signal at all — Link's default behavior takes over,
    // navigating to /sign-up | /sign-in.
  }

  return (
    <Link
      href={fallbackHref}
      onClick={onClick}
      className={className}
      aria-busy={busy || undefined}
    >
      {busy ? "Connecting…" : children}
    </Link>
  );
}
