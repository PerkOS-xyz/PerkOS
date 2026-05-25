"use client";

/**
 * Alpha-only floating badge that surfaces the auth signals the rest of
 * the app uses to decide where to route the user. Visible on every
 * page so we can read it directly off the screen while debugging Base
 * App / Farcaster flows.
 *
 * Shows:
 *   - miniapp:    sdk.isInMiniApp() — null while resolving, then yes/no.
 *   - wallet :    wagmi isConnected.
 *   - session:    useWalletSession status.
 *   - cbWallet:   yes/no — is Coinbase Smart Wallet present via EIP-6963
 *                 (this is the signal that distinguishes Base App's
 *                 in-app browser from plain Safari).
 *   - conn   :    short list of wagmi connector ids the page currently
 *                 sees. Includes anything wagmi discovered via EIP-6963.
 *   - ua     :    last 36 chars of navigator.userAgent.
 *
 * Tap the "hide" button to collapse to a single status dot anchored
 * top-center: green when signed-in, amber while loading/syncing or
 * connect is in flight, rose otherwise. The minimised state persists
 * across page loads via localStorage.
 *
 * Remove or gate behind an env flag once the alpha auth flow stabilises.
 */

import { useEffect, useState } from "react";
import { useAccount, useConnect, useConnectors, type Connector } from "wagmi";

import { useIsInMiniApp } from "../lib/useIsInMiniApp";
import { useWalletSession } from "../lib/useWalletSession";

const COINBASE_WALLET_RDNS = "com.coinbase.wallet";
const STORAGE_KEY = "perkos:dev-auth-indicator:minimized";

function rdnsOf(connector: Connector): string | undefined {
  const c = connector as Connector & {
    rdns?: string;
    info?: { rdns?: string };
  };
  return c.rdns ?? c.info?.rdns;
}

function shortId(connector: Connector): string {
  // EIP-6963 connector ids are full rdns strings ("com.coinbase.wallet")
  // — trim them so the badge stays readable on mobile.
  const id = connector.id;
  return id.length > 20 ? id.slice(0, 18) + "…" : id;
}

export function DevAuthIndicator() {
  const isInMiniApp = useIsInMiniApp();
  const { isConnected } = useAccount();
  const session = useWalletSession();
  const connectors = useConnectors();
  const { isPending: isConnectPending, error: connectError } = useConnect();
  const [ua, setUa] = useState<string>("");
  const [minimized, setMinimized] = useState<boolean>(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      // Keep the full UA so we can spot the Base App / Coinbase
      // Wallet signature when debugging context detection. The
      // expanded badge wraps long strings, so length isn't an issue.
      setUa(navigator.userAgent);
    }
    if (typeof window !== "undefined") {
      try {
        setMinimized(window.localStorage.getItem(STORAGE_KEY) === "1");
      } catch {
        // localStorage unavailable (private mode / iframe) — stay expanded.
      }
    }
  }, []);

  const toggle = () => {
    setMinimized((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore — preference just won't persist this session.
      }
      return next;
    });
  };

  const hasCoinbaseWallet = connectors.some(
    (c) => c.id === COINBASE_WALLET_RDNS || rdnsOf(c) === COINBASE_WALLET_RDNS,
  );

  const miniappLabel =
    isInMiniApp === null ? "?" : isInMiniApp ? "yes" : "no";
  const miniappColor =
    isInMiniApp === null
      ? "text-amber-300"
      : isInMiniApp
        ? "text-emerald-300"
        : "text-rose-300";

  // Overall health for the collapsed dot: green when signed-in, amber
  // while loading/syncing or while a connect is in flight, rose otherwise.
  const dotColor =
    session.status === "signed-in"
      ? "bg-emerald-400"
      : session.status === "loading" ||
          session.status === "syncing" ||
          isConnectPending
        ? "bg-amber-400"
        : "bg-rose-400";

  if (minimized) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Show auth debug indicator"
        className="fixed left-1/2 top-2 z-[100] flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-primary/30 bg-black/70 shadow-lg backdrop-blur-sm"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
      </button>
    );
  }

  return (
    <div className="fixed left-1/2 top-2 z-[100] flex max-w-[260px] -translate-x-1/2 flex-col gap-0.5 rounded-md border border-primary/30 bg-black/70 px-2 py-1.5 font-mono text-[10px] leading-tight text-white shadow-lg backdrop-blur-sm">
      <button
        type="button"
        onClick={toggle}
        aria-label="Hide auth debug indicator"
        className="-mt-1 self-end rounded border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/70 hover:bg-white/10 hover:text-white"
      >
        hide
      </button>
      <span>
        miniapp: <span className={miniappColor}>{miniappLabel}</span>
      </span>
      <span>
        wallet:{" "}
        <span className={isConnected ? "text-emerald-300" : "text-rose-300"}>
          {isConnected ? "connected" : "off"}
        </span>
      </span>
      <span>
        session: <span className="text-primary">{session.status}</span>
      </span>
      <span>
        cbWallet:{" "}
        <span className={hasCoinbaseWallet ? "text-emerald-300" : "text-rose-300"}>
          {hasCoinbaseWallet ? "yes" : "no"}
        </span>
      </span>
      <span className="text-white/70">
        conn: {connectors.map(shortId).join(", ") || "—"}
      </span>
      {isConnectPending ? (
        <span className="text-amber-300">connecting…</span>
      ) : null}
      {connectError ? (
        <span
          className="text-rose-300"
          title={(connectError as Error).message}
        >
          err:{" "}
          {(connectError as Error).name ||
            (connectError as Error).message.slice(0, 30)}
        </span>
      ) : null}
      {ua ? (
        <span className="break-all text-[9px] leading-tight text-white/60">
          {ua}
        </span>
      ) : null}
    </div>
  );
}
