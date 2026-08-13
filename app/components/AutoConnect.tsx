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
 * Browser tabs — including Chrome with Coinbase Wallet installed and Base
 * App's in-app browser — never auto-connect. They must wait for an explicit
 * user gesture on a sign-in CTA. This prevents a wallet permission popup from
 * appearing merely because a visitor opened the public landing page.
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
} from "wagmi";
import { sdk } from "@farcaster/miniapp-sdk";

// Public host IDs. Stable per host app.
const FARCASTER_CLIENT_FID = 9152;
const BASE_APP_CLIENT_FID = 309857;

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

        // A browser-discovered extension is only a signal that a wallet is
        // available, never consent to connect it. Wallet access outside a
        // verified Mini App host must begin from an explicit user click.
        if (!inMiniApp) return;

        const findById = (id: string) =>
          connectors.find((c) => c.id === id);

        const context = await sdk.context;
        if (cancelled) return;

        const clientFid = context?.client?.clientFid;
        let connector;

        if (clientFid === FARCASTER_CLIENT_FID) {
          connector = findById("farcasterMiniApp");
        } else if (clientFid === BASE_APP_CLIENT_FID) {
          connector = findById("baseAccount");
        } else {
          // Unknown verified host — try Farcaster first since the SDK runs
          // there, then Base Account as the compatible fallback.
          connector =
            findById("farcasterMiniApp") ?? findById("baseAccount");
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
