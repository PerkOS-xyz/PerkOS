"use client";

/**
 * Auto-connect the right wallet when running inside a Mini App host.
 *
 * The Farcaster Mini App SDK exposes:
 *   - `sdk.isInMiniApp()` → boolean: are we inside any Mini App host?
 *   - `sdk.context.client.clientFid` → number: which host (Warpcast, Base
 *     App, etc.) is running us.
 *
 * In a plain browser tab `isInMiniApp` is false and we do nothing — the
 * user uses the sign-in page's "Connect" buttons as before.
 *
 * Inside a host:
 *   - Farcaster (clientFid 9152) → use the farcasterMiniApp connector,
 *     which picks up the user's pre-authorized Farcaster wallet.
 *   - Base App (clientFid 309857) → use baseAccount, which picks up the
 *     user's Base smart wallet.
 *   - Unknown host → try Farcaster first, then Base.
 *
 * This runs once per session. If the user disconnects manually we
 * respect that and don't fight them on the next render.
 *
 * Recovery from the "Connector already connected" trap
 * ----------------------------------------------------
 * wagmi v3 throws `ConnectorAlreadyConnectedError` from `connect()` when
 * the wagmi store has a `current` connector UID set, but `useAccount`
 * still reports `isConnected: false`. This happens after the host
 * restores a webview session: wagmi's persisted state is half-hydrated
 * — connector remembered, account not yet rehydrated — and our regular
 * `connect()` call races against the rehydration.
 *
 * Symptom (Base App, second open): sign-in page shows the buttons with
 * the error "Connector already connected." pinned underneath them. The
 * user is fully stuck.
 *
 * Fix: wait until `isReconnecting` is false before deciding anything,
 * use `connectAsync` so we can catch the error, and on that specific
 * error call `reconnectAsync` to finish the hydration cleanly instead
 * of surfacing the error to the UI.
 */

import { useEffect, useRef } from "react";
import { useAccount, useConnect, useConnectors, useReconnect } from "wagmi";
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
        if (cancelled || !inMiniApp) return;

        const context = await sdk.context;
        if (cancelled) return;

        const clientFid = context?.client?.clientFid;

        const findConnector = (id: string) =>
          connectors.find((c) => c.id === id);

        let connector;
        if (clientFid === FARCASTER_CLIENT_FID) {
          connector = findConnector("farcasterMiniApp");
        } else if (clientFid === BASE_APP_CLIENT_FID) {
          connector = findConnector("baseAccount");
        } else {
          // Unknown host — try Farcaster first since the SDK runs there,
          // then fall back to Base.
          connector =
            findConnector("farcasterMiniApp") ?? findConnector("baseAccount");
        }

        if (!connector) return;

        attempted.current = true;

        try {
          await connectAsync({ connector });
        } catch (err) {
          // wagmi's persisted `current` connector matches us but
          // `useAccount` hasn't been hydrated yet — finish the hydration
          // via reconnect instead of letting the error bubble to the
          // sign-in UI.
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
          // Other errors swallowed silently — non-MiniApp users won't
          // reach this branch anyway.
        }
      } catch {
        // Detecting the host can throw if the SDK is unreachable (e.g.
        // someone embeds the app in a non-mini-app iframe). Treat as
        // "not in a mini app" — the user will see the sign-in screen.
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
