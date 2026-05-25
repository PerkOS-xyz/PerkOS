"use client";

/**
 * Auto-connect the right wallet based on where we are loaded.
 *
 * Three host contexts we care about:
 *
 *   1. Farcaster Mini App host (Warpcast / Farcaster app, clientFid 9152)
 *      → farcasterMiniApp connector. Picks up the user's pre-authorized
 *      Farcaster wallet.
 *
 *   2. Base App Mini App host (clientFid 309857)
 *      → baseAccount connector. Picks up the user's Base smart wallet.
 *
 *   3. Base App's in-app browser (NOT a Mini App host — sdk.isInMiniApp()
 *      returns false) — but the host injects the user's Coinbase Smart
 *      Wallet as an EIP-6963 provider. wagmi v3 auto-discovers EIP-6963
 *      providers and exposes them as connectors. We look for the one
 *      whose rdns is "com.coinbase.wallet" and connect through it so
 *      the user doesn't see the manual sign-up buttons.
 *
 * Anywhere else (plain Safari without a Coinbase provider) we do
 * nothing and the user uses the /sign-up | /sign-in connect buttons.
 *
 * Recovery from the "Connector already connected" trap
 * ----------------------------------------------------
 * wagmi v3 throws `ConnectorAlreadyConnectedError` from `connect()` when
 * the store's `current` connector UID is set but `useAccount` hasn't
 * hydrated the address yet (happens after a host restores a webview
 * session). We catch it and call reconnectAsync to finish the hydration
 * cleanly instead of surfacing the error.
 */

import { useEffect, useRef } from "react";
import {
  useAccount,
  useConnect,
  useConnectors,
  useReconnect,
  type Connector,
} from "wagmi";
import { sdk } from "@farcaster/miniapp-sdk";

// Public host IDs. Stable per host app.
const FARCASTER_CLIENT_FID = 9152;
const BASE_APP_CLIENT_FID = 309857;
const COINBASE_WALLET_RDNS = "com.coinbase.wallet";

/**
 * EIP-6963 providers are exposed by wagmi v3 either as a top-level
 * `rdns` on the connector or inside a nested `info.rdns`. Check both
 * so we are resilient to minor wagmi-version differences.
 */
function rdnsOf(connector: Connector): string | undefined {
  const c = connector as Connector & {
    rdns?: string;
    info?: { rdns?: string };
  };
  return c.rdns ?? c.info?.rdns;
}

export function AutoConnect() {
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const { connectAsync } = useConnect();
  const { reconnectAsync } = useReconnect();
  const connectors = useConnectors();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    if (isConnected || isConnecting || isReconnecting) return;

    let cancelled = false;

    (async () => {
      try {
        const inMiniApp = await sdk.isInMiniApp();
        if (cancelled) return;

        const findById = (id: string) =>
          connectors.find((c) => c.id === id);
        const findByRdns = (rdns: string) =>
          connectors.find((c) => c.id === rdns || rdnsOf(c) === rdns);

        let connector: Connector | undefined;

        if (inMiniApp) {
          const context = await sdk.context;
          if (cancelled) return;

          const clientFid = context?.client?.clientFid;

          if (clientFid === FARCASTER_CLIENT_FID) {
            connector = findById("farcasterMiniApp");
          } else if (clientFid === BASE_APP_CLIENT_FID) {
            connector = findById("baseAccount");
          } else {
            // Unknown host — try Farcaster first since the SDK runs there.
            connector =
              findById("farcasterMiniApp") ?? findById("baseAccount");
          }
        } else {
          // Base App's in-app browser: EIP-6963 announces Coinbase
          // Smart Wallet. The announce event arrives asynchronously
          // after page load, which is why we depend on `connectors` in
          // useEffect — when wagmi registers the discovered provider
          // the effect re-runs and we find it here.
          connector = findByRdns(COINBASE_WALLET_RDNS);
        }

        if (!connector) return;

        attempted.current = true;

        try {
          await connectAsync({ connector });
        } catch (err) {
          // wagmi's persisted `current` connector matches us but
          // `useAccount` hasn't been hydrated yet — finish the hydration
          // via reconnect instead of letting the error bubble to the UI.
          if (
            err instanceof Error &&
            (err.name === "ConnectorAlreadyConnectedError" ||
              err.message.toLowerCase().includes("already connected"))
          ) {
            try {
              await reconnectAsync({ connectors: [connector] });
            } catch {
              // If reconnect also fails the user falls through to the
              // sign-in screen; useConnect.error will surface there.
            }
          }
          // Other errors swallowed silently — non-host users won't
          // reach this branch anyway.
        }
      } catch {
        // Detecting the host can throw if the SDK is unreachable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    connectAsync,
    reconnectAsync,
    connectors,
    isConnected,
    isConnecting,
    isReconnecting,
  ]);

  return null;
}
